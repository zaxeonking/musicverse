package __APP_ID__;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.drawable.Icon;
import android.media.MediaMetadata;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.SystemClock;

/**
 * Foreground service (tipe mediaPlayback) untuk MusicVerse.
 *
 * Audio sendiri tetap diputar oleh WebView; service ini:
 *  1. menjaga proses tetap hidup + CPU menyala saat layar mati / app di latar belakang,
 *  2. menampilkan notifikasi media (judul, artis, sampul, tombol, bilah posisi) yang SELURUH asetnya
 *     (ikon kecil, ikon tombol, sampul bawaan) ada di dalam APK (res/drawable*),
 *  3. meneruskan tombol notifikasi / layar kunci / headset ke JavaScript lewat ActionListener.
 */
public class PlaybackService extends Service {
  static final String CHANNEL_ID = "musicverse_playback";
  static final int NOTIFICATION_ID = 4711;

  static final String ACTION_PLAY = "__APP_ID__.action.PLAY";
  static final String ACTION_PAUSE = "__APP_ID__.action.PAUSE";
  static final String ACTION_NEXT = "__APP_ID__.action.NEXT";
  static final String ACTION_PREVIOUS = "__APP_ID__.action.PREVIOUS";
  static final String ACTION_DISMISS = "__APP_ID__.action.DISMISS";

  public interface ActionListener {
    void onAction(String action, long seekMs);
  }

  /** Keadaan yang dikirim dari JavaScript. Sampul null = pertahankan yang lama. */
  public static class State {
    String title = "";
    String artist = "";
    String album = "";
    long durationMs = 0;
    long positionMs = 0;
    boolean playing = false;
    /** Mencari/memuat audio (jeda antar lagu / buffering): tampilkan indikator memuat. */
    boolean loading = false;
    boolean hasNext = false;
    boolean hasPrevious = false;
    boolean resetCover = false;
    Bitmap cover = null;
  }

  private static PlaybackService instance;
  private static State pending;
  private static ActionListener listener;

  public static void setListener(ActionListener value) {
    listener = value;
  }

  static void emit(String action, long seekMs) {
    ActionListener l = listener;
    if (l != null) l.onAction(action, seekMs);
  }

  /** Dipanggil plugin. Memulai service jika belum jalan, jika sudah jalan langsung memperbarui. */
  public static void update(Context context, State state) {
    PlaybackService running = instance;
    if (running != null) {
      // Plugin Capacitor berjalan di thread sendiri; semua perubahan keadaan dijalankan di thread utama
      // (sama dengan ticker) supaya posisi/durasi tidak saling menimpa setengah jadi.
      running.handler.post(() -> running.apply(state));
      return;
    }
    pending = state;
    Intent intent = new Intent(context, PlaybackService.class);
    if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(intent);
    else context.startService(intent);
  }

  public static void stop(Context context) {
    pending = null;
    PlaybackService running = instance;
    if (running != null) running.shutdown();
    else context.stopService(new Intent(context, PlaybackService.class));
  }

  private MediaSession session;
  private PowerManager.WakeLock wakeLock;
  private final State current = new State();
  private Bitmap defaultCover;
  /** Metadata yang terakhir dipasang ke sesi. Dipasang ulang hanya jika berubah: set ulang terus-menerus membuat kartu media sistem memuat ulang dan bilahnya kembali ke awal. */
  private String metaKey = "";
  private Bitmap metaArt = null;
  private boolean foreground = false;
  /** Waktu (elapsedRealtime) saat positionMs terakhir dilaporkan JS; dasar penghitungan posisi berjalan. */
  private long positionAt = 0;
  private final Handler handler = new Handler(Looper.getMainLooper());
  /** Lama notifikasi pemutar bertahan saat dijeda / tidak dipakai sebelum service berhenti (1 jam). */
  private static final long IDLE_LIMIT_MS = 60L * 60L * 1000L;
  private boolean idleScheduled = false;
  private final Runnable idleStop = new Runnable() {
    @Override public void run() {
      idleScheduled = false;
      shutdown();
    }
  };
  /**
   * Beberapa ROM (ColorOS/Realme, MIUI, dll.) tidak menggerakkan bilah progres sendiri dari kecepatan 1x,
   * jadi bilahnya diam di posisi terakhir. Selama memutar, posisi dihitung ulang dan didorong ke sesi tiap detik.
   */
  private final Runnable ticker = new Runnable() {
    @Override public void run() {
      if (!current.playing || session == null) return;
      pushPlaybackState();
      // ROM yang menggambar bilah dari notifikasi (bukan dari sesi) hanya bergerak jika notifikasinya ikut diperbarui.
      NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
      if (nm != null) nm.notify(NOTIFICATION_ID, buildNotification());
      handler.postDelayed(this, 1000);
    }
  };

