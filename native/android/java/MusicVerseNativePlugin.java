package __APP_ID__;

import android.Manifest;
import android.app.DownloadManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageInfo;
import android.os.BatteryManager;
import android.database.Cursor;
import android.media.AudioManager;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import java.io.File;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import android.util.Base64;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/** Jembatan JavaScript -> PlaybackService (notifikasi media + foreground service). */
@CapacitorPlugin(
    name = "MusicVerseNative",
    permissions = {
      @Permission(strings = {Manifest.permission.POST_NOTIFICATIONS}, alias = "notifications"),
      // Folder "Lokal" (tab Unduhan): Android 13+ izin audio khusus, di bawahnya izin penyimpanan. Hanya salah satu yang diminta.
      @Permission(strings = {"android.permission.READ_MEDIA_AUDIO"}, alias = "audio33"),
      @Permission(strings = {Manifest.permission.READ_EXTERNAL_STORAGE}, alias = "audioLegacy")
    })
public class MusicVerseNativePlugin extends Plugin {
  private static final String UPDATE_FILE = "musicverse-update.apk";
  private static final String UPDATE_DIR = "app-update";
  private static final String PREFS = "musicverse_update";
  private static final String PREF_ID = "download_id";

  private static final String DL_CHANNEL = "musicverse_downloads";
  private static final int DL_NOTIFICATION_ID = 4242;

  private final Handler uiHandler = new Handler(Looper.getMainLooper());
  private BroadcastReceiver downloadReceiver;
  private long watchedId = -1;
  private boolean autoInstallTried = false;

  /** Pekerja unduhan native (satu thread per unduhan; antrean diatur JS sehingga praktis satu per satu). */
  private final ExecutorService downloadPool = Executors.newCachedThreadPool();

  @Override
  public void load() {
    // Dipakai StreamProxy & NativeDownloader untuk menunggu jaringan kembali saat sinyal putus.
    NetWatch.attach(getContext());
    // Bersihkan sampah APK pembaruan (berkas + entri unduhan sistem) bila versinya sudah terpasang.
    downloadPool.execute(this::cleanupStaleUpdate);
    DownloadQueue.init(getContext());
    DownloadQueue.setListener(
        new DownloadQueue.Listener() {
          @Override
          public void onProgress(String id, long bytes, long total) {
            JSObject event = new JSObject();
            event.put("id", id);
            event.put("bytes", bytes);
            event.put("total", total);
            notifyListeners("downloadProgress", event);
          }

          @Override
          public void onResult(org.json.JSONObject result) {
            try {
              notifyListeners("queueResult", new JSObject(result.toString()));
            } catch (org.json.JSONException e) {
              android.util.Log.w("MusicVerse", "Hasil antrean tidak terkirim: " + e);
            }
          }
        });
    DownloadService.setListener((action) -> {
      JSObject event = new JSObject();
      event.put("action", action);
      notifyListeners("downloadAction", event);
    });
    PlaybackService.setListener((action, seekMs) -> {
      JSObject event = new JSObject();
      event.put("action", action);
      if (seekMs >= 0) event.put("seekMs", seekMs);
      notifyListeners("mediaAction", event);
    });
    PlaybackService.setEngineListener((type, currentTime, duration, ended, seekable, errorCode, ahead, reason) -> {
      JSObject event = new JSObject();
      event.put("type", type);
      event.put("currentTime", currentTime);
      if (duration >= 0) event.put("duration", duration);
      event.put("ended", ended);
      event.put("seekable", seekable);
      if (errorCode > 0) event.put("errorCode", errorCode);
      event.put("ahead", ahead);
      event.put("reason", reason);
      notifyListeners("engineEvent", event);
    });
    // Android Auto: JS hanya perlu tahu "ada permintaan"; isinya diambil lewat consumeAutoRequest() (sekali pakai),
    // jadi event yang hilang karena JS belum memasang pendengar tidak membuat permintaan hilang.
    AutoBridge.setListener((kind, payload) -> {
      JSObject event = new JSObject();
      event.put("kind", kind);
      event.put("payload", payload);
      notifyListeners("autoRequest", event);
    });
  }

