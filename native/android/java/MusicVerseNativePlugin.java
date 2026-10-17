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
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import android.util.Base64;
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
    permissions = {@Permission(strings = {Manifest.permission.POST_NOTIFICATIONS}, alias = "notifications")})
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

  @Override
  public void load() {
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
  }

  @Override
  protected void handleOnDestroy() {
    PlaybackService.setListener(null);
    DownloadService.setListener(null);
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
    Intent intent = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    try {
      getContext().startActivity(intent);
      call.resolve();
    } catch (RuntimeException e) {
      call.reject("Tidak bisa membuka pengaturan baterai.");
    }
  }
}
