package __APP_ID__;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.PorterDuff;
import android.graphics.PorterDuffXfermode;
import android.graphics.Rect;
import android.graphics.RectF;
import android.os.Build;
import android.view.View;
import android.widget.RemoteViews;

/**
 * Widget layar utama: sampul, judul, artis, dan tombol Sebelumnya / Putar-Jeda / Berikutnya.
 *
 * Keadaan didorong oleh PlaybackService (push / pushIdle) setiap kali lagu atau status berubah, bukan lewat polling,
 * jadi updatePeriodMillis = 0. Tombol memakai broadcast ke kelas ini, lalu diteruskan ke PlaybackService.dispatch()
 * (satu proses, tanpa Intent service) sehingga tidak kena batasan memulai service dari latar belakang.
 *
 * Saat tidak ada service yang berjalan (belum diputar, atau proses dimatikan sistem) widget tampil "siap" dan seluruh
 * tombolnya membuka aplikasi.
 */
public class MusicVerseWidget extends AppWidgetProvider {
  static final String ACTION_PREVIOUS = "__APP_ID__.widget.PREVIOUS";
  static final String ACTION_TOGGLE = "__APP_ID__.widget.TOGGLE";
  static final String ACTION_NEXT = "__APP_ID__.widget.NEXT";

  /** Sisi sampul di widget (px). Kecil sengaja: RemoteViews punya batas memori bitmap. */
  private static final int COVER_PX = 192;

  private static final class Model {
    final String title;
    final String artist;
    final boolean playing;
    final boolean loading;
    final boolean hasNext;
    final boolean hasPrevious;
    final Bitmap cover;

    Model(String title, String artist, boolean playing, boolean loading, boolean hasNext, boolean hasPrevious, Bitmap cover) {
      this.title = title == null ? "" : title;
      this.artist = artist == null ? "" : artist;
      this.playing = playing;
      this.loading = loading;
      this.hasNext = hasNext;
      this.hasPrevious = hasPrevious;
      this.cover = cover;
    }
  }

  /** Keadaan terakhir yang didorong service; null = siap (tidak ada pemutaran). Hanya diakses dari thread utama. */
  private static Model last;
  private static Bitmap coverSrc;
  private static Bitmap coverOut;

  /** Dipanggil PlaybackService (thread utama). `cover` null = sampul bawaan. */
  static void push(Context context, String title, String artist, boolean playing, boolean loading, boolean hasNext, boolean hasPrevious, Bitmap cover) {
    last = new Model(title, artist, playing, loading, hasNext, hasPrevious, cover);
    render(context, last);
  }

  /** Service berhenti: kembali ke keadaan siap. */
  static void pushIdle(Context context) {
    last = null;
    coverSrc = null;
    coverOut = null;
    render(context, null);
  }

  private static void render(Context context, Model model) {
    Context app = context.getApplicationContext();
    AppWidgetManager manager = AppWidgetManager.getInstance(app);
    int[] ids = manager.getAppWidgetIds(new ComponentName(app, MusicVerseWidget.class));
    if (ids == null || ids.length == 0) return; // tidak ada widget di layar: tidak perlu kerja apa pun
    try {
      manager.updateAppWidget(ids, build(app, model));
    } catch (RuntimeException e) {
      // Mis. bitmap melebihi batas RemoteViews: coba lagi tanpa sampul supaya tombol tetap hidup.
      android.util.Log.w("MusicVerse", "Widget gagal digambar: " + e);
      if (model != null && model.cover != null) {
        try {
          manager.updateAppWidget(ids, build(app, new Model(model.title, model.artist, model.playing, model.loading, model.hasNext, model.hasPrevious, null)));
        } catch (RuntimeException ignored) {
          // biarkan tampilan lama
        }
      }
    }
  }

  private static RemoteViews build(Context app, Model model) {
    RemoteViews views = new RemoteViews(app.getPackageName(), R.layout.widget_player);
    boolean live = model != null;

    views.setTextViewText(R.id.widget_title, live && !model.title.isEmpty() ? model.title : "MusicVerse");
    if (!live) views.setTextViewText(R.id.widget_artist, "Ketuk untuk membuka");
    else if (model.loading) views.setTextViewText(R.id.widget_artist, model.artist.isEmpty() ? "Memuat lagu…" : "Memuat lagu… · " + model.artist);
    else views.setTextViewText(R.id.widget_artist, model.artist);
    // Bilah berjalan di bawah teks selama memuat, supaya terlihat jelas widget sedang bekerja (bukan macet).
    views.setViewVisibility(R.id.widget_loading, live && model.loading ? View.VISIBLE : View.GONE);

    if (live && model.cover != null) views.setImageViewBitmap(R.id.widget_cover, roundedCover(model.cover));
    else views.setImageViewResource(R.id.widget_cover, R.drawable.notif_default_cover);

    views.setImageViewResource(R.id.widget_play, live && model.playing ? R.drawable.ic_media_pause : R.drawable.ic_media_play);

    PendingIntent open = openApp(app);
    views.setOnClickPendingIntent(R.id.widget_root, open);
    views.setOnClickPendingIntent(R.id.widget_cover, open);
    views.setOnClickPendingIntent(R.id.widget_text, open);

    if (live) {
      views.setOnClickPendingIntent(R.id.widget_prev, command(app, ACTION_PREVIOUS, 21));
      views.setOnClickPendingIntent(R.id.widget_play, command(app, ACTION_TOGGLE, 22));
      views.setOnClickPendingIntent(R.id.widget_next, command(app, ACTION_NEXT, 23));
    } else {
      // Tidak ada service: broadcast tidak bisa melakukan apa-apa, jadi semua tombol membuka aplikasi.
      views.setOnClickPendingIntent(R.id.widget_prev, open);
      // Putar: buka aplikasi (di latar belakang bila bisa) lalu ambil tautan audio baru dan lanjut dari posisi terakhir.
      PendingIntent playAndOpen = openAndPlay(app);
      views.setOnClickPendingIntent(R.id.widget_play, playAndOpen != null ? playAndOpen : open);
      views.setOnClickPendingIntent(R.id.widget_next, open);
    }
    views.setViewVisibility(R.id.widget_prev, live ? View.VISIBLE : View.INVISIBLE);
    views.setViewVisibility(R.id.widget_next, live ? View.VISIBLE : View.INVISIBLE);
    setEnabled(views, R.id.widget_prev, live && model.hasPrevious);
    setEnabled(views, R.id.widget_next, live && model.hasNext);
    return views;
  }

