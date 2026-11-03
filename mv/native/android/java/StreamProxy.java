package __APP_ID__;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Iterator;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Proxy HTTP lokal (hanya 127.0.0.1) agar elemen <audio> di WebView bisa memutar stream yang
 * mensyaratkan header khusus (mis. User-Agent klien Android/iOS YouTube). WebView tidak bisa mengirim
 * header itu; proxy ini yang mengirimnya, persis seperti mpv di StreamBeats.
 *
 * Alur: JS mendaftarkan (url, userAgent) -> dapat URL lokal ber-token. <audio> meminta URL lokal dengan
 * header Range; proxy meneruskannya ke sumber dalam potongan <= 1 MB (sumber tertentu menolak Range
 * tak terbatas) dan menyalurkan balik sebagai respons 206 yang bisa di-seek.
 *
 * TAHAN PUTUS (v0.3.7): bila sumber putus / jaringan hilang di tengah lagu, proxy TIDAK menutup koneksi ke
 * <audio> (yang sebelumnya langsung menjadi MEDIA_ERR_NETWORK). Proxy menunggu jaringan kembali lalu
 * meminta ulang sisa lagu dari byte terakhir yang sudah terkirim, sehingga pemutar hanya terlihat buffering.
 * Sama seperti opsi reconnect pada mpv di StreamBeats.
 */
public final class StreamProxy {
  private static final int CHUNK = 1024 * 1024;
  private static final int MAX_SOURCES = 200;
  /** Gagal berturut-turut TANPA kemajuan sebelum proxy menyerah dan menutup koneksi ke <audio>. */
  private static final int MAX_FAILS = 8;
  /** Lama maksimum menunggu jaringan kembali pada satu kali putus. */
  private static final long NET_WAIT_MS = 90_000L;
  private static final Pattern RANGE = Pattern.compile("bytes=(\\d*)-(\\d*)");
  private static final Pattern CONTENT_RANGE = Pattern.compile("bytes\\s+(\\d+)-(\\d+)/(\\d+)");

  private static StreamProxy instance;

  private static final class Source {
    final String url;
    final String userAgent;
    final long createdAt = System.currentTimeMillis();

    Source(String url, String userAgent) {
      this.url = url;
      this.userAgent = userAgent;
    }
  }

  /** Sumber membalas kode HTTP yang tidak layak dicoba ulang (mis. 403/404/410: URL kedaluwarsa atau ditolak). */
  private static final class HttpStatusException extends IOException {
    final int code;

    HttpStatusException(int code) {
      super("HTTP " + code);
      this.code = code;
    }
  }

  /** Pembacaan dari SUMBER gagal (beda dengan gagal menulis ke <audio>, yang berarti pemutar menutup koneksi). */
  private static final class UpstreamIOException extends IOException {
    UpstreamIOException(IOException cause) {
      super(cause);
    }
  }

  private final Map<String, Source> sources = new ConcurrentHashMap<>();
  private final ExecutorService pool = Executors.newCachedThreadPool();
  private ServerSocket server;

  public static synchronized StreamProxy get() throws IOException {
    if (instance == null) {
      StreamProxy proxy = new StreamProxy();
      proxy.start();
      instance = proxy;
    }
    return instance;
  }

  private void start() throws IOException {
    server = new ServerSocket(0, 50, InetAddress.getByName("127.0.0.1"));
    Thread acceptor =
        new Thread(
            () -> {
              while (!server.isClosed()) {
                try {
                  final Socket socket = server.accept();
                  pool.execute(() -> handle(socket));
                } catch (IOException e) {
                  break;
                }
              }
            },
            "mv-stream-proxy");
    acceptor.setDaemon(true);
    acceptor.start();
  }

  public int port() {
    return server.getLocalPort();
  }

  /** Mendaftarkan sumber; mengembalikan URL lokal untuk <audio>. */
  public String register(String url, String userAgent) {
    if (sources.size() >= MAX_SOURCES) {
      Iterator<Map.Entry<String, Source>> it = sources.entrySet().iterator();
      long cutoff = System.currentTimeMillis() - 30 * 60_000L;
      while (it.hasNext()) if (it.next().getValue().createdAt < cutoff) it.remove();
      if (sources.size() >= MAX_SOURCES) sources.clear();
    }
    String token = UUID.randomUUID().toString().replace("-", "");
    sources.put(token, new Source(url, userAgent == null ? "" : userAgent));
    return "http://127.0.0.1:" + port() + "/s/" + token;
  }

  /* ---------------- penanganan satu koneksi ---------------- */

