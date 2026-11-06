package __APP_ID__;

import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.Context;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.MediaMetadataRetriever;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import android.util.Size;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Memindai SEMUA audio di HP lewat MediaStore (folder "Lokal" di tab Unduhan), kecuali yang milik MusicVerse sendiri
 * supaya tidak tercampur dengan unduhan: salinan di Music/MusicVerse, berkas di Android/data/<paket>, dan apa pun yang
 * pemiliknya aplikasi ini. Nada dering / notifikasi / alarm tidak dihitung sebagai musik. Hanya MEMBACA: tidak ada
 * berkas yang diubah atau dihapus.
 */
final class LocalAudioScanner {
  /** Folder ekspor MediaExporter (Music/MusicVerse/). Dijaga sama dengan MediaExporter.SUBDIR. */
  private static final String EXPORT_DIR = "music/musicverse/";
  private static final String COVER_DIR = "localcovers";

  private LocalAudioScanner() {}

  static boolean isOwnFile(String relativePath, String data, String owner, String pkg) {
    String own = pkg.toLowerCase(Locale.ROOT);
    if (owner != null && owner.equalsIgnoreCase(pkg)) return true;
    if (relativePath != null) {
      String r = relativePath.toLowerCase(Locale.ROOT).replace('\\', '/');
      if (r.startsWith(EXPORT_DIR) || r.contains("android/data/" + own + "/")) return true;
    }
    if (data != null) {
      String d = data.toLowerCase(Locale.ROOT).replace('\\', '/');
      if (d.contains("/" + EXPORT_DIR) || d.contains("/android/data/" + own + "/")) return true;
    }
    return false;
  }

  private static String str(Cursor c, int index) {
    return index < 0 || c.isNull(index) ? "" : c.getString(index);
  }

