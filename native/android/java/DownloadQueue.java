package __APP_ID__;

import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.media.MediaMetadataRetriever;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.os.BatteryManager;
import android.os.SystemClock;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Antrean unduhan NATIVE (padanan manajer unduhan Rust milik StreamBeats), tahap 1.
 *
 * Pembagian kerja: JavaScript tetap menyusun urutan lagu dan me-resolve link plugin (itu kode JS), lalu menyerahkan lagu
 * yang URL-nya SUDAH siap ke sini. Antrean ini lalu mengerjakan semuanya sendiri di thread native, tanpa WebView:
 * unduh (NativeDownloader, bisa disambung) -> cek isi -> verifikasi ukuran/durasi -> sampul -> tag -> ganti nama atomik ->
 * tulis metadata (jurnal) -> salin ke Music. Karena itu lagu yang sedang berjalan (dan beberapa yang sudah diserahkan)
 * tetap selesai walau aplikasi digeser dari recent apps.
 *
 * Disimpan di `files/dlqueue.json` (antrean + hasil yang belum dibaca JS), jadi tidak hilang bila proses mati.
 *
 * Hasil tiap lagu (event `queueResult` ke JS bila hidup; selalu dicatat sampai JS mengakuinya lewat `ack`):
 *  - done:     berkas sudah jadi + metadata tertulis.
 *  - handback: JS harus me-resolve ulang (URL ditolak / kedaluwarsa, isi bukan audio, terpotong, jaringan putus terlalu lama).
 *  - verify:   berkas utuh tetapi durasi tidak bisa dipastikan di native; .part DIPERTAHANKAN supaya JS memverifikasinya
 *              dengan pemeriksaan ketatnya (pembaca durasi WebView) lalu menyelesaikannya.
 *
 * BATAS: lagu yang BELUM diserahkan JS ke antrean ini tetap menunggu aplikasi dibuka (native tidak membuat job sendiri). Lagu yang sudah
 * diserahkan diambil ulang linknya oleh native sendiri bila kedaluwarsa / ditolak: lewat YtResolver bila job membawa `ytId`, atau lewat
 * pencarian judul + artis (YtMatcher, pemeriksaan ketat) bila tidak dan bukan pilihan manual.
 */
final class DownloadQueue {
  interface Listener {
    void onProgress(String id, long bytes, long total);

    void onResult(JSONObject result);
  }

  private static final String FILE = "dlqueue.json";
  private static final long MIN_VALID_BYTES = 100L * 1024;
  private static final long MIN_BYTES_PER_SEC = 5000;
  private static final long MIN_BYTES_PER_SEC_STRICT = 11_000;
  private static final long MAX_BYTES_PER_SEC_STRICT = 42_000;
  private static final double STRICT_DIFF_S = 1.5;
  private static final double STRICT_MIN_UNKNOWN_S = 60;
  /** URL hasil resolve lebih tua dari ini dianggap kedaluwarsa: dikembalikan ke JS. */
  private static final long STALE_MS = 90L * 60_000L;
  private static final long CONDITION_POLL_MS = 5_000L;
  private static final long CONDITION_WAIT_MAX_MS = 20L * 60_000L;

  private static final Object LOCK = new Object();
  private static final List<JSONObject> pending = new ArrayList<>();
  private static final List<JSONObject> results = new ArrayList<>();
  private static Context app;
  private static boolean loaded = false;
  private static volatile Listener listener;
  private static volatile boolean wifiOnly = false;
  private static volatile boolean chargingOnly = false;
  /**
   * Jeda dari tombol notifikasi saat JS mati/beku. Lagu yang sedang berjalan diselesaikan dulu, sisanya menunggu. Dilepas
   * oleh tombol Lanjutkan, oleh JS yang menyerahkan lagu baru (add), atau saat app dibuka (sync): JS yang memegang kendali.
   */
  private static volatile boolean paused = false;
  private static String runningKey = null;
  private static Thread worker = null;
  private static int sessionDone = 0;
  private static int sessionFailed = 0;
  private static int sessionTotal = 0;
  private static long lastNotifyAt = 0;