  private static String readLine(InputStream in) throws IOException {
    StringBuilder sb = new StringBuilder();
    int c;
    while ((c = in.read()) != -1) {
      if (c == '\n') break;
      if (c != '\r') sb.append((char) c);
      if (sb.length() > 16 * 1024) throw new IOException("header terlalu panjang");
    }
    return c == -1 && sb.length() == 0 ? null : sb.toString();
  }

  private static void writeHead(OutputStream out, int code, String reason, String... headers) throws IOException {
    StringBuilder sb = new StringBuilder("HTTP/1.1 ").append(code).append(' ').append(reason).append("\r\n");
    for (String h : headers) sb.append(h).append("\r\n");
    // CORS: dibutuhkan equalizer (Web Audio) agar elemen <audio crossorigin> boleh membaca audio dari proxy lokal ini.
    sb.append("Access-Control-Allow-Origin: *\r\n");
    sb.append("Access-Control-Expose-Headers: Content-Length, Content-Range, Accept-Ranges\r\n");
    sb.append("Connection: close\r\n\r\n");
    out.write(sb.toString().getBytes(StandardCharsets.ISO_8859_1));
    out.flush();
  }

  private HttpURLConnection open(Source src, long from, long to) throws IOException {
    HttpURLConnection c = (HttpURLConnection) new URL(src.url).openConnection();
    c.setConnectTimeout(8000);
    c.setReadTimeout(15000);
    c.setInstanceFollowRedirects(true);
    if (!src.userAgent.isEmpty()) c.setRequestProperty("User-Agent", src.userAgent);
    c.setRequestProperty("Accept", "*/*");
    c.setRequestProperty("Range", "bytes=" + from + "-" + to);
    return c;
  }

  /**
   * Membuka permintaan Range ke sumber dan mengembalikan koneksi berstatus 200/206. Gangguan jaringan dan 429/5xx dicoba
   * ulang (menunggu jaringan kembali); 4xx lain (URL kedaluwarsa / ditolak) langsung dilempar sebagai HttpStatusException.
   */
  private HttpURLConnection openOk(Source src, long from, long to) throws IOException {
    IOException last = null;
    for (int attempt = 1; attempt <= MAX_FAILS; attempt += 1) {
      HttpURLConnection c = null;
      try {
        c = open(src, from, to);
        int code = c.getResponseCode();
        if (code == 200 || code == 206) return c;
        c.disconnect();
        if (code == 429 || code >= 500) last = new IOException("HTTP " + code);
        else throw new HttpStatusException(code);
      } catch (HttpStatusException e) {
        throw e;
      } catch (IOException e) {
        if (c != null) c.disconnect();
        last = e;
      }
      if (!NetWatch.waitForNetwork(NET_WAIT_MS)) break;
      if (!NetWatch.backoff(attempt)) break;
    }
    throw last != null ? last : new IOException("sumber tidak terjangkau");
  }

  /**
   * Menyalin paling banyak `limit` byte dan mencatat jumlah yang SUDAH terkirim di done[0] (juga saat gagal di tengah).
   * UpstreamIOException = sumber putus (boleh dilanjutkan); IOException biasa = <audio> menutup koneksi (seek / ganti lagu).
   */
  private static void copy(InputStream in, OutputStream out, long limit, long[] done) throws IOException {
    byte[] buf = new byte[16 * 1024];
    while (done[0] < limit) {
      int n;
      try {
        n = in.read(buf, 0, (int) Math.min(buf.length, limit - done[0]));
      } catch (IOException e) {
        throw new UpstreamIOException(e);
      }
      if (n < 0) break;
      out.write(buf, 0, n);
      done[0] += n;
    }
    out.flush();
  }

