package __APP_ID__;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Sesi pemutaran NATIVE: lagu aktif + posisinya menurut pemutar native. Saat activity dihancurkan Android (JS mati) atau
 * rantai native pindah lagu sendiri, penyimpanan JS (localStorage) tertinggal di lagu / posisi lama. JS membaca catatan
 * ini saat app dibuka lagi (`nativeSessionRead`) lalu menyamakan lagu aktif dan posisinya, dan menghapusnya
 * (`nativeSessionClear`) setelah diadopsi.
 *
 * Dua lapis: `mem` = keadaan hidup di memori (diperbarui tiap detak pemutar, tanpa I/O), `prefs` = salinan di
 * SharedPreferences yang ditulis hanya di saat penting (lagu pindah, jeda, service berhenti, tiap ~10 dtk saat native
 * memegang kendali) supaya masih ada walau proses dimatikan sistem.
 */
final class NativeSession {
  private static final String PREFS = "mv_native_session";
  private static final String KEY = "session";
  private static final Object LOCK = new Object();
  private static JSONObject mem = null;
  /** Service masih punya media dimuat (pemutar hidup): audio bisa diadopsi JS tanpa memuat ulang. */
  private static boolean live = false;

  private NativeSession() {}

  /** Memperbarui keadaan hidup di memori. Murah: dipanggil tiap detak. */
  static void update(String trackId, String title, String artist, int index, long positionMs, long durationMs, boolean playing,
      String sourceUrl, String cacheKey) {
    if (title == null || title.isEmpty()) return;
    JSONObject o = new JSONObject();
    try {
      o.put("trackId", trackId == null ? "" : trackId);
      o.put("title", title);
      o.put("artist", artist == null ? "" : artist);
      o.put("index", index);
      o.put("positionMs", Math.max(0, positionMs));
      o.put("durationMs", durationMs);
      o.put("playing", playing);
      o.put("sourceUrl", sourceUrl == null ? "" : sourceUrl);
      o.put("cacheKey", cacheKey == null ? "" : cacheKey);
      o.put("at", System.currentTimeMillis());
    } catch (JSONException e) {
      return;
    }
    synchronized (LOCK) {
      mem = o;
      live = true;
    }
  }

  /** Service berhenti / pemutar dilepas: tidak ada lagi audio yang bisa diadopsi. */
  static void markDead() {
    synchronized (LOCK) {
      live = false;
    }
  }

  /** Menulis keadaan memori ke penyimpanan. apply() asinkron, aman dari thread utama. */
  static void persist(Context context) {
    JSONObject snapshot;
    synchronized (LOCK) {
      snapshot = mem;
    }
    if (context == null || snapshot == null) return;
    try {
      prefs(context).edit().putString(KEY, snapshot.toString()).apply();
    } catch (Exception e) {
      android.util.Log.w("MusicVerse", "Sesi native gagal disimpan: " + e);
    }
  }

  /** Catatan terakhir (memori dulu, lalu penyimpanan) + apakah audionya masih hidup. null bila tidak ada. */
  static JSONObject read(Context context) {
    JSONObject out = null;
    boolean isLive;
    synchronized (LOCK) {
      isLive = live;
      if (mem != null) {
        try {
          out = new JSONObject(mem.toString());
        } catch (JSONException e) {
          out = null;
        }
      }
    }
    if (out == null && context != null) {
      try {
        String raw = prefs(context).getString(KEY, null);
        if (raw != null) out = new JSONObject(raw);
      } catch (Exception e) {
        out = null;
      }
    }
    if (out == null) return null;
    try {
      out.put("live", isLive);
    } catch (JSONException e) {
      return null;
    }
    return out;
  }

  /** JS sudah mengadopsi: hapus catatan (memori dan penyimpanan). Detak berikutnya menulis ulang bila pemutar masih hidup. */
  static void clear(Context context) {
    synchronized (LOCK) {
      mem = null;
    }
    if (context == null) return;
    try {
      prefs(context).edit().remove(KEY).apply();
    } catch (Exception e) {
      android.util.Log.w("MusicVerse", "Sesi native gagal dihapus: " + e);
    }
  }

  private static SharedPreferences prefs(Context context) {
    return context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
  }
}
