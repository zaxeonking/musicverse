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
import android.media.audiofx.Equalizer;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

import androidx.annotation.OptIn;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.PlaybackParameters;
import androidx.media3.common.Player;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.datasource.DefaultDataSource;
import androidx.media3.datasource.okhttp.OkHttpDataSource;
import java.util.concurrent.TimeUnit;
import okhttp3.OkHttpClient;
import androidx.media3.database.StandaloneDatabaseProvider;
import androidx.media3.datasource.DataSource;
import androidx.media3.datasource.DataSpec;
import androidx.media3.datasource.cache.CacheDataSource;
import androidx.media3.datasource.cache.LeastRecentlyUsedCacheEvictor;
import androidx.media3.datasource.cache.SimpleCache;
import androidx.media3.exoplayer.source.MediaSource;
import androidx.media3.exoplayer.source.ProgressiveMediaSource;
import java.io.File;
import androidx.media3.datasource.HttpDataSource;
import androidx.media3.datasource.ResolvingDataSource;
import androidx.media3.exoplayer.DefaultLoadControl;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.SeekParameters;
import androidx.media3.exoplayer.upstream.DefaultLoadErrorHandlingPolicy;
import androidx.media3.extractor.DefaultExtractorsFactory;

/**
 * Foreground service (tipe mediaPlayback) untuk MusicVerse.
 *
 * MESIN AUDIO (v0.4.0): lagu diputar oleh ExoPlayer (Media3) di service ini, bukan lagi <audio> WebView.
 * Buffer baca-depan besar (sampai ~3 menit) + coba-ulang otomatis saat sinyal putus, jadi sinyal jelek
 * tidak membuat lagu nyendat. JavaScript hanya remote control (engineLoad/Resume/Pause/Seek/Stop) dan menerima
 * event pemutaran lewat EngineListener.
 *
 * Service ini juga:
 *  1. menjaga proses tetap hidup + CPU menyala saat layar mati / app di latar belakang,
 *  2. menampilkan notifikasi media (judul, artis, sampul, tombol, bilah posisi) yang SELURUH asetnya
 *     (ikon kecil, ikon tombol, sampul bawaan) ada di dalam APK (res/drawable*),
 *  3. meneruskan tombol notifikasi / layar kunci / headset ke JavaScript lewat ActionListener.
 */
@OptIn(markerClass = UnstableApi.class)
public class PlaybackService extends Service {
  static final String CHANNEL_ID = "musicverse_playback";
  static final int NOTIFICATION_ID = 4711;

  static final String ACTION_PLAY = "__APP_ID__.action.PLAY";
  static final String ACTION_PAUSE = "__APP_ID__.action.PAUSE";
  static final String ACTION_NEXT = "__APP_ID__.action.NEXT";
  static final String ACTION_PREVIOUS = "__APP_ID__.action.PREVIOUS";
  static final String ACTION_DISMISS = "__APP_ID__.action.DISMISS";
  /**
   * Notifikasi dihapus SISTEM / digeser (deleteIntent), bukan tombol "Tutup". Beda dengan ACTION_DISMISS: saat terhenti karena
   * gangguan sesaat (app lain / panggilan) dan menunggu putar-ulang, ini TIDAK boleh mematikan service; notifikasi dipasang lagi.
   */
  static final String ACTION_SWIPED = "__APP_ID__.action.SWIPED";

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
    /** Terhenti karena app lain mengambil audio (bukan jeda pengguna) dan JS sedang menunggu giliran memutar lagi. */
    boolean interrupted = false;
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

  /** True bila service hidup dan belum dimatikan. Dipakai MediaSessionHolder / widget. */
  static boolean isRunning() {
    PlaybackService running = instance;
    return running != null && !running.stopped;
  }

  /**
   * Perintah dari widget: "previous" | "toggle" | "next" | "play" | "pause". Jalan di proses yang sama dengan service,
   * jadi tanpa Intent. False = tidak ada service yang berjalan (pemanggil harus membuka aplikasi).
   */
  static boolean dispatch(String command) {
    PlaybackService running = instance;
    if (running == null || running.stopped) return false;
    running.handler.post(() -> {
      if (running.stopped) return;
      String action = command;
      if (action.equals("toggle")) action = running.current.playing ? "pause" : "play";
      running.handleAction(action);
    });
    return true;
  }

  /** JS melaporkan apakah lagu aktif sudah disukai: hati di widget ikut berubah. Boleh dipanggil dari thread mana pun. */
  static void setWidgetLiked(Context context, String title, boolean liked) {
    final Context app = context.getApplicationContext();
    new Handler(Looper.getMainLooper()).post(() -> MusicVerseWidget.pushLiked(app, title, liked));
  }

  /** Widget baru ditambahkan saat memutar: dorong ulang keadaan sekarang. */
  static void refreshWidget() {
    PlaybackService running = instance;
    if (running == null) return;
    running.handler.post(() -> {
      running.widgetKey = "";
      running.notifyWidget();
    });
  }

  // ---------------------------------------------------------------------------------------------
  // Mesin audio (ExoPlayer): API statis dipanggil plugin (thread lain); semuanya dilempar ke thread utama.
  // ---------------------------------------------------------------------------------------------

  /** Event pemutaran ke JavaScript. type = nama event ala HTMLAudioElement; duration < 0 = tidak diketahui. */
  public interface EngineListener {
    void onEngine(String type, double currentTime, double duration, boolean ended, boolean seekable, int errorCode, double aheadSeconds, String reason);
  }

  private static final class LoadRequest {
    final String url;
    final long startMs;
    final String cacheKey;
    final String ytId;

    LoadRequest(String url, long startMs, String cacheKey, String ytId) {
      this.url = url;
      this.startMs = startMs;
      this.cacheKey = cacheKey;
      this.ytId = ytId == null ? "" : ytId;
    }
  }

  private static final double[] EQ_FREQS = {32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000};
  private static volatile EngineListener engineListener;
  private static LoadRequest pendingLoad;
  private static volatile float engineVolume = 1f;
  /** Kecepatan putar (nada tetap). Berlaku untuk pemutar aktif, cadangan, dan yang baru dibuat. */
  private static volatile float engineSpeed = 1f;
  private static volatile boolean autoAdvance = false;
  /** Mode langsung (ExoPlayer ambil dari sumber tanpa proxy). Dari pengaturan; mati = selalu lewat StreamProxy. */
  private static volatile boolean directEnabled = false;
  private static volatile boolean eqEnabled = false;
  private static volatile double[] eqGains = new double[EQ_FREQS.length];

  public static void setEngineListener(EngineListener value) {
    engineListener = value;
  }

  public static void engineLoad(Context context, String url, long startMs, String cacheKey) {
    engineLoad(context, url, startMs, cacheKey, "");
  }

  /** `ytId`: id video YouTube bila `url` stream YouTube langsung (kosong = tidak diketahui); dipakai `relinkActive`. */
  public static void engineLoad(Context context, String url, long startMs, String cacheKey, String ytId) {
    final String yt = ytId == null ? "" : ytId;
    PlaybackService running = instance;
    if (running != null) {
      running.handler.post(() -> running.doLoad(url, startMs, cacheKey, yt));
      return;
    }
    pendingLoad = new LoadRequest(url, startMs, cacheKey, yt);
    Intent intent = new Intent(context, PlaybackService.class);
    if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(intent);
    else context.startService(intent);
  }

  /** False bila tidak ada lagu yang dimuat di mesin (service sudah berhenti): pemanggil harus engineLoad ulang. */
  public static boolean engineResume() {
    PlaybackService running = instance;
    if (running == null || !running.hasMedia) return false;
    running.handler.post(running::doResume);
    return true;
  }

  public static void enginePause() {
    PlaybackService running = instance;
    if (running != null) running.handler.post(() -> {
      running.cancelFade(); // jeda di tengah crossfade: selesaikan dulu
      if (running.player != null) running.player.pause();
    });
  }

  public static void engineSeek(long positionMs) {
    PlaybackService running = instance;
    if (running != null) running.handler.post(() -> {
      ExoPlayer p = running.player;
      if (p == null || !running.hasMedia) return;
      // Lagu sudah SELESAI: seekTo() pada pemutar berstatus ENDED menghidupkannya lagi dan memutar lagu yang sama dari posisi itu.
      // Seek yang datang terlambat (setelah event `ended`, sambil JS memuat lagu berikutnya) tidak boleh melakukan itu.
      if (p.getPlaybackState() == Player.STATE_ENDED) return;
      running.lastPosMs = Math.max(0, positionMs);
      running.bufferingSince = 0; // seek memulai hitungan macet dari awal
      running.stallStage = 0;
      if (p.getPlaybackState() == Player.STATE_IDLE) p.prepare(); // pemutar berhenti karena galat: bangunkan lagi
      p.seekTo(Math.max(0, positionMs));
    });
  }

  public static void engineStop() {
    pendingLoad = null;
    PlaybackService running = instance;
    if (running != null) running.handler.post(running::doStopEngine);
  }

  public static void engineSetVolume(float volume) {
    engineVolume = Math.max(0f, Math.min(1f, volume));
    PlaybackService running = instance;
    if (running != null) running.handler.post(running::applyVolumes);
  }

  // ---------------------------------------------------------------------------------------------
  // Sleep timer di native: tetap jalan walau WebView beku / activity sudah dihancurkan sistem.
  // ---------------------------------------------------------------------------------------------

  /** Waktu (epoch ms) timer menit berakhir; 0 = tidak ada. Statis supaya bertahan bila service dibuat ulang. */
  private static volatile long sleepEndsAtEpoch = 0L;
  /** Volume mengecil selama ini sebelum waktu habis (sama dengan SLEEP_FADE_MS di JS). */
  private static final long SLEEP_FADE_MS = 30_000L;
  /** Penguatan fade sleep timer (1 = penuh). Hanya dipakai native saat JS beku; kalau JS hidup, JS yang memudar. */
  private float sleepGain = 1f;

  public static void engineSetSleep(long endsAtEpochMs) {
    sleepEndsAtEpoch = Math.max(0L, endsAtEpochMs);
    PlaybackService running = instance;
    if (running != null) running.handler.post(running::scheduleSleep);
  }

  void scheduleSleep() {
    handler.removeCallbacks(sleepTick);
    setSleepGain(1f);
    if (stopped || sleepEndsAtEpoch <= 0L) return;
    handler.post(sleepTick);
  }

  private void setSleepGain(float gain) {
    if (gain == sleepGain) return;
    sleepGain = gain;
    applyVolumes();
  }

  private final Runnable sleepTick = new Runnable() {
    @Override public void run() {
      if (stopped) return;
      long end = sleepEndsAtEpoch;
      if (end <= 0L) {
        setSleepGain(1f);
        return;
      }
      long left = end - System.currentTimeMillis();
      boolean playing = player != null && player.getPlayWhenReady();
      if (left <= 0L) {
        // Waktu habis. Bila JS hidup, beri dia kesempatan menjeda sendiri (maks 5 dtk); kalau tidak, native menjeda.
        if (jsAlive() && playing && left > -5_000L) {
          setSleepGain(1f);
          handler.postDelayed(this, 500L);
          return;
        }
        sleepEndsAtEpoch = 0L;
        if (playing) {
          if (player != null) player.pause();
          markNativePlaying(false);
          emit("pause", -1);
        }
        setSleepGain(1f); // setelah jeda: dilanjutkan = volume penuh
        return;
      }
      if (!jsAlive() && playing && left < SLEEP_FADE_MS) {
        float remaining = left / (float) SLEEP_FADE_MS; // 1 -> 0
        setSleepGain(remaining * remaining);
      } else {
        setSleepGain(1f);
      }
      handler.postDelayed(this, left < SLEEP_FADE_MS + 1_000L ? 200L : 1_000L);
    }
  };

  // ---------------------------------------------------------------------------------------------
  // Riwayat lagu untuk tombol Previous tanpa JS (hanya yang ditinggalkan lewat rantai native; berlaku 20 menit).
  // ---------------------------------------------------------------------------------------------

  private static final long HISTORY_KEEP_MS = 20L * 60L * 1000L;
  private static final int HISTORY_MAX = 20;

  private static final class HistoryItem {
    final String url;
    final String cacheKey;
    final String title;
    final String artist;
    final String album;
    final String coverUrl;
    final long durationMs;
    final int index;
    final long at;
    final float normGain;
    final String trackId;
    final String trackUrl;
    /** Sampul yang sedang tampil saat lagu ditinggalkan: dipakai lagi saat kembali (lagu yang dimuat JS tidak punya URL sampul di native). */
    final Bitmap cover;
    /** Id video YouTube (dari bekal JS) untuk mengambil link baru bila tautan sudah mati; kosong bila tidak ada. */
    String ytId = "";

