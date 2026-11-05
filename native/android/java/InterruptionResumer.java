package __APP_ID__;

import android.content.Context;
import android.media.AudioManager;
import android.media.AudioPlaybackConfiguration;
import android.os.Build;
import android.os.Handler;
import android.os.SystemClock;
import java.util.List;

/**
 * Putar-ulang otomatis setelah gangguan, dijalankan SEPENUHNYA di native (padanan `_setupInterruptionListeners` +
 * `_resumePlaybackAfterInterruption` di StreamBeats). Tidak bergantung pada JavaScript/WebView dan TIDAK punya batas
 * waktu pendek: menunggu selama service hidup (batas pengaman {@link #GIVE_UP_MS}), lalu melanjutkan begitu gangguannya
 * benar-benar selesai.
 *
 * Gangguan = ExoPlayer berhenti karena kehilangan fokus audio (panggilan, app musik/video lain). Jeda dari pengguna,
 * notifikasi, atau headset dicabut BUKAN gangguan dan tidak pernah diputar ulang: {@link #end()} dipanggil untuk itu.
 *
 * Mendeteksi "app lain berhenti" lewat {@code AudioPlaybackCallback} (Android 8+; berbasis event, tanpa polling terus-
 * menerus) ditambah pengecekan berkala sebagai jaring pengaman. Sebelum memutar lagi harus sepi {@link #QUIET_MS}
 * berturut-turut, supaya tidak berebut dengan app yang baru mulai (buffering, jeda antar lagu).
 */
final class InterruptionResumer {
  /** Yang dibutuhkan dari pemilik (PlaybackService). Semua dipanggil di thread handler (main). */
  interface Host {
    /** True bila pemutar sudah berniat/sedang memutar lagi (gangguan dianggap selesai). */
    boolean isPlayWanted();

    /** Minta pemutar lanjut memutar (meminta fokus audio lagi). */
    void resumePlayback();

    /** Tahan CPU sebentar agar penundaan debounce tidak tertidur saat layar mati. */
    void holdWake(long ms);

    /** Menunggu sampai batas pengaman tanpa hasil: pemilik boleh membereskan service. */
    void gaveUp();
  }

  /** Sepi sekian ms berturut-turut sebelum memutar lagi. */
  static final long QUIET_MS = 2_000L;
  /** Bila app lain tak pernah terlihat memutar audio, putar lagi setelah ini (gangguan singkat, mis. suara navigasi). */
  static final long NO_SIGNAL_MS = 8_000L;
  /** Selang pengecekan berkala (jaring pengaman bila callback tak datang). */
  static final long POLL_MS = 3_000L;
  /** Batas pengaman: berhenti menunggu setelah ini agar notifikasi tidak menggantung selamanya. */
  static final long GIVE_UP_MS = 24L * 60L * 60L * 1000L;

  private final Context context;
  private final Handler handler;
  private final Host host;
  private final Runnable checkTask =
      new Runnable() {
        @Override
        public void run() {
          check();
        }
      };

  private boolean waiting = false;
  private long since = 0;
  private long quietSince = 0;
  private boolean sawBusy = false;
  private boolean enabled = true;
  private Object playbackCallback; // AudioManager.AudioPlaybackCallback (Android 8+)

  InterruptionResumer(Context context, Handler handler, Host host) {
    this.context = context;
    this.handler = handler;
    this.host = host;
  }

  boolean isWaiting() {
    return waiting;
  }

  /** Pengaturan pengguna "Putar otomatis setelah gangguan". Dimatikan = gangguan yang sedang ditunggu dibatalkan. */
  void setEnabled(boolean on) {
    enabled = on;
    if (!on) end();
  }

  /** Dipanggil saat pemutar berhenti karena kehilangan fokus audio. Aman dipanggil berulang. */
  void begin() {
    if (!enabled || waiting) return;
    waiting = true;
    since = SystemClock.elapsedRealtime();
    quietSince = 0;
    sawBusy = false;
    registerCallback();
    handler.removeCallbacks(checkTask);
    handler.postDelayed(checkTask, 1_000L);
  }

  /** Gangguan selesai atau dibatalkan (jeda pengguna, putar lagi, lagu baru, service berhenti). */
  void end() {
    if (!waiting) return;
    waiting = false;
    handler.removeCallbacks(checkTask);
    unregisterCallback();
  }

  private AudioManager audioManager() {
    return (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
  }

  /** True bila tidak ada audio lain yang sedang berbunyi dan tidak sedang panggilan. */
  private boolean quiet() {
    AudioManager am = audioManager();
    if (am == null) return true;
    try {
      if (am.getMode() != AudioManager.MODE_NORMAL) return false;
      if (am.isMusicActive()) return false;
      if (Build.VERSION.SDK_INT >= 26) {
        List<AudioPlaybackConfiguration> active = am.getActivePlaybackConfigurations();
        if (active != null && !active.isEmpty()) return false;
      }
      return true;
    } catch (RuntimeException e) {
      return true;
    }
  }

  private void check() {
    if (!waiting) return;
    long now = SystemClock.elapsedRealtime();
    if (host.isPlayWanted()) {
      end();
      return;
    }
    if (now - since > GIVE_UP_MS) {
      end();
      host.gaveUp();
      return;
    }
    boolean q = quiet();
    if (!q) {
      sawBusy = true;
      quietSince = 0;
    } else if (quietSince == 0) {
      quietSince = now;
    }
    boolean quietLongEnough = quietSince != 0 && now - quietSince >= QUIET_MS;
    boolean ready = q && ((sawBusy && quietLongEnough) || (!sawBusy && now - since >= NO_SIGNAL_MS));
    if (ready) {
      host.resumePlayback();
      // Tetap menunggu: play() yang diterima belum tentu berbunyi (fokus masih dipegang app lain). Selesai bila pemutar
      // melaporkan berniat memutar (isPlayWanted) atau pengguna menjeda (end).
      quietSince = now;
    } else if (q) {
      // Sudah sepi tetapi belum cukup lama: tahan CPU supaya pengecekan berikutnya jalan walau layar mati.
      host.holdWake(QUIET_MS + 2_000L);
    }
    handler.removeCallbacks(checkTask);
    handler.postDelayed(checkTask, q && !ready ? 1_000L : POLL_MS);
  }

  /* ---------------- AudioPlaybackCallback (Android 8+) ---------------- */

  private void registerCallback() {
    if (Build.VERSION.SDK_INT < 26 || playbackCallback != null) return;
    AudioManager am = audioManager();
    if (am == null) return;
    try {
      AudioManager.AudioPlaybackCallback callback =
          new AudioManager.AudioPlaybackCallback() {
            @Override
            public void onPlaybackConfigChanged(List<AudioPlaybackConfiguration> configs) {
              // App lain mulai/berhenti memutar: periksa segera (debounce dijaga oleh quietSince).
              if (!waiting) return;
              handler.removeCallbacks(checkTask);
              handler.post(checkTask);
            }
          };
      am.registerAudioPlaybackCallback(callback, handler);
      playbackCallback = callback;
    } catch (RuntimeException e) {
      playbackCallback = null;
    }
  }

  private void unregisterCallback() {
    if (playbackCallback == null) return;
    AudioManager am = audioManager();
    try {
      if (am != null) am.unregisterAudioPlaybackCallback((AudioManager.AudioPlaybackCallback) playbackCallback);
    } catch (RuntimeException e) {
      // sudah terlepas
    }
    playbackCallback = null;
  }
}