  @Override
  protected void handleOnDestroy() {
    PlaybackService.setListener(null);
    PlaybackService.setEngineListener(null);
    AutoBridge.setListener(null);
    DownloadService.setListener(null);
    // WebView mati: antrean native jalan terus dan memegang notifikasinya sendiri.
    DownloadQueue.setListener(null);
    uiHandler.removeCallbacksAndMessages(null);
    if (downloadReceiver != null) {
      try {
        getContext().unregisterReceiver(downloadReceiver);
      } catch (IllegalArgumentException ignored) {
        // sudah dilepas
      }
      downloadReceiver = null;
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Pembaruan APK: unduh lewat DownloadManager (progres tampil di notifikasi sistem, tetap jalan
  // walau app ditutup), lalu buka installer paket begitu selesai.
  // ---------------------------------------------------------------------------------------------

  private File updateFile() {
    // Folder khusus pembaruan. JANGAN memakai "Download": di penyimpanan yang tidak membedakan huruf besar/kecil
    // namanya sama dengan folder unduhan lagu ("download"), dan folder lagu tidak boleh disentuh pembaruan.
    return new File(getContext().getExternalFilesDir(UPDATE_DIR), UPDATE_FILE);
  }

  private static long versionCodeOf(PackageInfo info) {
    return Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode;
  }

  /**
   * Dipanggil tiap app dibuka: menghapus berkas pembaruan (musicverse-update.apk) beserta entri DownloadManager-nya bila
   * APK itu sudah terpasang (versionCode <= versi yang berjalan) atau rusak/sisa unduhan yang tidak aktif. Berkas lama
   * yang menumpuk bisa menghalangi pembaruan berikutnya. Unduhan yang sedang berjalan tidak disentuh.
   */
  private void cleanupStaleUpdate() {
    try {
      Context ctx = getContext();
      DownloadManager dm = downloadManager();
      long id = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getLong(PREF_ID, -1);
      if (id >= 0 && dm != null) {
        try (Cursor c = dm.query(new DownloadManager.Query().setFilterById(id))) {
          if (c != null && c.moveToFirst()) {
            int status = c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
            if (status == DownloadManager.STATUS_RUNNING || status == DownloadManager.STATUS_PENDING || status == DownloadManager.STATUS_PAUSED) return;
          }
        }
      }
      if (watchedId >= 0) return;
      File file = updateFile();
      boolean stale = true;
      if (file.exists() && file.length() > 0) {
        PackageInfo apk = ctx.getPackageManager().getPackageArchiveInfo(file.getAbsolutePath(), 0);
        PackageInfo me = ctx.getPackageManager().getPackageInfo(ctx.getPackageName(), 0);
        // APK yang lebih baru dari yang berjalan = pembaruan yang belum dipasang: biarkan.
        if (apk != null && versionCodeOf(apk) > versionCodeOf(me)) stale = false;
      }
      if (!stale) return;
      if (id >= 0 && dm != null) dm.remove(id);
      ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove(PREF_ID).apply();
      File dir = file.getParentFile();
      File[] leftovers = dir == null ? null : dir.listFiles();
      if (leftovers != null) {
        for (File f : leftovers) {
          if (f.isFile() && f.getName().toLowerCase().endsWith(".apk")) f.delete();
        }
      }
    } catch (Exception ignored) {
      // pembersihan hanya upaya terbaik; jangan mengganggu start aplikasi
    }
  }

  private DownloadManager downloadManager() {
    return (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
  }

  private void emitUpdate(String status, long downloaded, long total) {
    JSObject event = new JSObject();
    event.put("status", status);
    event.put("downloaded", downloaded);
    event.put("total", total);
    notifyListeners("updateProgress", event);
  }

  @PluginMethod
  public void downloadUpdate(PluginCall call) {
    String url = call.getString("url", "");
    String version = call.getString("version", "");
    if (url == null || !url.startsWith("https://")) {
      call.reject("Alamat unduhan harus https.");
      return;
    }
    DownloadManager dm = downloadManager();
    if (dm == null) {
      call.reject("DownloadManager tidak tersedia.");
      return;
    }
    // Batalkan unduhan lama dan hapus berkas sisa pembaruan sebelumnya.
    long previous = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE).getLong(PREF_ID, -1);
    if (previous >= 0) dm.remove(previous);
    File file = updateFile();
    if (file.exists() && !file.delete()) {
      call.reject("Tidak bisa menghapus berkas pembaruan lama.");
      return;
    }
    try {
      DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
      request.setTitle("MusicVerse" + (version.isEmpty() ? "" : " v" + version));
      request.setDescription("Mengunduh pembaruan");
      request.setMimeType("application/vnd.android.package-archive");
      request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
      request.setDestinationInExternalFilesDir(getContext(), UPDATE_DIR, UPDATE_FILE);
      long id = dm.enqueue(request);
      getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putLong(PREF_ID, id).apply();
      autoInstallTried = false;
      watchDownload(id);
      call.resolve();
    } catch (RuntimeException e) {
      call.reject("Unduhan tidak bisa dimulai: " + e.getMessage());
    }
  }

  private void watchDownload(long id) {
    watchedId = id;
    if (downloadReceiver == null) {
      downloadReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
          long done = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
          if (done == watchedId) pollDownload();
        }
      };
      ContextCompat.registerReceiver(
          getContext(),
          downloadReceiver,
          new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE),
          ContextCompat.RECEIVER_EXPORTED);
    }
    uiHandler.removeCallbacks(pollRunnable);
    uiHandler.post(pollRunnable);
  }

  private final Runnable pollRunnable = this::pollDownload;