    HistoryItem(String url, String cacheKey, String title, String artist, String album, String coverUrl, long durationMs, int index, long at, float normGain, String trackId, String trackUrl, Bitmap cover) {
      this.cover = cover;
      this.trackId = trackId;
      this.trackUrl = trackUrl;
      this.normGain = normGain;
      this.url = url == null ? "" : url;
      this.cacheKey = cacheKey;
      this.title = title;
      this.artist = artist;
      this.album = album;
      this.coverUrl = coverUrl;
      this.durationMs = durationMs;
      this.index = index;
      this.at = at;
    }
  }

  private final List<HistoryItem> history = new ArrayList<>();
  /**
   * Lagu tepat sebelum lagu aktif menurut JS (terlama dulu, tautan sudah di-resolve JS). Dipakai tombol Sebelumnya saat JS beku
   * bila `history` kosong (riwayat native hanya berisi lagu yang ditinggalkan rantai native, dan dikosongkan tiap JS pindah lagu).
   */
  private final List<UpcomingItem> prevSeed = new ArrayList<>();
  /** Sampul lagu yang baru diputar (10 terakhir), kunci = judul + artis. */
  private final java.util.LinkedHashMap<String, Bitmap> coverMemo = new java.util.LinkedHashMap<String, Bitmap>(16, 0.75f, true) {
    @Override
    protected boolean removeEldestEntry(java.util.Map.Entry<String, Bitmap> eldest) {
      return size() > 10;
    }
  };
  /**
   * Id lagu (antrean JS) dari lagu yang dimulai RANTAI native, lengkap dengan judulnya. Id hanya dipercaya bila judul lagu aktif
   * masih sama: lagu yang dimuat ulang oleh JS tidak boleh mewarisi id lagu rantai sebelumnya.
   */
  private String chainTrackId = "";
  private String chainTrackUrl = "";
  private String chainTrackTitle = "";

  private String activeTrackId() {
    return !chainTrackId.isEmpty() && chainTrackTitle.equals(current.title) ? chainTrackId : "";
  }

  private String activeTrackUrl() {
    return activeTrackId().isEmpty() ? "" : chainTrackUrl;
  }

  private int sessionTick = 0;

  /**
   * Catat lagu aktif + posisi di NativeSession supaya JS yang hidup kembali (activity dihancurkan Android) bisa menyamakan
   * lagu dan posisinya. Memori tiap panggilan; `persistNow` juga menulis ke penyimpanan (lagu pindah, jeda, service berhenti).
   */
  private void recordSession(boolean persistNow) {
    ExoPlayer p = player;
    if (p == null || !hasMedia || current.title.isEmpty()) return;
    Src src = activeSrc;
    long dur = p.getDuration();
    NativeSession.update(activeTrackId(), current.title, current.artist, knownIndex, resumePos(p),
        dur != C.TIME_UNSET && dur > 0 ? dur : current.durationMs, p.getPlayWhenReady(),
        src == null ? "" : src.proxyUrl, src == null ? "" : src.cacheKey);
    if (persistNow) NativeSession.persist(getApplicationContext());
  }

  /** Lagu baru dimulai native: catat ke jurnal supaya Riwayat tidak bolong (JS beku / mati tidak melihatnya). */
  private void journalPlay(UpcomingItem item) {
    chainTrackId = item.trackId;
    chainTrackUrl = item.trackUrl;
    chainTrackTitle = item.title;
    PlayJournal.add(getApplicationContext(), item.trackId, item.trackUrl, item.title, item.artist, item.album, item.coverUrl, item.durationMs);
    recordSession(true);
  }
  /** Sampul (URL) lagu yang sedang diputar bila diketahui native (lagu hasil rantai); kosong bila dimuat JS. */
  private String currentCoverUrl = "";

  /** Catat lagu yang sedang diputar sebelum ditinggalkan rantai native. Tanpa sumber / indeks yang jelas: dilewati. */
  private void pushHistory() {
    Src src = activeSrc;
    if (src == null || knownIndex < 0 || current.title.isEmpty()) return;
    history.add(new HistoryItem(src.proxyUrl, src.cacheKey, current.title, current.artist, current.album, currentCoverUrl, current.durationMs, knownIndex, SystemClock.elapsedRealtime(), engineNorm, activeTrackId(), activeTrackUrl(), current.cover));
    while (history.size() > HISTORY_MAX) history.remove(0);
  }

  /** Previous tanpa JS: kembali ke lagu sebelumnya dari riwayat (lagu yang ditinggalkan kembali menjadi "berikutnya"). */
  private boolean chainPrevious() {
    if (stopped || player == null) return false;
    HistoryItem h = null;
    if (!history.isEmpty()) {
      h = history.remove(history.size() - 1);
      if (SystemClock.elapsedRealtime() - h.at > HISTORY_KEEP_MS) {
        history.clear();
        h = null;
      }
    }
    // Riwayat native kosong / kedaluwarsa (mis. lagu sebelumnya diputar saat JS masih hidup): pakai bekal dari JS.
    if (h == null && !prevSeed.isEmpty()) {
      UpcomingItem p = prevSeed.remove(prevSeed.size() - 1);
      h = new HistoryItem(p.url, p.cacheKey, p.title, p.artist, p.album, p.coverUrl, p.durationMs, p.index, SystemClock.elapsedRealtime(), p.normGain, p.trackId, p.trackUrl, null);
      h.ytId = p.ytId == null ? "" : p.ytId;
    }
    if (h == null) return false;
    Src leaving = activeSrc;
    if (leaving != null && knownIndex >= 0 && !current.title.isEmpty()) {
      UpcomingItem leavingItem = new UpcomingItem(knownIndex, leaving.proxyUrl, leaving.cacheKey, current.title, current.artist, current.album, currentCoverUrl, current.durationMs, engineNorm, activeTrackId(), activeTrackUrl());
      leavingItem.coverBitmap = current.cover; // supaya "Berikutnya" nanti juga langsung punya sampul
      upcoming.add(0, leavingItem);
    }
    engineNorm = h.normGain;
    applyVolumes();
    loadMedia(h.url, 0, h.cacheKey);
    resetRelink(h.ytId);
    player.setPlayWhenReady(true);
    playingIndex = h.index;
    knownIndex = h.index;
    standbyItem = null;
    currentCoverUrl = h.coverUrl;
    State s = snapshot();
    s.title = h.title;
    s.artist = h.artist;
    s.album = h.album;
    s.durationMs = h.durationMs;
    s.positionMs = 0;
    s.playing = true;
    s.loading = true;
    s.hasNext = !upcoming.isEmpty();
    s.hasPrevious = true;
    s.interrupted = false;
    s.resetCover = true;
    // Sampul lagu yang dituju langsung dipasang bersama judulnya (tanpa jeda "banner kosong"); mengunduh hanya bila tidak ada.
    s.cover = h.cover;
    chainLoading = true;
    chainLoadingSince = SystemClock.elapsedRealtime();
    applyInternal(s, false);
    UpcomingItem back = new UpcomingItem(h.index, h.url, h.cacheKey, h.title, h.artist, h.album, h.coverUrl, h.durationMs, h.normGain, h.trackId, h.trackUrl);
    if (h.cover == null) fetchCover(back);
    journalPlay(back);
    emitEngine("advanced", 0, "idx:" + h.index);
    preloadChainStandby();
    return true;
  }

  /** Normalisasi volume lagu aktif (1 = penuh), terpisah dari volume utama supaya native bisa menggantinya sendiri saat pindah lagu. */
  private static volatile float engineNorm = 1f;

  public static void engineSetNorm(float gain) {
    engineNorm = gain > 0f && gain <= 1f ? gain : 1f;
    PlaybackService running = instance;
    if (running != null) running.handler.post(running::applyVolumes);
  }

  public static void engineSetSpeed(float speed) {
    engineSpeed = Math.max(0.5f, Math.min(2f, speed));
    PlaybackService running = instance;
    if (running != null) running.handler.post(running::applySpeed);
  }

  void applySpeed() {
    PlaybackParameters params = new PlaybackParameters(engineSpeed, 1f);
    if (player != null) player.setPlaybackParameters(params);
    if (standby != null) standby.setPlaybackParameters(params);
    if (fading != null) fading.setPlaybackParameters(params);
  }

  /** Memuat lagu berikutnya di pemutar cadangan (tanpa memutar, senyap). Event `standby_ready` / `standby_error` ke JS. */
  public static void engineStandbyLoad(String url, String cacheKey) {
    PlaybackService running = instance;
    if (running != null) running.handler.post(() -> running.doStandbyLoad(url, cacheKey));
  }

  /**
   * true = bila lagu aktif selesai dan lagu cadangan sudah dimuat, native langsung pindah sendiri (tanpa menunggu JS /
   * WebView yang mungkin ditahan di latar belakang) lalu mengirim event `advanced`. JS yang menjamin lagu cadangan itu valid.
   */
  public static void engineSetDirect(boolean on) {
    directEnabled = on;
  }

  public static void engineSetAutoAdvance(boolean on) {
    autoAdvance = on;
  }

  /** Pengaturan "Putar otomatis setelah gangguan" (default menyala). Berlaku juga untuk penantian yang sedang berjalan. */
  private static volatile boolean autoResumeEnabled = true;

  public static void engineSetAutoResume(boolean on) {
    autoResumeEnabled = on;
    final PlaybackService running = instance;
    if (running != null) {
      running.handler.post(
          () -> {
            if (running.resumer != null) running.resumer.setEnabled(on);
          });
    }
  }

  /**
   * Satu lagu berikutnya yang URL-nya SUDAH di-resolve JS. Dengan daftar ini native pindah lagu sendiri tanpa JS: WebView
   * yang dibekukan di latar belakang (layar mati) tidak lagi memutus pemutaran setelah 2-3 lagu.
   */
  public static final class UpcomingItem {
    final int index;
    /** Kosong = belum di-resolve JS ("lazy"): native mencarinya sendiri lewat YtMatcher (lihat `resolveLazy`). */
    String url;
    /** Id video YouTube hasil resolve native (kosong bila dari JS). */
    String ytId = "";
    boolean resolving = false;
    boolean failed = false;
    final String cacheKey;
    final String title;
    final String artist;
    final String album;
    final String coverUrl;
    final long durationMs;
    /** Penguatan normalisasi volume lagu ini (1 = tanpa redaman), dihitung JS dari loudnessDb. */
    final float normGain;
    /** Id lagu di antrean JS + URL Spotify-nya: dipakai jurnal putar (PlayJournal). Kosong = tidak dicatat. */
    final String trackId;
    final String trackUrl;
    /** Sampul yang sudah ada di memori (lagu yang baru ditinggalkan lewat Sebelumnya): dipakai langsung tanpa mengunduh. */
    Bitmap coverBitmap;

    public UpcomingItem(int index, String url, String cacheKey, String title, String artist, String album, String coverUrl, long durationMs) {
      this(index, url, cacheKey, title, artist, album, coverUrl, durationMs, 1f);
    }

    public UpcomingItem(int index, String url, String cacheKey, String title, String artist, String album, String coverUrl, long durationMs, float normGain) {
      this(index, url, cacheKey, title, artist, album, coverUrl, durationMs, normGain, "", "");
    }

    public UpcomingItem(int index, String url, String cacheKey, String title, String artist, String album, String coverUrl, long durationMs, float normGain, String trackId, String trackUrl) {
      this.trackId = trackId == null ? "" : trackId;
      this.trackUrl = trackUrl == null ? "" : trackUrl;
      this.normGain = normGain > 0f && normGain <= 1f ? normGain : 1f;
      this.index = index;
      this.url = url;
      this.cacheKey = cacheKey;
      this.title = title == null ? "" : title;
      this.artist = artist == null ? "" : artist;
      this.album = album == null ? "" : album;
      this.coverUrl = coverUrl == null ? "" : coverUrl;
      this.durationMs = durationMs;
    }
  }

  /**
   * Daftar lagu berikutnya menurut JS. `currentIndex` = indeks antrean lagu yang sedang diputar menurut JS: bila native sudah
   * pindah sendiri (JS belum tahu), daftar usang itu diabaikan supaya lagu yang sudah lewat tidak diputar lagi.
   */
  public static void engineSetUpcoming(int currentIndex, List<UpcomingItem> items) {
    engineSetUpcoming(currentIndex, items, -1, null);
  }

