package __APP_ID__;

import android.content.Context;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Pengambil stream YouTube NATIVE: padanan `getStreams` plugin `ytmusic` / `ytvideo` di JS (`src/plugins/ytmusic.ts`).
 * Dipakai saat JS mati / beku dan sebuah lagu butuh link BARU untuk id video yang sudah diketahui (mis. link unduhan
 * ditolak atau kedaluwarsa). Pencarian mentah (`searchSongs` / `searchVideos`) ada di sini; pemilihan kandidat (judul +
 * artis + durasi -> id video) ada di `YtMatcher`.
 *
 * Urutan klien sama dengan JS: VISIONOS, ANDROID_VR, ANDROID (tanpa androidSdkVersion), IOS. Semuanya mengembalikan URL
 * langsung tanpa cipher dan tanpa PO token. Klien yang URL-nya baru ditolak server video dilewati 10 menit (`markRejected`).
 * Hanya audio dengan URL langsung; MP4/AAC dulu, lalu bitrate tertinggi. Pilihan kualitas pengguna (JS) tidak dibawa:
 * native memakai urutan bawaan itu.
 */
final class YtResolver {
  /** Satu stream audio hasil resolve. `userAgent` = klien yang menghasilkannya (sumber menuntut header yang sama). */
  static final class Stream {
    final String url;
    final String userAgent;
    final long bitrate;
    final String mime;
    /** Epoch ms URL kedaluwarsa; 0 = tidak diketahui. */
    final long expiresAt;
    final double loudnessDb;
    /** Durasi audio (detik) menurut YouTube (`approxDurationMs`, cadangan `lengthSeconds`); 0 = tidak diketahui. */
    final double durationSec;

    Stream(String url, String userAgent, long bitrate, String mime, long expiresAt, double loudnessDb, double durationSec) {
      this.url = url;
      this.userAgent = userAgent;
      this.bitrate = bitrate;
      this.mime = mime;
      this.expiresAt = expiresAt;
      this.loudnessDb = loudnessDb;
      this.durationSec = durationSec;
    }
  }

  private static final String PLAYER_URL = "https://www.youtube.com/youtubei/v1/player?prettyPrint=false";
  private static final String VISITOR_URL = "https://www.youtube.com/sw.js_data";
  private static final String VISITOR_UA = "com.google.android.youtube/20.10.38 (Linux; U; ANDROID 11)";
  private static final String PREFS = "mv_yt_resolver";
  private static final String PREF_VISITOR = "visitor";
  private static final long REJECT_PAUSE_MS = 10L * 60_000L;
  private static final int CONNECT_MS = 10_000;
  private static final int READ_MS = 15_000;

  private static final class Client {
    final String name;
    final String id;
    final String version;
    final String ua;
    final JSONObject context;

    Client(String name, String id, String version, String ua, JSONObject context) {
      this.name = name;
      this.id = id;
      this.version = version;
      this.ua = ua;
      this.context = context;
    }
  }

  private static final List<Client> CLIENTS = new ArrayList<>();

  static {
    try {
      CLIENTS.add(new Client("VISIONOS", "101", "1.02",
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15",
          new JSONObject().put("deviceMake", "Apple").put("deviceModel", "RealityDevice17,1").put("osName", "visionOS").put("osVersion", "26.5.23O471")));
      CLIENTS.add(new Client("ANDROID_VR", "28", "1.65.10",
          "com.google.android.apps.youtube.vr.oculus/1.65.10 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip",
          new JSONObject().put("deviceMake", "Oculus").put("deviceModel", "Quest 3").put("androidSdkVersion", 32).put("osName", "Android").put("osVersion", "12L")));
      CLIENTS.add(new Client("ANDROID", "3", "20.10.38", "com.google.android.youtube/20.10.38 (Linux; U; Android 11) gzip",
          new JSONObject().put("osName", "Android").put("osVersion", "11")));
      CLIENTS.add(new Client("IOS", "5", "20.10.4", "com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)",
          new JSONObject().put("deviceMake", "Apple").put("deviceModel", "iPhone16,2").put("osName", "iOS").put("osVersion", "18.3.2.22D82")));
    } catch (JSONException e) {
      throw new IllegalStateException(e);
    }
  }

  /** User-Agent klien -> epoch ms sampai kapan dilewati. */
  private static final Map<String, Long> REJECTED_UNTIL = new HashMap<>();
  private static String visitorData = null;

  private YtResolver() {}

