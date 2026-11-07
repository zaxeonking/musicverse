package __APP_ID__;

import android.content.Context;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Jurnal pemutaran NATIVE. Saat rantai native memutar lagu sendiri (JS beku atau activity sudah dihancurkan), JS tidak
 * pernah melihat lagu itu mulai sehingga Riwayat / "Baru diputar" bolong. Setiap lagu yang dimulai native dicatat di sini
 * (`files/playjournal.json`); JS membacanya saat app dibuka / kembali ke depan, memasukkannya ke Riwayat, lalu menghapus
 * yang sudah diambil lewat `clearThrough`.
 *
 * JS yang masih hidup mencatat pemutaran itu sendiri juga; pencocokan ganda (id lagu + waktu berdekatan) diselesaikan di
 * sisi JS, jadi jurnal ini boleh mencatat berlebih tetapi tidak boleh kehilangan.
 *
 * Hanya lagu yang diserahkan JS lengkap dengan id lagunya yang dicatat (butir tanpa id tidak bisa dijadikan entri Riwayat).
 */
final class PlayJournal {
  private static final String FILE = "playjournal.json";
  private static final int MAX_ENTRIES = 300;
  private static final Object LOCK = new Object();
  private static final JSONArray items = new JSONArray();
  private static boolean loaded = false;
  private static long lastSeq = 0;
  /** Satu thread supaya tulis berkas berurutan dan tidak membebani thread utama service. */
  private static final ExecutorService IO = Executors.newSingleThreadExecutor();

  private PlayJournal() {}

  /** Mencatat satu lagu yang baru dimulai native. Aman dipanggil dari thread mana pun. */
  static void add(Context context, String trackId, String trackUrl, String title, String artist, String album, String cover, long durationMs) {
    if (context == null || trackId == null || trackId.isEmpty() || title == null || title.isEmpty()) return;
    synchronized (LOCK) {
      load(context);
      long now = System.currentTimeMillis();
      // `at` dipakai sebagai nomor urut juga: dibuat naik terus walau jam sistem berubah / dua lagu di milidetik yang sama.
      long seq = Math.max(now, lastSeq + 1);
      lastSeq = seq;
      try {
        JSONObject o = new JSONObject();
        o.put("at", seq);
        o.put("id", trackId);
        o.put("url", trackUrl == null ? "" : trackUrl);
        o.put("title", title);
        o.put("artist", artist == null ? "" : artist);
        o.put("album", album == null ? "" : album);
        o.put("cover", cover == null ? "" : cover);
        o.put("durationMs", durationMs);
        items.put(o);
      } catch (JSONException e) {
        return;
      }
      while (items.length() > MAX_ENTRIES) items.remove(0);
      persist(context);
    }
  }

  /** Semua entri yang belum diakui JS (urut lama ke baru). */
  static JSONArray read(Context context) {
    synchronized (LOCK) {
      load(context);
      JSONArray copy = new JSONArray();
      for (int i = 0; i < items.length(); i++) copy.put(items.opt(i));
      return copy;
    }
  }

  /** Menghapus entri dengan `at` <= through (yang sudah dimasukkan JS ke Riwayat). */
  static void clearThrough(Context context, long through) {
    synchronized (LOCK) {
      load(context);
      JSONArray keep = new JSONArray();
      for (int i = 0; i < items.length(); i++) {
        JSONObject o = items.optJSONObject(i);
        if (o != null && o.optLong("at", 0) > through) keep.put(o);
      }
      if (keep.length() == items.length()) return;
      while (items.length() > 0) items.remove(0);
      for (int i = 0; i < keep.length(); i++) items.put(keep.opt(i));
      persist(context);
    }
  }

  private static void load(Context context) {
    if (loaded) return;
    loaded = true;
    File f = new File(context.getApplicationContext().getFilesDir(), FILE);
    if (!f.isFile()) return;
    try {
      JSONArray arr = new JSONArray(new String(AudioFinalizer.readAll(f), StandardCharsets.UTF_8));
      for (int i = 0; i < arr.length(); i++) {
        JSONObject o = arr.optJSONObject(i);
        if (o == null) continue;
        items.put(o);
        lastSeq = Math.max(lastSeq, o.optLong("at", 0));
      }
    } catch (Exception e) {
      android.util.Log.w("MusicVerse", "Jurnal putar rusak, dimulai kosong: " + e);
      while (items.length() > 0) items.remove(0);
    }
  }

  /** Dipanggil di dalam LOCK: ambil salinan isi sekarang, tulis di thread IO (urutan tulis = urutan panggil). */
  private static void persist(Context context) {
    final File dir = context.getApplicationContext().getFilesDir();
    final String snapshot = items.toString();
    IO.execute(
        () -> {
          try {
            File tmp = new File(dir, FILE + ".tmp");
            java.io.FileOutputStream out = new java.io.FileOutputStream(tmp);
            try {
              out.write(snapshot.getBytes(StandardCharsets.UTF_8));
              out.getFD().sync();
            } finally {
              out.close();
            }
            if (!tmp.renameTo(new File(dir, FILE))) android.util.Log.w("MusicVerse", "Jurnal putar gagal disimpan (rename)");
          } catch (Exception e) {
            android.util.Log.w("MusicVerse", "Jurnal putar gagal disimpan: " + e);
          }
        });
  }
}