  private void handle(Socket socket) {
    HttpURLConnection c = null;
    try (Socket s = socket) {
      s.setSoTimeout(30_000);
      InputStream rawIn = new BufferedInputStream(s.getInputStream());
      OutputStream out = new BufferedOutputStream(s.getOutputStream(), 32 * 1024);

      String request = readLine(rawIn);
      if (request == null) return;
      String[] parts = request.split(" ");
      String rangeHeader = null;
      for (String line = readLine(rawIn); line != null && !line.isEmpty(); line = readLine(rawIn)) {
        if (line.regionMatches(true, 0, "range:", 0, 6)) rangeHeader = line.substring(6).trim();
      }
      if (parts.length < 2 || !parts[1].startsWith("/s/")) {
        writeHead(out, 404, "Not Found", "Content-Length: 0");
        return;
      }
      String method = parts[0];
      Source src = sources.get(parts[1].substring(3));
      if (src == null) {
        writeHead(out, 404, "Not Found", "Content-Length: 0");
        return;
      }

      long start = 0;
      long reqEnd = -1;
      boolean hadRange = false;
      if (rangeHeader != null) {
        Matcher m = RANGE.matcher(rangeHeader);
        if (m.find() && !m.group(1).isEmpty()) {
          hadRange = true;
          start = Long.parseLong(m.group(1));
          if (!m.group(2).isEmpty()) reqEnd = Long.parseLong(m.group(2));
        }
      }

      long pos = start;
      long firstTo = reqEnd >= 0 ? Math.min(reqEnd, pos + CHUNK - 1) : pos + CHUNK - 1;
      try {
        c = openOk(src, pos, firstTo);
      } catch (HttpStatusException e) {
        writeHead(out, e.code, "Upstream Error", "Content-Length: 0");
        return;
      } catch (IOException e) {
        writeHead(out, 502, "Bad Gateway", "Content-Length: 0");
        return;
      }

      int code = c.getResponseCode();
      String type = c.getContentType() != null ? c.getContentType() : "audio/mp4";
      long total = -1;
      if (code == 206) {
        Matcher m = CONTENT_RANGE.matcher(c.getHeaderField("Content-Range") == null ? "" : c.getHeaderField("Content-Range"));
        if (m.find()) total = Long.parseLong(m.group(3));
      } else {
        total = c.getContentLengthLong(); // sumber mengabaikan Range: seluruh berkas
      }
      InputStream body = c.getInputStream();
      if (code == 200 && start > 0) {
        long skipped = 0;
        while (skipped < start) {
          long n = body.skip(start - skipped);
          if (n <= 0) break;
          skipped += n;
        }
      }

      if (total <= 0) {
        // Panjang tak diketahui: salurkan apa adanya sampai habis (tanpa seek dan tanpa sambung-ulang).
        writeHead(out, 200, "OK", "Content-Type: " + type, "Accept-Ranges: none");
        if (!"HEAD".equals(method)) copy(body, out, Long.MAX_VALUE, new long[1]);
        return;
      }
      long endFinal = reqEnd >= 0 ? Math.min(reqEnd, total - 1) : total - 1;
      if (start > endFinal) {
        writeHead(out, 416, "Range Not Satisfiable", "Content-Range: bytes */" + total, "Content-Length: 0");
        return;
      }
      long length = endFinal - start + 1;
      if (hadRange) {
        writeHead(
            out, 206, "Partial Content",
            "Content-Type: " + type, "Accept-Ranges: bytes",
            "Content-Range: bytes " + start + "-" + endFinal + "/" + total,
            "Content-Length: " + length);
      } else {
        writeHead(out, 200, "OK", "Content-Type: " + type, "Accept-Ranges: bytes", "Content-Length: " + length);
      }
      if ("HEAD".equals(method)) return;

      // Potongan pertama sudah terbuka; sisanya diminta berurutan sampai ujung rentang. Putus di tengah potongan
      // atau antar potongan: tunggu jaringan, lalu sambung dari byte terakhir yang sudah terkirim.
      long remaining = length;
      int fails = 0;
      while (remaining > 0) {
        if (body == null) {
          try {
            c = openOk(src, pos, Math.min(endFinal, pos + CHUNK - 1));
            int nextCode = c.getResponseCode();
            if (nextCode != 206) {
              c.disconnect();
              throw new IOException("potongan berikutnya ditolak: " + nextCode);
            }
            body = c.getInputStream();
          } catch (HttpStatusException e) {
            throw e;
          } catch (IOException e) {
            if (++fails > MAX_FAILS || !NetWatch.waitForNetwork(NET_WAIT_MS)) throw e;
            if (!NetWatch.backoff(fails)) throw e;
            continue;
          }
        }
        long[] done = new long[1];
        try {
          copy(body, out, remaining, done);
        } catch (UpstreamIOException e) {
          // Sumber putus: byte yang sudah terkirim tetap dihitung (done[0]); sisanya diminta ulang di putaran berikut.
        }
        remaining -= done[0];
        pos += done[0];
        c.disconnect();
        body = null;
        if (done[0] > 0) {
          fails = 0;
        } else if (remaining > 0) {
          if (++fails > MAX_FAILS) throw new IOException("sumber putus berulang");
          if (!NetWatch.waitForNetwork(NET_WAIT_MS)) throw new IOException("tidak ada jaringan");
          if (!NetWatch.backoff(fails)) throw new IOException("dihentikan");
        }
      }
      out.flush();
    } catch (Exception ignored) {
      // <audio> menutup koneksi (seek / ganti lagu), atau sumber menyerah setelah semua percobaan: cukup ditutup.
    } finally {
      if (c != null) c.disconnect();
    }
  }
}