  private DownloadQueue() {}

  /* ------------------------------------------------------------------ API untuk plugin */

  static void init(Context context) {
    synchronized (LOCK) {
      if (context != null) app = context.getApplicationContext();
      if (loaded || app == null) return;
      loaded = true;
      File f = new File(app.getFilesDir(), FILE);
      if (!f.isFile()) return;
      try {
        JSONObject root = new JSONObject(new String(AudioFinalizer.readAll(f), StandardCharsets.UTF_8));
        JSONArray jobs = root.optJSONArray("jobs");
        JSONArray res = root.optJSONArray("results");
        if (jobs != null) for (int i = 0; i < jobs.length(); i++) pending.add(jobs.getJSONObject(i));
        if (res != null) for (int i = 0; i < res.length(); i++) results.add(res.getJSONObject(i));
      } catch (Exception e) {
        android.util.Log.w("MusicVerse", "Antrean native rusak, dimulai kosong: " + e);
        pending.clear();
        results.clear();
      }
    }
  }

  /** Pendengar dari plugin (null = WebView/JS sudah mati: antrean memegang notifikasi sendiri). */
  static void setListener(Listener value) {
    listener = value;
  }

  static void configure(boolean wifi, boolean charging) {
    wifiOnly = wifi;
    chargingOnly = charging;
  }

  /** Tombol Jeda / Lanjutkan di notifikasi saat tidak ada JS yang menanganinya. */
  static void setPaused(boolean value) {
    boolean idle;
    synchronized (LOCK) {
      paused = value;
      if (!value) {
        if (!pending.isEmpty()) startWorkerLocked();
        return;
      }
      idle = worker == null;
    }
    // Pekerja sedang diam (mis. menyerah menunggu Wi-Fi): tidak ada lagu yang akan memperbarui notifikasi, jadi tampilkan sekarang.
    if (idle && listener == null && app != null) finishNotification(false);
  }

  static boolean isPaused() {
    return paused;
  }

  /** True bila masih ada kerja (dipakai DownloadService agar tidak berhenti saat app digeser). */
  static boolean isBusy() {
    synchronized (LOCK) {
      // Dijeda dan pekerja diam = tidak ada kerja yang perlu dilindungi service.
      return worker != null || (!pending.isEmpty() && !paused);
    }
  }

  /** Menambah lagu. Kunci yang sedang berjalan dibiarkan; kunci yang masih menunggu diganti (URL lebih baru). */
  static boolean add(JSONObject job) {
    String key = job.optString("key", "");
    if (key.isEmpty() || job.optString("url", "").isEmpty() || job.optString("partPath", "").isEmpty()) return false;
    if (!job.has("addedAt")) put(job, "addedAt", System.currentTimeMillis());
    synchronized (LOCK) {
      // JS menyerahkan lagu = JS yang memegang kendali lagi.
      paused = false;
      if (key.equals(runningKey)) return true;
      boolean replaced = false;
      for (int i = 0; i < pending.size(); i++) {
        if (key.equals(pending.get(i).optString("key"))) {
          pending.set(i, job);
          replaced = true;
          break;
        }
      }
      if (!replaced) {
        pending.add(job);
        sessionTotal += 1;
      }
      // Kunci yang sama tidak boleh punya hasil lama yang menggantung.
      removeResult(key);
      persistLocked();
      startWorkerLocked();
    }
    return true;
  }

  /** Mencabut satu lagu yang BELUM mulai. True bila berhasil dicabut. */
  static boolean cancel(String key) {
    synchronized (LOCK) {
      if (key.equals(runningKey)) return false;
      for (int i = 0; i < pending.size(); i++) {
        if (key.equals(pending.get(i).optString("key"))) {
          pending.remove(i);
          sessionTotal = Math.max(0, sessionTotal - 1);
          persistLocked();
          return true;
        }
      }
      return false;
    }
  }

