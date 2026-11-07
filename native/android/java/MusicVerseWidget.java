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
import android.content.res.ColorStateList;
import android.graphics.Rect;
import android.graphics.RectF;
import android.os.Build;
import android.util.TypedValue;
import android.view.View;
import android.widget.RemoteViews;

/**
 * Widget layar utama. Ada 6 bentuk (lihat {@link Form}): Standar 4x1, Kotak 2x2, Tinggi 2x3, Besar 4x2, Strip 4x1 tipis,
 * Mini 1x1. Tiap bentuk punya receiver sendiri (subkelas kelas ini) dan tiap widget yang dipasang punya pengaturan sendiri
 * (MusicVerseWidgetConfig, diatur di MusicVerseWidgetConfigActivity): tema, warna aksen, bentuk sampul, sudut, ukuran teks, dll.
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

  /** Bentuk widget. Tiap bentuk = satu layout + satu receiver; bendera menandai view mana yang ada di layoutnya. */
  enum Form {
    //        layout                  receiver                    nama       teks   prev   loading  coverPx titleSp artistSp  pratinjau (dp)
    STANDARD(R.layout.widget_player, MusicVerseWidget.class, "Standar 4×1", true, true, true, 192, 14, 12, 300, 72),
    SQUARE(R.layout.widget_square, MusicVerseWidgetSquare.class, "Kotak 2×2", true, true, true, 192, 13, 11, 160, 150),
    TALL(R.layout.widget_tall, MusicVerseWidgetTall.class, "Tinggi 2×3", true, true, true, 320, 14, 12, 160, 250),
    LARGE(R.layout.widget_large, MusicVerseWidgetLarge.class, "Besar 4×2", true, true, true, 320, 16, 13, 300, 150),
    STRIP(R.layout.widget_strip, MusicVerseWidgetStrip.class, "Strip 4×1", true, true, false, 96, 12, 10, 300, 44),
    TINY(R.layout.widget_tiny, MusicVerseWidgetTiny.class, "Mini 1×1", false, false, false, 192, 0, 0, 72, 72);

    final int layout;
    final Class<?> receiver;
    final String label;
    /** Ada judul/artis (widget_title / widget_artist / widget_text). */
    final boolean text;
    /** Ada tombol Sebelumnya dan Berikutnya. */
    final boolean controls;
    /** Ada bilah "memuat". */
    final boolean loading;
    final int coverPx;
    final int titleSp;
    final int artistSp;
    final int previewW;
    final int previewH;

    Form(int layout, Class<?> receiver, String label, boolean text, boolean controls, boolean loading, int coverPx, int titleSp,
        int artistSp, int previewW, int previewH) {
      this.layout = layout;
      this.receiver = receiver;
      this.label = label;
      this.text = text;
      this.controls = controls;
      this.loading = loading;
      this.coverPx = coverPx;
      this.titleSp = titleSp;
      this.artistSp = artistSp;
      this.previewW = previewW;
      this.previewH = previewH;
    }
  }

  /** Bentuk yang dipakai receiver ini. Subkelas menimpa. */
  Form form() {
    return Form.STANDARD;
  }

  static final class Model {
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

  /** Dipanggil PlaybackService (thread utama). `cover` null = sampul bawaan. */
  static void push(Context context, String title, String artist, boolean playing, boolean loading, boolean hasNext, boolean hasPrevious, Bitmap cover) {
    last = new Model(title, artist, playing, loading, hasNext, hasPrevious, cover);
    render(context, last);
  }

  /** Service berhenti: kembali ke keadaan siap. */
  static void pushIdle(Context context) {
    last = null;
    coverSrc = null;
    java.util.Arrays.fill(coverOut, null);
    render(context, null);
  }

  /** Gambar ulang semua widget (semua bentuk) dari keadaan `model`. */
  private static void render(Context context, Model model) {
    Context app = context.getApplicationContext();
    AppWidgetManager manager = AppWidgetManager.getInstance(app);
    for (Form form : Form.values()) {
      int[] ids = manager.getAppWidgetIds(new ComponentName(app, form.receiver));
      if (ids == null) continue; // tidak ada widget bentuk ini di layar: tidak perlu kerja apa pun
      for (int id : ids) update(app, manager, id, form, model);
    }
  }

  /** Gambar ulang satu widget dengan pengaturannya. Gagal menggambar sampul -> coba lagi tanpa sampul supaya tombol tetap hidup. */
  private static void update(Context app, AppWidgetManager manager, int id, Form form, Model model) {
    MusicVerseWidgetConfig cfg = MusicVerseWidgetConfig.load(app, id);
    try {
      manager.updateAppWidget(id, build(app, model, form, cfg));
    } catch (RuntimeException e) {
      android.util.Log.w("MusicVerse", "Widget gagal digambar: " + e);
      if (model != null && model.cover != null) {
        try {
          manager.updateAppWidget(id, build(app, new Model(model.title, model.artist, model.playing, model.loading, model.hasNext, model.hasPrevious, null), form, cfg));
        } catch (RuntimeException ignored) {
          // biarkan tampilan lama
        }
      }
    }
  }

  /** Dipanggil layar pengaturan setelah menyimpan: gambar ulang widget `id` dari keadaan terakhir. */
  static void refreshOne(Context context, int id) {
    Context app = context.getApplicationContext();
    AppWidgetManager manager = AppWidgetManager.getInstance(app);
    Form form = formOf(manager, id);
    if (form != null) update(app, manager, id, form, last);
  }

  /** Bentuk widget `id` menurut penyedia yang terdaftar; null bila tidak dikenal. */
  static Form formOf(AppWidgetManager manager, int id) {
    android.appwidget.AppWidgetProviderInfo info = manager.getAppWidgetInfo(id);
    if (info == null || info.provider == null) return null;
    String cls = info.provider.getClassName();
    for (Form form : Form.values()) {
      if (form.receiver.getName().equals(cls)) return form;
    }
    return null;
  }

  /** Keadaan contoh untuk pratinjau di layar pengaturan: keadaan sekarang bila sedang memutar, kalau tidak lagu contoh. */
  static Model previewModel(Context context) {
    if (last != null) return last;
    Bitmap cover = null;
    try {
      cover = android.graphics.BitmapFactory.decodeResource(context.getResources(), R.drawable.notif_default_cover);
    } catch (RuntimeException ignored) {
      // tanpa sampul
    }
    return new Model("Judul lagu", "Nama artis", true, false, true, true, cover);
  }

  static RemoteViews build(Context app, Model model, Form form, MusicVerseWidgetConfig cfg) {
    RemoteViews views = new RemoteViews(app.getPackageName(), form.layout);
    boolean live = model != null;
    Bitmap cover = live ? model.cover : null;

    // --- Warna dari tema + aksen ---
    // 0 = sampul tidak punya warna berarti (hampir hitam-putih / tidak ada): pakai aksen pilihan.
    int coverBase = cover != null ? coverColor(cover) : 0;
    int accent = cfg.accentFromCover && coverBase != 0 ? WidgetColors.vivid(coverBase) : cfg.accent;
    int bg;
    switch (cfg.theme) {
      case MusicVerseWidgetConfig.THEME_LIGHT: bg = 0xFFF2F2F2; break;
      case MusicVerseWidgetConfig.THEME_GLASS: bg = 0xFF14181C; break;
      case MusicVerseWidgetConfig.THEME_COVER: bg = WidgetColors.deep(coverBase != 0 ? coverBase : accent); break;
      case MusicVerseWidgetConfig.THEME_ACCENT: bg = accent; break;
      default: bg = 0xFF181818;
    }
    int opacity = cfg.theme == MusicVerseWidgetConfig.THEME_GLASS ? Math.round(cfg.opacity * 0.5f) : cfg.opacity;
    int bgAlpha = Math.round(255 * opacity / 100f);
    int textPrimary = WidgetColors.onColor(cfg.theme == MusicVerseWidgetConfig.THEME_GLASS ? 0xFF000000 : bg);
    int textSecondary = WidgetColors.withAlpha(textPrimary, 0xB3);
    // Tombol putar terisi: aksen (di tema Aksen: warna teks, supaya tetap kontras dengan latar). Ikon di atasnya kontras.
    boolean accentTheme = cfg.theme == MusicVerseWidgetConfig.THEME_ACCENT;
    int playFill = accentTheme ? textPrimary : accent;
    int playIcon = cfg.playStyle == MusicVerseWidgetConfig.PLAY_FILLED ? (accentTheme ? bg : WidgetColors.onColor(accent)) : (accentTheme ? textPrimary : accent);

    // --- Latar ---
    int bgRes = cfg.corner == MusicVerseWidgetConfig.CORNER_SQUARE ? R.drawable.widget_bg_square
        : cfg.corner == MusicVerseWidgetConfig.CORNER_PILL ? R.drawable.widget_bg_pill : R.drawable.widget_bg_round;
    views.setImageViewResource(R.id.widget_bg, bgRes);
    views.setInt(R.id.widget_bg, "setColorFilter", bg);
    views.setInt(R.id.widget_bg, "setImageAlpha", bgAlpha);

    // --- Teks ---
    if (form.text) {
      float scale = cfg.textSize == MusicVerseWidgetConfig.SIZE_SMALL ? 0.88f : cfg.textSize == MusicVerseWidgetConfig.SIZE_LARGE ? 1.18f : 1f;
      views.setTextViewText(R.id.widget_title, live && !model.title.isEmpty() ? model.title : "MusicVerse");
      String artist;
      if (!live) artist = "Ketuk untuk membuka";
      else if (model.loading) artist = model.artist.isEmpty() ? "Memuat lagu…" : "Memuat lagu… · " + model.artist;
      else artist = model.artist;
      views.setTextViewText(R.id.widget_artist, artist);
      views.setTextViewTextSize(R.id.widget_title, TypedValue.COMPLEX_UNIT_SP, form.titleSp * scale);
      views.setTextViewTextSize(R.id.widget_artist, TypedValue.COMPLEX_UNIT_SP, form.artistSp * scale);
      views.setTextColor(R.id.widget_title, textPrimary);
      views.setTextColor(R.id.widget_artist, textSecondary);
      views.setViewVisibility(R.id.widget_artist, cfg.showArtist ? View.VISIBLE : View.GONE);
      // Bilah berjalan di bawah teks selama memuat, supaya terlihat jelas widget sedang bekerja (bukan macet).
      if (form.loading) {
        views.setViewVisibility(R.id.widget_loading, live && model.loading ? View.VISIBLE : View.GONE);
        if (Build.VERSION.SDK_INT >= 31) {
          views.setColorStateList(R.id.widget_loading, "setIndeterminateTintList", ColorStateList.valueOf(accentTheme ? textPrimary : accent));
        }
      }
    }

    // --- Sampul ---
    boolean showCover = form == Form.TINY || cfg.showCover;
    views.setViewVisibility(R.id.widget_cover, showCover ? View.VISIBLE : View.GONE);
    if (showCover) {
      if (live && cover != null) views.setImageViewBitmap(R.id.widget_cover, shapedCover(cover, cfg.coverShape, form.coverPx));
      else views.setImageViewResource(R.id.widget_cover, R.drawable.notif_default_cover);
    }

    // --- Tombol ---
    views.setImageViewResource(R.id.widget_play, live && model.playing ? R.drawable.ic_media_pause : R.drawable.ic_media_play);
    views.setInt(R.id.widget_play, "setColorFilter", playIcon);
    views.setInt(R.id.widget_play_bg, "setColorFilter", playFill);
    views.setViewVisibility(R.id.widget_play_bg, cfg.playStyle == MusicVerseWidgetConfig.PLAY_FILLED ? View.VISIBLE : View.GONE);

    PendingIntent open = openApp(app);
    views.setOnClickPendingIntent(R.id.widget_root, open);
    if (showCover) views.setOnClickPendingIntent(R.id.widget_cover, open);
    if (form.text) views.setOnClickPendingIntent(R.id.widget_text, open);

    if (live) {
      views.setOnClickPendingIntent(R.id.widget_play, command(app, ACTION_TOGGLE, 22));
    } else {
      // Tidak ada service: broadcast tidak bisa melakukan apa-apa, jadi semua tombol membuka aplikasi.
      // Putar: buka aplikasi (di latar belakang bila bisa) lalu ambil tautan audio baru dan lanjut dari posisi terakhir.
      PendingIntent playAndOpen = openAndPlay(app);
      views.setOnClickPendingIntent(R.id.widget_play, playAndOpen != null ? playAndOpen : open);
    }

    if (form.controls) {
      int vis = !cfg.showControls ? View.GONE : (live ? View.VISIBLE : View.INVISIBLE);
      views.setViewVisibility(R.id.widget_prev, vis);
      views.setViewVisibility(R.id.widget_next, vis);
      views.setInt(R.id.widget_prev, "setColorFilter", textPrimary);
      views.setInt(R.id.widget_next, "setColorFilter", textPrimary);
      if (live) {
        views.setOnClickPendingIntent(R.id.widget_prev, command(app, ACTION_PREVIOUS, 21));
        views.setOnClickPendingIntent(R.id.widget_next, command(app, ACTION_NEXT, 23));
      } else {
        views.setOnClickPendingIntent(R.id.widget_prev, open);
        views.setOnClickPendingIntent(R.id.widget_next, open);
      }
      setEnabled(views, R.id.widget_prev, live && model.hasPrevious);
      setEnabled(views, R.id.widget_next, live && model.hasNext);
    }
    return views;
  }

  private static void setEnabled(RemoteViews views, int viewId, boolean enabled) {
    views.setBoolean(viewId, "setEnabled", enabled);
    views.setInt(viewId, "setImageAlpha", enabled ? 255 : 90);
  }

  private static int immutableFlag() {
    return Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0;
  }

  /** Perintah tombol: selalu ke receiver Standar (kelas dasar); satu receiver cukup melayani semua bentuk. */
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

  // --- Sampul: dipotong persegi dari tengah, bentuk sesuai pengaturan, diperkecil. Disimpan selama sampulnya sama. ---
  private static Bitmap coverSrc;
  /** Indeks = bentuk * 3 + ukuran (0: <=128, 1: <=224, 2: lebih besar). */
  private static final Bitmap[] coverOut = new Bitmap[9];
  private static int coverDominant;

  /** Warna dominan sampul (dihitung dari versi 8x8), disimpan selama sampulnya sama. 0 = tidak ada warna berarti. */
  private static int coverColor(Bitmap src) {
    if (src != coverSrc) {
      coverSrc = src;
      java.util.Arrays.fill(coverOut, null);
      int fallback = 0;
      try {
        Bitmap tiny = Bitmap.createScaledBitmap(src, 8, 8, true);
        int[] px = new int[64];
        tiny.getPixels(px, 0, 8, 0, 0, 8, 8);
        coverDominant = WidgetColors.dominant(px, fallback);
      } catch (RuntimeException e) {
        coverDominant = fallback;
      }
    }
    return coverDominant;
  }

  private static Bitmap shapedCover(Bitmap src, int shape, int px) {
    coverColor(src); // memastikan cache milik `src`
    int sizeIdx = px <= 128 ? 0 : px <= 224 ? 1 : 2;
    int slot = shape * 3 + sizeIdx;
    if (coverOut[slot] != null) return coverOut[slot];
    Bitmap out = Bitmap.createBitmap(px, px, Bitmap.Config.ARGB_8888);
    Canvas canvas = new Canvas(out);
    Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.FILTER_BITMAP_FLAG);
    int w = src.getWidth();
    int h = src.getHeight();
    int side = Math.min(w, h);
    Rect from = new Rect((w - side) / 2, (h - side) / 2, (w + side) / 2, (h + side) / 2);
    RectF to = new RectF(0, 0, px, px);
    float radius = shape == MusicVerseWidgetConfig.SHAPE_CIRCLE ? px / 2f : shape == MusicVerseWidgetConfig.SHAPE_SQUARE ? 0f : px * 0.14f;
    canvas.drawRoundRect(to, radius, radius, paint);
    paint.setXfermode(new PorterDuffXfermode(PorterDuff.Mode.SRC_IN));
    canvas.drawBitmap(src, from, to, paint);
    coverOut[slot] = out;
    return out;
  }

  @Override
  public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
    // Widget baru ditambahkan / perangkat baru menyala: gambar dari keadaan terakhir (atau siap).
    Context app = context.getApplicationContext();
    for (int id : appWidgetIds) update(app, manager, id, form(), last);
    // Service sedang berjalan tetapi belum ada keadaan tersimpan: minta service mendorong ulang.
    if (last == null) PlaybackService.refreshWidget();
  }

  @Override
  public void onDeleted(Context context, int[] appWidgetIds) {
    for (int id : appWidgetIds) MusicVerseWidgetConfig.delete(context, id);
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