  private void pollDownload() {
    uiHandler.removeCallbacks(pollRunnable);
    if (watchedId < 0) return;
    DownloadManager dm = downloadManager();
    if (dm == null) return;
    try (Cursor c = dm.query(new DownloadManager.Query().setFilterById(watchedId))) {
      if (c == null || !c.moveToFirst()) {
        // Dihapus/dibatalkan pengguna dari notifikasi.
        watchedId = -1;
        emitUpdate("failed", 0, 0);
        return;
      }
      int status = c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
      long soFar = c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR));
      long total = c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES));
      if (status == DownloadManager.STATUS_SUCCESSFUL) {
        watchedId = -1;
        emitUpdate("ready", soFar, total);
        if (!autoInstallTried) {
          autoInstallTried = true;
          launchInstaller(null);
        }
      } else if (status == DownloadManager.STATUS_FAILED) {
        watchedId = -1;
        emitUpdate("failed", soFar, total);
      } else {
        emitUpdate(status == DownloadManager.STATUS_PAUSED ? "paused" : "downloading", soFar, total);
        uiHandler.postDelayed(pollRunnable, 500);
      }
    }
  }

  /** True jika izin "pasang dari sumber ini" sudah ada (atau tidak diperlukan, Android < 8). */
  private boolean canInstall() {
    return Build.VERSION.SDK_INT < 26 || getContext().getPackageManager().canRequestPackageInstalls();
  }

  /** Membuka installer untuk berkas pembaruan. Mengembalikan false (dan menolak call) jika gagal. */
  private boolean launchInstaller(PluginCall call) {
    File file = updateFile();
    if (!file.exists() || file.length() == 0) {
      if (call != null) call.reject("Berkas pembaruan tidak ditemukan. Unduh ulang.", "NO_FILE");
      return false;
    }
    if (!canInstall()) {
      Intent settings = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()));
      settings.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      try {
        getContext().startActivity(settings);
      } catch (RuntimeException ignored) {
        // lanjut: JS tetap diberi tahu lewat kode NEED_PERMISSION
      }
      if (call != null) call.reject("Izinkan MusicVerse memasang aplikasi, lalu ketuk Pasang lagi.", "NEED_PERMISSION");
      return false;
    }
    try {
      Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".updatefileprovider", file);
      Intent install = new Intent(Intent.ACTION_VIEW);
      install.setDataAndType(uri, "application/vnd.android.package-archive");
      install.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
      getContext().startActivity(install);
      if (call != null) call.resolve();
      return true;
    } catch (RuntimeException e) {
      if (call != null) call.reject("Installer tidak bisa dibuka: " + e.getMessage());
      return false;
    }
  }

  /** Membagikan berkas di folder files/ aplikasi (mis. cadangan data) lewat lembar bagikan sistem. */
  @PluginMethod
  public void shareFile(PluginCall call) {
    String mime = call.getString("mimeType", "application/json");
    if (mime == null || !mime.matches("[a-z]+/[a-z0-9.+-]+")) mime = "application/json";
    String rel = call.getString("path");
    String title = call.getString("title", "Bagikan berkas");
    if (rel == null || rel.contains("..") || rel.startsWith("/")) {
      call.reject("Path tidak valid");
      return;
    }
    File base = getContext().getExternalFilesDir(null);
    File file = base == null ? null : new File(base, rel);
    if (file == null || !file.isFile()) {
      call.reject("Berkas tidak ditemukan");
      return;
    }
    try {
      Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".updatefileprovider", file);
      Intent send = new Intent(Intent.ACTION_SEND);
      send.setType(mime);
      send.putExtra(Intent.EXTRA_STREAM, uri);
      send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
      Intent chooser = Intent.createChooser(send, title);
      chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      getContext().startActivity(chooser);
      call.resolve();
    } catch (Exception e) {
      call.reject("Gagal membuka lembar bagikan: " + e.getMessage());
    }
  }

  @PluginMethod
  public void installUpdate(PluginCall call) {
    launchInstaller(call);
  }

  /** Dipanggil saat app dibuka lagi: apakah berkas pembaruan sudah selesai diunduh / sedang diunduh. */
  @PluginMethod
  public void getUpdateState(PluginCall call) {
    long id = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE).getLong(PREF_ID, -1);
    boolean downloading = false;
    boolean ready = false;
    DownloadManager dm = downloadManager();
    if (id >= 0 && dm != null) {
      try (Cursor c = dm.query(new DownloadManager.Query().setFilterById(id))) {
        if (c != null && c.moveToFirst()) {
          int status = c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
          ready = status == DownloadManager.STATUS_SUCCESSFUL && updateFile().length() > 0;
          downloading = status == DownloadManager.STATUS_RUNNING || status == DownloadManager.STATUS_PENDING || status == DownloadManager.STATUS_PAUSED;
        }
      }
    }
    if (downloading) {
      autoInstallTried = true; // jangan melempar installer sendiri saat pengguna kembali ke app
      watchDownload(id);
    }
    JSObject result = new JSObject();
    result.put("downloading", downloading);
    result.put("ready", ready);
    call.resolve(result);
  }

  // ---------------------------------------------------------------------------------------------
  // Notifikasi progres unduhan lagu (satu notifikasi untuk seluruh antrean).
  // ---------------------------------------------------------------------------------------------

  /**
   * Mendaftarkan URL stream ke proxy lokal (StreamProxy) supaya <audio> bisa memutarnya dengan
   * header User-Agent yang diminta sumber. Mengembalikan URL http://127.0.0.1:<port>/s/<token>.
   */
  @PluginMethod
  public void proxyStream(PluginCall call) {
    String url = call.getString("url");
    if (url == null || !(url.startsWith("https://") || url.startsWith("http://"))) {
      call.reject("URL stream tidak valid");
      return;
    }
    try {
      JSObject result = new JSObject();
      result.put("url", StreamProxy.get().register(url, call.getString("userAgent")));
      call.resolve(result);
    } catch (Exception e) {
      call.reject("Proxy stream gagal: " + e.getMessage());
    }
  }

  /**
   * Mengunduh berkas dengan pengunduh native yang bisa MELANJUTKAN (lihat NativeDownloader): putus sinyal tidak membuang
   * byte yang sudah masuk. `path` relatif terhadap Directory.External (sama dengan Filesystem Capacitor).
   * Progres dikirim lewat event `downloadProgress` {id, bytes, total}; promise selesai saat berkas utuh.
   */
  @PluginMethod
  public void downloadFile(PluginCall call) {
    final String id = call.getString("id");
    final String url = call.getString("url");
    final String path = call.getString("path");
    final String userAgent = call.getString("userAgent");
    if (id == null || id.isEmpty() || path == null || path.isEmpty()) {
      call.reject("Parameter unduhan tidak lengkap", "INVALID");
      return;
    }
    if (url == null || !(url.startsWith("https://") || url.startsWith("http://"))) {
      call.reject("URL unduhan tidak valid", "INVALID");
      return;
    }
    if (path.contains("..") || path.startsWith("/")) {
      call.reject("Path unduhan tidak valid", "INVALID");
      return;
    }
    final File base = getContext().getExternalFilesDir(null);
    if (base == null) {
      call.reject("Penyimpanan eksternal tidak tersedia", "IO");
      return;
    }
    final File dest = new File(base, path);
    downloadPool.execute(() -> {
      try {
        NativeDownloader.Result result = NativeDownloader.download(id, url, userAgent, dest, (rid, bytes, total) -> {
          JSObject event = new JSObject();
          event.put("id", rid);
          event.put("bytes", bytes);
          event.put("total", total);
          notifyListeners("downloadProgress", event);
          // Progres native = tanda hidup: service + wake lock unduhan tidak boleh lepas hanya karena WebView sedang dibekukan.
          DownloadService.keepAlive();
        });
        JSObject out = new JSObject();
        out.put("bytes", result.bytes);
        out.put("total", result.total);
        out.put("resumed", result.resumed);
        call.resolve(out);
      } catch (NativeDownloader.DownloadException e) {
        call.reject(e.getMessage(), e.code);
      } catch (RuntimeException e) {
        call.reject("Unduhan gagal: " + e.getMessage(), "IO");
      }
    });
  }

  /** Path relatif terhadap Directory.External -> File; null bila tidak aman. */
  private File externalFile(String path) {
    if (path == null || path.isEmpty() || path.contains("..") || path.startsWith("/")) return null;
    File base = getContext().getExternalFilesDir(null);
    return base == null ? null : new File(base, path);
  }

  /**
   * Mengenali jenis audio dari ISI berkas (bukan dari nama/URL), seperti pemeriksaan wadah di StreamBeats.
   * Menolak dengan code NOT_AUDIO bila isinya bukan audio (mis. halaman error HTML yang tersimpan sebagai lagu).
   */
  @PluginMethod
  public void inspectDownload(PluginCall call) {
    final File file = externalFile(call.getString("path"));
    if (file == null || !file.isFile()) {
      call.reject("Berkas tidak ditemukan", "IO");
      return;
    }
    downloadPool.execute(
        () -> {
          try {
            AudioFinalizer.Container container = AudioFinalizer.sniff(file);
            if (container == null) {
              call.reject("Isi berkas bukan audio yang dikenal", "NOT_AUDIO");
              return;
            }
            JSObject out = new JSObject();
            out.put("ext", container.ext);
            out.put("mime", container.mime);
            call.resolve(out);
          } catch (Exception e) {
            call.reject("Gagal memeriksa berkas: " + e.getMessage(), "IO");
          }
        });
  }

  /**
   * Menyelesaikan unduhan di sisi native: sematkan tag + sampul ke dalam berkas (usaha terbaik; wadah yang tidak
   * didukung dibiarkan), ganti nama atomik dari .part ke nama akhir, tulis salinan metadata (jurnal) lalu, bila
   * diminta, salin ke Music/MusicVerse. Setelah berkas jadi, metadata ikut tertulis di native, jadi aplikasi
   * yang mati di tengah jalan tidak meninggalkan lagu tanpa catatan.
   */
  @PluginMethod
  public void finalizeDownload(PluginCall call) {
    final File part = externalFile(call.getString("partPath"));
    final File dest = externalFile(call.getString("finalPath"));
    final File cover = externalFile(call.getString("coverPath"));
    final File metaFile = externalFile(call.getString("metaPath"));
    final String metaJson = call.getString("metaJson");
    final String exportName = call.getString("exportName");
    final boolean export = Boolean.TRUE.equals(call.getBoolean("exportToMusic", false));
    final AudioFinalizer.Tags tags = new AudioFinalizer.Tags();
    String title = call.getString("title");
    String artist = call.getString("artist");
    String album = call.getString("album");
    tags.title = title == null ? "" : title;
    tags.artist = artist == null ? "" : artist;
    tags.album = album == null ? "" : album;
    if (part == null || dest == null || !part.isFile()) {
      call.reject("Parameter / berkas unduhan tidak valid", "INVALID");
      return;
    }
    downloadPool.execute(
        () -> {
          try {
            AudioFinalizer.Container container = AudioFinalizer.sniff(part);
            if (container == null) {
              call.reject("Isi berkas bukan audio yang dikenal", "NOT_AUDIO");
              return;
            }
            boolean tagged = false;
            try {
              if (cover != null && cover.isFile() && cover.length() < 8L * 1024 * 1024) {
                tags.cover = AudioFinalizer.readAll(cover);
              }
              tagged = AudioFinalizer.tag(part, container, tags);
            } catch (Exception e) {
              // Tag hanya pemanis: berkas tetap sah tanpa tag.
              android.util.Log.w("MusicVerse", "Tag gagal disematkan: " + e);
            }
            File parent = dest.getParentFile();
            if (parent != null && !parent.isDirectory() && !parent.mkdirs()) {
              call.reject("Folder tujuan tidak bisa dibuat", "IO");
              return;
            }
            AudioFinalizer.moveReplace(part, dest);
            if (metaFile != null && metaJson != null) {
              try {
                File parentMeta = metaFile.getParentFile();
                if (parentMeta != null) parentMeta.mkdirs();
                File tmp = new File(metaFile.getPath() + ".tmp");
                try (java.io.FileOutputStream fos = new java.io.FileOutputStream(tmp)) {
                  fos.write(metaJson.getBytes(java.nio.charset.StandardCharsets.UTF_8));
                }
                AudioFinalizer.moveReplace(tmp, metaFile);
              } catch (Exception e) {
                android.util.Log.w("MusicVerse", "Metadata tidak tertulis: " + e);
              }
            }
            String exportError = null;
            boolean exported = false;
            if (export && exportName != null && !exportName.isEmpty()) {
              exportError = MediaExporter.export(getContext(), dest, exportName, container.mime);
              exported = exportError == null;
            }
            JSObject out = new JSObject();
            out.put("ext", container.ext);
            out.put("mime", container.mime);
            out.put("bytes", dest.length());
            out.put("tagged", tagged);
            out.put("exported", exported);
            if (exportError != null) out.put("exportError", exportError);
            call.resolve(out);
          } catch (Exception e) {
            call.reject("Gagal menyelesaikan unduhan: " + e.getMessage(), "IO");
          }
        });
  }

  /**
   * Merapikan SATU unduhan lama: tag + sampul disematkan dan berkas diberi ekstensi sesuai isinya (lihat
   * AudioFinalizer.upgradeInPlace). `finalPath` harus di folder yang sama dengan `path`. Menolak dengan code NOT_AUDIO
   * (isi bukan audio), NO_SPACE (ruang kurang), atau IO.
   */
  @PluginMethod
  public void upgradeDownload(PluginCall call) {
    final File src = externalFile(call.getString("path"));
    final File dest = externalFile(call.getString("finalPath"));
    final File cover = externalFile(call.getString("coverPath"));
    final File metaFile = externalFile(call.getString("metaPath"));
    final String metaJson = call.getString("metaJson");
    final AudioFinalizer.Tags tags = new AudioFinalizer.Tags();
    String title = call.getString("title");
    String artist = call.getString("artist");
    String album = call.getString("album");
    tags.title = title == null ? "" : title;
    tags.artist = artist == null ? "" : artist;
    tags.album = album == null ? "" : album;
    if (src == null || dest == null || !src.isFile() || !java.util.Objects.equals(src.getParentFile(), dest.getParentFile())) {
      call.reject("Parameter / berkas tidak valid", "INVALID");
      return;
    }
    downloadPool.execute(
        () -> {
          try {
            if (cover != null && cover.isFile() && cover.length() < 8L * 1024 * 1024) tags.cover = AudioFinalizer.readAll(cover);
            AudioFinalizer.Upgrade result = AudioFinalizer.upgradeInPlace(src, dest, tags, metaFile, metaJson);
            JSObject out = new JSObject();
            out.put("ext", result.container.ext);
            out.put("mime", result.container.mime);
            out.put("bytes", result.bytes);
            out.put("tagged", result.tagged);
            out.put("renamed", result.renamed);
            call.resolve(out);
          } catch (AudioFinalizer.NotAudioException e) {
            call.reject("Isi berkas bukan audio yang dikenal", "NOT_AUDIO");
          } catch (AudioFinalizer.NoSpaceException e) {
            call.reject("Ruang penyimpanan tidak cukup", "NO_SPACE");
          } catch (Exception e) {
            call.reject("Gagal merapikan unduhan: " + e.getMessage(), "IO");
          }
        });
  }

  /** Menyalin lagu yang SUDAH diunduh ke Music/MusicVerse (untuk unduhan lama saat opsi folder Musik dinyalakan). */
  @PluginMethod
  public void exportDownload(PluginCall call) {
    final File file = externalFile(call.getString("path"));
    final String name = call.getString("exportName");
    final String mime = call.getString("mime");
    if (file == null || !file.isFile() || name == null || name.isEmpty()) {
      call.reject("Berkas / nama tidak valid", "INVALID");
      return;
    }
    downloadPool.execute(
        () -> {
          String error = MediaExporter.export(getContext(), file, name, mime == null ? "audio/mpeg" : mime);
          JSObject out = new JSObject();
          out.put("exported", error == null);
          if (error != null) out.put("exportError", error);
          call.resolve(out);
        });
  }

  @PluginMethod
  public void cancelDownload(PluginCall call) {
    String id = call.getString("id");
    if (id != null) NativeDownloader.cancel(id);
    call.resolve();
  }

  /**
   * Menyerahkan satu lagu yang URL-nya SUDAH di-resolve ke antrean native (lihat DownloadQueue). Antrean mengerjakan sisanya
   * tanpa WebView, jadi tetap selesai walau app digeser dari recent apps. Hasil datang lewat event `queueResult`.
   */
  @PluginMethod
  public void queueAdd(PluginCall call) {
    JSObject job = call.getObject("job");
    if (job == null || !DownloadQueue.add(job)) {
      call.reject("Data unduhan tidak lengkap", "INVALID");
      return;
    }
    call.resolve();
  }

  /** Mencabut satu lagu yang belum mulai. `removed` false = sudah berjalan (tidak bisa dihentikan di tengah). */
  @PluginMethod
  public void queueCancel(PluginCall call) {
    String key = call.getString("key");
    JSObject out = new JSObject();
    out.put("removed", key != null && DownloadQueue.cancel(key));
    call.resolve(out);
  }

  /** Mencabut semua lagu yang belum mulai (jeda / syarat Wi-Fi-cas); lagu yang sudah berjalan diselesaikan. */
  @PluginMethod
  public void queueRelease(PluginCall call) {
    JSArray keys = new JSArray();
    for (String key : DownloadQueue.release()) keys.put(key);
    JSObject out = new JSObject();
    out.put("released", keys);
    call.resolve(out);
  }

  /** Dipanggil saat app dibuka: lagu yang masih di native + hasil yang terjadi selagi JS mati. */
  @PluginMethod
  public void queueSync(PluginCall call) {
    try {
      call.resolve(new JSObject(DownloadQueue.sync().toString()));
    } catch (org.json.JSONException e) {
      call.reject("Antrean native tidak terbaca", "IO");
    }
  }

  @PluginMethod
  public void queueAck(PluginCall call) {
    java.util.List<String> keys = new java.util.ArrayList<>();
    JSArray array = call.getArray("keys");
    if (array != null) {
      for (int i = 0; i < array.length(); i++) {
        String key = array.optString(i, "");
        if (!key.isEmpty()) keys.add(key);
      }
    }
    DownloadQueue.ack(keys);
    call.resolve();
  }

  @PluginMethod
  public void queueConfigure(PluginCall call) {
    DownloadQueue.configure(
        Boolean.TRUE.equals(call.getBoolean("wifiOnly", false)), Boolean.TRUE.equals(call.getBoolean("chargingOnly", false)));
    call.resolve();
  }

  @PluginMethod
  public void showDownloadProgress(PluginCall call) {
    boolean done = Boolean.TRUE.equals(call.getBoolean("done", false));
    boolean waiting = Boolean.TRUE.equals(call.getBoolean("waiting", false));
    Object percentValue = call.getData().opt("percent");
    Integer percent = percentValue instanceof Number ? Integer.valueOf((int) Math.round(((Number) percentValue).doubleValue())) : null;
    try {
      // Notifikasi dimiliki DownloadService (foreground service) supaya unduhan tetap jalan di latar belakang.
      DownloadService.update(getContext(), call.getString("title", "Unduhan"), call.getString("text", ""), percent, done, waiting, call.getString("action"));
      call.resolve();
    } catch (RuntimeException e) {
      call.reject("Notifikasi unduhan gagal: " + e.getMessage());
    }
  }

  /** Jenis koneksi aktif: dipakai pilihan "Unduh hanya lewat Wi-Fi". Tanpa izin / gagal baca = "unknown" (tidak dianggap seluler). */
  /** Sidik jari kode native APK ini (ditanam setup-android.mjs). Dipakai pembaruan tampilan OTA untuk mengecek kecocokan. */
  @PluginMethod
  public void nativeHash(PluginCall call) {
    int id = getContext().getResources().getIdentifier("mv_native_hash", "string", getContext().getPackageName());
    JSObject out = new JSObject();
    out.put("hash", id == 0 ? "" : getContext().getString(id));
    call.resolve(out);
  }

  @PluginMethod
  public void getNetworkType(PluginCall call) {
    String type = "unknown";
    boolean metered = false;
    try {
      ConnectivityManager cm = (ConnectivityManager) getContext().getSystemService(Context.CONNECTIVITY_SERVICE);
      if (cm != null) {
        Network network = cm.getActiveNetwork();
        NetworkCapabilities caps = network == null ? null : cm.getNetworkCapabilities(network);
        if (caps == null) type = "none";
        else if (caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) type = "wifi";
        else if (caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)) type = "ethernet";
        else if (caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)) type = "cellular";
        else type = "other";
        metered = cm.isActiveNetworkMetered();
      }
    } catch (RuntimeException e) {
      type = "unknown";
    }
    JSObject result = new JSObject();
    result.put("type", type);
    result.put("metered", metered);
    call.resolve(result);
  }

  /** Apakah aplikasi lain sedang memutar audio atau ada panggilan/dering. Dipakai putar-ulang otomatis setelah gangguan. */
  @PluginMethod
  public void isOtherAudioActive(PluginCall call) {
    boolean busy = false;
    try {
      AudioManager am = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
      if (am != null) busy = am.isMusicActive() || am.getMode() != AudioManager.MODE_NORMAL;
    } catch (RuntimeException e) {
      busy = false;
    }
    JSObject result = new JSObject();
    result.put("busy", busy);
    call.resolve(result);
  }

  /** Apakah HP sedang dicas (dipakai pilihan "Unduh hanya saat dicas"). Gagal baca = "unknown" (tidak dianggap lepas cas). */
  @PluginMethod
  public void getPowerState(PluginCall call) {
    boolean known = false;
    boolean charging = false;
    try {
      Intent battery = getContext().registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
      if (battery != null) {
        int plugged = battery.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0);
        charging = plugged != 0;
        known = true;
      }
    } catch (RuntimeException e) {
      known = false;
    }
    JSObject result = new JSObject();
    result.put("known", known);
    result.put("charging", charging);
    call.resolve(result);
  }

  @PluginMethod
  public void clearDownloadProgress(PluginCall call) {
    DownloadService.stop(getContext());
    call.resolve();
  }

  /** Membaca angka apa pun dari JS (Integer / Long / Double / string angka) sebagai long; 0 jika kosong atau tidak valid. */
  private static long readLong(PluginCall call, String name) {
    Object value = call.getData().opt(name);
    if (value instanceof Number) {
      double d = ((Number) value).doubleValue();
      return Double.isNaN(d) || Double.isInfinite(d) ? 0L : Math.max(0L, Math.round(d));
    }
    if (value instanceof String) {
      try {
        return Math.max(0L, Math.round(Double.parseDouble(((String) value).trim())));
      } catch (NumberFormatException ignored) {
        return 0L;
      }
    }
    return 0L;
  }

  @PluginMethod
  public void updateNowPlaying(PluginCall call) {
    PlaybackService.State state = new PlaybackService.State();
    state.title = call.getString("title", "");
    state.artist = call.getString("artist", "");
    state.album = call.getString("album", "");
    // Angka dari JS tiba sebagai Integer (muat di 32-bit) atau Double, BUKAN Long: PluginCall.getLong() hanya mengenali Long
    // sehingga selalu mengembalikan nilai bawaan 0 => durasi dan posisi notifikasi selalu 0 (tanpa waktu, bilah tidak bergerak).
    state.durationMs = readLong(call, "durationMs");
    state.positionMs = readLong(call, "positionMs");
    state.playing = Boolean.TRUE.equals(call.getBoolean("playing", false));
    state.loading = Boolean.TRUE.equals(call.getBoolean("loading", false));
    state.hasNext = Boolean.TRUE.equals(call.getBoolean("hasNext", false));
    state.hasPrevious = Boolean.TRUE.equals(call.getBoolean("hasPrevious", false));
    state.interrupted = Boolean.TRUE.equals(call.getBoolean("interrupted", false));
    state.resetCover = Boolean.TRUE.equals(call.getBoolean("resetCover", false));
    String cover = call.getString("coverBase64");
    if (cover != null && !cover.isEmpty()) {
      try {
        byte[] bytes = Base64.decode(cover, Base64.DEFAULT);
        Bitmap bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
        if (bitmap != null) state.cover = bitmap;
      } catch (IllegalArgumentException ignored) {
        // Sampul rusak: pakai sampul bawaan APK.
      }
    }
    try {
      PlaybackService.update(getContext(), state);
      call.resolve();
    } catch (RuntimeException e) {
      // Mis. ForegroundServiceStartNotAllowedException saat app di latar belakang dan service belum jalan.
      call.reject("Service pemutaran tidak bisa dimulai: " + e.getMessage());
    }
  }

  // ---- Mesin audio ExoPlayer (PlaybackService) ----

  @PluginMethod
  public void engineLoad(PluginCall call) {
    String url = call.getString("url");
    if (url == null || url.isEmpty()) {
      call.reject("URL audio kosong.");
      return;
    }
    try {
      String ytId = call.getString("ytId");
      PlaybackService.engineLoad(getContext(), url, readLong(call, "startMs"), call.getString("cacheKey"), ytId == null ? "" : ytId);
      call.resolve();
    } catch (RuntimeException e) {
      call.reject("Mesin audio tidak bisa dimulai: " + e.getMessage());
    }
  }

  @PluginMethod
  public void engineResume(PluginCall call) {
    JSObject result = new JSObject();
    result.put("loaded", PlaybackService.engineResume());
    call.resolve(result);
  }

  @PluginMethod
  public void enginePause(PluginCall call) {
    PlaybackService.enginePause();
    call.resolve();
  }

  @PluginMethod
  public void engineSeek(PluginCall call) {
    PlaybackService.engineSeek(readLong(call, "positionMs"));
    call.resolve();
  }

  @PluginMethod
  public void engineStop(PluginCall call) {
    PlaybackService.engineStop();
    call.resolve();
  }

  @PluginMethod
  public void engineStandbyLoad(PluginCall call) {
    String url = call.getString("url");
    if (url == null || url.isEmpty()) {
      call.reject("URL audio kosong.");
      return;
    }
    PlaybackService.engineStandbyLoad(url, call.getString("cacheKey"));
    call.resolve();
  }

  @PluginMethod
  public void engineSetDirect(PluginCall call) {
    PlaybackService.engineSetDirect(Boolean.TRUE.equals(call.getBoolean("enabled", false)));
    call.resolve();
  }

  @PluginMethod
  public void engineSetAutoResume(PluginCall call) {
    PlaybackService.engineSetAutoResume(!Boolean.FALSE.equals(call.getBoolean("enabled", true)));
    call.resolve();
  }

  @PluginMethod
  public void engineSetAutoAdvance(PluginCall call) {
    PlaybackService.engineSetAutoAdvance(Boolean.TRUE.equals(call.getBoolean("on", false)));
    call.resolve();
  }

  /**
   * Daftar lagu berikutnya yang URL-nya sudah di-resolve JS. Native memutarnya sendiri saat lagu aktif selesai, jadi
   * pemutaran berlanjut walau WebView dibekukan di latar belakang. Daftar kosong = native tidak pindah lagu sendiri.
   */
  @PluginMethod
  public void engineSetUpcoming(PluginCall call) {
    java.util.List<PlaybackService.UpcomingItem> list = new java.util.ArrayList<>();
    JSArray items = call.getArray("items");
    if (items != null) {
      for (int i = 0; i < items.length(); i++) {
        try {
          org.json.JSONObject o = items.getJSONObject(i);
          String url = o.optString("url", "");
          // Tanpa URL = belum di-resolve JS: native mencarinya sendiri (butuh judul).
          if (url.isEmpty() && o.optString("title", "").isEmpty()) continue;
          PlaybackService.UpcomingItem upItem =
              new PlaybackService.UpcomingItem(
                  o.optInt("index", -1),
                  url,
                  o.has("cacheKey") && !o.isNull("cacheKey") ? o.optString("cacheKey") : null,
                  o.optString("title", ""),
                  o.optString("artist", ""),
                  o.optString("album", ""),
                  o.optString("cover", ""),
                  o.optLong("durationMs", 0),
                  (float) o.optDouble("norm", 1.0),
                  o.optString("trackId", ""),
                  o.optString("trackUrl", ""));
          // Id video YouTube dari JS (bila URL-nya stream YouTube langsung): dipakai native untuk mengambil link baru.
          if (!url.isEmpty()) upItem.ytId = o.optString("ytId", "");
          list.add(upItem);
        } catch (org.json.JSONException ignored) {
          // butir rusak dilewati
        }
      }
    }
    // Info radio (opsional): antrean JS berakhir di sini + radio menyala. Tanpa itu native tidak menambah lagu radio.
    int radioTail = -1;
    java.util.List<String> radioExclude = new java.util.ArrayList<>();
    com.getcapacitor.JSObject radio = call.getObject("radio");
    if (radio != null) {
      radioTail = radio.optInt("tailIndex", -1);
      org.json.JSONArray keys = radio.optJSONArray("exclude");
      if (keys != null) {
        for (int i = 0; i < keys.length(); i++) {
          String key = keys.optString(i, "");
          if (!key.isEmpty()) radioExclude.add(key);
        }
      }
    }
    PlaybackService.engineSetUpcoming(call.getInt("currentIndex", -1), list, radioTail, radioExclude);
    call.resolve();
  }

  /** Tambahan radio yang dicari native saat JS beku (urut indeks); JS memasukkannya ke antrean lebih dulu saat bangun. */
  @PluginMethod
  public void radioExtrasRead(PluginCall call) {
    JSObject out = new JSObject();
    out.put("items", RadioExtras.read(getContext()));
    call.resolve(out);
  }

  /** JS sudah memasukkan tambahan radio ke antreannya (atau membuangnya): kosongkan daftar. */
  @PluginMethod
  public void radioExtrasClear(PluginCall call) {
    RadioExtras.clear(getContext());
    call.resolve();
  }

  /** Lagu yang dimulai native saat JS beku/mati dan belum dimasukkan JS ke Riwayat (urut lama ke baru). */
  @PluginMethod
  public void playJournalRead(PluginCall call) {
    JSObject out = new JSObject();
    out.put("items", PlayJournal.read(getContext()));
    call.resolve(out);
  }

  /**
   * Lagu aktif + posisi menurut pemutar native (untuk menyamakan JS setelah activity dihancurkan). `found` false = tidak ada
   * catatan; `live` true = pemutar native masih memegang audionya (bisa diadopsi tanpa memuat ulang).
   */
  @PluginMethod
  public void nativeSessionRead(PluginCall call) {
    JSObject out = new JSObject();
    org.json.JSONObject o = NativeSession.read(getContext());
    out.put("found", o != null);
    if (o != null) {
      java.util.Iterator<String> keys = o.keys();
      while (keys.hasNext()) {
        String k = keys.next();
        try {
          out.put(k, o.get(k));
        } catch (org.json.JSONException ignored) {
          // kunci rusak dilewati
        }
      }
    }
    call.resolve(out);
  }

  /** JS sudah mengadopsi sesi native: hapus catatannya. */
  @PluginMethod
  public void nativeSessionClear(PluginCall call) {
    NativeSession.clear(getContext());
    call.resolve();
  }

  /** Menghapus entri jurnal dengan `at` <= through, setelah JS selesai memasukkannya ke Riwayat. */
  @PluginMethod
  public void playJournalClear(PluginCall call) {
    PlayJournal.clearThrough(getContext(), readLong(call, "through"));
    call.resolve();
  }

  @PluginMethod
  public void engineClearStandby(PluginCall call) {
    PlaybackService.engineClearStandby();
    call.resolve();
  }

  @PluginMethod
  public void engineCrossfade(PluginCall call) {
    PlaybackService.engineCrossfade(readLong(call, "durationMs"), ok -> {
      JSObject result = new JSObject();
      result.put("switched", ok);
      call.resolve(result);
    });
  }

  @PluginMethod
  public void engineSetVolume(PluginCall call) {
    Double volume = call.getDouble("volume", 1.0);
    PlaybackService.engineSetVolume(volume == null ? 1f : volume.floatValue());
    call.resolve();
  }

  @PluginMethod
  public void engineSetNorm(PluginCall call) {
    Double gain = call.getDouble("gain", 1.0);
    PlaybackService.engineSetNorm(gain == null ? 1f : gain.floatValue());
    call.resolve();
  }

  @PluginMethod
  public void engineSetSleep(PluginCall call) {
    PlaybackService.engineSetSleep(readLong(call, "endsAtMs"));
    call.resolve();
  }

  @PluginMethod
  public void engineSetSpeed(PluginCall call) {
    Double speed = call.getDouble("speed", 1.0);
    PlaybackService.engineSetSpeed(speed == null ? 1f : speed.floatValue());
    call.resolve();
  }

  @PluginMethod
  public void engineSetEq(PluginCall call) {
    boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", false));
    double[] gains = null;
    JSArray array = call.getArray("gains");
    if (array != null && array.length() == 10) {
      gains = new double[10];
      for (int i = 0; i < 10; i++) gains[i] = array.optDouble(i, 0.0);
    }
    PlaybackService.engineSetEq(enabled, gains);
    call.resolve();
  }

  // ---- Android Auto ----

  /** Daftar telusur untuk Android Auto (JSON). Disimpan native supaya bisa ditelusuri walau WebView belum hidup. */
  @PluginMethod
  public void setAutoBrowse(PluginCall call) {
    AutoBridge.setBrowse(getContext(), call.getString("json", ""));
    call.resolve();
  }

  /** Pustaka untuk telusur Android Auto: Lagu Disukai, Playlist saya, Unduhan (JSON). Disimpan native seperti `setAutoBrowse`. */
  @PluginMethod
  public void setAutoLibrary(PluginCall call) {
    AutoBridge.setLibrary(getContext(), call.getString("json", ""));
    call.resolve();
  }

  /** Permintaan putar dari Android Auto yang menunggu (sekali pakai). Objek kosong = tidak ada. */
  @PluginMethod
  public void consumeAutoRequest(PluginCall call) {
    JSObject result = new JSObject();
    String[] request = AutoBridge.consume();
    if (request != null) {
      result.put("kind", request[0]);
      result.put("payload", request[1]);
    }
    call.resolve(result);
  }

  /** Kembali ke layar sebelumnya (mis. layar utama) tanpa menutup aplikasi; dipakai setelah lanjut memutar dari widget. */
  @PluginMethod
  public void sendToBackground(PluginCall call) {
    try {
      if (getActivity() != null) getActivity().moveTaskToBack(true);
    } catch (RuntimeException ignored) {
      // tidak penting
    }
    call.resolve();
  }

  /** JS -> widget: lagu aktif sedang disukai atau tidak (hati terisi di widget). */
  @PluginMethod
  public void setWidgetLiked(PluginCall call) {
    PlaybackService.setWidgetLiked(getContext(), call.getString("title", ""), Boolean.TRUE.equals(call.getBoolean("liked", false)));
    call.resolve();
  }

  @PluginMethod
  public void stopPlayback(PluginCall call) {
    PlaybackService.stop(getContext());
    call.resolve();
  }

  @PluginMethod
  public void requestNotificationPermission(PluginCall call) {
    if (Build.VERSION.SDK_INT < 33 || getPermissionState("notifications") == PermissionState.GRANTED) {
      JSObject result = new JSObject();
      result.put("granted", true);
      call.resolve(result);
      return;
    }
    requestPermissionForAlias("notifications", call, "notificationPermissionCallback");
  }

  @PermissionCallback
  private void notificationPermissionCallback(PluginCall call) {
    JSObject result = new JSObject();
    result.put("granted", getPermissionState("notifications") == PermissionState.GRANTED);
    call.resolve(result);
  }

  // ---- Folder "Lokal": audio di HP di luar unduhan MusicVerse (hanya membaca MediaStore) ----

  private static String audioAlias() {
    return Build.VERSION.SDK_INT >= 33 ? "audio33" : "audioLegacy";
  }

  private boolean hasAudioPermission() {
    return getPermissionState(audioAlias()) == PermissionState.GRANTED;
  }

  @PluginMethod
  public void localAudioPermission(PluginCall call) {
    JSObject result = new JSObject();
    result.put("granted", hasAudioPermission());
    call.resolve(result);
  }

  @PluginMethod
  public void requestLocalAudioPermission(PluginCall call) {
    if (hasAudioPermission()) {
      JSObject result = new JSObject();
      result.put("granted", true);
      call.resolve(result);
      return;
    }
    requestPermissionForAlias(audioAlias(), call, "localAudioPermissionCallback");
  }

  @PermissionCallback
  private void localAudioPermissionCallback(PluginCall call) {
    JSObject result = new JSObject();
    result.put("granted", hasAudioPermission());
    call.resolve(result);
  }

  /** Semua audio di HP kecuali milik MusicVerse (lihat LocalAudioScanner). Gagal dengan code PERMISSION bila izin belum ada. */
  @PluginMethod
  public void scanLocalAudio(PluginCall call) {
    if (!hasAudioPermission()) {
      call.reject("Izin audio belum diberikan", "PERMISSION");
      return;
    }
    downloadPool.execute(
        () -> {
          try {
            JSObject out = new JSObject();
            out.put("tracks", LocalAudioScanner.scan(getContext()));
            call.resolve(out);
          } catch (Exception e) {
            call.reject("Gagal memindai audio: " + e.getMessage(), "IO");
          }
        });
  }

  /** Menyiapkan sampul lagu lokal di cache/localcovers/<id>.jpg; `has` false = lagu tidak punya sampul. */
  @PluginMethod
  public void localAudioCover(PluginCall call) {
    final String raw = call.getString("id");
    if (raw == null || !raw.matches("\\d{1,18}") || !hasAudioPermission()) {
      call.reject("ID / izin tidak valid", "INVALID");
      return;
    }
    final long id = Long.parseLong(raw);
    downloadPool.execute(
        () -> {
          JSObject out = new JSObject();
          out.put("has", LocalAudioScanner.cover(getContext(), id));
          call.resolve(out);
        });
  }

  /** Halaman info aplikasi: dipakai bila izin audio ditolak permanen (dialog izin tidak muncul lagi). */
  @PluginMethod
  public void openAppSettings(PluginCall call) {
    Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName()));
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    try {
      getContext().startActivity(intent);
      call.resolve();
    } catch (RuntimeException e) {
      call.reject("Tidak bisa membuka pengaturan aplikasi.");
    }
  }

  @PluginMethod
  public void isIgnoringBatteryOptimizations(PluginCall call) {
    PowerManager pm = (PowerManager) getContext().getSystemService(android.content.Context.POWER_SERVICE);
    boolean ignoring = pm == null || Build.VERSION.SDK_INT < 23 || pm.isIgnoringBatteryOptimizations(getContext().getPackageName());
    JSObject result = new JSObject();
    result.put("ignoring", ignoring);
    call.resolve(result);
  }

  @PluginMethod
  public void openBatterySettings(PluginCall call) {
    // Dialog sistem langsung ("Izinkan selalu berjalan di latar belakang?"): satu ketukan, tanpa mencari app di daftar.
    // Butuh izin REQUEST_IGNORE_BATTERY_OPTIMIZATIONS di manifest; jika ditolak sistem, jatuh ke daftar pengaturan.
    PowerManager pm = (PowerManager) getContext().getSystemService(android.content.Context.POWER_SERVICE);
    if (Build.VERSION.SDK_INT >= 23 && pm != null && !pm.isIgnoringBatteryOptimizations(getContext().getPackageName())) {
      try {
        Intent direct = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + getContext().getPackageName()));
        direct.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(direct);
        call.resolve();
        return;
      } catch (RuntimeException ignored) {
        // lanjut ke daftar pengaturan
      }
    }
    Intent intent = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    try {
      getContext().startActivity(intent);
      call.resolve();
    } catch (RuntimeException e) {
      call.reject("Tidak bisa membuka pengaturan baterai.");
    }
  }

  /** Android 11+: "Jeda aktivitas aplikasi jika tidak digunakan" (auto-revoke / hibernasi). true = aplikasi sudah dikecualikan atau tidak berlaku. */
  @PluginMethod
  public void isUnusedAppRestrictionExempt(PluginCall call) {
    boolean exempt = true;
    if (Build.VERSION.SDK_INT >= 30) {
      try {
        exempt = getContext().getPackageManager().isAutoRevokeWhitelisted();
      } catch (RuntimeException ignored) {
        exempt = true; // tidak bisa dicek: jangan mengganggu pengguna
      }
    }
    JSObject result = new JSObject();
    result.put("exempt", exempt);
    call.resolve(result);
  }

  /** Membuka layar izin aplikasi tempat saklar "Jeda aktivitas aplikasi jika tidak digunakan" berada. */
  @PluginMethod
  public void openUnusedAppRestrictionSettings(PluginCall call) {
    String pkg = getContext().getPackageName();
    Uri uri = Uri.parse("package:" + pkg);
    if (Build.VERSION.SDK_INT >= 30) {
      try {
        Intent direct = new Intent(Intent.ACTION_AUTO_REVOKE_PERMISSIONS, uri);
        direct.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(direct);
        call.resolve();
        return;
      } catch (RuntimeException ignored) {
        // jatuh ke halaman info aplikasi
      }
    }
    try {
      Intent details = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, uri);
      details.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      getContext().startActivity(details);
      call.resolve();
    } catch (RuntimeException e) {
      call.reject("Tidak bisa membuka pengaturan aplikasi.");
    }
  }
}