  /** Mencabut semua lagu yang belum mulai (jeda / syarat tidak terpenuhi). Mengembalikan kuncinya. */
  static List<String> release() {
    List<String> keys = new ArrayList<>();
    synchronized (LOCK) {
      for (int i = pending.size() - 1; i >= 0; i--) {
        String key = pending.get(i).optString("key");
        if (key.equals(runningKey)) continue;
        keys.add(0, key);
        pending.remove(i);
        sessionTotal = Math.max(0, sessionTotal - 1);
      }
      persistLocked();
    }
    return keys;
  }

  /** Keadaan untuk JS yang baru dibuka: kunci yang masih di native + hasil yang belum diakui. Menyalakan pekerja bila perlu. */
  static JSONObject sync() {
    JSONObject out = new JSONObject();
    JSONArray active = new JSONArray();
    JSONArray res = new JSONArray();
    synchronized (LOCK) {
      // App dibuka: JS mengambil alih, jeda dari notifikasi dilepas (JS punya status jedanya sendiri).
      paused = false;
      for (JSONObject job : pending) active.put(job.optString("key"));
      for (JSONObject r : results) res.put(r);
      if (!pending.isEmpty()) startWorkerLocked();
    }
    put(out, "active", active);
    put(out, "results", res);
    return out;
  }

  static void ack(List<String> keys) {
    synchronized (LOCK) {
      for (String key : keys) removeResult(key);
      persistLocked();
    }
  }

  /* ------------------------------------------------------------------ pekerja */

  private static void startWorkerLocked() {
    if (worker != null || app == null) return;
    worker = new Thread(DownloadQueue::runLoop, "mv-download-queue");
    worker.start();
  }

  private static void runLoop() {
    try {
      for (;;) {
        JSONObject job;
        synchronized (LOCK) {
          job = nextLocked();
          if (job == null) break;
          runningKey = job.optString("key");
        }
        if (!job.optBoolean("forced", false) && !waitForConditions()) {
          synchronized (LOCK) {
            runningKey = null;
          }
          break;
        }
        JSONObject result;
        try {
          result = process(job);
        } catch (Throwable t) {
          android.util.Log.w("MusicVerse", "Unduhan native gagal: " + t);
          result = handback(job.optString("key"), "network", "Unduhan terhenti: " + t.getMessage());
        }
        finish(job, result);
      }
    } finally {
      boolean done;
      synchronized (LOCK) {
        runningKey = null;
        worker = null;
        done = pending.isEmpty();
        // Ada yang masuk persis saat pekerja berhenti: jalankan lagi.
        if (!done && app != null && !paused && !isBlockedNow()) startWorkerLocked();
      }
      if (listener == null && app != null) finishNotification(done);
      if (done) {
        sessionDone = 0;
        sessionFailed = 0;
        sessionTotal = 0;
      }
    }
  }

  private static JSONObject nextLocked() {
    if (pending.isEmpty()) return null;
    for (JSONObject job : pending) if (job.optBoolean("forced", false)) return job;
    if (paused) return null;
    return pending.get(0);
  }

  private static void finish(JSONObject job, JSONObject result) {
    String key = job.optString("key");
    String status = result.optString("status");
    synchronized (LOCK) {
      for (int i = 0; i < pending.size(); i++) {
        if (key.equals(pending.get(i).optString("key"))) {
          pending.remove(i);
          break;
        }
      }
      runningKey = null;
      removeResult(key);
      results.add(result);
      persistLocked();
    }
    if ("done".equals(status)) sessionDone += 1;
    else if ("failed".equals(status)) sessionFailed += 1;
    Listener l = listener;
    if (l != null) l.onResult(result);
  }

