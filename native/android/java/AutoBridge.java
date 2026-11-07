package __APP_ID__;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;

/**
 * Penghubung Android Auto <-> JavaScript.
 *
 *  - Daftar telusur (Baru diputar, Antrean) DITULIS JS lewat `setAutoBrowse` dan disimpan di SharedPreferences, jadi
 *    Android Auto bisa menelusurinya walau WebView belum hidup (mis. mobil tersambung saat aplikasi belum dibuka).
 *  - Permintaan putar (ketuk lagu / pencarian suara) HARUS dikerjakan JS karena hanya JS yang bisa mencari sumber audio.
 *    Permintaan disimpan sebagai `pending` sampai JS mengambilnya (`consumeAutoRequest`). Bila WebView hidup, JS juga
 *    diberi tahu lewat event `autoRequest`. Bila tidak ada yang mengambil dalam LAUNCH_AFTER_MS, aplikasi dicoba dibuka;
 *    bila masih tidak diambil sampai GIVE_UP_AFTER_MS, Android Auto menampilkan pesan galat.
 */
final class AutoBridge {
  interface Listener {
    void onRequest(String kind, String payload);
  }

  private static final String PREFS = "musicverse_auto";
  private static final String KEY_BROWSE = "browse";
  private static final long LAUNCH_AFTER_MS = 1_200L;
  private static final long GIVE_UP_AFTER_MS = 7_000L;
  static final String BUSY_MESSAGE = "Buka MusicVerse di ponsel, lalu coba lagi.";

  private static final Handler main = new Handler(Looper.getMainLooper());
  private static final Object lock = new Object();
  private static volatile Listener listener;
  /** {kind, payload}; kind = "media" (payload = id item telusur) atau "search" (payload = kata kunci, boleh kosong). */
  private static String[] pending;
  private static Context appContext;

  private AutoBridge() {}

  static void setListener(Listener value) {
    listener = value;
  }

  static void request(Context context, String kind, String payload) {
    appContext = context.getApplicationContext();
    synchronized (lock) {
      pending = new String[] {kind, payload == null ? "" : payload};
    }
    main.removeCallbacks(launchRunnable);
    main.removeCallbacks(giveUpRunnable);
    main.postDelayed(launchRunnable, LAUNCH_AFTER_MS);
    main.postDelayed(giveUpRunnable, GIVE_UP_AFTER_MS);
    Listener l = listener;
    if (l != null) l.onRequest(kind, payload == null ? "" : payload);
  }

  /** Mengambil permintaan yang menunggu (sekali pakai). Null = tidak ada. */
  static String[] consume() {
    String[] taken;
    synchronized (lock) {
      taken = pending;
      pending = null;
    }
    if (taken != null) {
      main.removeCallbacks(launchRunnable);
      main.removeCallbacks(giveUpRunnable);
      // Hapus pesan galat bila sempat tampil; saat memutar, PlaybackService mengambil alih keadaan sesi.
      main.post(MediaSessionHolder::setIdle);
    }
    return taken;
  }

  private static boolean hasPending() {
    synchronized (lock) {
      return pending != null;
    }
  }

  private static final Runnable launchRunnable = new Runnable() {
    @Override public void run() {
      Context ctx = appContext;
      if (ctx == null || !hasPending()) return;
      try {
        Intent open = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
        if (open != null) {
          open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
          ctx.startActivity(open); // sering ditolak sistem saat di latar belakang; galat ditangani di giveUpRunnable
        }
      } catch (RuntimeException ignored) {
        // dibatasi sistem
      }
    }
  };

  private static final Runnable giveUpRunnable = new Runnable() {
    @Override public void run() {
      Context ctx = appContext;
      if (ctx == null) return;
      synchronized (lock) {
        if (pending == null) return;
        pending = null;
      }
      MediaSessionHolder.setError(ctx, BUSY_MESSAGE);
    }
  };

  // ---- Daftar telusur ----

  /** JSON dari JS: {"recent":[{id,title,artist}], "queue":[{id,title,artist}]}. Diterima apa adanya, dibaca AutoBrowserService. */
  static void setBrowse(Context context, String json) {
    SharedPreferences prefs = context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    prefs.edit().putString(KEY_BROWSE, json == null ? "" : json).apply();
    main.post(AutoBrowserService::refresh);
  }

  static String readBrowse(Context context) {
    return context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_BROWSE, "");
  }
}