  /**
   * Seperti di atas, plus info radio dari JS: `radioTail` >= 0 = antrean JS berakhir di daftar ini (tidak ada lagu lagi
   * sesudahnya), radio menyala, dan `radioTail` = panjang antrean JS (indeks untuk lagu tambahan pertama). -1 = native tidak
   * boleh menambah lagu radio sendiri. `radioExclude` = kunci judul + artis semua lagu di antrean JS (tidak diulang radio).
   */
  public static void engineSetUpcoming(int currentIndex, List<UpcomingItem> items, int radioTail, List<String> radioExclude) {
    engineSetUpcoming(currentIndex, items, radioTail, radioExclude, null);
  }

  /** Plus `previous`: lagu tepat sebelum lagu aktif (urut dari terlama), bekal tombol Sebelumnya saat JS beku. */
  public static void engineSetUpcoming(int currentIndex, List<UpcomingItem> items, int radioTail, List<String> radioExclude, List<UpcomingItem> previous) {
    PlaybackService running = instance;
    if (running != null) running.handler.post(() -> running.setUpcoming(currentIndex, items, radioTail, radioExclude, previous));
  }

  public static void engineClearStandby() {
    PlaybackService running = instance;
    if (running != null) running.handler.post(running::releaseStandby);
  }

  public interface Result {
    void done(boolean ok);
  }

  /** Memutar lagu cadangan dari 0:00 dengan volume naik sambil lagu aktif memudar (daya sama), lalu cadangan jadi aktif. */
  public static void engineCrossfade(long durationMs, Result result) {
    PlaybackService running = instance;
    if (running == null) {
      result.done(false);
      return;
    }
    running.handler.post(() -> result.done(running.doCrossfade(Math.max(1, durationMs))));
  }

  public static void engineSetEq(boolean enabled, double[] gains) {
    eqEnabled = enabled;
    if (gains != null && gains.length == EQ_FREQS.length) eqGains = gains;
    PlaybackService running = instance;
    if (running != null) running.handler.post(running::applyEq);
  }

  public static void stop(Context context) {
    pending = null;
    pendingLoad = null;
    PlaybackService running = instance;
    if (running != null) running.shutdown();
    // Selalu minta berhenti juga (aman dipanggil walau service tidak jalan).
    context.stopService(new Intent(context, PlaybackService.class));
  }

  private ExoPlayer player;
  private volatile boolean hasMedia = false;
  /** Posisi terakhir yang diketahui valid (detak pemutar / seek). Dasar buka-ulang bila pemutar melapor posisi 0 setelah galat. */
  private volatile long lastPosMs = 0;
  /** Lagu berikutnya yang siap diputar native sendiri (hanya diubah di thread utama). */
  private final List<UpcomingItem> upcoming = new ArrayList<>();
  /** Indeks antrean lagu yang diputar native hasil pindah sendiri; -1 = lagu dimuat JS (JS yang tahu posisinya). */
  private int playingIndex = -1;
  /** Indeks antrean lagu yang sedang diputar menurut pembaruan terakhir (JS atau rantai native); -1 = belum diketahui. */
  private int knownIndex = -1;
  /** Item yang sedang dimuat di pemutar cadangan oleh rantai native (bukan oleh JS). */
  private UpcomingItem standbyItem = null;
  private int coverToken = 0;
  /** Tanpa pembaruan JS selama ini saat memutar = WebView dibekukan di latar belakang: native menangani sendiri. */
  private static final long JS_STALE_MS = 6_000L;
  private boolean metaSent = false;
  private int tickCount = 0;
  private Equalizer equalizer;
  private int eqSession = -1;

  /** Gagal 4xx (URL kedaluwarsa / ditolak) langsung dilaporkan ke JS agar link diambil ulang; selain itu dicoba ulang. */
  private static final class RetryPolicy extends DefaultLoadErrorHandlingPolicy {
    RetryPolicy() {
      super(12);
    }

    @Override
    public long getRetryDelayMsFor(LoadErrorInfo info) {
      if (info.exception instanceof HttpDataSource.InvalidResponseCodeException) {
        int code = ((HttpDataSource.InvalidResponseCodeException) info.exception).responseCode;
        if (code >= 400 && code < 500 && code != 408 && code != 429) return C.TIME_UNSET;
      }
      return super.getRetryDelayMsFor(info);
    }
  }

  private final Player.Listener playerListener = new Player.Listener() {
    @Override public void onPlaybackStateChanged(int state) {
      if (state == Player.STATE_BUFFERING) {
        emitEngine("waiting", 0, null);
      } else if (state == Player.STATE_READY) {
        if (!metaSent) {
          metaSent = true;
          emitEngine("durationchange", 0, null);
          emitEngine("loadedmetadata", 0, null);
        }
        releaseChainLoading();
      } else if (state == Player.STATE_ENDED) {
        // Saat JS beku, native selalu memakai antrean upcoming sebagai sumber kebenaran.
        // Standby bisa disiapkan oleh JS (autoAdvance) atau oleh rantai native; keduanya harus
        // melewati chainAdvance agar metadata notifikasi, indeks, sampul, dan sisa antrean ikut diperbarui.
        // Jalur lama melakukan crossfade langsung lalu mengosongkan seluruh antrean, sehingga
        // notifikasi tertinggal di lagu sebelumnya dan pemutaran berhenti setelah standby habis.
        if (!jsAlive() && chainAdvance(false)) {
          // Pindah ke lagu berikutnya dari daftar native (JS tidak diperlukan).
        } else {
          if (nativeInCharge()) markNativePlaying(false); // rantai habis saat JS beku: tombol notifikasi harus jadi "putar"
          emitEngine("ended", 0, null);
        }
      }
    }

    @Override public void onIsPlayingChanged(boolean isPlaying) {
      if (isPlaying) {
        // Pemutar benar-benar berbunyi tetapi notifikasi masih "jeda" (mis. putar-ulang otomatis setelah gangguan saat JS
        // beku / tidak sempat melapor): samakan tampilan notifikasi + widget dengan kenyataan.
        if (!stopped && !current.playing && !jsAlive()) markNativePlaying(true);
        emitEngine("playing", 0, null);
        // Lagu hasil pindah native: lepas indikator memuat, isi durasi dan posisi dari pemutar.
        releaseChainLoading();
      }
    }

    @Override public void onPlayWhenReadyChanged(boolean playWhenReady, int reason) {
      if (playWhenReady) {
        if (resumer != null) resumer.end(); // sudah berbunyi lagi (oleh ExoPlayer, kami, atau pengguna)
        emitEngine("play", 0, null);
      } else {
        boolean focusLoss = reason == Player.PLAY_WHEN_READY_CHANGE_REASON_AUDIO_FOCUS_LOSS;
        String why = focusLoss ? "focus"
            : reason == Player.PLAY_WHEN_READY_CHANGE_REASON_AUDIO_BECOMING_NOISY ? "noisy" : "user";
        // Hanya kehilangan fokus audio yang ditunggu lalu dilanjutkan. Jeda pengguna / notifikasi / headset dicabut /
        // lagu habis membatalkan penantian (tidak pernah diputar ulang sendiri), seperti StreamBeats.
        if (resumer != null) {
          if (focusLoss) resumer.begin();
          else resumer.end();
        }
        recordSession(true);
        // JS tidak melapor: notifikasi harus ikut menunjukkan jeda (dan tombol Putar berfungsi sebagai Putar).
        if (!stopped && current.playing && !jsAlive() && !current.loading) markNativePlaying(false);
        emitEngine("pause", 0, why);
      }
    }

    @Override public void onPositionDiscontinuity(Player.PositionInfo oldPosition, Player.PositionInfo newPosition, int reason) {
      if (reason == Player.DISCONTINUITY_REASON_SEEK) emitEngine("seeked", 0, null);
    }

    @Override public void onPlayerError(PlaybackException error) {
      if (fallbackActive()) return; // gagal langsung (4xx / jaringan): ulang lewat proxy dari posisi yang sama
      if (!jsAlive()) {
        // JS beku dan tidak bisa mengambil link baru: native mengambil sendiri link baru untuk lagu yang SAMA dan lanjut dari
        // posisi terakhir. Baru bila itu gagal, lompati lagu yang rusak daripada diam selamanya.
        if (relinkActive(isRejectedByServer(error), mapError(error.errorCode))) return;
        if (chainAdvance(true)) return;
      }
      emitEngine("error", mapError(error.errorCode), null);
    }

    @Override public void onAudioSessionIdChanged(int audioSessionId) {
      applyEq();
    }
  };

  /** Kode galat ala MediaError: 2 jaringan, 3 decode, 4 tidak didukung, 5 lainnya. */
  private static int mapError(int code) {
    if (code == PlaybackException.ERROR_CODE_PARSING_CONTAINER_UNSUPPORTED
        || code == PlaybackException.ERROR_CODE_DECODING_FORMAT_UNSUPPORTED) return 4;
    if (code >= 2000 && code < 3000) return 2;
    if (code >= 3000 && code < 5000) return 3;
    if (code >= 5000 && code < 6000) return 3;
    return 5;
  }

  private final Runnable engineTicker = new Runnable() {
    @Override public void run() {
      if (stopped || player == null || !hasMedia) return;
      int st = player.getPlaybackState();
      if (st == Player.STATE_BUFFERING && player.getPlayWhenReady()) {
        long now = SystemClock.elapsedRealtime();
        if (bufferingSince == 0) {
          bufferingSince = now;
          stallStage = 0;
        } else if (now - bufferingSince > STALL_STEP_MS) {
          bufferingSince = now;
          handleStall(++stallStage);
        }
      } else {
        bufferingSince = 0;
        stallStage = 0;
      }
      if (st == Player.STATE_READY || st == Player.STATE_BUFFERING) {
        if (player.isPlaying()) {
          lastPosMs = Math.max(0, player.getCurrentPosition());
          emitEngine("timeupdate", 0, null);
        }
        else if (++tickCount % 4 == 0) emitEngine("progress", 0, null);
      }
      // Tiap ~1 dtk perbarui sesi di memori; tiap ~10 dtk tulis ke penyimpanan bila JS tidak mengirim detak (native memegang kendali).
      if (++sessionTick % 4 == 0) recordSession(sessionTick % 40 == 0 && !jsAlive());
      if (sessionTick % 4 == 0) maybeFillRadio();
      handler.postDelayed(this, 250);
    }
  };

  private void emitEngine(String type, int errorCode, String reason) {
    ExoPlayer p = player;
    EngineListener l = engineListener;
    if (p == null || l == null || !hasMedia) return;
    long dur = p.getDuration();
    long pos = Math.max(0, p.getCurrentPosition());
    long buffered = p.getBufferedPosition();
    l.onEngine(type, pos / 1000.0, dur == C.TIME_UNSET || dur <= 0 ? -1 : dur / 1000.0,
        p.getPlaybackState() == Player.STATE_ENDED, p.isCurrentMediaItemSeekable(), errorCode,
        Math.max(0, (buffered - pos) / 1000.0), reason == null ? "" : reason);
  }

  // ---- Mode langsung: ExoPlayer ambil dari sumber (satu koneksi panjang ala mpv), proxy lokal hanya cadangan ----

  /** User-Agent per URL sumber langsung; dibaca ResolvingDataSource saat membuka koneksi. */
  private static final Map<String, String> DIRECT_UA = new ConcurrentHashMap<>();
  /** Domain yang sudah gagal/macet saat langsung: sisa sesi lewat proxy (mis. sumber yang membatasi Range tak terbatas). */
  private static final Set<String> DIRECT_BLOCKED = ConcurrentHashMap.newKeySet();
  /** Tangga pemulihan macet: tiap STALL_STEP_MS buffering terus-menerus naik satu anak tangga. */
  private static final long STALL_STEP_MS = 10_000L;

  private static final class Src {
    final String proxyUrl;
    final String directUrl; // null = tidak langsung
    /** Kunci cache disk (lagu + sumber API); kosong = jangan di-cache (berkas lokal, sumber tanpa kunci). */
    final String cacheKey;
    boolean fellBack = false;

    Src(String proxyUrl, String directUrl, String cacheKey) {
      this.proxyUrl = proxyUrl;
      this.directUrl = directUrl;
      this.cacheKey = cacheKey;
    }

    boolean direct() {
      return directUrl != null && !fellBack;
    }

    String playUrl() {
      return direct() ? directUrl : proxyUrl;
    }
  }

