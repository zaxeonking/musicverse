package __APP_ID__;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * Menyalin lagu yang sudah diunduh ke folder publik Music/MusicVerse lewat MediaStore, sehingga muncul di pemutar musik
 * dan pengelola berkas lain (padanan opsi "Download Folder" di StreamBeats). Berkas utama tetap di folder aplikasi.
 * Android 10+ saja: di versi lama butuh izin penyimpanan, jadi dilewati.
 */
final class MediaExporter {
  private static final String SUBDIR = "MusicVerse";

  private MediaExporter() {}

  /** Mengembalikan null bila berhasil (atau sudah ada); selain itu teks alasan gagal. */
  static String export(Context context, File file, String displayName, String mime) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return "Butuh Android 10 ke atas";
    try {
      ContentResolver resolver = context.getContentResolver();
      Uri collection = MediaStore.Audio.Media.EXTERNAL_CONTENT_URI;
      String relativePath = Environment.DIRECTORY_MUSIC + "/" + SUBDIR + "/";

      // Sudah pernah diekspor: jangan buat salinan "(1)".
      try (Cursor c =
          resolver.query(
              collection,
              new String[] {MediaStore.MediaColumns._ID},
              MediaStore.MediaColumns.DISPLAY_NAME + "=? AND " + MediaStore.MediaColumns.RELATIVE_PATH + "=?",
              new String[] {displayName, relativePath},
              null)) {
        if (c != null && c.moveToFirst()) return null;
      }

      ContentValues values = new ContentValues();
      values.put(MediaStore.MediaColumns.DISPLAY_NAME, displayName);
      values.put(MediaStore.MediaColumns.MIME_TYPE, mime);
      values.put(MediaStore.MediaColumns.RELATIVE_PATH, relativePath);
      values.put(MediaStore.MediaColumns.IS_PENDING, 1);
      Uri uri = resolver.insert(collection, values);
      if (uri == null) return "MediaStore menolak berkas";
      try (InputStream in = new FileInputStream(file);
          OutputStream out = resolver.openOutputStream(uri)) {
        if (out == null) throw new IOException("tidak bisa menulis ke MediaStore");
        byte[] buf = new byte[64 * 1024];
        int n;
        while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
      } catch (IOException e) {
        resolver.delete(uri, null, null);
        return e.getMessage() == null ? "gagal menyalin" : e.getMessage();
      }
      ContentValues done = new ContentValues();
      done.put(MediaStore.MediaColumns.IS_PENDING, 0);
      resolver.update(uri, done, null, null);
      return null;
    } catch (RuntimeException e) {
      return e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
    }
  }
}