  /** URL stream klien ini baru ditolak server video (HTTP 401/403/410): lewati 10 menit supaya resolve berikutnya pindah klien. */
  static void markRejected(String userAgent) {
    if (userAgent == null || userAgent.isEmpty()) return;
    for (Client c : CLIENTS) {
      if (c.ua.equals(userAgent)) {
        synchronized (REJECTED_UNTIL) {
          REJECTED_UNTIL.put(userAgent, System.currentTimeMillis() + REJECT_PAUSE_MS);
        }
        return;
      }
    }
  }

  private static List<Client> orderedClients() {
    long now = System.currentTimeMillis();
    List<Client> usable = new ArrayList<>();
    List<Client> paused = new ArrayList<>();
    synchronized (REJECTED_UNTIL) {
      for (Client c : CLIENTS) {
        Long until = REJECTED_UNTIL.get(c.ua);
        if (until != null && until > now) paused.add(c);
        else usable.add(c);
      }
    }
    usable.addAll(paused);
    return usable;
  }

  /**
   * Stream audio untuk satu id video YouTube, terbaik dulu. Mencoba klien berurutan sampai ada yang memberi stream.
   * Melempar IOException bila semuanya gagal (pesan = galat klien terakhir).
   */
  static List<Stream> getStreams(Context context, String videoId) throws IOException {
    if (videoId == null || videoId.isEmpty()) throw new IOException("Id video kosong.");
    String visitor = loadVisitor(context);
    if (visitor == null) visitor = fetchVisitor(context);
    IOException last = new IOException("Tidak ada stream audio.");
    boolean first = true;
    for (Client client : orderedClients()) {
      try {
        List<Stream> streams = playerStreams(client, videoId, visitor);
        if (!streams.isEmpty()) return streams;
      } catch (IOException e) {
        last = e;
        // Gagal pada klien pertama biasanya karena visitorData basi: ambil ulang sekali.
        if (first) {
          String fresh = fetchVisitor(context);
          if (fresh != null) visitor = fresh;
        }
      }
      first = false;
    }
    throw last;
  }

  private static List<Stream> playerStreams(Client client, String videoId, String visitor) throws IOException {
    JSONObject data;
    try {
      JSONObject clientCtx = new JSONObject();
      clientCtx.put("clientName", client.name);
      clientCtx.put("clientVersion", client.version);
      clientCtx.put("userAgent", client.ua);
      clientCtx.put("hl", "en");
      clientCtx.put("gl", "US");
      clientCtx.put("utcOffsetMinutes", 0);
      JSONArray names = client.context.names();
      for (int i = 0; names != null && i < names.length(); i++) {
        String k = names.getString(i);
        clientCtx.put(k, client.context.get(k));
      }
      if (visitor != null) clientCtx.put("visitorData", visitor);
      JSONObject body = new JSONObject();
      body.put("context", new JSONObject().put("client", clientCtx));
      body.put("videoId", videoId);
      body.put("playbackContext", new JSONObject().put("contentPlaybackContext", new JSONObject().put("html5Preference", "HTML5_PREF_WANTS")));
      body.put("contentCheckOk", true);
      body.put("racyCheckOk", true);
      Map<String, String> headers = new HashMap<>();
      headers.put("Content-Type", "application/json");
      headers.put("User-Agent", client.ua);
      headers.put("X-YouTube-Client-Name", client.id);
      headers.put("X-YouTube-Client-Version", client.version);
      if (visitor != null) headers.put("X-Goog-Visitor-Id", visitor);
      data = new JSONObject(postJson(PLAYER_URL, headers, body.toString()));
    } catch (JSONException e) {
      throw new IOException(client.name + ": respons tidak terbaca");
    }
    JSONObject playability = data.optJSONObject("playabilityStatus");
    String status = playability == null ? "?" : playability.optString("status", "?");
    if (!"OK".equals(status)) {
      String reason = playability == null ? "" : playability.optString("reason", "");
      throw new IOException((client.name + ": " + status + " " + reason).trim());
    }
    List<JSONObject> formats = new ArrayList<>();
    JSONObject streaming = data.optJSONObject("streamingData");
    if (streaming != null) {
      addAll(formats, streaming.optJSONArray("adaptiveFormats"));
      addAll(formats, streaming.optJSONArray("formats"));
    }
    double configLoud = Double.NaN;
    JSONObject playerConfig = data.optJSONObject("playerConfig");
    JSONObject audioConfig = playerConfig == null ? null : playerConfig.optJSONObject("audioConfig");
    if (audioConfig != null && audioConfig.has("loudnessDb")) configLoud = audioConfig.optDouble("loudnessDb", Double.NaN);
    JSONObject details = data.optJSONObject("videoDetails");
    double lengthSec = details == null ? 0 : details.optDouble("lengthSeconds", 0);
    if (Double.isNaN(lengthSec) || lengthSec < 0) lengthSec = 0;
    List<Stream> out = new ArrayList<>();
    for (JSONObject f : formats) {
      String mime = f.optString("mimeType", "");
      String url = f.optString("url", "");
      // Hanya audio dengan URL langsung (tanpa signatureCipher).
      if (!mime.startsWith("audio/") || url.isEmpty()) continue;
      long expiresAt = 0;
      int at = url.indexOf("expire=");
      if (at >= 0) {
        int end = url.indexOf('&', at);
        String num = url.substring(at + 7, end < 0 ? url.length() : end);
        try {
          long expire = Long.parseLong(num);
          if (expire > 0) expiresAt = expire * 1000L;
        } catch (NumberFormatException ignored) {
          // biarkan 0
        }
      }
      double formatLoud = f.has("loudnessDb") ? f.optDouble("loudnessDb", Double.NaN) : Double.NaN;
      double loud = !Double.isNaN(configLoud) ? configLoud : formatLoud;
      long approxMs = f.optLong("approxDurationMs", 0);
      double durationSec = approxMs > 0 ? approxMs / 1000.0 : lengthSec;
      out.add(new Stream(url, client.ua, f.optLong("bitrate", 0), mime, expiresAt, loud, durationSec));
    }
    // MP4/AAC dulu (seek paling andal), lalu bitrate tertinggi.
    Collections.sort(out, (a, b) -> {
      int am = a.mime.contains("mp4") ? 1 : 0;
      int bm = b.mime.contains("mp4") ? 1 : 0;
      if (am != bm) return bm - am;
      return Long.compare(b.bitrate, a.bitrate);
    });
    return out;
  }

