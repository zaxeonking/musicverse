package __APP_ID__;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.net.wifi.WifiManager;
import android.os.PowerManager;
import android.os.SystemClock;

/**
 * Foreground service (tipe dataSync) yang menjaga unduhan lagu tetap berjalan saat app di latar belakang
 * atau layar mati. Unduhan sendiri dijalankan JS di WebView; service ini hanya menjaga proses tetap hidup
 * (notifikasi foreground + PARTIAL_WAKE_LOCK) dan menjadi pemilik notifikasi progres unduhan.
 *
 * Keadaan dari JS:
 *  - berjalan (done=false, waiting=false): foreground + wake lock + bilah progres.
 *  - menunggu syarat Wi-Fi/cas (waiting=true): foreground tetap ada supaya proses hidup dan bisa lanjut sendiri,
 *    tetapi TANPA wake lock (hemat baterai).
 *  - selesai / dijeda pengguna (done=true): wake lock dilepas, notifikasi dilepas dari foreground dan bisa disapu,
 *    service berhenti.
 */
public class DownloadService extends Service {
  static final String CHANNEL = "musicverse_downloads";
  static final int NOTIFICATION_ID = 4242;
  /** Wake lock otomatis lepas bila JS berhenti memperbarui (proses mati / macet), supaya tidak bocor. */
  private static final long WAKE_LOCK_MS = 10 * 60 * 1000L;
  /** Tanpa kabar dari JS selama ini = proses unduhan sudah mati; service ikut berhenti supaya notifikasi tidak menggantung. */
  private static final long JS_SILENCE_LIMIT_MS = 15 * 60 * 1000L;
  private static final long WATCHDOG_INTERVAL_MS = 30 * 1000L;

  static final String ACTION_PAUSE = "__APP_ID__.download.PAUSE";
  static final String ACTION_RESUME = "__APP_ID__.download.RESUME";

  /** Penerima tombol notifikasi (Jeda / Lanjutkan); dipasang plugin dan meneruskannya ke JavaScript. */
  public interface ActionListener {
    void onAction(String action);
  }

  private static ActionListener listener;

  public static void setListener(ActionListener value) {
    listener = value;
  }

  static final class Payload {
    String title = "Unduhan";
    String text = "";
    Integer percent = null;
    boolean done = false;
    boolean waiting = false;
    /** Tombol di notifikasi: "pause" | "resume" | null. */
    String action = null;
  }

  private static volatile DownloadService instance;
  private static Payload pending;

  /** Dipanggil plugin (thread Capacitor). Memulai service bila perlu; bila tidak bisa, jatuh ke notifikasi biasa. */
  public static void update(Context context, String title, String text, Integer percent, boolean done, boolean waiting, String action) {
    Payload payload = new Payload();
    payload.title = title == null ? "Unduhan" : title;
    payload.text = text == null ? "" : text;
    payload.percent = percent;
    payload.done = done;
    payload.waiting = waiting;
    payload.action = action;

    DownloadService running = instance;
    if (running != null) {
      running.handler.post(() -> running.apply(payload));
      return;
    }
    if (done) {
      // Tidak ada service yang perlu dihentikan: cukup tampilkan notifikasi akhir yang bisa disapu.
      notifyPlain(context, payload);
      return;
    }
    pending = payload;
    try {
      Intent intent = new Intent(context, DownloadService.class);
      if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(intent);
      else context.startService(intent);
    } catch (RuntimeException e) {
      // Android 12+ melarang memulai foreground service dari latar belakang. Unduhan tetap jalan, hanya
      // tanpa perlindungan service; notifikasi biasa tetap ditampilkan.
      pending = null;
      notifyPlain(context, payload);
    }
  }

  /**
   * Tanda hidup dari pengunduh native: menyegarkan watchdog dan wake lock tanpa menyentuh notifikasi. Tanpa ini, bila WebView
   * dibekukan lama di latar belakang (JS tidak mengirim pembaruan), service mengira unduhan mati dan berhenti padahal
   * byte masih mengalir di thread native.
   */
  public static void keepAlive() {
    DownloadService running = instance;
    if (running == null) return;
    running.handler.post(
        () -> {
          if (running.stopped) return;
          running.lastJsUpdateAt = SystemClock.elapsedRealtime();
          if (running.wakeLock != null && running.wakeLock.isHeld()) running.wakeLock.acquire(WAKE_LOCK_MS);
        });
  }

