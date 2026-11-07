package __APP_ID__;

import android.content.Context;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Daftar tambahan radio yang dicari NATIVE saat JS beku (`files/radioextras.json`). Urut sesuai indeks antrean JS yang
 * dipakai native untuk lagu-lagu itu (`index` naik berurutan mulai dari panjang antrean JS saat pencarian).
 *
 * Langkah 2b hanya MENULIS daftar ini. Langkah 2c (JS) yang membacanya saat app bangun, memasukkannya ke antrean JS lebih
 * dulu (supaya indeks dan id lagu cocok), lalu menghapusnya lewat `clear`. Sebelum 2c ada, daftar ini tidak dibaca siapa pun;
 * jumlahnya dibatasi `MAX_ENTRIES` supaya tidak membengkak.
 *
 * Satu entri = satu lagu hasil `RadioFinder` (bentuk id / url sama dengan `mapDeezerRows` di JS: `dz-<id>`).
 */
final class RadioExtras {
  private static final String FILE = "radioextras.json";
  private static final int MAX_ENTRIES = 200;
  private static final Object LOCK = new Object();
  private static final JSONArray items = new JSONArray();
  private static boolean loaded = false;
  /** Satu thread supaya tulis berkas berurutan dan tidak membebani thread utama service. */
  private static final ExecutorService IO = Executors.newSingleThreadExecutor();

  private RadioExtras() {}

  /** Menambah lagu hasil radio, indeksnya `startIndex`, `startIndex + 1`, dst. Aman dipanggil dari thread mana pun. */
  static void add(Context context, List<RadioFinder.Track> tracks, int startIndex) {
    if (context == null || tracks == null || tracks.isEmpty() || startIndex < 0) return;
    synchronized (LOCK) {
      load(context);
      int index = startIndex;
      for (RadioFinder.Track t : tracks) {
        try {
          JSONObject o = new JSONObject();
          o.put("index", index);
          o.put("id", t.id);
          o.put("url", t.url == null ? "" : t.url);
          o.put("title", t.title);
          o.put("artists", t.artists == null ? "" : t.artists);
          o.put("album", t.album == null ? "" : t.album);
          o.put("cover", t.cover == null ? "" : t.cover);
          o.put("durationSec", t.durationSec);
          items.put(o);
        } catch (JSONException e) {
          continue; // butir rusak dilewati; indeks tetap naik supaya sama dengan yang dipakai antrean native
        } finally {
          index++;
        }
      }
      while (items.length() > MAX_ENTRIES) items.remove(0);
      persist(context);
    }
  }

  /** Semua tambahan yang belum diambil JS (urut lama ke baru). Dipakai langkah 2c. */
  static JSONArray read(Context context) {
    synchronized (LOCK) {
      load(context);
      JSONArray copy = new JSONArray();
      for (int i = 0; i < items.length(); i++) copy.put(items.opt(i));
      return copy;
    }
  }

  /** Mengosongkan daftar (JS sudah memasukkannya ke antrean). Dipakai langkah 2c. */
  static void clear(Context context) {
    synchronized (LOCK) {
      load(context);
      if (items.length() == 0) return;
      while (items.length() > 0) items.remove(0);
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
        if (o != null) items.put(o);
      }
    } catch (Exception e) {
      android.util.Log.w("MusicVerse", "Daftar tambahan radio rusak, dimulai kosong: " + e);
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
            if (!tmp.renameTo(new File(dir, FILE))) android.util.Log.w("MusicVerse", "Daftar tambahan radio gagal disimpan (rename)");
          } catch (Exception e) {
            android.util.Log.w("MusicVerse", "Daftar tambahan radio gagal disimpan: " + e);
          }
        });
  }
}