  /* ---------------- pencarian ---------------- */

  private static final String MUSIC_SEARCH_URL = "https://music.youtube.com/youtubei/v1/search?key=AIzaSyC9XL3ZjWddXya6X74dJoCTL-WEYFDNX30&prettyPrint=false";
  private static final String VIDEO_SEARCH_URL = "https://www.youtube.com/youtubei/v1/search?alt=json&key=AIzaSyC9XL3ZjWddXya6X74dJoCTL-WEYFDNX30";
  private static final String MUSIC_WEB_VERSION = "1.20260222.01.00";
  private static final String VIDEO_WEB_VERSION = "2.20260222.01.00";
  private static final String WEB_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";
  /** Filter "Songs" YouTube Music dan "Videos" YouTube (sama dengan `ytmusic.ts` / `ytvideo.ts`). */
  private static final String SONGS_PARAMS = "EgWKAQIIAWoMEA4QChADEAQQCRAF";
  private static final String VIDEOS_PARAMS = "EgIQAQ%3D%3D";
  private static final int MAX_HITS = 8;
  private static final java.util.regex.Pattern CLOCK = java.util.regex.Pattern.compile("^(?:(\\d+):)?(\\d{1,2}):(\\d{2})$");

  /** Pencarian YouTube Music, filter Songs (padanan `search` di `ytmusic.ts`). Melempar IOException bila jaringan/respons gagal. */
  static List<TrackMatch.Hit> searchSongs(String query) throws IOException {
    try {
      JSONObject client = new JSONObject().put("clientName", "WEB_REMIX").put("clientVersion", MUSIC_WEB_VERSION).put("hl", "en").put("gl", "US");
      JSONObject body = new JSONObject().put("context", new JSONObject().put("client", client)).put("query", query).put("params", SONGS_PARAMS);
      Map<String, String> headers = new HashMap<>();
      headers.put("Content-Type", "application/json");
      headers.put("Origin", "https://music.youtube.com");
      headers.put("User-Agent", WEB_UA);
      Object root = new org.json.JSONTokener(postJson(MUSIC_SEARCH_URL, headers, body.toString())).nextValue();
      List<JSONObject> items = new ArrayList<>();
      collect(root, "musicResponsiveListItemRenderer", items);
      List<TrackMatch.Hit> out = new ArrayList<>();
      for (JSONObject r : items) {
        TrackMatch.Hit hit = songHit(r);
        if (hit != null) out.add(hit);
        if (out.size() >= MAX_HITS) break;
      }
      return out;
    } catch (JSONException e) {
      throw new IOException("Pencarian: respons tidak terbaca");
    }
  }