  /** Daftar lagu: {id, title, artist, album, durationMs, size, addedAt}. Urutan bebas (JS yang mengurutkan). */
  static JSONArray scan(Context context) throws JSONException {
    ContentResolver resolver = context.getContentResolver();
    String pkg = context.getPackageName();
    Uri collection = MediaStore.Audio.Media.EXTERNAL_CONTENT_URI;
    boolean q = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q;
    String[] projection =
        q
            ? new String[] {
              MediaStore.Audio.Media._ID,
              MediaStore.Audio.Media.TITLE,
              MediaStore.Audio.Media.ARTIST,
              MediaStore.Audio.Media.ALBUM,
              MediaStore.Audio.Media.DURATION,
              MediaStore.Audio.Media.SIZE,
              MediaStore.Audio.Media.DATE_ADDED,
              MediaStore.Audio.Media.DISPLAY_NAME,
              MediaStore.Audio.Media.RELATIVE_PATH,
              MediaStore.Audio.Media.OWNER_PACKAGE_NAME
            }
            : new String[] {
              MediaStore.Audio.Media._ID,
              MediaStore.Audio.Media.TITLE,
              MediaStore.Audio.Media.ARTIST,
              MediaStore.Audio.Media.ALBUM,
              MediaStore.Audio.Media.DURATION,
              MediaStore.Audio.Media.SIZE,
              MediaStore.Audio.Media.DATE_ADDED,
              MediaStore.Audio.Media.DISPLAY_NAME,
              MediaStore.Audio.Media.DATA
            };
    String selection =
        MediaStore.Audio.Media.DURATION + ">0 AND " + MediaStore.Audio.Media.SIZE + ">0 AND "
            + MediaStore.Audio.Media.IS_RINGTONE + "=0 AND " + MediaStore.Audio.Media.IS_NOTIFICATION + "=0 AND "
            + MediaStore.Audio.Media.IS_ALARM + "=0";
    JSONArray out = new JSONArray();
    try (Cursor c = resolver.query(collection, projection, selection, null, null)) {
      if (c == null) return out;
      int iId = c.getColumnIndexOrThrow(MediaStore.Audio.Media._ID);
      int iTitle = c.getColumnIndexOrThrow(MediaStore.Audio.Media.TITLE);
      int iArtist = c.getColumnIndexOrThrow(MediaStore.Audio.Media.ARTIST);
      int iAlbum = c.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM);
      int iDur = c.getColumnIndexOrThrow(MediaStore.Audio.Media.DURATION);
      int iSize = c.getColumnIndexOrThrow(MediaStore.Audio.Media.SIZE);
      int iAdded = c.getColumnIndexOrThrow(MediaStore.Audio.Media.DATE_ADDED);
      int iName = c.getColumnIndexOrThrow(MediaStore.Audio.Media.DISPLAY_NAME);
      int iRel = q ? c.getColumnIndex(MediaStore.Audio.Media.RELATIVE_PATH) : -1;
      int iOwner = q ? c.getColumnIndex(MediaStore.Audio.Media.OWNER_PACKAGE_NAME) : -1;
      int iData = q ? -1 : c.getColumnIndex(MediaStore.Audio.Media.DATA);
      while (c.moveToNext()) {
        String rel = iRel >= 0 ? str(c, iRel) : null;
        String data = iData >= 0 ? str(c, iData) : null;
        String owner = iOwner >= 0 ? str(c, iOwner) : null;
        if (isOwnFile(rel, data, owner, pkg)) continue;
        String title = str(c, iTitle);
        String name = str(c, iName);
        if (title.isEmpty() || "<unknown>".equals(title)) {
          int dot = name.lastIndexOf('.');
          title = dot > 0 ? name.substring(0, dot) : name;
        }
        String artist = str(c, iArtist);
        if ("<unknown>".equals(artist)) artist = "";
        String album = str(c, iAlbum);
        JSONObject o = new JSONObject();
        o.put("id", String.valueOf(c.getLong(iId)));
        o.put("title", title);
        o.put("artist", artist);
        o.put("album", album);
        o.put("durationMs", c.getLong(iDur));
        o.put("size", c.getLong(iSize));
        o.put("addedAt", c.getLong(iAdded) * 1000L);
        out.put(o);
      }
    }
    return out;
  }

  /**
   * Menyimpan sampul lagu ke cache/localcovers/<id>.jpg (dibaca WebView lewat Directory.Cache). True bila sampulnya ada.
   * Android 10+: thumbnail MediaStore (termasuk cover.jpg di folder album); lebih lama: gambar yang disematkan di tag.
   */
  static boolean cover(Context context, long id) {
    File dir = new File(context.getCacheDir(), COVER_DIR);
    File file = new File(dir, id + ".jpg");
    if (file.isFile() && file.length() > 0) return true;
    if (!dir.isDirectory() && !dir.mkdirs()) return false;
    Uri uri = ContentUris.withAppendedId(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, id);
    Bitmap bitmap = null;
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        bitmap = context.getContentResolver().loadThumbnail(uri, new Size(512, 512), null);
      } else {
        MediaMetadataRetriever r = new MediaMetadataRetriever();
        try {
          r.setDataSource(context, uri);
          byte[] art = r.getEmbeddedPicture();
          if (art != null) {
            BitmapFactory.Options bounds = new BitmapFactory.Options();
            bounds.inJustDecodeBounds = true;
            BitmapFactory.decodeByteArray(art, 0, art.length, bounds);
            BitmapFactory.Options opts = new BitmapFactory.Options();
            int side = Math.max(bounds.outWidth, bounds.outHeight);
            while (side / (opts.inSampleSize + 1) >= 1024) opts.inSampleSize++;
            bitmap = BitmapFactory.decodeByteArray(art, 0, art.length, opts);
          }
        } finally {
          try {
            r.release();
          } catch (Exception ignored) {
            // abaikan
          }
        }
      }
    } catch (IOException | RuntimeException e) {
      return false; // tidak punya sampul / berkas tidak terbaca
    }
    if (bitmap == null) return false;
    File tmp = new File(dir, id + ".tmp");
    try (FileOutputStream out = new FileOutputStream(tmp)) {
      if (!bitmap.compress(Bitmap.CompressFormat.JPEG, 85, out)) return false;
    } catch (IOException e) {
      tmp.delete();
      return false;
    } finally {
      bitmap.recycle();
    }
    if (!tmp.renameTo(file)) {
      tmp.delete();
      return false;
    }
    return true;
  }
}