  /** Menunggu syarat Wi-Fi / cas. False bila menyerah (lagu tetap tersimpan, lanjut saat app dibuka). */
  private static boolean waitForConditions() {
    long start = SystemClock.elapsedRealtime();
    while (isBlockedNow()) {
      if (listener == null) notifyText("Menunggu " + reason(), pendingCount() + " lagu menunggu.", null, true);
      DownloadService.keepAlive();
      if (SystemClock.elapsedRealtime() - start > CONDITION_WAIT_MAX_MS) return false;
      if (!NetWatch.sleep(CONDITION_POLL_MS)) return false;
    }
    return true;
  }

  private static boolean isBlockedNow() {
    if (app == null) return false;
    if (wifiOnly && isCellular()) return true;
    return chargingOnly && isUnplugged();
  }

  private static String reason() {
    boolean w = wifiOnly && isCellular();
    boolean c = chargingOnly && isUnplugged();
    if (w && c) return "Wi-Fi dan cas";
    return w ? "Wi-Fi" : "cas";
  }

  private static boolean isCellular() {
    try {
      ConnectivityManager cm = (ConnectivityManager) app.getSystemService(Context.CONNECTIVITY_SERVICE);
      if (cm == null) return false;
      Network n = cm.getActiveNetwork();
      if (n == null) return false;
      NetworkCapabilities caps = cm.getNetworkCapabilities(n);
      if (caps == null) return false;
      return caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)
          && !caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)
          && !caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET);
    } catch (RuntimeException e) {
      return false;
    }
  }

  /** Tidak terbaca = dianggap dicas (jangan menahan unduhan tanpa alasan). */
  private static boolean isUnplugged() {
    try {
      Intent battery = app.registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
      if (battery == null) return false;
      return battery.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0) == 0;
    } catch (RuntimeException e) {
      return false;
    }
  }

  /* ------------------------------------------------------------------ satu lagu */

  /** Berapa kali link satu lagu diambil ulang di native sebelum dikembalikan ke JS. */
  private static final int MAX_LINK_REFRESHES = 2;

  /**
   * Mengambil link BARU untuk lagu YouTube (job membawa `ytId`) lewat YtResolver, lalu mengganti url / userAgent / resolvedAt
   * di job. false = bukan lagu YouTube atau resolve gagal (jaringan, video tidak bisa diputar): pemanggil mengembalikannya ke JS.
   */
  private static boolean refreshLink(JSONObject job, String why) {
    String ytId = job.optString("ytId", "");
    if (ytId.isEmpty()) return refreshBySearch(job, why);
    try {
      List<YtResolver.Stream> streams = YtResolver.getStreams(app, ytId);
      if (streams.isEmpty()) return false;
      YtResolver.Stream s = streams.get(0);
      put(job, "url", s.url);
      put(job, "userAgent", s.userAgent);
      put(job, "resolvedAt", System.currentTimeMillis());
      android.util.Log.i("MusicVerse", "Link unduhan diambil ulang di native (" + why + ") untuk " + job.optString("key"));
      return true;
    } catch (Exception e) {
      android.util.Log.w("MusicVerse", "Resolve ulang native gagal (" + why + "): " + e);
      return false;
    }
  }

  /**
   * Lagu TANPA id video (job tidak membawa `ytId`): dicari ulang di native lewat YtMatcher dengan pemeriksaan ketat yang sama
   * seperti unduhan di JS (artis, versi, durasi dalam 1,5 dtk). Tidak dipakai untuk pilihan manual (`free`): itu mutlak milik
   * pengguna dan tidak boleh diganti hasil pencarian. Berhasil = job kini membawa `ytId`, jadi link berikutnya lewat jalur cepat.
   */
  private static boolean refreshBySearch(JSONObject job, String why) {
    if (job.optBoolean("free", false)) return false;
    String title = job.optString("title", "");
    if (title.isEmpty()) return false;
    double expected = job.optDouble("expectedSec", -1);
    try {
      YtMatcher.Result r =
          YtMatcher.resolve(app, title, job.optString("artist", ""), expected > 0 ? Double.valueOf(expected) : null, true, null, 0);
      if (!r.ok()) {
        android.util.Log.w("MusicVerse", "Cari ulang native (" + why + ") untuk " + job.optString("key") + ": " + r.outcome);
        return false;
      }
      put(job, "url", r.stream.url);
      put(job, "userAgent", r.stream.userAgent);
      put(job, "ytId", r.videoId());
      put(job, "remoteSec", r.actualSec);
      put(job, "resolvedAt", System.currentTimeMillis());
      android.util.Log.i("MusicVerse", "Lagu dicari ulang di native (" + why + ") untuk " + job.optString("key") + ": " + r.source + " " + r.videoId());
      return true;
    } catch (Exception e) {
      android.util.Log.w("MusicVerse", "Cari ulang native gagal (" + why + "): " + e);
      return false;
    }
  }

  private static JSONObject process(JSONObject job) throws Exception {
    final String key = job.optString("key");
    final String title = job.optString("title", "Lagu");
    File base = app.getExternalFilesDir(null);
    if (base == null) return failed(key, "Penyimpanan eksternal tidak tersedia.");
    File part = safeFile(base, job.optString("partPath"));
    if (part == null) return failed(key, "Path unduhan tidak valid.");

    // Lagu YouTube (job membawa `ytId`): link kedaluwarsa / ditolak diambil ulang di native, tanpa menunggu JS.
    if (System.currentTimeMillis() - job.optLong("resolvedAt", System.currentTimeMillis()) > STALE_MS) {
      if (!refreshLink(job, "kedaluwarsa")) return handback(key, "rejected", "Link unduhan sudah kedaluwarsa.");
    }

    // 1. Unduh (bisa menyambung dari .part; bila sumber baru berukuran lain, pengunduh memulai ulang sendiri).
    NativeDownloader.Result dl;
    int refreshes = 0;
    while (true) {
      try {
        dl =
            NativeDownloader.download(
                key,
                job.optString("url"),
                job.has("userAgent") && !job.isNull("userAgent") ? job.optString("userAgent") : null,
                part,
                (pid, pbytes, ptotal) -> {
                  Listener l = listener;
                  if (l != null) l.onProgress(pid, pbytes, ptotal);
                  DownloadService.keepAlive();
                  if (l == null) {
                    Integer percent = ptotal > 0 ? Integer.valueOf((int) Math.min(100, pbytes * 100 / ptotal)) : null;
                    notifyText(title, sessionLine(), percent, false);
                  }
                });
        break;
      } catch (NativeDownloader.DownloadException e) {
        String code = e.code == null ? "" : e.code;
        boolean rejected = code.matches("HTTP_(401|403|404|410)");
        if (rejected && refreshes < MAX_LINK_REFRESHES) {
          refreshes++;
          // Klien yang URL-nya ditolak dilewati supaya resolve berikutnya memakai klien lain.
          YtResolver.markRejected(job.has("userAgent") && !job.isNull("userAgent") ? job.optString("userAgent") : null);
          if (refreshLink(job, code)) continue;
        }
        if (!rejected && !"NETWORK".equals(code)) deletePart(part);
        return handback(key, rejected ? "rejected" : "network", e.getMessage());
      }
    }

    // 2. Isi harus audio sungguhan.
    AudioFinalizer.Container container = AudioFinalizer.sniff(part);
    if (container == null) {
      deletePart(part);
      return handback(key, "notaudio", "Isi unduhan bukan audio.");
    }

    // 3. Verifikasi.
    long bytes = part.length();
    double expected = job.optDouble("expectedSec", -1);
    double remote = job.optDouble("remoteSec", -1);
    // Audio pilihan manual pengguna: bebas dari pemeriksaan durasi / laju bit terhadap playlist; hanya integritas berkas.
    boolean free = job.optBoolean("free", false);
    if (free) expected = -1;
    if (bytes < MIN_VALID_BYTES) {
      deletePart(part);
      return handback(key, "mismatch", "Berkas yang terunduh tidak valid (terlalu kecil).");
    }
    if (dl.total > 0 && bytes < dl.total * 0.99) {
      deletePart(part);
      return handback(key, "truncated", "Unduhan terpotong (" + bytes + " dari " + dl.total + " byte).");
    }
    if (expected > 0 && bytes < expected * MIN_BYTES_PER_SEC) {
      deletePart(part);
      return handback(key, "mismatch", "Berkas yang terunduh terlalu kecil untuk durasi lagu, kemungkinan cuplikan.");
    }
    double actual = probeDuration(part);
    // Durasi yang tidak terbaca / tidak cocok di sini BELUM tentu salah (pembaca native dan WebView bisa beda tipis untuk
    // MP3 VBR / WebM): serahkan ke JS dengan pemeriksaan ketatnya. Berkas tetap ada.
    if (free) {
      // Durasi tidak terbaca di native: JS yang memastikan (mode bebas juga). Terpotong dibanding sumbernya: JS yang menilai.
      if (actual <= 0 || (remote > 0 && Math.abs(actual - remote) > 3)) {
        JSONObject r = base("verify", key);
        put(r, "ext", container.ext);
        put(r, "mime", container.mime);
        put(r, "bytes", bytes);
        put(r, "total", dl.total);
        return r;
      }
    } else if (actual <= 0 || strictProblem(actual, expected) || isClip(actual, expected) || (remote > 0 && Math.abs(actual - remote) > 3)) {
      JSONObject r = base("verify", key);
      put(r, "ext", container.ext);
      put(r, "mime", container.mime);
      put(r, "bytes", bytes);
      put(r, "total", dl.total);
      return r;
    }
    double rate = bytes / actual;
    if (!free && (rate < MIN_BYTES_PER_SEC_STRICT || rate > MAX_BYTES_PER_SEC_STRICT)) {
      deletePart(part);
      return handback(key, "mismatch", "Ukuran berkas tidak wajar untuk durasinya, kemungkinan bukan lagu yang dimaksud.");
    }

    // 4. Sampul (usaha terbaik).
    File coverFile = safeFile(base, job.optString("coverPath"));
    boolean haveCover = false;
    String coverUrl = job.optString("coverUrl", "");
    if (coverFile != null && (coverUrl.startsWith("https://") || coverUrl.startsWith("http://"))) {
      haveCover = downloadCover(coverUrl, coverFile);
    } else if (coverFile != null && coverFile.isFile()) {
      haveCover = true;
    }

    // 5. Tag + ganti nama atomik.
    AudioFinalizer.Tags tags = new AudioFinalizer.Tags();
    tags.title = job.optString("title", "");
    tags.artist = job.optString("artist", "");
    tags.album = job.optString("album", "");
    boolean tagged = false;
    try {
      if (haveCover && coverFile.length() < 8L * 1024 * 1024) tags.cover = AudioFinalizer.readAll(coverFile);
      tagged = AudioFinalizer.tag(part, container, tags);
    } catch (Exception e) {
      android.util.Log.w("MusicVerse", "Tag gagal disematkan: " + e);
    }
    String fileName = new File(job.optString("finalBase")).getName() + "." + container.ext;
    File dest = safeFile(base, job.optString("finalBase") + "." + container.ext);
    if (dest == null) return failed(key, "Path tujuan tidak valid.");
    File parent = dest.getParentFile();
    if (parent != null && !parent.isDirectory() && !parent.mkdirs()) return failed(key, "Folder tujuan tidak bisa dibuat.");
    AudioFinalizer.moveReplace(part, dest);
    deleteQuietly(new File(part.getPath() + ".meta"));

    // 6. Metadata (jurnal pemulihan) ditulis di native.
    JSONObject entry;
    try {
      entry = new JSONObject(job.optString("entryJson", "{}"));
    } catch (Exception e) {
      entry = new JSONObject();
    }
    put(entry, "key", key);
    put(entry, "fileName", fileName);
    put(entry, "bytes", dest.length());
    put(entry, "savedAt", System.currentTimeMillis());
    put(entry, "tagged", true);
    if (haveCover) put(entry, "coverFileName", coverFile.getName());
    File metaFile = safeFile(base, job.optString("metaPath"));
    if (metaFile != null) {
      try {
        File pm = metaFile.getParentFile();
        if (pm != null) pm.mkdirs();
        File tmp = new File(metaFile.getPath() + ".tmp");
        try (FileOutputStream fos = new FileOutputStream(tmp)) {
          fos.write(entry.toString().getBytes(StandardCharsets.UTF_8));
        }
        AudioFinalizer.moveReplace(tmp, metaFile);
      } catch (Exception e) {
        android.util.Log.w("MusicVerse", "Metadata tidak tertulis: " + e);
      }
    }

    // 7. Salinan ke Music/MusicVerse bila diminta.
    boolean exported = false;
    String exportError = null;
    String exportName = job.optString("exportName", "");
    if (job.optBoolean("exportToMusic", false) && !exportName.isEmpty()) {
      exportError = MediaExporter.export(app, dest, exportName + "." + container.ext, container.mime);
      exported = exportError == null;
    }

    JSONObject r = base("done", key);
    put(r, "entry", entry.toString());
    put(r, "ext", container.ext);
    put(r, "bytes", dest.length());
    put(r, "tagged", tagged);
    put(r, "exported", exported);
    if (exportError != null) put(r, "exportError", exportError);
    return r;
  }

  /* ------------------------------------------------------------------ pemeriksaan (padanan clipDetect.ts) */

  private static boolean strictProblem(double actual, double expected) {
    if (actual <= 0) return true;
    if (expected <= 0) return actual <= STRICT_MIN_UNKNOWN_S;
    return Math.abs(actual - expected) > STRICT_DIFF_S;
  }

  private static boolean isClip(double actual, double expected) {
    if (actual <= 0 || expected <= 0) return false;
    double gap = expected - actual;
    if (actual <= 35 && gap >= 20) return true;
    if (actual < expected * 0.6 && gap >= 45) return true;
    return strictProblem(actual, expected);
  }

  /** Detik, atau -1 bila tidak terbaca. */
  private static double probeDuration(File file) {
    MediaMetadataRetriever r = new MediaMetadataRetriever();
    try {
      r.setDataSource(file.getAbsolutePath());
      String d = r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION);
      return d == null ? -1 : Long.parseLong(d) / 1000.0;
    } catch (Exception e) {
      return -1;
    } finally {
      try {
        r.release();
      } catch (Exception ignored) {
        // sudah lepas
      }
    }
  }

  private static boolean downloadCover(String url, File dest) {
    HttpURLConnection c = null;
    File tmp = new File(dest.getPath() + ".tmp");
    try {
      File parent = dest.getParentFile();
      if (parent != null) parent.mkdirs();
      c = (HttpURLConnection) new URL(url).openConnection();
      c.setConnectTimeout(15_000);
      c.setReadTimeout(15_000);
      c.setInstanceFollowRedirects(true);
      if (c.getResponseCode() != 200) return false;
      ByteArrayOutputStream buf = new ByteArrayOutputStream();
      try (InputStream in = c.getInputStream()) {
        byte[] chunk = new byte[16 * 1024];
        int n;
        while ((n = in.read(chunk)) > 0) {
          buf.write(chunk, 0, n);
          if (buf.size() > 8 * 1024 * 1024) return false;
        }
      }
      if (buf.size() < 64 || AudioFinalizer.sniffImage(buf.toByteArray()) == null) return false;
      try (FileOutputStream fos = new FileOutputStream(tmp)) {
        buf.writeTo(fos);
      }
      AudioFinalizer.moveReplace(tmp, dest);
      return true;
    } catch (Exception e) {
      return false;
    } finally {
      if (c != null) c.disconnect();
      deleteQuietly(tmp);
    }
  }

  /* ------------------------------------------------------------------ notifikasi (hanya saat JS mati) */

  private static String sessionLine() {
    int left = pendingCount();
    return left > 1 ? "Mengunduh lagu (" + left + " tersisa)" : "Mengunduh lagu";
  }

  private static int pendingCount() {
    synchronized (LOCK) {
      return pending.size();
    }
  }

  private static void notifyText(String title, String text, Integer percent, boolean waiting) {
    long now = SystemClock.elapsedRealtime();
    if (now - lastNotifyAt < 800) return;
    lastNotifyAt = now;
    String action = "pause";
    if (paused) {
      // Sudah ditekan Jeda: lagu berjalan diselesaikan dulu.
      title = "Unduhan dijeda";
      text = "Berhenti setelah lagu ini";
      action = "resume";
    }
    if (app != null) DownloadService.update(app, title, text, percent, false, waiting, action);
  }

  private static void finishNotification(boolean allDone) {
    if (app == null) return;
    if (!allDone && paused) {
      DownloadService.update(app, "Unduhan dijeda", pendingCount() + " lagu menunggu.", null, true, false, "resume");
      return;
    }
    if (!allDone) {
      // Berhenti karena syarat tidak terpenuhi: sisanya menunggu app dibuka.
      DownloadService.update(app, "Unduhan menunggu", pendingCount() + " lagu menunggu. Buka MusicVerse untuk melanjutkan.", null, true, false, null);
      return;
    }
    int ok = sessionDone;
    int bad = sessionFailed;
    if (ok + bad == 0) {
      DownloadService.stop(app);
      return;
    }
    String text = bad == 0 ? (ok == 1 ? "1 lagu selesai diunduh" : ok + " lagu selesai diunduh") : ok + " selesai, " + bad + " gagal. Buka Unduhan untuk melihat.";
    DownloadService.update(app, "Unduhan selesai", text, null, true, false, null);
  }

  /* ------------------------------------------------------------------ util */

  private static JSONObject base(String status, String key) {
    JSONObject r = new JSONObject();
    put(r, "key", key);
    put(r, "status", status);
    return r;
  }

  private static JSONObject handback(String key, String reason, String message) {
    JSONObject r = base("handback", key);
    put(r, "reason", reason);
    put(r, "message", message == null ? "" : message);
    return r;
  }

  private static JSONObject failed(String key, String message) {
    JSONObject r = base("failed", key);
    put(r, "message", message);
    return r;
  }

  private static File safeFile(File base, String path) {
    if (path == null || path.isEmpty() || path.contains("..") || path.startsWith("/")) return null;
    return new File(base, path);
  }

  private static void deletePart(File part) {
    deleteQuietly(part);
    deleteQuietly(new File(part.getPath() + ".meta"));
  }

  private static void deleteQuietly(File f) {
    if (f != null && f.exists() && !f.delete()) f.deleteOnExit();
  }

  private static void removeResult(String key) {
    for (int i = results.size() - 1; i >= 0; i--) if (key.equals(results.get(i).optString("key"))) results.remove(i);
  }

  private static void put(JSONObject o, String k, Object v) {
    try {
      o.put(k, v);
    } catch (org.json.JSONException ignored) {
      // kunci tidak null: tidak terjadi
    }
  }

  private static void persistLocked() {
    if (app == null) return;
    try {
      JSONObject root = new JSONObject();
      root.put("jobs", new JSONArray(pending));
      root.put("results", new JSONArray(results));
      File f = new File(app.getFilesDir(), FILE);
      File tmp = new File(f.getPath() + ".tmp");
      try (FileOutputStream fos = new FileOutputStream(tmp)) {
        fos.write(root.toString().getBytes(StandardCharsets.UTF_8));
      }
      AudioFinalizer.moveReplace(tmp, f);
    } catch (Exception e) {
      android.util.Log.w("MusicVerse", "Antrean native tidak tersimpan: " + e);
    }
  }
}