  /** Pencarian YouTube, filter Videos (padanan `search` di `ytvideo.ts`). */
  static List<TrackMatch.Hit> searchVideos(String query) throws IOException {
    try {
      JSONObject client = new JSONObject().put("clientName", "WEB").put("clientVersion", VIDEO_WEB_VERSION).put("hl", "en").put("gl", "US");
      JSONObject body = new JSONObject().put("context", new JSONObject().put("client", client)).put("query", query).put("params", VIDEOS_PARAMS);
      Map<String, String> headers = new HashMap<>();
      headers.put("Content-Type", "application/json");
      headers.put("User-Agent", WEB_UA);
      headers.put("Origin", "https://www.youtube.com");
      headers.put("Referer", "https://www.youtube.com/");
      Object root = new org.json.JSONTokener(postJson(VIDEO_SEARCH_URL, headers, body.toString())).nextValue();
      List<JSONObject> items = new ArrayList<>();
      collect(root, "videoRenderer", items);
      List<TrackMatch.Hit> out = new ArrayList<>();
      for (JSONObject r : items) {
        TrackMatch.Hit hit = videoHit(r);
        if (hit != null) out.add(hit);
        if (out.size() >= MAX_HITS) break;
      }
      return out;
    } catch (JSONException e) {
      throw new IOException("Pencarian: respons tidak terbaca");
    }
  }

  /** Mengumpulkan semua objek di bawah kunci `key` (jangan turun lagi ke dalam yang sudah ketemu), urutan dokumen. */
  private static void collect(Object node, String key, List<JSONObject> out) {
    if (node instanceof JSONArray) {
      JSONArray arr = (JSONArray) node;
      for (int i = 0; i < arr.length(); i++) collect(arr.opt(i), key, out);
    } else if (node instanceof JSONObject) {
      JSONObject obj = (JSONObject) node;
      JSONObject found = obj.optJSONObject(key);
      if (found != null) {
        out.add(found);
        return;
      }
      JSONArray names = obj.names();
      for (int i = 0; names != null && i < names.length(); i++) collect(obj.opt(names.optString(i)), key, out);
    }
  }

  private static JSONObject path(JSONObject root, String... keys) {
    JSONObject cur = root;
    for (String k : keys) {
      if (cur == null) return null;
      cur = cur.optJSONObject(k);
    }
    return cur;
  }

  private static Double parseClock(String text) {
    java.util.regex.Matcher m = CLOCK.matcher(text.trim());
    if (!m.matches()) return null;
    long h = m.group(1) == null ? 0 : Long.parseLong(m.group(1));
    return (double) (h * 3600 + Long.parseLong(m.group(2)) * 60 + Long.parseLong(m.group(3)));
  }

  private static String lastThumb(JSONObject holder) {
    JSONArray thumbs = holder == null ? null : holder.optJSONArray("thumbnails");
    if (thumbs == null || thumbs.length() == 0) return "";
    JSONObject t = thumbs.optJSONObject(thumbs.length() - 1);
    return t == null ? "" : t.optString("url", "");
  }

  private static String joinRuns(JSONArray flex, int index) {
    JSONObject col = flex == null ? null : flex.optJSONObject(index);
    JSONObject text = path(col, "musicResponsiveListItemFlexColumnRenderer", "text");
    JSONArray runs = text == null ? null : text.optJSONArray("runs");
    StringBuilder sb = new StringBuilder();
    for (int i = 0; runs != null && i < runs.length(); i++) {
      JSONObject run = runs.optJSONObject(i);
      if (run != null) sb.append(run.optString("text", ""));
    }
    return sb.toString();
  }

  private static TrackMatch.Hit songHit(JSONObject r) {
    String id = "";
    JSONObject item = r.optJSONObject("playlistItemData");
    if (item != null) id = item.optString("videoId", "");
    if (id.isEmpty()) {
      JSONObject watch = path(r, "overlay", "musicItemThumbnailOverlayRenderer", "content", "musicPlayButtonRenderer", "playNavigationEndpoint", "watchEndpoint");
      if (watch != null) id = watch.optString("videoId", "");
    }
    if (id.isEmpty()) return null;
    JSONArray flex = r.optJSONArray("flexColumns");
    String title = joinRuns(flex, 0).trim();
    if (title.isEmpty()) return null;
    List<String> segments = new ArrayList<>();
    for (String seg : joinRuns(flex, 1).split(" \u2022 ")) {
      String t = seg.trim();
      if (!t.isEmpty()) segments.add(t);
    }
    Double duration = null;
    if (!segments.isEmpty()) {
      duration = parseClock(segments.get(segments.size() - 1));
      if (duration != null) segments.remove(segments.size() - 1);
    }
    if (!segments.isEmpty() && ("Song".equals(segments.get(0)) || "Video".equals(segments.get(0)))) segments.remove(0);
    String cover = lastThumb(path(r, "thumbnail", "musicThumbnailRenderer", "thumbnail"));
    return new TrackMatch.Hit(id, title, segments.size() > 0 ? segments.get(0) : "", segments.size() > 1 ? segments.get(1) : "", duration, cover);
  }

