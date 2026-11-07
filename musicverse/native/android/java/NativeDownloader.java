package __APP_ID__;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Pengunduh berkas native yang BISA MELANJUTKAN (resume), pengganti Filesystem.downloadFile milik Capacitor.
 *
 * Kenapa dibuat: Filesystem.downloadFile berjalan sekali jalan di dalam WebView tanpa Range. Begitu sinyal putus,
 * seluruh hasil terbuang (berkas .part dihapus lalu mulai dari 0) dan setelah beberapa kali gagal unduhan menyerah dengan
 * "Sinyal jelek". Pengunduh ini mengikuti sistem native StreamBeats (reqwest di Rust + berkas sementara + status tersimpan):
 *  - byte ditulis langsung ke berkas .part, dan HANYA bertambah; putus di tengah tidak membuang apa pun;
 *  - putus / timeout / 429 / 5xx -> tunggu jaringan kembali (NetWatch) lalu minta ulang mulai dari byte terakhir (Range);
 *  - ukuran total sumber dicatat di berkas `<tujuan>.meta`. Bila aplikasi dimatikan atau URL diganti (hasil resolve baru),
 *    unduhan lanjut dari .part HANYA jika ukuran total sumber baru sama; jika beda, mulai dari awal (tidak menyambung
 *    byte dari dua berkas yang berbeda);
 *  - header (User-Agent klien YouTube) dikirim langsung oleh native, tanpa perantara proxy;
 *  - berjalan di thread native, jadi tidak ikut tertahan saat WebView melambat di latar belakang / layar mati.
 */
public final class NativeDownloader {
  /** Potongan permintaan Range. YouTube membatasi laju untuk rentang besar, jadi diminta bertahap. */
  private static final int RANGE_CHUNK = 4 * 1024 * 1024;
  /** Gagal berturut-turut TANPA tambahan byte sebelum menyerah (JS masih bisa mencoba ulang dengan URL baru). */
  private static final int MAX_FAILS = 10;
  /** Lama maksimum menunggu jaringan kembali pada satu kali putus. */
  private static final long NET_WAIT_MS = 5 * 60_000L;
  private static final long REPORT_EVERY_MS = 250L;
  private static final Pattern CONTENT_RANGE = Pattern.compile("bytes\\s+(\\d+)-(\\d+)/(\\d+)");

  private static final Map<String, AtomicBoolean> CANCEL = new ConcurrentHashMap<>();

  private NativeDownloader() {}

  public interface Progress {
    void onProgress(String id, long bytes, long total);
  }

  public static final class Result {
    public final long bytes;
    public final long total;
    /** True bila unduhan menyambung dari byte yang sudah ada di .part. */
    public final boolean resumed;

    Result(long bytes, long total, boolean resumed) {
      this.bytes = bytes;
      this.total = total;
      this.resumed = resumed;
    }
  }

  /** code: CANCELLED | HTTP_<kode> | NETWORK | SOURCE_CHANGED | IO. HTTP_401/403/404/410 biasanya = URL kedaluwarsa: resolve ulang. */
  public static final class DownloadException extends IOException {
    public final String code;

    DownloadException(String code, String message) {
      super(message);
      this.code = code;
    }
  }

  private static final class UpstreamIOException extends IOException {
    UpstreamIOException(IOException cause) {
      super(cause);
    }
  }

  public static void cancel(String id) {
    AtomicBoolean flag = CANCEL.get(id);
    if (flag != null) flag.set(true);
  }

  /** Mengunduh `url` ke `dest` (blok sampai selesai / gagal). Dipanggil dari thread pekerja, bukan thread utama. */
  public static Result download(String id, String url, String userAgent, File dest, Progress progress) throws DownloadException {
    AtomicBoolean cancelled = new AtomicBoolean(false);
    CANCEL.put(id, cancelled);
    try {
      return run(id, url, userAgent, dest, progress, cancelled);
    } finally {
      CANCEL.remove(id, cancelled);
    }
  }

  private static DownloadException cancelledError() {
    return new DownloadException("CANCELLED", "Unduhan dibatalkan.");
  }