  private Src activeSrc;
  private Src standbySrc;

  // ---- Link baru oleh native saat stream aktif gagal / kedaluwarsa dan JS beku ----

  /** Id video YouTube lagu aktif bila diketahui native (lagu rantai hasil resolve native); kosong = dicari ulang lewat judul + artis. */
  private String activeYtId = "";
  /** Berapa kali lagu aktif sudah diambil ulang linknya oleh native (direset tiap lagu baru). */
  private int relinkTries = 0;
  private boolean relinking = false;
  /** Nomor giliran; hasil resolve yang datang setelah lagu berganti / berhenti dibuang. */
  private int relinkSeq = 0;
  private static final int MAX_RELINKS = 2;

  /** Lagu baru mulai (rantai native, JS memuat, crossfade, berhenti): hasil resolve lama tidak boleh dipakai lagi. */
  private void resetRelink(String ytId) {
    activeYtId = ytId == null ? "" : ytId;
    relinkTries = 0;
    relinking = false;
    relinkSeq++;
  }

  /** Server video menolak link (401/403/404/410): link kedaluwarsa atau klien itu ditolak. Galat jaringan biasa bukan penolakan. */
  private static boolean isRejectedByServer(PlaybackException error) {
    Throwable c = error.getCause();
    for (int depth = 0; c != null && depth < 8; depth++, c = c.getCause()) {
      if (c instanceof HttpDataSource.InvalidResponseCodeException) {
        int code = ((HttpDataSource.InvalidResponseCodeException) c).responseCode;
        return code == 401 || code == 403 || code == 404 || code == 410;
      }
    }
    return false;
  }

  /**
   * Stream lagu aktif gagal saat JS beku: ambil link BARU di native (id video bila diketahui lewat YtResolver, bila tidak
   * dicari ulang lewat YtMatcher dengan judul + artis + durasi), lalu lanjut dari posisi terakhir. Maks. MAX_RELINKS kali per
   * lagu. Mengembalikan true bila pengambilan sedang / baru dimulai (pemanggil tidak perlu berbuat apa-apa); false bila tidak
   * bisa (pemanggil lompat ke lagu berikutnya seperti sebelumnya).
   *
   * @param rejected link ditolak server video: klien yang menghasilkannya dilewati 10 menit
   * @param errorCode kode galat ala MediaError yang dilaporkan bila pengambilan gagal dan tidak ada lagu berikutnya
   */
  private boolean relinkActive(final boolean rejected, final int errorCode) {
    final ExoPlayer p = player;
    final Src src = activeSrc;
    if (stopped || p == null || src == null || !hasMedia || jsAlive()) return false;
    if (relinking) return true;
    if (relinkTries >= MAX_RELINKS || current.title.isEmpty()) return false;
    relinkTries++;
    relinking = true;
    final int seq = ++relinkSeq;
    final long pos = resumePos(p);
    final boolean wasPlaying = p.getPlayWhenReady();
    final String ytId = activeYtId;
    final String title = current.title;
    final String artist = current.artist;
    final long durMs = current.durationMs;
    final String cacheKey = src.cacheKey;
    String oldUa = null;
    try {
      String[] peeked = StreamProxy.get().peek(src.proxyUrl);
      if (peeked != null) oldUa = peeked[1];
    } catch (Exception ignored) {
      // proxy tidak tersedia: klien lama tidak diketahui
    }
    final String rejectedUa = rejected ? oldUa : null;
    final Context app = getApplicationContext();
    State wait = snapshot();
    wait.loading = true;
    applyInternal(wait, false);
    new Thread(
            () -> {
              String url = "";
              String id = "";
              try {
                if (rejectedUa != null && !rejectedUa.isEmpty()) YtResolver.markRejected(rejectedUa);
                YtResolver.Stream stream = null;
                if (!ytId.isEmpty()) {
                  List<YtResolver.Stream> streams = YtResolver.getStreams(app, ytId);
                  if (!streams.isEmpty()) {
                    stream = streams.get(0);
                    id = ytId;
                  }
                }
                if (stream == null) {
                  Double sec = durMs > 0 ? Double.valueOf(durMs / 1000.0) : null;
                  YtMatcher.Result r = YtMatcher.resolve(app, title, artist, sec, false, null, 0);
                  if (r.ok()) {
                    stream = r.stream;
                    id = r.videoId();
                  } else {
                    android.util.Log.w("MusicVerse", "Link baru native \"" + title + "\": " + r.outcome);
                  }
                }
                if (stream != null) url = StreamProxy.get().register(stream.url, stream.userAgent);
              } catch (Exception e) {
                android.util.Log.w("MusicVerse", "Link baru native gagal: " + e);
              }
              final String fUrl = url;
              final String fId = id;
              handler.post(() -> onRelinked(seq, fUrl, fId, pos, wasPlaying, cacheKey, errorCode));
            },
            "mv-yt-relink")
        .start();
    return true;
  }

  private void onRelinked(int seq, String url, String id, long pos, boolean wasPlaying, String cacheKey, int errorCode) {
    if (seq != relinkSeq) return; // lagu sudah berganti / berhenti selagi mengambil link
    relinking = false;
    ExoPlayer p = player;
    if (stopped || p == null) return;
    if (jsAlive()) {
      // JS terbangun selagi native mengambil link: serahkan ke JS seperti biasa (JS yang memegang antrean lagi).
      emitEngine("error", errorCode, null);
      return;
    }
    if (url.isEmpty()) {
      // Tidak ada link baru: lompat ke lagu berikutnya; bila tidak ada, lapor galat dan lepas indikator memuat.
      if (chainAdvance(true)) return;
      State idle = snapshot();
      idle.loading = false;
      applyInternal(idle, false);
      emitEngine("error", errorCode, null);
      return;
    }
    if (!id.isEmpty()) activeYtId = id;
    loadMedia(url, pos, cacheKey); // kunci cache sama: bagian yang sudah ter-cache tetap terpakai
    p.setPlayWhenReady(wasPlaying);
    chainLoading = true;
    chainLoadingSince = SystemClock.elapsedRealtime();
    preloadChainStandby(); // loadMedia membuang pemutar cadangan
  }
  private long bufferingSince = 0;
  private int stallStage = 0;

  /**
   * Buffering macet tanpa galat (koneksi menggantung): 1) buka ulang sumber yang sama di posisi sekarang (koneksi baru),
   * 2) pindah ke proxy bila masih langsung (atau buka ulang lagi), 3) laporkan galat jaringan ke JS supaya link
   * diambil ulang dan lagu dimuat ulang dari posisi terakhir. Sebelumnya macet seperti ini bisa berputar selamanya.
   */
  private void handleStall(int stage) {
    // Macet di UJUNG lagu (stream lebih pendek dari durasi yang dilaporkan): anggap selesai. Membuka ulang di sini memutar
    // lagu yang sama dari awal lagi dan lagi.
    ExoPlayer ep = player;
    if (ep != null) {
      long dur = ep.getDuration();
      if (dur != C.TIME_UNSET && dur > 0 && ep.getCurrentPosition() >= dur - 4_000L) {
        bufferingSince = 0;
        stallStage = 0;
        if (!jsAlive() && chainAdvance(false)) return;
        if (nativeInCharge()) markNativePlaying(false);
        emitEngine("ended", 0, null);
        return;
      }
    }
    if (stage == 1) {
      reopenActive();
    } else if (stage == 2) {
      if (!fallbackActive()) reopenActive();
    } else {
      stallStage = 0;
      // Macet terus walau sumber dibuka ulang: JS yang hidup mengambil link baru (galat jaringan); bila JS beku, native sendiri.
      if (!jsAlive() && relinkActive(false, 2)) return;
      emitEngine("error", 2, null);
    }
  }

  /**
   * Posisi untuk membuka ulang sumber. Setelah galat saat seek / di ujung stream ExoPlayer bisa melapor 0; membuka ulang di 0
   * memutar lagu yang sama dari awal. Pakai posisi terakhir yang valid bila yang dilaporkan jelas keliru.
   */
  private long resumePos(ExoPlayer p) {
    long cur = Math.max(0, p.getCurrentPosition());
    return (cur <= 500 && lastPosMs > 5_000) ? lastPosMs : cur;
  }

  private void reopenActive() {
    Src src = activeSrc;
    ExoPlayer p = player;
    if (src == null || p == null || !hasMedia) return;
    long pos = resumePos(p);
    p.setMediaSource(mediaSourceFor(src), pos);
    p.prepare();
  }

  private static String domainKey(String url) {
    try {
      String host = new java.net.URI(url).getHost();
      if (host == null) return "";
      String[] parts = host.split("\\.");
      return parts.length >= 2 ? parts[parts.length - 2] + "." + parts[parts.length - 1] : host;
    } catch (Exception e) {
      return "";
    }
  }

  private Src makeSrc(String url, String cacheKey) {
    try {
      String[] peeked = StreamProxy.get().peek(url);
      if (directEnabled && peeked != null && !DIRECT_BLOCKED.contains(domainKey(peeked[0]))) {
        if (DIRECT_UA.size() > 400) DIRECT_UA.clear();
        DIRECT_UA.put(peeked[0], peeked[1] == null ? "" : peeked[1]);
        return new Src(url, peeked[0], cacheKey);
      }
    } catch (Exception ignored) {
      // proxy tidak tersedia: pakai URL apa adanya
    }
    return new Src(url, null, cacheKey);
  }

  // ---- Cache disk (SimpleCache): lagu yang sudah diputar / di-seek balik tidak diunduh lagi ----

  private static final long CACHE_BYTES = 200L * 1024L * 1024L;
  private static SimpleCache diskCache;
  private DataSource.Factory plainFactory;
  private DataSource.Factory cachedFactory;
  private DefaultExtractorsFactory extractors;

  private static synchronized SimpleCache diskCache(Context context) {
    if (diskCache == null) {
      try {
        diskCache = new SimpleCache(
            new File(context.getCacheDir(), "exo-audio"),
            new LeastRecentlyUsedCacheEvictor(CACHE_BYTES),
            new StandaloneDatabaseProvider(context));
      } catch (RuntimeException e) {
        return null; // folder cache bermasalah / sudah dipakai: lanjut tanpa cache
      }
    }
    return diskCache;
  }

  private void ensureFactories() {
    if (plainFactory != null) return;
    // OkHttp: HTTP/2, koneksi dipakai ulang, dan lebih tahan di jaringan lossy daripada HttpURLConnection bawaan.
    OkHttpClient client = new OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .retryOnConnectionFailure(true)
        .followRedirects(true)
        .followSslRedirects(true)
        .build();
    OkHttpDataSource.Factory http = new OkHttpDataSource.Factory(client);
    ResolvingDataSource.Factory resolving = new ResolvingDataSource.Factory(
        new DefaultDataSource.Factory(this, http),
        (DataSpec spec) -> {
          String ua = DIRECT_UA.get(spec.uri.toString());
          if (ua == null) return spec;
          Map<String, String> headers = new HashMap<>(spec.httpRequestHeaders);
          if (!ua.isEmpty()) headers.put("User-Agent", ua);
          headers.put("Accept", "*/*");
          return spec.withRequestHeaders(headers);
        });
    plainFactory = resolving;
    SimpleCache cache = diskCache(getApplicationContext());
    cachedFactory = cache == null ? null : new CacheDataSource.Factory()
        .setCache(cache)
        .setUpstreamDataSourceFactory(resolving)
        .setFlags(CacheDataSource.FLAG_IGNORE_CACHE_ON_ERROR);
    extractors = new DefaultExtractorsFactory().setConstantBitrateSeekingEnabled(true);
  }

  private MediaSource mediaSourceFor(Src src) {
    ensureFactories();
    boolean cached = cachedFactory != null && src.cacheKey != null && !src.cacheKey.isEmpty();
    MediaItem.Builder item = new MediaItem.Builder().setUri(src.playUrl());
    if (cached) item.setCustomCacheKey(src.cacheKey);
    return new ProgressiveMediaSource.Factory(cached ? cachedFactory : plainFactory, extractors)
        .setLoadErrorHandlingPolicy(new RetryPolicy())
        .createMediaSource(item.build());
  }

  /** Beralih dari sumber langsung ke proxy pada posisi sekarang. False bila tidak ada yang bisa dialihkan. */
  private boolean fallbackActive() {
    Src src = activeSrc;
    ExoPlayer p = player;
    if (src == null || p == null || !src.direct() || !hasMedia) return false;
    src.fellBack = true;
    DIRECT_BLOCKED.add(domainKey(src.directUrl));
    bufferingSince = 0;
    long pos = resumePos(p);
    p.setMediaSource(mediaSourceFor(src), pos);
    p.prepare();
    return true;
  }