  private static void setEnabled(RemoteViews views, int viewId, boolean enabled) {
    views.setBoolean(viewId, "setEnabled", enabled);
    views.setInt(viewId, "setImageAlpha", enabled ? 255 : 90);
  }

  private static int immutableFlag() {
    return Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0;
  }

  private static PendingIntent command(Context app, String action, int requestCode) {
    Intent intent = new Intent(app, MusicVerseWidget.class).setAction(action);
    return PendingIntent.getBroadcast(app, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT | immutableFlag());
  }

  private static PendingIntent openApp(Context app) {
    Intent open = app.getPackageManager().getLaunchIntentForPackage(app.getPackageName());
    if (open == null) return null;
    open.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    return PendingIntent.getActivity(app, 20, open, PendingIntent.FLAG_UPDATE_CURRENT | immutableFlag());
  }

  /** Ekstra pada intent pembuka: MainActivity meneruskannya ke JS sebagai permintaan "lanjut memutar". */
  static final String EXTRA_PLAY = "__APP_ID__.extra.WIDGET_PLAY";

  /**
   * Buka aplikasi sambil meminta lanjut memutar. Sengaja PendingIntent aktivitas (bukan broadcast lalu startActivity):
   * ketukan langsung pada widget boleh membuka aplikasi dari latar belakang, sedangkan startActivity dari receiver
   * ditolak sistem di Android 10+.
   */
  private static PendingIntent openAndPlay(Context app) {
    Intent open = app.getPackageManager().getLaunchIntentForPackage(app.getPackageName());
    if (open == null) return null;
    open.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    open.putExtra(EXTRA_PLAY, true);
    return PendingIntent.getActivity(app, 24, open, PendingIntent.FLAG_UPDATE_CURRENT | immutableFlag());
  }

  /** Sampul dipotong persegi dari tengah, sudut dibulatkan, dan diperkecil. Hasil disimpan selama sampulnya sama. */
  private static Bitmap roundedCover(Bitmap src) {
    if (src == coverSrc && coverOut != null) return coverOut;
    Bitmap out = Bitmap.createBitmap(COVER_PX, COVER_PX, Bitmap.Config.ARGB_8888);
    Canvas canvas = new Canvas(out);
    Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.FILTER_BITMAP_FLAG);
    int w = src.getWidth();
    int h = src.getHeight();
    int side = Math.min(w, h);
    Rect from = new Rect((w - side) / 2, (h - side) / 2, (w + side) / 2, (h + side) / 2);
    RectF to = new RectF(0, 0, COVER_PX, COVER_PX);
    canvas.drawRoundRect(to, COVER_PX * 0.14f, COVER_PX * 0.14f, paint);
    paint.setXfermode(new PorterDuffXfermode(PorterDuff.Mode.SRC_IN));
    canvas.drawBitmap(src, from, to, paint);
    coverSrc = src;
    coverOut = out;
    return out;
  }

  @Override
  public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
    // Widget baru ditambahkan / perangkat baru menyala: gambar dari keadaan terakhir (atau siap).
    try {
      manager.updateAppWidget(appWidgetIds, build(context.getApplicationContext(), last));
    } catch (RuntimeException e) {
      android.util.Log.w("MusicVerse", "Widget gagal digambar: " + e);
    }
    // Service sedang berjalan tetapi belum ada keadaan tersimpan: minta service mendorong ulang.
    if (last == null) PlaybackService.refreshWidget();
  }

  @Override
  public void onReceive(Context context, Intent intent) {
    super.onReceive(context, intent);
    String action = intent == null ? null : intent.getAction();
    if (action == null) return;
    String command;
    if (ACTION_PREVIOUS.equals(action)) command = "previous";
    else if (ACTION_TOGGLE.equals(action)) command = "toggle";
    else if (ACTION_NEXT.equals(action)) command = "next";
    else return;
    if (PlaybackService.dispatch(command)) return;
    // Tidak ada service (proses sudah dimatikan sistem): widget usang. Kembalikan ke "siap" supaya ketukan berikutnya
    // membuka aplikasi, dan coba buka sekarang (bisa ditolak sistem bila aplikasi di latar belakang).
    pushIdle(context);
    try {
      Intent open = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
      if (open != null) {
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        if (ACTION_TOGGLE.equals(action)) open.putExtra(EXTRA_PLAY, true);
        context.startActivity(open);
      }
    } catch (RuntimeException ignored) {
      // dibatasi sistem
    }
  }
}