  private static Result run(String id, String url, String userAgent, File dest, Progress progress, AtomicBoolean cancelled)
      throws DownloadException {
    File parent = dest.getParentFile();
    if (parent != null && !parent.exists() && !parent.mkdirs() && !parent.exists()) {
      throw new DownloadException("IO", "Folder unduhan tidak bisa dibuat.");
    }
    File meta = new File(dest.getPath() + ".meta");

    long total = readMeta(meta);
    long have = dest.exists() ? dest.length() : 0;
    // Sisa .part tanpa catatan ukuran sumber tidak bisa diverifikasi: mulai dari awal.
    if (have > 0 && total <= 0) have = truncate(dest);
    if (total > 0 && have > total) have = truncate(dest);
    boolean resumed = have > 0;

    int fails = 0;
    boolean resetUsed = false;
    long lastReport = 0;
    if (progress != null && have > 0) progress.onProgress(id, have, total);

    while (true) {
      if (cancelled.get()) throw cancelledError();
      have = dest.exists() ? dest.length() : 0;
      if (total > 0 && have >= total) break;

      long startHave = have;
      long to = have + RANGE_CHUNK - 1;
      if (total > 0) to = Math.min(to, total - 1);
      long requested = to - have + 1;
      HttpURLConnection c = null;
      boolean finished = false;
      try {
        c = open(url, userAgent, have, to);
        int code = c.getResponseCode();

        if (code == 416) {
          if (total > 0 && have >= total) break;
          if (resetUsed) throw new DownloadException("HTTP_416", "Rentang ditolak sumber.");
          resetUsed = true;
          have = truncate(dest);
          total = -1;
          deleteQuietly(meta);
          continue;
        }
        if (code != 200 && code != 206) {
          if (code == 429 || code >= 500) throw new IOException("HTTP " + code);
          throw new DownloadException("HTTP_" + code, "Sumber menolak unduhan (HTTP " + code + ").");
        }

        long serverTotal = -1;
        if (code == 206) {
          String header = c.getHeaderField("Content-Range");
          Matcher m = CONTENT_RANGE.matcher(header == null ? "" : header);
          if (m.find()) serverTotal = Long.parseLong(m.group(3));
        } else {
          // Sumber mengabaikan Range dan mengirim seluruh berkas: tulis ulang dari awal.
          serverTotal = c.getContentLengthLong();
          if (have > 0) have = truncate(dest);
        }

        if (serverTotal > 0 && total > 0 && serverTotal != total) {
          // Berkas di sumber berbeda dari yang tadi diunduh sebagian (mis. format lain): jangan menyambung dua berkas berbeda.
          if (resetUsed) throw new DownloadException("SOURCE_CHANGED", "Ukuran berkas di sumber berubah.");
          resetUsed = true;
          have = truncate(dest);
          total = serverTotal;
          writeMeta(meta, total);
          continue;
        }
        if (serverTotal > 0 && total <= 0) {
          total = serverTotal;
          writeMeta(meta, total);
        }

        long chunkBytes = 0;
        try (InputStream in = c.getInputStream(); FileOutputStream out = new FileOutputStream(dest, true)) {
          byte[] buf = new byte[32 * 1024];
          while (true) {
            if (cancelled.get()) throw cancelledError();
            int n;
            try {
              n = in.read(buf);
            } catch (IOException e) {
              throw new UpstreamIOException(e);
            }
            if (n < 0) break;
            out.write(buf, 0, n);
            have += n;
            chunkBytes += n;
            fails = 0; // ada kemajuan
            long now = System.currentTimeMillis();
            if (progress != null && now - lastReport >= REPORT_EVERY_MS) {
              lastReport = now;
              progress.onProgress(id, have, total);
            }
          }
        }

        if (code == 200) {
          if (total > 0 && have < total) throw new IOException("Unduhan terpotong (" + have + " dari " + total + " byte).");
          finished = true;
        } else if (total <= 0 && chunkBytes < requested) {
          finished = true; // total tidak diketahui: potongan lebih pendek dari yang diminta = ujung berkas
        }
      } catch (DownloadException e) {
        throw e;
      } catch (IOException e) {
        if (cancelled.get()) throw cancelledError();
        long now = dest.exists() ? dest.length() : 0;
        if (now > startHave) fails = 0;
        fails += 1;
        if (fails > MAX_FAILS) throw new DownloadException("NETWORK", "Koneksi terus terputus: " + e.getMessage());
        // Hasil yang sudah masuk tetap di .part; tunggu jaringan lalu lanjut dari byte terakhir.
        if (!NetWatch.waitForNetwork(NET_WAIT_MS)) throw new DownloadException("NETWORK", "Tidak ada jaringan.");
        if (!NetWatch.backoff(fails)) throw cancelledError();
        continue;
      } finally {
        if (c != null) c.disconnect();
      }
      if (finished) break;
    }

    long size = dest.exists() ? dest.length() : 0;
    if (progress != null) progress.onProgress(id, size, total > 0 ? total : size);
    deleteQuietly(meta);
    return new Result(size, total > 0 ? total : size, resumed);
  }

  private static HttpURLConnection open(String url, String userAgent, long from, long to) throws IOException {
    HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
    c.setConnectTimeout(10_000);
    c.setReadTimeout(20_000);
    c.setInstanceFollowRedirects(true);
    if (userAgent != null && !userAgent.isEmpty()) c.setRequestProperty("User-Agent", userAgent);
    c.setRequestProperty("Accept", "*/*");
    // Tanpa gzip: kompresi mengubah Content-Length dan membuat Range tidak bisa dipercaya.
    c.setRequestProperty("Accept-Encoding", "identity");
    c.setRequestProperty("Range", "bytes=" + from + "-" + to);
    return c;
  }

  private static long truncate(File file) throws DownloadException {
    try (FileOutputStream f = new FileOutputStream(file, false)) {
      return 0;
    } catch (IOException e) {
      throw new DownloadException("IO", "Berkas sementara tidak bisa ditulis: " + e.getMessage());
    }
  }

  private static long readMeta(File meta) {
    try {
      if (!meta.exists()) return -1;
      String text = new String(Files.readAllBytes(meta.toPath()), StandardCharsets.UTF_8).trim();
      return Long.parseLong(text);
    } catch (IOException | NumberFormatException e) {
      return -1;
    }
  }

  private static void writeMeta(File meta, long total) {
    try {
      Files.write(meta.toPath(), String.valueOf(total).getBytes(StandardCharsets.UTF_8));
    } catch (IOException ignored) {
      // Tanpa catatan, sisa .part tidak akan disambung pada percobaan berikutnya (aman: mulai dari awal).
    }
  }

  private static void deleteQuietly(File file) {
    try {
      if (file.exists() && !file.delete()) file.deleteOnExit();
    } catch (RuntimeException ignored) {
      // abaikan
    }
  }
}