  private boolean fallbackStandby() {
    Src src = standbySrc;
    ExoPlayer p = standby;
    if (src == null || p == null || !src.direct()) return false;
    src.fellBack = true;
    DIRECT_BLOCKED.add(domainKey(src.directUrl));
    p.setMediaSource(mediaSourceFor(src));
    p.prepare();
    return true;
  }

  private static final AudioAttributes AUDIO_ATTRS = new AudioAttributes.Builder()
      .setUsage(C.USAGE_MEDIA)
      .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
      .build();
  /** Pemutar cadangan (lagu berikutnya, senyap) dan pemutar lama yang sedang memudar saat crossfade. */
  private ExoPlayer standby;
  private String standbyUrl;
  private ExoPlayer fading;
  private float activeGain = 1f;
  private float fadingGain = 0f;
  private long fadeStartAt;
  private long fadeDurationMs;

  private final Player.Listener standbyListener = new Player.Listener() {
    @Override public void onPlaybackStateChanged(int state) {
      if (state == Player.STATE_READY) emitStandby("standby_ready", 0);
    }

    @Override public void onPlayerError(PlaybackException error) {
      if (fallbackStandby()) return;
      emitStandby("standby_error", mapError(error.errorCode));
    }
  };

  private void emitStandby(String type, int errorCode) {
    ExoPlayer p = standby;
    EngineListener l = engineListener;
    if (p == null || l == null) return;
    long dur = p.getDuration();
    l.onEngine(type, 0, dur == C.TIME_UNSET || dur <= 0 ? -1 : dur / 1000.0, false, p.isCurrentMediaItemSeekable(), errorCode, 0, "");
  }

  /** Volume tiap pemutar = volume utama (master x akhir-lagu dari JS) x penguatan fade pemutar itu. */
  void applyVolumes() {
    if (player != null) player.setVolume(engineVolume * engineNorm * activeGain * sleepGain);
    if (fading != null) fading.setVolume(engineVolume * engineNorm * fadingGain * sleepGain);
    if (standby != null) standby.setVolume(0f);
  }

  private final Runnable fadeTicker = new Runnable() {
    @Override public void run() {
      if (stopped || fading == null) return;
      double t = Math.min(1.0, (SystemClock.elapsedRealtime() - fadeStartAt) / (double) fadeDurationMs);
      activeGain = (float) Math.sin(t * Math.PI / 2);
      fadingGain = (float) Math.cos(t * Math.PI / 2);
      if (t >= 1.0) {
        cancelFade();
        return;
      }
      applyVolumes();
      handler.postDelayed(this, 50);
    }
  };

  /** Mengakhiri crossfade seketika: pemutar lama dilepas, lagu aktif volume penuh. */
  void cancelFade() {
    handler.removeCallbacks(fadeTicker);
    ExoPlayer old = fading;
    fading = null;
    fadingGain = 0f;
    activeGain = 1f;
    if (old != null) {
      old.release();
    }
    applyVolumes();
  }

  void releaseStandby() {
    ExoPlayer p = standby;
    standbyItem = null;
    standby = null;
    standbyUrl = null;
    standbySrc = null;
    if (p != null) {
      p.removeListener(standbyListener);
      p.release();
    }
  }

  void doStandbyLoad(String url, String cacheKey) {
    if (stopped || player == null || !hasMedia || fading != null) return;
    if (url.equals(standbyUrl) && standby != null) return;
    releaseStandby();
    ExoPlayer p = buildPlayer(false, true);
    // Satu sesi audio dengan pemutar aktif: satu Equalizer berlaku untuk keduanya.
    int session = player.getAudioSessionId();
    if (session != C.AUDIO_SESSION_ID_UNSET) p.setAudioSessionId(session);
    p.setVolume(0f);
    p.addListener(standbyListener);
    standby = p;
    standbyUrl = url;
    standbySrc = makeSrc(url, cacheKey);
    p.setMediaSource(mediaSourceFor(standbySrc));
    p.setPlayWhenReady(false);
    p.prepare();
  }

  boolean doCrossfade(long durationMs) {
    ExoPlayer incoming = standby;
    ExoPlayer outgoing = player;
    if (stopped || incoming == null || outgoing == null || !hasMedia) return false;
    if (incoming.getPlayerError() != null) return false;
    autoAdvance = false;
    cancelFade(); // crossfade sebelumnya yang belum selesai dibereskan dulu
    standby = null;
    standbyUrl = null;
    activeSrc = standbySrc;
    standbySrc = null;
    resetRelink(""); // lagu aktif berganti; chainAdvance mengisi id video setelah ini bila lagunya hasil resolve native
    bufferingSince = 0;
    incoming.removeListener(standbyListener);
    outgoing.removeListener(playerListener);
    // Fokus audio & "headset dicabut" hanya dipegang pemutar aktif.
    outgoing.setAudioAttributes(AUDIO_ATTRS, false);
    outgoing.setHandleAudioBecomingNoisy(false);
    incoming.setAudioAttributes(AUDIO_ATTRS, true);
    incoming.setHandleAudioBecomingNoisy(true);
    incoming.addListener(playerListener);
    player = incoming;
    fading = outgoing;
    activeGain = 0f;
    fadingGain = 1f;
    applyVolumes();
    fadeStartAt = SystemClock.elapsedRealtime();
    fadeDurationMs = durationMs;
    incoming.setPlayWhenReady(true);
    metaSent = false;
    tickCount = 0;
    if (incoming.getPlaybackState() == Player.STATE_READY) {
      metaSent = true;
      emitEngine("durationchange", 0, null);
      emitEngine("loadedmetadata", 0, null);
    }
    handler.removeCallbacks(fadeTicker);
    handler.postDelayed(fadeTicker, 50);
    return true;
  }

  private ExoPlayer ensurePlayer() {
    if (player != null) return player;
    ExoPlayer p = buildPlayer(true, false);
    p.addListener(playerListener);
    player = p;
    applyVolumes();
    applyEq();
    return p;
  }

  private ExoPlayer buildPlayer(boolean handleFocus, boolean forStandby) {
    // Baca-depan besar: mulai putar setelah 1,5 dtk terisi, terus mengisi sampai 3 menit; setelah stall tunggu 4 dtk.
    // Pemutar cadangan (lagu berikutnya) hanya mengisi ~20 dtk supaya tidak berebut bandwidth dengan lagu yang berjalan.
    DefaultLoadControl loadControl = new DefaultLoadControl.Builder()
        .setBufferDurationsMs(forStandby ? 10_000 : 30_000, forStandby ? 20_000 : 180_000, 1_500, 4_000)
        .setPrioritizeTimeOverSizeThresholds(true)
        .build();
    ExoPlayer p = new ExoPlayer.Builder(this)
        .setLoadControl(loadControl)
        .setAudioAttributes(AUDIO_ATTRS, handleFocus)
        .setHandleAudioBecomingNoisy(handleFocus)
        .setWakeMode(C.WAKE_MODE_NETWORK)
        .build();
    p.setPlaybackParameters(new PlaybackParameters(engineSpeed, 1f));
    p.setSeekParameters(SeekParameters.CLOSEST_SYNC); // loncat ke titik sinkron terdekat: lebih cepat tanpa membaca mundur
    p.setTrackSelectionParameters(p.getTrackSelectionParameters().buildUpon()
        .setTrackTypeDisabled(C.TRACK_TYPE_VIDEO, true).build());
    return p;
  }

  /** Lagu dimuat oleh JS: JS yang memegang antrean, daftar native lama dibuang (JS mengirim yang baru). */
  void doLoad(String url, long startMs, String cacheKey, String ytId) {
    currentCoverUrl = "";
    playingIndex = -1;
    knownIndex = -1;
    upcoming.clear();
    resetRadio();
    resetRelink(ytId);
    loadMedia(url, startMs, cacheKey);
  }

  void loadMedia(String url, long startMs, String cacheKey) {
    if (stopped) return;
    ExoPlayer p = ensurePlayer();
    autoAdvance = false;
    cancelFade();
    releaseStandby();
    metaSent = false;
    tickCount = 0;
    hasMedia = true;
    lastPosMs = Math.max(0, startMs);
    activeSrc = makeSrc(url, cacheKey);
    bufferingSince = 0;
    p.setMediaSource(mediaSourceFor(activeSrc), Math.max(0, startMs));
    p.setPlayWhenReady(true);
    p.prepare();
    handler.removeCallbacks(engineTicker);
    handler.postDelayed(engineTicker, 250);
  }

  void doResume() {
    ExoPlayer p = player;
    if (p == null || stopped) return;
    int st = p.getPlaybackState();
    if (st == Player.STATE_IDLE) p.prepare();
    else if (st == Player.STATE_ENDED) p.seekToDefaultPosition();
    p.play();
  }

  void doStopEngine() {
    resetRelink("");
    upcoming.clear();
    resetRadio();
    playingIndex = -1;
    knownIndex = -1;
    if (resumer != null) resumer.end();
    autoAdvance = false;
    hasMedia = false;
    handler.removeCallbacks(engineTicker);
    cancelFade();
    releaseStandby();
    if (player != null) {
      player.stop();
      player.clearMediaItems();
    }
  }

  private void releasePlayer() {
    hasMedia = false;
    handler.removeCallbacks(engineTicker);
    handler.removeCallbacks(fadeTicker);
    releaseStandby();
    ExoPlayer old = fading;
    fading = null;
    if (old != null) old.release();
    activeGain = 1f;
    releaseEq();
    ExoPlayer p = player;
    player = null;
    if (p != null) {
      p.removeListener(playerListener);
      p.release();
    }
  }

  private void releaseEq() {
    if (equalizer != null) {
      try {
        equalizer.release();
      } catch (RuntimeException ignored) {
        // sudah dilepas
      }
      equalizer = null;
    }
    eqSession = -1;
  }

  /** Gain (dB) untuk frekuensi hz dari 10 pita JS: interpolasi linear pada skala log frekuensi. */
  private static double gainAt(double hz) {
    double[] g = eqGains;
    if (hz <= EQ_FREQS[0]) return g[0];
    for (int i = 1; i < EQ_FREQS.length; i++) {
      if (hz <= EQ_FREQS[i]) {
        double t = (Math.log(hz) - Math.log(EQ_FREQS[i - 1])) / (Math.log(EQ_FREQS[i]) - Math.log(EQ_FREQS[i - 1]));
        return g[i - 1] + (g[i] - g[i - 1]) * t;
      }
    }
    return g[g.length - 1];
  }

  /** Equalizer bawaan Android (android.media.audiofx) pada sesi audio ExoPlayer; pita perangkat (biasanya 5) diisi dari 10 pita JS. */
  private void applyEq() {
    ExoPlayer p = player;
    if (p == null) return;
    try {
      int session = p.getAudioSessionId();
      if (session == C.AUDIO_SESSION_ID_UNSET) return;
      if (equalizer == null || eqSession != session) {
        if (!eqEnabled && equalizer == null) return; // jangan membuat efek bila tak dipakai
        releaseEq();
        equalizer = new Equalizer(0, session);
        eqSession = session;
      }
      equalizer.setEnabled(eqEnabled);
      if (!eqEnabled) return;
      short[] range = equalizer.getBandLevelRange();
      short bands = equalizer.getNumberOfBands();
      for (short b = 0; b < bands; b++) {
        double hz = equalizer.getCenterFreq(b) / 1000.0;
        int level = (int) Math.round(gainAt(hz) * 100);
        level = Math.max(range[0], Math.min(range[1], level));
        equalizer.setBandLevel(b, (short) level);
      }
    } catch (RuntimeException e) {
      releaseEq(); // perangkat tanpa efek audio: lagu tetap jalan tanpa EQ
    }
  }

