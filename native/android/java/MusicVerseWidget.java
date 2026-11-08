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
 * Widget layar utama. Ada 5 bentuk di daftar widget (lihat {@link Form}), dari terkecil: Mini 1x1, Strip 4x1, Kotak 2x2, Tinggi 2x3,
 * Besar 4x2. Kelas dasar ini sendiri tidak lagi tampil di daftar (dulu Standar 4x1, kembar dengan Strip). Tiap bentuk punya receiver sendiri (subkelas kelas ini) dan tiap widget yang dipasang punya pengaturan sendiri
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
  static final String ACTION_LIKE = "__APP_ID__.widget.LIKE";

  /** Bentuk widget. Tiap bentuk = satu layout + satu receiver; bendera menandai view mana yang ada di layoutnya. */
  enum Form {
    // Urutan = dari yang terkecil. STANDARD (4×1 lama) TIDAK lagi tampil di daftar widget (kembar dengan Strip 4×1); kelasnya tetap
    // terdaftar di manifest sebagai penerima perintah tombol saja.
    //        layout                  receiver                    nama       teks   prev   loading  progres like  coverPx titleSp artistSp  pratinjau (dp)
    TINY(R.layout.widget_tiny, MusicVerseWidgetTiny.class, "Mini 1×1", false, false, false, false, false, 192, 0, 0, 72, 72),
    STRIP(R.layout.widget_strip, MusicVerseWidgetStrip.class, "Strip 4×1", true, true, false, false, false, 128, 15, 12, 300, 60),
    SQUARE(R.layout.widget_square, MusicVerseWidgetSquare.class, "Kotak 2×2", true, true, true, false, false, 192, 15, 12, 160, 150),
    TALL(R.layout.widget_tall, MusicVerseWidgetTall.class, "Tinggi 2×3", true, true, true, true, false, 320, 16, 13, 160, 250),
    LARGE(R.layout.widget_large, MusicVerseWidgetLarge.class, "Besar 4×2", true, true, true, true, true, 320, 18, 14, 300, 150),
    STANDARD(R.layout.widget_player, MusicVerseWidget.class, "Standar 4×1", true, true, true, false, false, 192, 15, 12, 300, 72);

    final int layout;
    final Class<?> receiver;
    final String label;
    /** Ada judul/artis (widget_title / widget_artist / widget_text). */
    final boolean text;
    /** Ada tombol Sebelumnya dan Berikutnya. */
    final boolean controls;
    /** Ada bilah "memuat". */
    final boolean loading;
    /** Ada baris progres (bilah + waktu). */
    final boolean progress;
    /** Ada tombol suka. */
    final boolean like;
    final int coverPx;
    final int titleSp;
    final int artistSp;
    final int previewW;
    final int previewH;

    /** Bentuk yang punya baris lirik (widget_lyric): Tinggi dan Besar. */
    boolean hasLyric() {
      return this == TALL || this == LARGE;
    }

    Form(int layout, Class<?> receiver, String label, boolean text, boolean controls, boolean loading, boolean progress, boolean like,
        int coverPx, int titleSp, int artistSp, int previewW, int previewH) {
      this.layout = layout;
      this.receiver = receiver;
      this.label = label;
      this.text = text;
      this.controls = controls;
      this.loading = loading;
      this.progress = progress;
      this.like = like;
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
    /** Lagu ini sudah disukai (disinkronkan dari JS lewat setWidgetLiked). */
    boolean liked;
    /** Posisi / durasi (ms) pada saat terakhir didorong; hanya untuk bilah progres dan waktu. */
    long positionMs;
    long durationMs;

    Model(String title, String artist, boolean playing, boolean loading, boolean hasNext, boolean hasPrevious, Bitmap cover) {
      this.title = title == null ? "" : title;
      this.artist = artist == null ? "" : artist;
      this.playing = playing;
      this.loading = loading;
      this.hasNext = hasNext;
      this.hasPrevious = hasPrevious;
      this.cover = cover;
    }

    Model copyWithoutCover() {
      Model m = new Model(title, artist, playing, loading, hasNext, hasPrevious, null);
      m.liked = liked;
      m.positionMs = positionMs;
      m.durationMs = durationMs;
      return m;
    }
  }

  /** Keadaan terakhir yang didorong service; null = siap (tidak ada pemutaran). Hanya diakses dari thread utama. */
  private static Model last;

  /** Dipanggil PlaybackService (thread utama). `cover` null = sampul bawaan. */
  static void push(Context context, String title, String artist, boolean playing, boolean loading, boolean hasNext, boolean hasPrevious, Bitmap cover,
      long positionMs, long durationMs) {
    Model m = new Model(title, artist, playing, loading, hasNext, hasPrevious, cover);
    m.positionMs = Math.max(0, positionMs);
    m.durationMs = Math.max(0, durationMs);
    // Tanda suka dicocokkan lewat judul lagu yang dilaporkan JS (setWidgetLiked), jadi tidak tertukar saat lagu berganti.
    m.liked = likedValue && m.title.equals(likedTitle);
    last = m;
    render(context, last);
  }

  /** Status suka terakhir yang dilaporkan JS, beserta judul lagunya. */
  private static String likedTitle = "";
  private static boolean likedValue = false;

  /** JS melaporkan status suka lagu `title`. */
  static void pushLiked(Context context, String title, boolean liked) {
    likedTitle = title == null ? "" : title;
    likedValue = liked;
    Model m = last;
    if (m == null || !m.title.equals(likedTitle) || m.liked == liked) return;
    m.liked = liked;
    render(context, m);
  }

  // --- Lirik: waktu (ms audio) dan teks per baris untuk lagu `lyricTitle`, dikirim JS sekali per lagu. Baris aktif dipilih di sini ---
  // dari posisi lagu, supaya tetap jalan saat WebView dibekukan (layar mati / app di latar belakang).
  private static String lyricTitle = "";
  private static long[] lyricTimes = new long[0];
  private static String[] lyricTexts = new String[0];
  /** Teks lirik yang terakhir digambar ke widget; pembanding supaya tick hanya memperbarui saat barisnya berganti. */
  private static String shownLyric = null;

  /** JS mengirim lirik lagu `title` (kosong = tidak ada lirik berwaktu). */
  static void pushLyrics(Context context, String title, long[] times, String[] texts) {
    lyricTitle = title == null ? "" : title;
    lyricTimes = times == null ? new long[0] : times;
    lyricTexts = texts == null ? new String[0] : texts;
    Model m = last;
    if (m != null) render(context, m);
  }

  /** Baris lirik pada posisi `m`, atau null bila lagu ini tidak punya lirik berwaktu / lirik lagu lain yang tersimpan. */
  private static String currentLyric(Model m) {
    if (m == null || lyricTimes.length == 0 || lyricTimes.length != lyricTexts.length || !m.title.equals(lyricTitle)) return null;
    int lo = 0;
    int hi = lyricTimes.length - 1;
    int idx = -1;
    while (lo <= hi) {
      int mid = (lo + hi) >>> 1;
      if (lyricTimes[mid] <= m.positionMs) {
        idx = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    if (idx < 0) return "\u266A"; // intro: belum ada baris
    String text = lyricTexts[idx].trim();
    return text.isEmpty() ? "\u266A" : text;
  }

  private static void applyLyric(RemoteViews views, String lyric, Palette pal, float scale, Form form) {
    boolean show = lyric != null;
    views.setViewVisibility(R.id.widget_lyric, show ? View.VISIBLE : View.GONE);
    if (!show) return;
    views.setTextViewText(R.id.widget_lyric, lyric);
    views.setTextColor(R.id.widget_lyric, pal.accentTheme ? pal.textPrimary : pal.accent);
    views.setTextViewTextSize(R.id.widget_lyric, TypedValue.COMPLEX_UNIT_SP, (form.artistSp - 1) * scale);
  }

  private static long lastTickAt = 0;

  /**
   * Detak tiap detik dari service saat memutar: perbarui HANYA bilah progres dan waktu (pembaruan sebagian, murah), dan hanya bila
   * layar menyala dan ada widget yang menampilkannya.
   */
  static void tick(Context context, long positionMs, long durationMs) {
    Model m = last;
    if (m == null) return;
    m.positionMs = Math.max(0, positionMs);
    if (durationMs > 0) m.durationMs = durationMs;
    long now = android.os.SystemClock.elapsedRealtime();
    if (now - lastTickAt < 900) return;
    lastTickAt = now;
    Context app = context.getApplicationContext();
    try {
      android.os.PowerManager pm = (android.os.PowerManager) app.getSystemService(Context.POWER_SERVICE);
      if (pm != null && !pm.isInteractive()) return;
      AppWidgetManager manager = AppWidgetManager.getInstance(app);
      String lyric = currentLyric(m);
      boolean lyricChanged = !java.util.Objects.equals(lyric, shownLyric);
      for (Form form : Form.values()) {
        if (!form.progress) continue;
        int[] ids = manager.getAppWidgetIds(new ComponentName(app, form.receiver));
        if (ids == null) continue;
        for (int id : ids) {
          MusicVerseWidgetConfig cfg = MusicVerseWidgetConfig.load(app, id);
          boolean wantProgress = cfg.showProgress || cfg.showTime;
          boolean wantLyric = form.hasLyric() && cfg.showLyrics && lyricChanged;
          if (!wantProgress && !wantLyric) continue;
          RemoteViews part = new RemoteViews(app.getPackageName(), form.layout);
          Palette pal = palette(cfg, m.cover, 0);
          if (wantProgress) applyProgress(part, m, cfg, pal);
          if (wantLyric) {
            float scale = cfg.textSize == MusicVerseWidgetConfig.SIZE_SMALL ? 0.93f : cfg.textSize == MusicVerseWidgetConfig.SIZE_LARGE ? 1.2f : 1f;
            applyLyric(part, lyric, pal, scale, form);
          }
          manager.partiallyUpdateAppWidget(id, part);
        }
      }
      shownLyric = lyric;
    } catch (RuntimeException ignored) {
      // pembaruan penuh berikutnya akan menyusul
    }
  }

  /** Service berhenti: kembali ke keadaan siap. */
  static void pushIdle(Context context) {
    last = null;
    lyricTitle = "";
    lyricTimes = new long[0];
    lyricTexts = new String[0];
    shownLyric = null;
    coverSrc = null;
    java.util.Arrays.fill(coverOut, null);
    WidgetGlass.clearCache();
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

  /**
   * Gambar ulang satu widget dengan pengaturannya. Bertahap supaya widget tidak pernah tertinggal di "Problem loading widget":
   * (1) gambar penuh, (2) tanpa sampul, (3) tampilan pengaman yang memuat judul + pesan galat singkat dan tetap membuka aplikasi.
   */
  private static void update(Context app, AppWidgetManager manager, int id, Form form, Model model) {
    Throwable failure;
    try {
      MusicVerseWidgetConfig cfg = MusicVerseWidgetConfig.load(app, id);
      int[] size = sizeDp(manager, id, form);
      try {
        manager.updateAppWidget(id, build(app, model, form, cfg, size[0], size[1]));
        return;
      } catch (RuntimeException | OutOfMemoryError e) {
        android.util.Log.w("MusicVerse", "Widget gagal digambar: " + e);
        failure = e;
        if (model != null && model.cover != null) {
          try {
            manager.updateAppWidget(id, build(app, model.copyWithoutCover(), form, cfg, size[0], size[1]));
            return;
          } catch (RuntimeException | OutOfMemoryError e2) {
            failure = e2;
          }
        }
      }
    } catch (RuntimeException | OutOfMemoryError e) {
      android.util.Log.w("MusicVerse", "Widget gagal disiapkan: " + e);
      failure = e;
    }
    try {
      manager.updateAppWidget(id, safeViews(app, form, failure));
    } catch (RuntimeException | OutOfMemoryError ignored) {
      // tidak ada yang bisa dilakukan lagi
    }
  }

  /** Tampilan pengaman: layout bentuknya apa adanya, hanya judul + alasan gagal (terbaca di layar) dan ketukan membuka aplikasi. */
  private static RemoteViews safeViews(Context app, Form form, Throwable why) {
    RemoteViews v = new RemoteViews(app.getPackageName(), form.layout);
    if (form.text) {
      String reason = why == null ? "?" : why.getClass().getSimpleName() + (why.getMessage() == null ? "" : ": " + why.getMessage());
      if (reason.length() > 90) reason = reason.substring(0, 90);
      v.setTextViewText(R.id.widget_title, "MusicVerse");
      v.setTextViewText(R.id.widget_artist, "Gagal menggambar: " + reason);
    }
    PendingIntent open = openApp(app);
    if (open != null) v.setOnClickPendingIntent(R.id.widget_root, open);
    return v;
  }

  /** Dipanggil layar pengaturan setelah menyimpan: gambar ulang widget `id` dari keadaan terakhir. */
  static void refreshOne(Context context, int id) {
    Context app = context.getApplicationContext();
    AppWidgetManager manager = AppWidgetManager.getInstance(app);
    Form form = formOf(manager, id);
    if (form != null) update(app, manager, id, form, last);
  }

  /** Ukuran widget (dp) dari opsi peluncur; bila tidak ada, ukuran pratinjau bentuknya. */
  static int[] sizeDp(AppWidgetManager manager, int id, Form form) {
    int w = form.previewW;
    int h = form.previewH;
    try {
      android.os.Bundle o = manager.getAppWidgetOptions(id);
      if (o != null) {
        int ow = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0);
        int oh = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0);
        if (ow >= 40) w = ow;
        if (oh >= 40) h = oh;
      }
    } catch (RuntimeException ignored) {
      // pakai ukuran bawaan
    }
    return new int[] {w, h};
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
    Model sample = new Model("Judul lagu", "Nama artis", true, false, true, true, cover);
    sample.positionMs = 70_000L;
    sample.durationMs = 200_000L;
    return sample;
  }

  /** Warna turunan dari gaya + aksen + sampul. */
  static final class Palette {
    int bg, accent, textPrimary, textSecondary, playFill, playIcon;
    boolean accentTheme;
  }

  private static Palette palette(MusicVerseWidgetConfig cfg, Bitmap cover, int unused) {
    // 0 = sampul tidak punya warna berarti (hampir hitam-putih / tidak ada): pakai aksen pilihan.
    int coverBase = cover != null ? coverColor(cover) : 0;
    Palette p = new Palette();
    p.accent = cfg.accentFromCover && coverBase != 0 ? WidgetColors.vivid(coverBase) : cfg.accent;
    switch (cfg.theme) {
      case MusicVerseWidgetConfig.THEME_LIGHT: p.bg = 0xFFF2F2F2; break;
      case MusicVerseWidgetConfig.THEME_GLASS:
      case MusicVerseWidgetConfig.THEME_CLEAR_GLASS: p.bg = 0xFF14181C; break;
      case MusicVerseWidgetConfig.THEME_COVER: p.bg = WidgetColors.deep(coverBase != 0 ? coverBase : p.accent); break;
      case MusicVerseWidgetConfig.THEME_ACCENT: p.bg = p.accent; break;
      default: p.bg = 0xFF181818;
    }
    p.textPrimary = WidgetColors.onColor(cfg.isGlass() ? 0xFF000000 : p.bg);
    p.textSecondary = WidgetColors.withAlpha(p.textPrimary, 0xB3);
    // Tombol putar terisi: aksen (di tema Aksen: warna teks, supaya tetap kontras dengan latar). Ikon di atasnya kontras.
    p.accentTheme = cfg.theme == MusicVerseWidgetConfig.THEME_ACCENT;
    p.playFill = p.accentTheme ? p.textPrimary : p.accent;
    p.playIcon = cfg.playStyle == MusicVerseWidgetConfig.PLAY_FILLED
        ? (p.accentTheme ? p.bg : WidgetColors.onColor(p.accent))
        : (p.accentTheme ? p.textPrimary : p.accent);
    return p;
  }

  private static String fmtTime(long ms) {
    long total = Math.max(0, ms) / 1000;
    long m = total / 60;
    long sec = total % 60;
    if (m >= 60) return (m / 60) + ":" + String.format(java.util.Locale.US, "%02d:%02d", m % 60, sec);
    return m + ":" + String.format(java.util.Locale.US, "%02d", sec);
  }

  /** Bilah progres + waktu. Dipakai build() (penuh) dan tick() (sebagian). */
  private static void applyProgress(RemoteViews views, Model model, MusicVerseWidgetConfig cfg, Palette pal) {
    long dur = model == null ? 0 : model.durationMs;
    long pos = model == null ? 0 : Math.min(model.positionMs, dur > 0 ? dur : model.positionMs);
    if (cfg.showProgress) {
      float frac = dur > 0 ? pos / (float) dur : 0f;
      views.setImageViewBitmap(R.id.widget_progress, WidgetGlass.progressBar(360, 8, frac, pal.textPrimary, WidgetColors.withAlpha(pal.textPrimary, 0x45)));
    }
    if (cfg.showTime) {
      views.setTextViewText(R.id.widget_time_cur, fmtTime(pos));
      views.setTextViewText(R.id.widget_time_total, dur > 0 ? fmtTime(dur) : "0:00");
      views.setTextColor(R.id.widget_time_cur, pal.textSecondary);
      views.setTextColor(R.id.widget_time_total, pal.textSecondary);
    }
  }

  static RemoteViews build(Context app, Model model, Form form, MusicVerseWidgetConfig cfg) {
    return build(app, model, form, cfg, form.previewW, form.previewH);
  }

  static RemoteViews build(Context app, Model model, Form form, MusicVerseWidgetConfig cfg, int wDp, int hDp) {
    RemoteViews views = new RemoteViews(app.getPackageName(), form.layout);
    boolean live = model != null;
    Bitmap cover = live ? model.cover : null;

    Palette pal = palette(cfg, cover, 0);
    boolean accentTheme = pal.accentTheme;
    int accent = pal.accent;
    int textPrimary = pal.textPrimary;
    int textSecondary = pal.textSecondary;
    int playFill = pal.playFill;
    int playIcon = pal.playIcon;

    // --- Latar: satu bitmap (kaca / warna) dengan sudut, frost, kilau, dan tepi sesuai pengaturan ---
    int bgW = Math.round(wDp * 1.5f);
    int bgH = Math.round(hDp * 1.5f);
    Bitmap bgBitmap = WidgetGlass.render(bgW, bgH, cfg, pal.bg, cover, cover == null ? 0 : System.identityHashCode(cover));
    views.setImageViewBitmap(R.id.widget_bg, bgBitmap);
    views.setInt(R.id.widget_bg, "setColorFilter", 0);
    views.setInt(R.id.widget_bg, "setImageAlpha", 255);

    // --- Teks ---
    if (form.text) {
      float scale = cfg.textSize == MusicVerseWidgetConfig.SIZE_SMALL ? 0.93f : cfg.textSize == MusicVerseWidgetConfig.SIZE_LARGE ? 1.2f : 1f;
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

    // --- Lirik (baris yang sedang dinyanyikan) ---
    if (form.hasLyric()) {
      String lyric = live && cfg.showLyrics ? currentLyric(model) : null;
      float lyricScale = cfg.textSize == MusicVerseWidgetConfig.SIZE_SMALL ? 0.93f : cfg.textSize == MusicVerseWidgetConfig.SIZE_LARGE ? 1.2f : 1f;
      applyLyric(views, lyric, pal, lyricScale, form);
      shownLyric = lyric;
    }

    // --- Sampul ---
    boolean showCover = form == Form.TINY || cfg.showCover;
    views.setViewVisibility(R.id.widget_cover, showCover ? View.VISIBLE : View.GONE);
    if (showCover) {
      if (live && cover != null) views.setImageViewBitmap(R.id.widget_cover, shapedCover(cover, cfg.coverShape, form.coverPx));
      else views.setImageViewResource(R.id.widget_cover, R.drawable.notif_default_cover);
    }

    // --- Progres + waktu ---
    if (form.progress) {
      boolean any = cfg.showProgress || cfg.showTime;
      views.setViewVisibility(R.id.widget_progress_row, any ? View.VISIBLE : View.GONE);
      views.setViewVisibility(R.id.widget_progress, cfg.showProgress ? View.VISIBLE : View.GONE);
      views.setViewVisibility(R.id.widget_time_cur, cfg.showTime ? View.VISIBLE : View.GONE);
      views.setViewVisibility(R.id.widget_time_total, cfg.showTime ? View.VISIBLE : View.GONE);
      if (any) applyProgress(views, live ? model : null, cfg, pal);
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

    // --- Suka ---
    if (form.like) {
      boolean liked = live && model.liked;
      views.setViewVisibility(R.id.widget_like, !cfg.showLike ? View.GONE : (live ? View.VISIBLE : View.INVISIBLE));
      views.setImageViewResource(R.id.widget_like, liked ? R.drawable.ic_widget_heart_filled : R.drawable.ic_widget_heart);
      views.setInt(R.id.widget_like, "setColorFilter", liked ? (accentTheme ? textPrimary : accent) : textPrimary);
      views.setOnClickPendingIntent(R.id.widget_like, live ? command(app, ACTION_LIKE, 25) : open);
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
  public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int appWidgetId, android.os.Bundle newOptions) {
    // Widget diubah ukurannya: latar (bitmap) disesuaikan dengan ukuran baru supaya sudut tidak melar.
    update(context.getApplicationContext(), manager, appWidgetId, form(), last);
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
    else if (ACTION_LIKE.equals(action)) command = "like";
    else return;
    if (command.equals("like")) {
      // Balik hati SEKARANG (tanpa menunggu JS); JS menyinkronkan status sebenarnya lewat setWidgetLiked.
      Model m = last;
      if (m != null) {
        m.liked = !m.liked;
        likedTitle = m.title;
        likedValue = m.liked;
        render(context, m);
      }
      PlaybackService.dispatch(command);
      return;
    }
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
