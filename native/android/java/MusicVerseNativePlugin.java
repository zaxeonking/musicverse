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
import android.database.Cursor;
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
    return new File(getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), UPDATE_FILE);
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
      request.setDestinationInExternalFilesDir(getContext(), Environment.DIRECTORY_DOWNLOADS, UPDATE_FILE);
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
    Context context = getContext();
    NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
    if (nm == null) {
      call.resolve();
      return;
    }
    if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(DL_CHANNEL) == null) {
      NotificationChannel channel = new NotificationChannel(DL_CHANNEL, "Unduhan lagu", NotificationManager.IMPORTANCE_LOW);
      channel.setDescription("Progres unduhan lagu untuk diputar offline");
      channel.setShowBadge(false);
      channel.setSound(null, null);
      nm.createNotificationChannel(channel);
    }
    boolean done = Boolean.TRUE.equals(call.getBoolean("done", false));
    Integer percent = call.getInt("percent");
    Notification.Builder builder = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(context, DL_CHANNEL) : new Notification.Builder(context);
    builder
        .setSmallIcon(R.drawable.ic_stat_musicverse)
        .setContentTitle(call.getString("title", "Unduhan"))
        .setContentText(call.getString("text", ""))
        .setOnlyAlertOnce(true)
        .setOngoing(!done)
        .setAutoCancel(done);
    if (done) builder.setProgress(0, 0, false);
    else if (percent == null) builder.setProgress(0, 0, true);
    else builder.setProgress(100, Math.max(0, Math.min(100, percent)), false);
    Intent launch = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
    if (launch != null) {
      int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
      builder.setContentIntent(PendingIntent.getActivity(context, 0, launch, flags));
    }
    try {
      nm.notify(DL_NOTIFICATION_ID, builder.build());
      call.resolve();
    } catch (RuntimeException e) {
      call.reject("Notifikasi unduhan gagal: " + e.getMessage());
    }
  }

  @PluginMethod
  public void clearDownloadProgress(PluginCall call) {
    NotificationManager nm = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
    if (nm != null) nm.cancel(DL_NOTIFICATION_ID);
    call.resolve();
  }

  @PluginMethod
  public void updateNowPlaying(PluginCall call) {
    PlaybackService.State state = new PlaybackService.State();
    state.title = call.getString("title", "");
    state.artist = call.getString("artist", "");
    state.album = call.getString("album", "");
    state.durationMs = call.getLong("durationMs", 0L);
    state.positionMs = call.getLong("positionMs", 0L);
    state.playing = Boolean.TRUE.equals(call.getBoolean("playing", false));
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