  private MediaSession session;
  private PowerManager.WakeLock wakeLock;
  private final State current = new State();
  /** True sejak native pindah lagu sendiri (rantai) sampai audio benar-benar berbunyi; JS yang beku tidak bisa melepas indikator memuat. */
  private boolean chainLoading = false;
  private long chainLoadingSince = 0;
  private Bitmap defaultCover;
  /** Metadata yang terakhir dipasang ke sesi. Dipasang ulang hanya jika berubah: set ulang terus-menerus membuat kartu media sistem memuat ulang dan bilahnya kembali ke awal. */
  private String metaKey = "";
  private Bitmap metaArt = null;
  private boolean foreground = false;
  /** Sidik jari keadaan yang terakhir didorong ke widget layar utama; didorong ulang hanya bila berubah. */
  private String widgetKey = "";
  private Bitmap widgetCover = null;
  /** True setelah shutdown(): semua pembaruan yang masih antre (dari JS / ticker) diabaikan supaya notifikasi tidak muncul lagi. */
  private volatile boolean stopped = false; // dibaca juga oleh thread pencari radio
  /** True saat wake lock yang dipegang adalah yang berbatas waktu (menunggu putar-ulang setelah gangguan). */
  private boolean timedLock = false;
  /** Waktu (elapsedRealtime) pembaruan terakhir dari JS. Dasar watchdog: JS mati = tidak ada kabar lagi. */
  private volatile long lastJsUpdateAt = 0; // dibaca juga oleh thread pencari radio
  /** Saat memutar, JS mengirim detak tiap ~2 dtk. Tanpa kabar selama ini berarti WebView/app sudah mati. */
  private static final long JS_SILENCE_LIMIT_MS = 90L * 1000L;
  private static final long WATCHDOG_INTERVAL_MS = 15L * 1000L;
  /** Lama maksimum wake lock saat menunggu putar-ulang otomatis setelah gangguan. */
  private static final long INTERRUPT_WAKE_MS = 20L * 60L * 1000L;
  private final Runnable watchdog = new Runnable() {
    @Override public void run() {
      if (stopped) return;
      // Hanya bila audio juga tidak berbunyi: JS yang beku di latar belakang tidak boleh mematikan lagu yang sedang jalan.
      boolean audible = player != null && player.isPlaying();
      if (current.playing && !audible && SystemClock.elapsedRealtime() - lastJsUpdateAt > JS_SILENCE_LIMIT_MS) {
        shutdown();
        return;
      }
      handler.postDelayed(this, WATCHDOG_INTERVAL_MS);
    }
  };
  /** Waktu (elapsedRealtime) saat positionMs terakhir dilaporkan JS; dasar penghitungan posisi berjalan. */
  private long positionAt = 0;
  private final Handler handler = new Handler(Looper.getMainLooper());
  /** Putar-ulang otomatis setelah gangguan fokus audio (panggilan / app lain), seluruhnya di native dan tanpa batas waktu pendek. */
  private InterruptionResumer resumer;
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
      if (stopped || !current.playing || session == null) return;
      releaseChainLoading();
      pushPlaybackState();
      // Bilah progres + waktu di widget layar utama (pembaruan sebagian, hanya bila layar menyala).
      MusicVerseWidget.tick(PlaybackService.this, livePosition(), current.durationMs);
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
    resumer =
        new InterruptionResumer(
            this,
            handler,
            new InterruptionResumer.Host() {
              @Override public boolean isPlayWanted() {
                return player != null && player.getPlayWhenReady();
              }

              @Override public void resumePlayback() {
                // Lagu sudah selesai saat gangguan: jangan putar ulang lagu yang sama dari awal.
                if (!stopped && hasMedia && player != null && player.getPlaybackState() != Player.STATE_ENDED) doResume();
              }

              @Override public void holdWake(long ms) {
                // Kunci berbatas waktu; apply() menggantinya dengan kunci biasa begitu benar-benar memutar.
                if (wakeLock == null || (wakeLock.isHeld() && !timedLock)) return;
                wakeLock.acquire(ms);
                timedLock = true;
              }

              @Override public void gaveUp() {
                shutdown();
              }
            });
    resumer.setEnabled(autoResumeEnabled);
    // Sesi dipegang MediaSessionHolder (bersama AutoBrowserService / Android Auto). Callback bawaannya juga menangani
    // putar-dari-id-lagu dan pencarian suara; di sini hanya tombol transport yang diganti dengan logika service.
    session = MediaSessionHolder.attach(this, new MediaSessionHolder.BaseCallback(this) {
      @Override public void onPlay() { handleAction("play"); }
      @Override public void onPause() { handleAction("pause"); }
      @Override public void onStop() { emit("stop", -1); }
      @Override public void onSkipToNext() { handleAction("next"); }
      @Override public void onSkipToPrevious() { handleAction("previous"); }
      @Override public void onSeekTo(long pos) { handleSeek(pos); }
    });
    PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
    if (pm != null) {
      wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "MusicVerse:playback");
      wakeLock.setReferenceCounted(false);
    }
    // Wajib: begitu startForegroundService() dipanggil, startForeground() harus menyusul segera.
    lastJsUpdateAt = SystemClock.elapsedRealtime();
    startInForeground(buildNotification());
    handler.postDelayed(watchdog, WATCHDOG_INTERVAL_MS);
    scheduleSleep(); // timer tidur yang diatur sebelum service (re)start
  }

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    if (intent != null && intent.getAction() != null) {
      switch (intent.getAction()) {
        case ACTION_PLAY: handleAction("play"); break;
        case ACTION_PAUSE: handleAction("pause"); break;
        case ACTION_NEXT: handleAction("next"); break;
        case ACTION_PREVIOUS: handleAction("previous"); break;
        case ACTION_DISMISS: shutdown(); return START_NOT_STICKY;
        case ACTION_SWIPED:
          if (!stopped && hasMedia && (current.interrupted || (resumer != null && resumer.isWaiting()))) {
            // Gangguan sesaat: sebagian ROM (ColorOS/MIUI, Android 14+) menyingkirkan notifikasi media yang sedang jeda.
            // Pasang lagi alih-alih mematikan pemutar, supaya lagu bisa lanjut sendiri setelah gangguan selesai.
            startInForeground(buildNotification());
            break;
          }
          shutdown();
          return START_NOT_STICKY;
        default: break;
      }
    }
    State state = pending;
    pending = null;
    if (state != null) apply(state);
    LoadRequest load = pendingLoad;
    pendingLoad = null;
    if (load != null) doLoad(load.url, load.startMs, load.cacheKey, load.ytId);
    // Audio ikut proses aplikasi (JS yang mengatur antrean); jika proses mati, service tidak ada gunanya sendirian.
    return START_NOT_STICKY;
  }

  // ---------------------------------------------------------------------------------------------
  // Rantai lagu native + tombol notifikasi tanpa JS (WebView yang dibekukan di latar belakang).
  // ---------------------------------------------------------------------------------------------

  /** JS masih mengirim detak (WebView hidup). Saat memutar JS mengirim ~tiap 2 dtk. */
  private boolean jsAlive() {
    return SystemClock.elapsedRealtime() - lastJsUpdateAt <= JS_STALE_MS;
  }

  /**
   * Native yang memegang kendali: JS tidak mengirim detak padahal sedang memutar, atau native sudah pindah lagu sendiri.
   * Saat dijeda biasa JS memang diam, jadi diamnya JS saja bukan tanda beku.
   */
  private boolean nativeInCharge() {
    return !jsAlive() && (current.playing || playingIndex != -1);
  }

  void setUpcoming(int currentIndex, List<UpcomingItem> items, int radioTail, List<String> radioExclude, List<UpcomingItem> previous) {
    if (stopped) return;
    // Native sudah pindah sendiri dan JS belum menyamakan: daftar ini dibuat dari keadaan lama.
    if (playingIndex != -1 && currentIndex != playingIndex) return;
    knownIndex = currentIndex;
    // Bekal Sebelumnya dari JS menggantikan yang lama (JS yang memegang antrean).
    prevSeed.clear();
    if (previous != null) {
      for (UpcomingItem p : previous) if (p != null && !p.url.isEmpty()) prevSeed.add(p);
    }
    // Info radio dari JS (antrean JS yang berlaku). JS yang memegang antrean: pencarian yang sedang jalan dibuang.
    radioTailIndex = radioTail;
    radioNextIndex = radioTail;
    radioKeys.clear();
    if (radioExclude != null) radioKeys.addAll(radioExclude);
    radioSeedTried = "";
    radioToken++;
    radioBusy = false;
    upcoming.clear();
    if (items != null) upcoming.addAll(items);
    if (waitingFor != null && !upcoming.contains(waitingFor)) {
      waitingFor = null;
      State idle = snapshot();
      idle.loading = false;
      applyInternal(idle, false);
    }
    // Pemutar cadangan milik rantai ini sudah tidak sesuai daftar baru: buang.
    if (standbyItem != null && (upcoming.isEmpty() || upcoming.get(0) != standbyItem)) releaseStandby();
    pushHasNext();
    preloadChainStandby();
  }

  // ---------------------------------------------------------------------------------------------
  // Radio native (langkah 2b): saat JS beku dan antrean native tinggal sedikit, cari lagu mirip untuk lagu aktif
  // (RadioFinder), tambahkan ke antrean native sebagai item tanpa URL (dicocokkan ke YouTube oleh YtMatcher lewat
  // resolveLazy, seperti item lain), dan simpan daftarnya di RadioExtras supaya JS bisa menyamakan antrean saat bangun (2c).
  // ---------------------------------------------------------------------------------------------

  /** Cari lagu radio bila lagu yang tersisa di antrean native (belum gagal) tinggal sebanyak ini atau kurang. */
  private static final int RADIO_LOW_WATER = 2;
  /** Panjang antrean JS saat daftar terakhir dikirim, bila radio boleh menambah; -1 = tidak boleh. */
  private int radioTailIndex = -1;
  /** Indeks antrean untuk lagu tambahan berikutnya. */
  private int radioNextIndex = -1;
  /** Kunci judul + artis yang tidak boleh diulang radio (antrean JS + tambahan native). */
  private final Set<String> radioKeys = new HashSet<>();
  /** Lagu aktif (kunci) yang pencariannya sudah dicoba: hasil kosong / gagal tidak diulang untuk lagu yang sama. */
  private String radioSeedTried = "";
  private boolean radioBusy = false;
  /** Naik tiap JS mengirim daftar baru / lagu dimuat JS / engine berhenti: hasil pencarian lama dibuang. */
  private volatile int radioToken = 0;

  private void resetRadio() {
    radioTailIndex = -1;
    radioNextIndex = -1;
    radioKeys.clear();
    radioSeedTried = "";
    radioBusy = false;
    radioToken++;
  }

  /** Dipanggil dari ticker (thread utama). Murah bila syaratnya tidak terpenuhi. */
  private void maybeFillRadio() {
    if (radioBusy || stopped || radioTailIndex < 0 || jsAlive() || !current.playing) return;
    if (current.title.isEmpty() || waitingFor != null) return;
    int left = 0;
    for (UpcomingItem u : upcoming) if (!u.failed) left++;
    if (left > RADIO_LOW_WATER) return;
    final String seedTitle = current.title;
    final String seedArtist = current.artist;
    final String seedKey = RadioFinder.trackKey(seedTitle, seedArtist);
    if (RadioFinder.firstArtist(seedArtist).isEmpty() || seedKey.equals(radioSeedTried)) return;
    radioSeedTried = seedKey;
    radioBusy = true;
    final int token = radioToken;
    final int startIndex = radioNextIndex;
    final Set<String> exclude = new HashSet<>(radioKeys);
    exclude.add(seedKey);
    for (UpcomingItem u : upcoming) exclude.add(RadioFinder.trackKey(u.title, u.artist));
    for (HistoryItem h : history) exclude.add(RadioFinder.trackKey(h.title, h.artist));
    final Context app = getApplicationContext();
    new Thread(
            () -> {
              List<RadioFinder.Track> found = new ArrayList<>();
              try {
                // Batal bila service berhenti, antrean JS berganti, atau JS bangun lagi (JS mengisi radio sendiri).
                found = RadioFinder.findSimilar(new RadioFinder.DeezerSource(), seedTitle, seedArtist, exclude,
                    () -> stopped || token != radioToken || jsAlive());
              } catch (Exception e) {
                android.util.Log.w("MusicVerse", "Radio native \"" + seedTitle + "\": " + e);
              }
              final List<RadioFinder.Track> result = found;
              handler.post(() -> onRadioFound(token, seedKey, startIndex, result, app));
            },
            "mv-radio-find")
        .start();
  }

  private void onRadioFound(int token, String seedKey, int startIndex, List<RadioFinder.Track> tracks, Context app) {
    if (stopped || token != radioToken) return; // daftar JS berganti / service berhenti: hasil usang
    radioBusy = false;
    // JS sudah bangun: JS yang menambah radio (AutoRadioSync). Menambah juga di sini membuat antrean ganda.
    if (jsAlive() || radioTailIndex < 0 || startIndex != radioNextIndex) {
      radioSeedTried = "";
      return;
    }
    if (tracks.isEmpty()) return; // tidak ada tambahan; radioSeedTried mencegah mengulang untuk lagu yang sama
    int index = startIndex;
    for (RadioFinder.Track t : tracks) {
      // Tanpa URL: resolveLazy mencocokkannya ke YouTube lewat YtMatcher saat lagu itu giliran (atau dimuat lebih awal).
      UpcomingItem item = new UpcomingItem(index++, "", null, t.title, t.artists, t.album, t.cover, t.durationSec * 1000L, 1f, t.id, t.url);
      upcoming.add(item);
      radioKeys.add(RadioFinder.trackKey(t.title, t.artists));
    }
    radioNextIndex = index;
    RadioExtras.add(app, tracks, startIndex);
    android.util.Log.i("MusicVerse", "Radio native menambah " + tracks.size() + " lagu (indeks " + startIndex + ".." + (index - 1) + ")");
    pushHasNext();
    preloadChainStandby();
  }

  /** Lagu berikutnya tanpa URL yang sedang ditunggu native (lagu aktif sudah selesai / Berikutnya ditekan). */
  private UpcomingItem waitingFor = null;
  private boolean waitingForce = false;

  /**
   * Lagu berikutnya yang belum di-resolve JS: dicari native sendiri (judul + artis + durasi -> YouTube) di thread terpisah,
   * lalu URL-nya disalurkan lewat StreamProxy seperti milik JS. Gagal = lagu itu dilewati.
   */
  private void resolveLazy(final UpcomingItem item) {
    if (item.resolving || item.failed || !item.url.isEmpty()) return;
    item.resolving = true;
    final Context app = getApplicationContext();
    new Thread(
            () -> {
              String url = "";
              String id = "";
              try {
                Double sec = item.durationMs > 0 ? Double.valueOf(item.durationMs / 1000.0) : null;
                YtMatcher.Result r = YtMatcher.resolve(app, item.title, item.artist, sec, false, null, 0);
                if (r.ok()) {
                  url = StreamProxy.get().register(r.stream.url, r.stream.userAgent);
                  id = r.videoId();
                } else {
                  android.util.Log.w("MusicVerse", "Resolve native \"" + item.title + "\": " + r.outcome);
                }
              } catch (Exception e) {
                android.util.Log.w("MusicVerse", "Resolve native gagal: " + e);
              }
              final String fUrl = url;
              final String fId = id;
              handler.post(() -> onLazyResolved(item, fUrl, fId));
            },
            "mv-yt-resolve")
        .start();
  }

  private void onLazyResolved(UpcomingItem item, String url, String id) {
    item.resolving = false;
    if (stopped) return;
    if (url.isEmpty()) {
      item.failed = true;
    } else {
      item.url = url;
      item.ytId = id;
    }
    if (waitingFor == item) {
      waitingFor = null;
      if (item.failed) {
        upcoming.remove(item);
        pushHasNext();
      }
      if (!chainAdvance(waitingForce)) {
        State idle = snapshot();
        idle.loading = false;
        applyInternal(idle, false);
      }
    } else if (upcoming.contains(item)) {
      preloadChainStandby();
    }
  }

  /** Pindah ke lagu berikutnya dari daftar native. `force` = tombol Berikutnya (lagu aktif belum selesai). */
  private boolean chainAdvance(boolean force) {
    if (stopped || player == null || upcoming.isEmpty()) return false;
    if (!force && !player.getPlayWhenReady()) return false;
    // JS masih hidup dan mengatur pergantian lagu sendiri (ulang lagu, sleep timer akhir lagu, dst. dikecualikan di sisinya
    // dengan mengosongkan daftar ini); hanya saat 'ended' kita ambil alih, atau saat JS beku.
    UpcomingItem item = upcoming.get(0);
    // Pengaman loop: lagu yang akan "berikutnya" ternyata lagu yang sedang diputar = daftar usang. Buang, jangan putar ulang.
    if (item.index == knownIndex || item.index == playingIndex) {
      upcoming.clear();
      releaseStandby();
      pushHasNext();
      return false;
    }
    // Belum punya URL: tunggu hasil resolve native (atau lewati bila gagal).
    if (item.url.isEmpty()) {
      if (item.failed) {
        upcoming.remove(0);
        pushHasNext();
        return chainAdvance(force);
      }
      waitingFor = item;
      waitingForce = force;
      resolveLazy(item);
      State wait = snapshot();
      wait.loading = true;
      applyInternal(wait, false);
      return true;
    }
    // Standby dapat dimuat oleh JS sebelum WebView membeku (standbyItem == null),
    // atau oleh preloadChainStandby. Cocokkan URL agar kedua jalur memakai audio siap tanpa memuat ulang.
    pushHistory(); // sebelum activeSrc / knownIndex berganti
    currentCoverUrl = item.coverUrl;
    engineNorm = item.normGain; // normalisasi volume lagu berikutnya (JS beku tidak bisa menggantinya)
    applyVolumes();
    boolean viaStandby = standby != null
        && (standbyItem == item || item.url.equals(standbyUrl))
        && standby.getPlayerError() == null
        && doCrossfade(150);
    if (!viaStandby) loadMedia(item.url, 0, item.cacheKey);
    resetRelink(item.ytId);
    player.setPlayWhenReady(true);
    upcoming.remove(0);
    playingIndex = item.index;
    knownIndex = item.index;
    standbyItem = null;
    State s = snapshot();
    s.title = item.title;
    s.artist = item.artist;
    s.album = item.album;
    s.durationMs = item.durationMs;
    s.positionMs = 0;
    s.playing = true;
    s.loading = true;
    s.hasNext = !upcoming.isEmpty();
    s.hasPrevious = true;
    s.interrupted = false;
    s.resetCover = true;
    s.cover = item.coverBitmap;
    chainLoading = true;
    chainLoadingSince = SystemClock.elapsedRealtime();
    applyInternal(s, false);
    if (item.coverBitmap == null) fetchCover(item);
    journalPlay(item);
    // Lagu yang dipilih native sendiri (tanpa JS): bawa id video + URL supaya JS bisa menyamakan state saat bangun.
    emitEngine("advanced", 0, "idx:" + item.index + (item.ytId.isEmpty() ? "" : "|yt:" + item.ytId + "|url:" + item.url));
    preloadChainStandby();
    return true;
  }

  /** Saat JS beku, lagu berikutnya dimuat lebih awal di pemutar cadangan supaya pindahnya tanpa jeda. */
  private void preloadChainStandby() {
    if (stopped || player == null || !hasMedia || upcoming.isEmpty() || fading != null || jsAlive()) return;
    UpcomingItem next = upcoming.get(0);
    if (next.url.isEmpty()) {
      resolveLazy(next);
      return;
    }
    if (standbyItem == next) return;
    if (standby != null && standbyItem == null) return; // pemutar cadangan milik JS: jangan ditimpa
    doStandbyLoad(next.url, next.cacheKey);
    if (standby != null) standbyItem = next;
  }


  /**
   * Lepas indikator "memuat" setelah native pindah lagu sendiri. Dulu hanya dilepas oleh onIsPlayingChanged dan hanya bila
   * JS dianggap beku; kalau peristiwa itu terlewat (JS terbangun sebentar, crossfade dari pemutar cadangan, dsb.) bilah progres
   * notifikasi terus berputar dan tombol Sebelumnya/Berikutnya terkunci. Sekarang juga dicek tiap detik dari keadaan pemutar.
   */
  private void releaseChainLoading() {
    if (!chainLoading) return;
    ExoPlayer p = player;
    if (stopped || p == null) return;
    boolean sounding = p.isPlaying() || (p.getPlaybackState() == Player.STATE_READY && p.getPlayWhenReady());
    boolean timedOut = SystemClock.elapsedRealtime() - chainLoadingSince > 12_000L && p.getPlaybackState() == Player.STATE_READY;
    if (!sounding && !timedOut) return;
    chainLoading = false;
    State s = snapshot();
    s.loading = false;
    s.playing = p.getPlayWhenReady();
    s.positionMs = Math.max(0, p.getCurrentPosition());
    long dur = p.getDuration();
    if (dur != C.TIME_UNSET && dur > 0) s.durationMs = dur;
    applyInternal(s, false);
  }

  private State snapshot() {
    State s = new State();
    s.title = current.title;
    s.artist = current.artist;
    s.album = current.album;
    s.durationMs = current.durationMs;
    s.positionMs = livePosition();
    s.playing = current.playing;
    s.loading = current.loading;
    s.hasNext = current.hasNext;
    s.hasPrevious = current.hasPrevious;
    s.interrupted = current.interrupted;
    return s;
  }

  private void pushHasNext() {
    if (current.hasNext == !upcoming.isEmpty() || jsAlive()) return;
    State s = snapshot();
    s.hasNext = !upcoming.isEmpty();
    applyInternal(s, false);
  }

  private void markNativePlaying(boolean playing) {
    if (stopped || (current.playing == playing && !current.loading)) return;
    optimisticLoading = false;
    State s = snapshot();
    s.playing = playing;
    s.loading = false;
    applyInternal(s, false);
  }

  /** True sejak Putar ditekan di notifikasi/widget sampai JS memegang keadaan lagi (atau batas waktu). */
  private boolean optimisticLoading = false;

  /**
   * Putar ditekan dari notifikasi/widget/mobil: langsung tampil memuat (bilah berjalan + \"Memuat lagu…\"). JS yang kemudian
   * menentukan (mengambil tautan baru atau lanjut biasa) dan menimpa keadaan ini lewat applyInternal(fromJs = true).
   * Bila JS sama sekali tidak bereaksi dalam OPTIMISTIC_LOADING_MS, kembali ke keadaan jeda supaya tidak memuat selamanya.
   */
  private void showOptimisticLoading() {
    if (stopped || current.playing) return;
    optimisticLoading = true;
    State s = snapshot();
    s.playing = true;
    s.loading = true;
    applyInternal(s, false);
    final long tappedAt = SystemClock.elapsedRealtime();
    handler.postDelayed(() -> {
      if (stopped || !optimisticLoading || lastJsUpdateAt > tappedAt) return;
      optimisticLoading = false;
      State back = snapshot();
      back.playing = false;
      back.loading = false;
      applyInternal(back, false);
    }, OPTIMISTIC_LOADING_MS);
  }

  private static final long OPTIMISTIC_LOADING_MS = 20_000L;

  /** Sampul lagu hasil pindah native diambil di thread sendiri (tanpa JS); gagal = tetap sampul bawaan. */
  private void fetchCover(UpcomingItem item) {
    if (item.coverUrl.isEmpty() || !(item.coverUrl.startsWith("https://") || item.coverUrl.startsWith("http://"))) return;
    final int token = ++coverToken;
    new Thread(() -> {
      HttpURLConnection c = null;
      try {
        c = (HttpURLConnection) new URL(item.coverUrl).openConnection();
        c.setConnectTimeout(10_000);
        c.setReadTimeout(10_000);
        if (c.getResponseCode() != 200) return;
        ByteArrayOutputStream buf = new ByteArrayOutputStream();
        try (InputStream in = c.getInputStream()) {
          byte[] chunk = new byte[16 * 1024];
          int n;
          while ((n = in.read(chunk)) > 0) {
            buf.write(chunk, 0, n);
            if (buf.size() > 4 * 1024 * 1024) return;
          }
        }
        byte[] data = buf.toByteArray();
        BitmapFactory.Options bounds = new BitmapFactory.Options();
        bounds.inJustDecodeBounds = true;
        BitmapFactory.decodeByteArray(data, 0, data.length, bounds);
        int sample = 1;
        while (bounds.outWidth / (sample * 2) >= 512 && bounds.outHeight / (sample * 2) >= 512) sample *= 2;
        BitmapFactory.Options opts = new BitmapFactory.Options();
        opts.inSampleSize = sample;
        Bitmap bmp = BitmapFactory.decodeByteArray(data, 0, data.length, opts);
        if (bmp == null) return;
        handler.post(() -> {
          if (stopped || token != coverToken) return; // sudah pindah lagu lagi
          State s = snapshot();
          s.cover = bmp;
          applyInternal(s, false);
        });
      } catch (Exception e) {
        // sampul hanya pemanis
      } finally {
        if (c != null) c.disconnect();
      }
    }, "mv-chain-cover").start();
  }

  /**
   * Tombol notifikasi / sesi media. Normalnya diteruskan ke JS (yang memegang antrean). Bila JS beku (tanpa detak),
   * native mengerjakannya sendiri, jadi tombol tetap berfungsi dan pemutaran tidak "mati" setelah beberapa lagu.
   */
  /**
   * Bilah progres notifikasi / layar kunci digeser. Dikerjakan di native SEKARANG: pemutar langsung loncat dan posisi sesi
   * diperbarui, jadi bilah tidak mental balik ke posisi lama walau WebView di latar belakang beku / lambat. JS tetap diberi
   * tahu (untuk state aplikasi, dan untuk pindah lagu bila digeser sampai ujung); seek ganda di JS tidak berbahaya.
   */
  private void handleSeek(long pos) {
    if (stopped) return;
    long target = Math.max(0, pos);
    if (current.durationMs > 0 && target > current.durationMs) target = current.durationMs;
    // Digeser sampai ujung = ingin ganti lagu: biarkan JS yang pindah ke lagu berikutnya.
    boolean nearEnd = current.durationMs > 0 && target >= current.durationMs - 750L;
    ExoPlayer p = player;
    if (!nearEnd && p != null && hasMedia && p.getPlaybackState() != Player.STATE_ENDED) {
      lastPosMs = target;
      bufferingSince = 0;
      stallStage = 0;
      if (p.getPlaybackState() == Player.STATE_IDLE) p.prepare();
      p.seekTo(target);
    }
    current.positionMs = target;
    positionAt = SystemClock.elapsedRealtime();
    pushPlaybackState();
    MusicVerseWidget.tick(this, target, current.durationMs);
    // ROM yang menggambar bilah dari notifikasi (bukan dari sesi): perbarui notifikasinya juga.
    NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
    if (nm != null) nm.notify(NOTIFICATION_ID, buildNotification());
    emit("seek", pos);
  }

  /** Bilah progres kembali ke 0:00 SEKARANG (sesi + notifikasi), tanpa menunggu JS yang bisa beku / lambat di latar belakang. */
  private void showPositionZero() {
    current.positionMs = 0;
    positionAt = SystemClock.elapsedRealtime();
    pushPlaybackState();
    NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
    if (nm != null) nm.notify(NOTIFICATION_ID, buildNotification());
  }

  private void handleAction(String action) {
    if (stopped) return;
    // Previous: lagu diulang dari awal (sudah jalan > 3 dtk) atau pindah ke lagu sebelumnya; keduanya mulai dari 0:00, jadi bilah langsung ke 0.
    boolean previousRestart = false;
    if (action.equals("previous")) {
      previousRestart = livePosition() > 3_000L;
      showPositionZero();
    }
    final boolean restartOnly = previousRestart;
    if (!nativeInCharge()) {
      // Putar ditekan saat dijeda: tampilkan "Memuat lagu…" di notifikasi dan widget SEKARANG juga. JS bisa terlambat bereaksi
      // (WebView di latar belakang) dan mengambil tautan baru butuh beberapa detik; tanpa ini tampilan tetap "jeda" tanpa tanda apa pun.
      if (action.equals("play")) showOptimisticLoading();
      emit(action, -1);
      // Jaring pengaman untuk Putar/Jeda: bila JS beku sehingga tidak bereaksi, native mengerjakannya sendiri sebentar lagi.
      // Bila JS sempat bereaksi (mis. sedang mengambil tautan audio BARU setelah jeda lama), jangan dipaksa: memutar ulang
      // audio lama yang tautannya sudah mati hanya membuat pemutar macet / galat sambil JS memuat yang baru.
      if (action.equals("play") || action.equals("pause")) {
        final long tappedAt = SystemClock.elapsedRealtime();
        handler.postDelayed(() -> {
          if (stopped || lastJsUpdateAt > tappedAt) return;
          nativeFallback(action);
        }, 1_200L);
      }
      // Next/Previous: bila JS setengah beku (belum lewat batas detak) dan sama sekali tidak bereaksi, native mengerjakannya sendiri.
      // "Tidak bereaksi" = tidak ada kabar dari JS sejak tombol ditekan dan lagu belum berganti.
      if (action.equals("next") || action.equals("previous")) {
        final long pressedAt = SystemClock.elapsedRealtime();
        final String before = current.title + "\u0001" + playingIndex;
        handler.postDelayed(() -> {
          if (stopped || lastJsUpdateAt > pressedAt) return;
          if (!before.equals(current.title + "\u0001" + playingIndex)) return;
          if (action.equals("next")) chainAdvance(true);
          else if (!restartOnly && chainPrevious()) return;
          else if (player != null && hasMedia) {
            player.seekTo(0);
            player.play();
          }
        }, 4_000L);
      }
      return;
    }
    switch (action) {
      case "next":
        if (chainAdvance(true)) return;
        break;
      case "previous":
        if (!previousRestart && chainPrevious()) return;
        if (player != null && hasMedia) {
          lastPosMs = 0;
          player.seekTo(0);
          player.play();
          markNativePlaying(true);
          return;
        }
        break;
      case "play":
        if (nativePlay()) return;
        break;
      case "pause":
        if (nativePause()) return;
        break;
      default:
        break;
    }
    emit(action, -1); // tidak bisa dikerjakan native: biarkan JS (bila hidup lagi) yang menangani
  }

  private void nativeFallback(String action) {
    if (stopped || player == null || !hasMedia) return;
    if (action.equals("play") && !player.getPlayWhenReady()) nativePlay();
    else if (action.equals("pause") && player.getPlayWhenReady()) nativePause();
  }

  private boolean nativePlay() {
    if (player == null) return false;
    if (player.getPlaybackState() == Player.STATE_ENDED && chainAdvance(true)) return true;
    if (!hasMedia) return chainAdvance(true);
    doResume();
    markNativePlaying(true);
    return true;
  }

  private boolean nativePause() {
    if (player == null) return false;
    cancelFade();
    player.pause();
    markNativePlaying(false);
    return true;
  }

  @Override
  public void onTaskRemoved(Intent rootIntent) {
    // Aplikasi digeser dari recent apps: WebView (dan audionya) ikut mati, jadi jangan tinggalkan notifikasi yatim.
    shutdown();
    super.onTaskRemoved(rootIntent);
  }

  @Override
  public void onDestroy() {
    if (!stopped) recordSession(true);
    NativeSession.markDead();
    stopped = true;
    if (resumer != null) resumer.end();
    handler.removeCallbacksAndMessages(null);
    if (instance == this) instance = null;
    // Jaring pengaman: pastikan notifikasi benar-benar hilang.
    NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
    if (nm != null) nm.cancel(NOTIFICATION_ID);
    if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
    releasePlayer();
    if (session != null) {
      // Sesi tidak dilepas (milik MediaSessionHolder): kembali ke keadaan siap untuk Android Auto.
      MediaSessionHolder.detach(this);
      session = null;
    }
    MusicVerseWidget.pushIdle(this);
    super.onDestroy();
  }

  @Override
  public IBinder onBind(Intent intent) {
    return null;
  }

  void apply(State next) {
    applyInternal(next, true);
  }

  /** `fromJs` false = pembaruan native (rantai lagu / tombol notifikasi): tidak boleh dianggap detak JS. */
  void applyInternal(State next, boolean fromJs) {
    if (stopped) return;
    if (fromJs && next.resetCover && !next.title.equals(current.title)) {
      // JS memindahkan lagu sendiri: riwayat native (lagu yang ia tinggalkan sendiri) sudah usang. Tanpa ini tombol
      // Sebelumnya di notifikasi melompat ke lagu yang beda dari yang terlihat di aplikasi.
      history.clear();
    }
    if (fromJs) {
      lastJsUpdateAt = SystemClock.elapsedRealtime();
      chainLoading = false; // JS hidup lagi dan memegang keadaan
      optimisticLoading = false;
    }
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
    current.interrupted = next.interrupted;
    if (next.resetCover) current.cover = null;
    if (next.cover != null) current.cover = next.cover;
    // Sampul lagu yang baru saja diputar diingat (per judul + artis): kembali ke lagu itu (Sebelumnya di notifikasi) langsung
    // punya banner, tidak menunggu JS menyusun sampul lagi.
    String memoKey = current.title + "\u0001" + current.artist;
    if (next.resetCover && next.cover == null && !current.title.isEmpty()) current.cover = coverMemo.get(memoKey);
    if (current.cover != null && !current.title.isEmpty()) coverMemo.put(memoKey, current.cover);

    updateSession();
    notifyWidget();
    handler.removeCallbacks(ticker);
    if (current.playing) handler.postDelayed(ticker, 1000);
    Notification notification = buildNotification();
    if (current.playing) {
      handler.removeCallbacks(idleStop);
      idleScheduled = false;
      if (wakeLock != null && timedLock) {
        // Lanjut memutar: ganti kunci berbatas waktu (menunggu putar-ulang) dengan kunci biasa.
        if (wakeLock.isHeld()) wakeLock.release();
        timedLock = false;
      }
      if (wakeLock != null && !wakeLock.isHeld()) wakeLock.acquire();
      startInForeground(notification);
    } else {
      // Jeda: wake lock dilepas (hemat baterai), tetapi service tetap foreground dan notifikasi tetap ada sampai
      // IDLE_LIMIT_MS tanpa dipakai. Itu menjaga proses (dan WebView) tetap hidup agar bisa lanjut sendiri setelah
      // diinterupsi app lain. Batas waktu dihitung dari saat mulai dijeda, bukan diperpanjang tiap pembaruan.
      // Pengecualian: terhenti karena gangguan (app lain / panggilan) dan JS menunggu untuk memutar lagi. Tanpa wake lock,
      // CPU tidur saat layar mati dan pengecekan putar-ulang otomatis di JS tidak pernah jalan. Dipegang paling lama
      // INTERRUPT_WAKE_MS (otomatis lepas sendiri), lalu kembali hemat baterai.
      if (current.interrupted) {
        if (wakeLock != null && !timedLock) {
          // Ganti kunci tanpa batas waktu (dari saat memutar) dengan yang berbatas waktu.
          if (wakeLock.isHeld()) wakeLock.release();
          wakeLock.acquire(INTERRUPT_WAKE_MS);
          timedLock = true;
        }
      } else {
        timedLock = false;
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
      }
      startInForeground(notification);
      if (resumer != null && resumer.isWaiting()) {
        // Menunggu gangguan selesai: service tetap hidup (tanpa batas 60 menit) agar bisa lanjut sendiri walau lama.
        // Batas pengamannya ada di InterruptionResumer (24 jam).
        handler.removeCallbacks(idleStop);
        idleScheduled = false;
      } else if (!idleScheduled) {
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
    if (stopped) return;
    recordSession(true); // posisi terakhir sebelum pemutar dilepas
    NativeSession.markDead();
    stopped = true;
    // Lepas referensi SEKARANG (bukan menunggu onDestroy): detak JS yang masih antre tidak boleh
    // memanggil apply() lagi dan menghidupkan notifikasi yang baru saja dihapus.
    if (instance == this) instance = null;
    pending = null;
    pendingLoad = null;
    if (resumer != null) resumer.end(); // lepas callback audio sebelum antrean handler dikosongkan
    handler.removeCallbacksAndMessages(null);
    idleScheduled = false;
    releasePlayer();
    if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
    stopForeground(true);
    foreground = false;
    NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
    if (nm != null) nm.cancel(NOTIFICATION_ID);
    widgetKey = "";
    MusicVerseWidget.pushIdle(this);
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

  /** Dorong keadaan ke widget layar utama, hanya bila ada yang berubah (applyInternal dipanggil tiap ~2 dtk saat memutar). */
  private void notifyWidget() {
    if (stopped) return;
    String key = current.title + "\u0001" + current.artist + "\u0001" + current.playing + current.loading
        + current.hasNext + current.hasPrevious;
    if (key.equals(widgetKey) && current.cover == widgetCover) return;
    widgetKey = key;
    widgetCover = current.cover;
    MusicVerseWidget.push(this, current.title, current.artist, current.playing, current.loading,
        current.hasNext, current.hasPrevious, current.cover, livePosition(), current.durationMs);
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
    long actions = PlaybackState.ACTION_PLAY | PlaybackState.ACTION_PAUSE | PlaybackState.ACTION_PLAY_PAUSE | PlaybackState.ACTION_STOP
        | PlaybackState.ACTION_PLAY_FROM_MEDIA_ID | PlaybackState.ACTION_PLAY_FROM_SEARCH;
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
        .setDeleteIntent(action(ACTION_SWIPED, 5))
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
