package __APP_ID__;

import android.content.Context;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;

/**
 * Satu MediaSession untuk seluruh proses. Dulu sesi dibuat dan dilepas oleh PlaybackService; sekarang dipegang di sini
 * karena Android Auto menyambung ke AutoBrowserService (dan mengambil token sesinya) SEBELUM ada pemutaran, saat
 * PlaybackService belum hidup. Kedua service memakai sesi yang sama sehingga kartu "sedang diputar" di mobil, notifikasi,
 * dan layar kunci tetap satu.
 *
 * Saat PlaybackService hidup ia memasang callback-nya sendiri (attach) dan mengatur seluruh PlaybackState. Saat berhenti
 * (detach) sesi kembali ke keadaan siap dengan callback bawaan (BaseCallback) yang meneruskan permintaan Android Auto ke JS.
 */
final class MediaSessionHolder {
  private static MediaSession session;
  /** True selama Android Auto (atau klien MediaBrowser lain) tersambung ke AutoBrowserService. */
  private static boolean browserBound = false;

  /** Aksi yang ditawarkan saat tidak ada pemutaran: Auto membutuhkannya untuk tombol putar dan pencarian suara. */
  static final long IDLE_ACTIONS = PlaybackState.ACTION_PLAY
      | PlaybackState.ACTION_PLAY_FROM_MEDIA_ID
      | PlaybackState.ACTION_PLAY_FROM_SEARCH;

  private MediaSessionHolder() {}

  /** Callback dasar: hanya permintaan yang bisa datang saat PlaybackService TIDAK berjalan. */
  static class BaseCallback extends MediaSession.Callback {
    protected final Context app;

    BaseCallback(Context context) {
      this.app = context.getApplicationContext();
    }

    @Override public void onPlay() {
      // Tidak ada service/lagu di mesin: minta JS (atau buka aplikasi) melanjutkan dari Riwayat.
      AutoBridge.request(app, "search", "");
    }

    @Override public void onPlayFromMediaId(String mediaId, Bundle extras) {
      AutoBridge.request(app, "media", mediaId == null ? "" : mediaId);
    }

    @Override public void onPlayFromSearch(String query, Bundle extras) {
      AutoBridge.request(app, "search", query == null ? "" : query);
    }
  }

  static synchronized MediaSession get(Context context) {
    if (session == null) {
      Context app = context.getApplicationContext();
      session = new MediaSession(app, "MusicVerse");
      session.setCallback(new BaseCallback(app), new Handler(Looper.getMainLooper()));
      applyIdleState();
    }
    return session;
  }

  /** PlaybackService hidup: pasang callback-nya dan aktifkan sesi. */
  static synchronized MediaSession attach(Context context, MediaSession.Callback callback) {
    MediaSession s = get(context);
    s.setCallback(callback, new Handler(Looper.getMainLooper()));
    s.setActive(true);
    return s;
  }

  /** PlaybackService berhenti: kosongkan metadata, kembali ke callback bawaan, aktif hanya bila Auto masih tersambung. */
  static synchronized void detach(Context context) {
    if (session == null) return;
    session.setCallback(new BaseCallback(context), new Handler(Looper.getMainLooper()));
    session.setMetadata(null);
    applyIdleState();
    session.setActive(browserBound);
  }

  /** Dipanggil AutoBrowserService saat dibuat / dihancurkan. */
  static synchronized void setBrowserBound(Context context, boolean bound) {
    browserBound = bound;
    if (bound) {
      get(context).setActive(true);
    } else if (session != null && !PlaybackService.isRunning()) {
      session.setActive(false);
    }
  }

  /** Keadaan siap. Tidak menyentuh sesi bila PlaybackService sedang mengaturnya. */
  static synchronized void setIdle() {
    if (session == null || PlaybackService.isRunning()) return;
    applyIdleState();
  }

  /** Pesan galat yang ditampilkan Android Auto (mis. aplikasi belum bisa dibuka dari mobil). */
  @SuppressWarnings("deprecation")
  static synchronized void setError(Context context, String message) {
    if (PlaybackService.isRunning()) return;
    MediaSession s = get(context);
    s.setPlaybackState(new PlaybackState.Builder()
        .setActions(IDLE_ACTIONS)
        .setState(PlaybackState.STATE_ERROR, 0, 0f)
        .setErrorMessage(message)
        .build());
  }

  private static void applyIdleState() {
    session.setPlaybackState(new PlaybackState.Builder()
        .setActions(IDLE_ACTIONS)
        .setState(PlaybackState.STATE_NONE, 0, 0f)
        .build());
  }
}