  public static void stop(Context context) {
    pending = null;
    DownloadService running = instance;
    if (running != null) running.handler.post(running::shutdown);
    else context.stopService(new Intent(context, DownloadService.class));
    NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
    if (nm != null) nm.cancel(NOTIFICATION_ID);
  }

  private final Handler handler = new Handler(Looper.getMainLooper());
  private PowerManager.WakeLock wakeLock;
  /** Wi-Fi sering masuk mode hemat daya saat layar mati dan unduhan jadi macet; kunci ini menahannya tetap aktif. */
  private WifiManager.WifiLock wifiLock;
  private boolean foreground = false;
  private boolean stopped = false;
  private long lastJsUpdateAt = 0;
  private final Runnable watchdog = new Runnable() {
    @Override public void run() {
      if (stopped) return;
      if (SystemClock.elapsedRealtime() - lastJsUpdateAt > JS_SILENCE_LIMIT_MS) {
        shutdown();
        return;
      }
      handler.postDelayed(this, WATCHDOG_INTERVAL_MS);
    }
  };

  @Override
  public void onCreate() {
    super.onCreate();
    instance = this;
    PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
    if (pm != null) {
      wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "MusicVerse:download");
      wakeLock.setReferenceCounted(false);
    }
    try {
      WifiManager wm = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
      if (wm != null) {
        wifiLock = wm.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "MusicVerse:download");
        wifiLock.setReferenceCounted(false);
      }
    } catch (RuntimeException ignored) {
      wifiLock = null;
    }
    lastJsUpdateAt = SystemClock.elapsedRealtime();
    handler.postDelayed(watchdog, WATCHDOG_INTERVAL_MS);
    // Wajib: begitu startForegroundService() dipanggil, startForeground() harus menyusul segera.
    // Tanpa payload = service dimulai oleh tombol notifikasi (bukan foreground): tidak perlu startForeground.
    if (pending != null) {
      Payload first = pending;
      pending = null;
      apply(first);
      if (!foreground) startInForeground(buildNotification(this, first));
    }
  }

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    String action = intent == null ? null : intent.getAction();
    if (action != null) {
      ActionListener l = listener;
      if (l != null) {
        if (ACTION_PAUSE.equals(action)) l.onAction("pause");
        else if (ACTION_RESUME.equals(action)) l.onAction("resume");
      }
      // Dimulai hanya untuk meneruskan tombol: bila bukan foreground, berhenti lagi.
      if (!foreground) stopSelf();
    }
    return START_NOT_STICKY;
  }

  @Override
  public IBinder onBind(Intent intent) {
    return null;
  }

  /** Android 15+: batas waktu foreground service dataSync. Berhenti dengan rapi; unduhan lanjut tanpa perlindungan. */
  public void onTimeout(int startId, int fgsType) {
    shutdown();
  }

  @Override
  public void onTaskRemoved(Intent rootIntent) {
    // Aplikasi digeser dari recent apps: WebView ikut mati. Bila antrean NATIVE masih bekerja, service (dan notifikasinya)
    // tetap hidup sampai antrean selesai; kalau tidak, jangan tinggalkan notifikasi yatim.
    if (DownloadQueue.isBusy()) {
      lastJsUpdateAt = SystemClock.elapsedRealtime();
    } else {
      shutdown();
    }
    super.onTaskRemoved(rootIntent);
  }

  @Override
  public void onDestroy() {
    stopped = true;
    releaseWakeLock();
    if (instance == this) instance = null;
    handler.removeCallbacksAndMessages(null);
    super.onDestroy();
  }

  private void apply(Payload payload) {
    if (stopped) return;
    lastJsUpdateAt = SystemClock.elapsedRealtime();
    Notification notification = buildNotification(this, payload);
    NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
    if (payload.done) {
      releaseWakeLock();
      if (foreground) {
        // Lepas dari foreground tetapi biarkan notifikasi akhirnya tampil (bisa disapu).
        if (Build.VERSION.SDK_INT >= 24) stopForeground(STOP_FOREGROUND_DETACH);
        else stopForeground(false);
        foreground = false;
      }
      if (nm != null) nm.notify(NOTIFICATION_ID, notification);
      stopped = true;
      handler.removeCallbacks(watchdog);
      if (instance == this) instance = null;
      stopSelf();
      return;
    }
    if (payload.waiting) releaseWakeLock();
    else acquireWakeLock();
    if (!foreground) startInForeground(notification);
    else if (nm != null) nm.notify(NOTIFICATION_ID, notification);
  }

  private void startInForeground(Notification notification) {
    try {
      if (Build.VERSION.SDK_INT >= 29) {
        startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
      } else {
        startForeground(NOTIFICATION_ID, notification);
      }
      foreground = true;
    } catch (RuntimeException e) {
      // Tidak diizinkan jadi foreground (mis. dimulai dari latar belakang): jangan crash, berhenti saja.
      stopSelf();
    }
  }

  private void acquireWakeLock() {
    if (wakeLock != null) wakeLock.acquire(WAKE_LOCK_MS);
    try {
      if (wifiLock != null && !wifiLock.isHeld()) wifiLock.acquire();
    } catch (RuntimeException ignored) {
      // Izin / perangkat tidak mendukung: unduhan tetap jalan tanpa kunci Wi-Fi.
    }
  }

  private void releaseWakeLock() {
    if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
    try {
      if (wifiLock != null && wifiLock.isHeld()) wifiLock.release();
    } catch (RuntimeException ignored) {
      // sudah lepas
    }
  }

  void shutdown() {
    if (stopped) return;
    stopped = true;
    // Lepas referensi SEKARANG supaya pembaruan JS yang masih antre tidak menghidupkan lagi notifikasi yang baru dihapus.
    if (instance == this) instance = null;
    pending = null;
    handler.removeCallbacksAndMessages(null);
    releaseWakeLock();
    if (foreground) {
      stopForeground(true);
      foreground = false;
    }
    NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
    if (nm != null) nm.cancel(NOTIFICATION_ID);
    stopSelf();
  }

  private static void ensureChannel(Context context, NotificationManager nm) {
    if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(CHANNEL) == null) {
      NotificationChannel channel = new NotificationChannel(CHANNEL, "Unduhan lagu", NotificationManager.IMPORTANCE_LOW);
      channel.setDescription("Progres unduhan lagu untuk diputar offline");
      channel.setShowBadge(false);
      channel.setSound(null, null);
      nm.createNotificationChannel(channel);
    }
  }

  static Notification buildNotification(Context context, Payload payload) {
    NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
    if (nm != null) ensureChannel(context, nm);
    Notification.Builder builder = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(context, CHANNEL) : new Notification.Builder(context);
    boolean ongoing = !payload.done;
    builder
        .setSmallIcon(R.drawable.ic_stat_musicverse)
        .setContentTitle(payload.title)
        .setContentText(payload.text)
        .setOnlyAlertOnce(true)
        .setOngoing(ongoing)
        .setAutoCancel(payload.done);
    if ("pause".equals(payload.action) || "resume".equals(payload.action)) {
      boolean pause = "pause".equals(payload.action);
      Intent actionIntent = new Intent(context, DownloadService.class).setAction(pause ? ACTION_PAUSE : ACTION_RESUME);
      int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
      PendingIntent pi = PendingIntent.getService(context, pause ? 1 : 2, actionIntent, flags);
      builder.addAction(R.drawable.ic_stat_musicverse, pause ? "Jeda" : "Lanjutkan", pi);
    }
    if (payload.done || payload.waiting) builder.setProgress(0, 0, false);
    else if (payload.percent == null) builder.setProgress(0, 0, true);
    else builder.setProgress(100, Math.max(0, Math.min(100, payload.percent)), false);
    Intent launch = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
    if (launch != null) {
      int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
      builder.setContentIntent(PendingIntent.getActivity(context, 0, launch, flags));
    }
    return builder.build();
  }

  private static void notifyPlain(Context context, Payload payload) {
    NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
    if (nm == null) return;
    try {
      nm.notify(NOTIFICATION_ID, buildNotification(context, payload));
    } catch (RuntimeException ignored) {
      // Izin notifikasi ditolak.
    }
  }
}