  @Override
  public void onCreate() {
    super.onCreate();
    instance = this;
    createChannel();
    session = new MediaSession(this, "MusicVerse");
    session.setCallback(new MediaSession.Callback() {
      @Override public void onPlay() { emit("play", -1); }
      @Override public void onPause() { emit("pause", -1); }
      @Override public void onStop() { emit("stop", -1); }
      @Override public void onSkipToNext() { emit("next", -1); }
      @Override public void onSkipToPrevious() { emit("previous", -1); }
      @Override public void onSeekTo(long pos) { emit("seek", pos); }
    });
    session.setActive(true);
    PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
    if (pm != null) {
      wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "MusicVerse:playback");
      wakeLock.setReferenceCounted(false);
    }
    // Wajib: begitu startForegroundService() dipanggil, startForeground() harus menyusul segera.
    startInForeground(buildNotification());
  }

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    if (intent != null && intent.getAction() != null) {
      switch (intent.getAction()) {
        case ACTION_PLAY: emit("play", -1); break;
        case ACTION_PAUSE: emit("pause", -1); break;
        case ACTION_NEXT: emit("next", -1); break;
        case ACTION_PREVIOUS: emit("previous", -1); break;
        case ACTION_DISMISS: shutdown(); return START_NOT_STICKY;
        default: break;
      }
    }
    State state = pending;
    pending = null;
    if (state != null) apply(state);
    // Audio ada di WebView; jika proses mati, service tidak ada gunanya sendirian.
    return START_NOT_STICKY;
  }

  @Override
  public void onTaskRemoved(Intent rootIntent) {
    // Aplikasi digeser dari recent apps: WebView (dan audionya) ikut mati, jadi jangan tinggalkan notifikasi yatim.
    shutdown();
    super.onTaskRemoved(rootIntent);
  }

  @Override
  public void onDestroy() {
    handler.removeCallbacks(ticker);
    instance = null;
    if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
    if (session != null) {
      session.setActive(false);
      session.release();
      session = null;
    }
    super.onDestroy();
  }

  @Override
  public IBinder onBind(Intent intent) {
    return null;
  }

  void apply(State next) {
    current.title = next.title;
    current.artist = next.artist;
    current.album = next.album;
    // Durasi yang sudah diketahui untuk lagu yang sama tidak boleh kembali ke 0: sistem menganggap durasi tak diketahui
    // dan bilah progres jadi rata di kiri. (Lagu baru = resetCover.)
    if (next.durationMs > 0) current.durationMs = next.durationMs;
    else if (next.resetCover) current.durationMs = 0;
    current.positionMs = next.positionMs;
    positionAt = SystemClock.elapsedRealtime();
    current.playing = next.playing;
    current.loading = next.loading;
    current.hasNext = next.hasNext;
    current.hasPrevious = next.hasPrevious;
    if (next.resetCover) current.cover = null;
    if (next.cover != null) current.cover = next.cover;

    updateSession();
    handler.removeCallbacks(ticker);
    if (current.playing) handler.postDelayed(ticker, 1000);
    Notification notification = buildNotification();
    if (current.playing) {
      handler.removeCallbacks(idleStop);
      idleScheduled = false;
      if (wakeLock != null && !wakeLock.isHeld()) wakeLock.acquire();
      startInForeground(notification);
    } else {
      // Jeda: wake lock dilepas (hemat baterai), tetapi service tetap foreground dan notifikasi tetap ada sampai
      // IDLE_LIMIT_MS tanpa dipakai. Itu menjaga proses (dan WebView) tetap hidup agar bisa lanjut sendiri setelah
      // diinterupsi app lain. Batas waktu dihitung dari saat mulai dijeda, bukan diperpanjang tiap pembaruan.
      if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
      startInForeground(notification);
      if (!idleScheduled) {
        handler.postDelayed(idleStop, IDLE_LIMIT_MS);
        idleScheduled = true;
      }
    }
  }

  private void startInForeground(Notification notification) {
    if (Build.VERSION.SDK_INT >= 29) {
      startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
    } else {
      startForeground(NOTIFICATION_ID, notification);
    }
    foreground = true;
  }

  void shutdown() {
    handler.removeCallbacks(ticker);
    handler.removeCallbacks(idleStop);
    idleScheduled = false;
    stopForeground(true);
    foreground = false;
    stopSelf();
  }

  private void createChannel() {
    if (Build.VERSION.SDK_INT < 26) return;
    NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
    if (nm == null || nm.getNotificationChannel(CHANNEL_ID) != null) return;
    NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Pemutar musik", NotificationManager.IMPORTANCE_LOW);
    channel.setDescription("Kontrol pemutaran MusicVerse");
    channel.setShowBadge(false);
    channel.setSound(null, null);
    nm.createNotificationChannel(channel);
  }

  private Bitmap defaultCover() {
    if (defaultCover == null) {
      BitmapFactory.Options options = new BitmapFactory.Options();
      options.inSampleSize = 1;
      defaultCover = BitmapFactory.decodeResource(getResources(), R.drawable.notif_default_cover, options);
    }
    return defaultCover;
  }

  private void updateSession() {
    if (session == null) return;
    Bitmap art = current.cover != null ? current.cover : defaultCover();
    String artistLine = artistLine();
    String key = current.title + "\u0001" + artistLine + "\u0001" + current.album + "\u0001" + current.durationMs;
    if (!key.equals(metaKey) || art != metaArt) {
      MediaMetadata.Builder meta = new MediaMetadata.Builder()
          .putString(MediaMetadata.METADATA_KEY_TITLE, current.title)
          .putString(MediaMetadata.METADATA_KEY_ARTIST, artistLine)
          .putString(MediaMetadata.METADATA_KEY_ALBUM, current.album)
          .putBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART, art)
          .putBitmap(MediaMetadata.METADATA_KEY_ART, art);
      if (current.durationMs > 0) meta.putLong(MediaMetadata.METADATA_KEY_DURATION, current.durationMs);
      session.setMetadata(meta.build());
      metaKey = key;
      metaArt = art;
    }

    pushPlaybackState();
  }

  /** Baris artis; saat memuat diawali "Memuat lagu…" supaya jeda antar lagu terlihat di notifikasi dan layar kunci. */
  private String artistLine() {
    if (!current.loading) return current.artist;
    return current.artist.isEmpty() ? "Memuat lagu…" : "Memuat lagu… · " + current.artist;
  }

  /** Posisi saat ini: posisi terakhir dari JS + waktu berjalan sejak itu (hanya saat memutar), dijepit ke durasi. */
  private long livePosition() {
    long pos = current.positionMs;
    // Saat memuat, posisi tidak berjalan.
    if (current.playing && !current.loading) pos += SystemClock.elapsedRealtime() - positionAt;
    if (current.durationMs > 0 && pos > current.durationMs) pos = current.durationMs;
    return Math.max(0, pos);
  }

  private void pushPlaybackState() {
    if (session == null) return;
    long actions = PlaybackState.ACTION_PLAY | PlaybackState.ACTION_PAUSE | PlaybackState.ACTION_PLAY_PAUSE | PlaybackState.ACTION_STOP;
    if (current.durationMs > 0) actions |= PlaybackState.ACTION_SEEK_TO;
    if (current.hasNext) actions |= PlaybackState.ACTION_SKIP_TO_NEXT;
    if (current.hasPrevious) actions |= PlaybackState.ACTION_SKIP_TO_PREVIOUS;
    PlaybackState.Builder state = new PlaybackState.Builder().setActions(actions);
    // Berkas lokal / lagu yang durasinya diketahui: tandai terbuffer penuh (beberapa ROM menggambar bilah dari nilai ini).
    if (current.durationMs > 0) state.setBufferedPosition(current.durationMs);
    session.setPlaybackState(state
        .setState(!current.playing ? PlaybackState.STATE_PAUSED
                : current.loading ? PlaybackState.STATE_BUFFERING : PlaybackState.STATE_PLAYING,
            livePosition(), current.playing && !current.loading ? 1f : 0f, SystemClock.elapsedRealtime())
        .build());
  }

  private PendingIntent action(String name, int requestCode) {
    Intent intent = new Intent(this, PlaybackService.class).setAction(name);
    int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
    // Tombol notifikasi memakai getService: service sedang foreground, jadi aman dari batasan latar belakang.
    return PendingIntent.getService(this, requestCode, intent, flags);
  }

  private Notification.Action button(int icon, String label, String name, int requestCode) {
    return new Notification.Action.Builder(Icon.createWithResource(this, icon), label, action(name, requestCode)).build();
  }

  private Notification buildNotification() {
    Notification.Builder builder = Build.VERSION.SDK_INT >= 26
        ? new Notification.Builder(this, CHANNEL_ID)
        : new Notification.Builder(this);

    int count = 0;
    int previousIndex = -1;
    int playIndex;
    int nextIndex = -1;
    if (current.hasPrevious) {
      builder.addAction(button(R.drawable.ic_media_previous, "Sebelumnya", ACTION_PREVIOUS, 1));
      previousIndex = count++;
    }
    if (current.playing) builder.addAction(button(R.drawable.ic_media_pause, "Jeda", ACTION_PAUSE, 2));
    else builder.addAction(button(R.drawable.ic_media_play, "Putar", ACTION_PLAY, 3));
    playIndex = count++;
    if (current.hasNext) {
      builder.addAction(button(R.drawable.ic_media_next, "Berikutnya", ACTION_NEXT, 4));
      nextIndex = count++;
    }
    // Notifikasi tidak bisa digeser selama dijeda (bertahan sampai 1 jam), jadi sediakan tombol Tutup.
    if (!current.playing) builder.addAction(button(R.drawable.ic_media_close, "Tutup", ACTION_DISMISS, 6));
    int[] compact;
    if (previousIndex >= 0 && nextIndex >= 0) compact = new int[] {previousIndex, playIndex, nextIndex};
    else if (previousIndex >= 0) compact = new int[] {previousIndex, playIndex};
    else if (nextIndex >= 0) compact = new int[] {playIndex, nextIndex};
    else compact = new int[] {playIndex};

    Notification.MediaStyle style = new Notification.MediaStyle().setShowActionsInCompactView(compact);
    if (session != null) style.setMediaSession(session.getSessionToken());

    Intent open = getPackageManager().getLaunchIntentForPackage(getPackageName());
    PendingIntent content = null;
    if (open != null) {
      open.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
      content = PendingIntent.getActivity(this, 0, open,
          PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0));
    }

    builder
        .setSmallIcon(R.drawable.ic_stat_musicverse)
        .setContentTitle(current.title.isEmpty() ? "MusicVerse" : current.title)
        .setContentText(artistLine())
        .setSubText(current.album.isEmpty() ? null : current.album)
        .setLargeIcon(current.cover != null ? current.cover : defaultCover())
        .setContentIntent(content)
        .setDeleteIntent(action(ACTION_DISMISS, 5))
        .setVisibility(Notification.VISIBILITY_PUBLIC)
        .setCategory(Notification.CATEGORY_TRANSPORT)
        .setOnlyAlertOnce(true)
        .setShowWhen(false)
        .setOngoing(true)
        .setStyle(style);
    if (current.loading) {
      // Jeda antar lagu: bilah berjalan terus (indeterminate) menggantikan bilah posisi.
      builder.setProgress(0, 0, true);
    } else if (current.durationMs > 0) {
      builder.setProgress(
          (int) Math.min(Integer.MAX_VALUE, current.durationMs),
          (int) Math.min(Integer.MAX_VALUE, livePosition()),
          false);
    }
    if (Build.VERSION.SDK_INT >= 31) builder.setForegroundServiceBehavior(Notification.FOREGROUND_SERVICE_IMMEDIATE);
    return builder.build();
  }
}