  private static String textOf(JSONObject node) {
    if (node == null) return "";
    String simple = node.optString("simpleText", "");
    if (!simple.isEmpty()) return simple;
    JSONArray runs = node.optJSONArray("runs");
    StringBuilder sb = new StringBuilder();
    for (int i = 0; runs != null && i < runs.length(); i++) {
      JSONObject run = runs.optJSONObject(i);
      if (run != null) sb.append(run.optString("text", ""));
    }
    return sb.toString();
  }

  private static TrackMatch.Hit videoHit(JSONObject r) {
    String id = r.optString("videoId", "");
    if (id.isEmpty()) return null;
    String title = textOf(r.optJSONObject("title")).trim();
    if (title.isEmpty()) return null;
    Double duration = parseClock(textOf(r.optJSONObject("lengthText")));
    // Siaran langsung / premiere tanpa durasi bukan lagu.
    if (duration == null) return null;
    String owner = textOf(r.optJSONObject("ownerText"));
    if (owner.isEmpty()) owner = textOf(r.optJSONObject("shortBylineText"));
    String artist = owner.replaceAll("(?i)\\s+-\\s+Topic$", "").replaceAll("(?i)VEVO$", "").trim();
    return new TrackMatch.Hit(id, title, artist, "", duration, lastThumb(r.optJSONObject("thumbnail")));
  }

  private static void addAll(List<JSONObject> out, JSONArray arr) {
    if (arr == null) return;
    for (int i = 0; i < arr.length(); i++) {
      JSONObject o = arr.optJSONObject(i);
      if (o != null) out.add(o);
    }
  }

  /* ---------------- visitorData ---------------- */

  private static String loadVisitor(Context context) {
    synchronized (YtResolver.class) {
      if (visitorData != null) return visitorData;
      if (context != null) {
        try {
          String v = context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(PREF_VISITOR, null);
          if (v != null && !v.isEmpty()) visitorData = v;
        } catch (Exception ignored) {
          // tanpa visitorData masih bisa dicoba
        }
      }
      return visitorData;
    }
  }

  private static String fetchVisitor(Context context) {
    try {
      Map<String, String> headers = new HashMap<>();
      headers.put("Accept", "application/json");
      headers.put("User-Agent", VISITOR_UA);
      String text = get(VISITOR_URL, headers);
      if (text.startsWith(")]}'")) text = text.substring(4).trim();
      JSONArray root = new JSONArray(text);
      String value = root.getJSONArray(0).getJSONArray(2).getJSONArray(0).getJSONArray(0).getString(13);
      if (value != null && !value.isEmpty()) {
        synchronized (YtResolver.class) {
          visitorData = value;
        }
        if (context != null) {
          try {
            context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(PREF_VISITOR, value).apply();
          } catch (Exception ignored) {
            // abaikan
          }
        }
        return value;
      }
    } catch (Exception ignored) {
      // tanpa visitorData masih bisa dicoba
    }
    return null;
  }

  /* ---------------- HTTP ---------------- */

  private static String get(String url, Map<String, String> headers) throws IOException {
    return request("GET", url, headers, null);
  }

  static String postJson(String url, Map<String, String> headers, String body) throws IOException {
    return request("POST", url, headers, body);
  }

  private static String request(String method, String url, Map<String, String> headers, String body) throws IOException {
    HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
    try {
      c.setRequestMethod(method);
      c.setConnectTimeout(CONNECT_MS);
      c.setReadTimeout(READ_MS);
      for (Map.Entry<String, String> h : headers.entrySet()) c.setRequestProperty(h.getKey(), h.getValue());
      if (body != null) {
        c.setDoOutput(true);
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        c.setFixedLengthStreamingMode(bytes.length);
        OutputStream out = c.getOutputStream();
        try {
          out.write(bytes);
        } finally {
          out.close();
        }
      }
      int code = c.getResponseCode();
      if (code < 200 || code >= 300) throw new IOException("HTTP " + code);
      InputStream in = c.getInputStream();
      try {
        ByteArrayOutputStream buf = new ByteArrayOutputStream();
        byte[] chunk = new byte[8192];
        int n;
        while ((n = in.read(chunk)) > 0) {
          buf.write(chunk, 0, n);
          if (buf.size() > 8 * 1024 * 1024) throw new IOException("Respons terlalu besar");
        }
        return new String(buf.toByteArray(), StandardCharsets.UTF_8);
      } finally {
        in.close();
      }
    } finally {
      c.disconnect();
    }
  }
}
