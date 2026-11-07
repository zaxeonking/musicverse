package __APP_ID__;

import android.content.Context;
import android.content.SharedPreferences;

/**
 * Pengaturan satu widget layar utama (per appWidgetId), disimpan di SharedPreferences. Tiap widget yang ditambahkan punya
 * pengaturan sendiri; pengaturan terakhir yang disimpan dipakai sebagai bawaan untuk widget berikutnya.
 */
final class MusicVerseWidgetConfig {
  static final int THEME_DARK = 0, THEME_LIGHT = 1, THEME_GLASS = 2, THEME_COVER = 3, THEME_ACCENT = 4, THEME_CLEAR_GLASS = 5;
  static final int SHAPE_ROUNDED = 0, SHAPE_CIRCLE = 1, SHAPE_SQUARE = 2;
  static final int CORNER_SQUARE = 0, CORNER_ROUND = 1, CORNER_PILL = 2;
  static final int SIZE_SMALL = 0, SIZE_MEDIUM = 1, SIZE_LARGE = 2;
  static final int PLAY_FILLED = 0, PLAY_PLAIN = 1;

  static final int DEFAULT_ACCENT = 0xFF1DB954;

  /** Gaya kaca (bergantung pada sampul / latar di belakang). */
  boolean isGlass() {
    return theme == THEME_GLASS || theme == THEME_CLEAR_GLASS;
  }

  int theme = THEME_GLASS;
  int accent = DEFAULT_ACCENT;
  boolean accentFromCover = false;
  int coverShape = SHAPE_ROUNDED;
  int corner = CORNER_ROUND;
  int textSize = SIZE_MEDIUM;
  int playStyle = PLAY_FILLED;
  /** Keburaman latar 20..100 (%). */
  int opacity = 95;
  boolean showCover = true;
  boolean showArtist = true;
  boolean showControls = true;
  /** Kilau kaca 0..100 (%). */
  int glassShine = 78;
  /** Ketebalan kaca (lensa + bingkai) 0..100 (%). */
  int glassThickness = 39;
  /** Kebulatan sudut 0..100 (%): 0 = kotak, 100 = pil penuh. Menggantikan `corner` (3 tingkat). */
  int roundness = 66;
  /** Frost: keburaman sampul di latar kaca 0..100 (%). */
  int frost = 40;
  boolean showProgress = true;
  boolean showTime = true;
  boolean showLike = true;
  /** Baris lirik yang sedang dinyanyikan (hanya bentuk Tinggi dan Besar). */
  boolean showLyrics = true;

  private static final String PREFS = "mv_widget_cfg";
  private static final String DEFAULTS_KEY = "default";

  private static SharedPreferences prefs(Context c) {
    return c.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
  }

  private static String key(int id) {
    return id == 0 ? DEFAULTS_KEY : "w" + id;
  }

  /** Pengaturan widget `id`; bila belum pernah disimpan, pengaturan bawaan (terakhir disimpan, atau bawaan pabrik). */
  static MusicVerseWidgetConfig load(Context c, int id) {
    SharedPreferences p = prefs(c);
    String k = key(id);
    if (!p.contains(k + ".theme")) k = DEFAULTS_KEY;
    MusicVerseWidgetConfig cfg = new MusicVerseWidgetConfig();
    cfg.theme = clampInt(p.getInt(k + ".theme", cfg.theme), 0, THEME_CLEAR_GLASS);
    cfg.accent = 0xFF000000 | p.getInt(k + ".accent", cfg.accent);
    cfg.accentFromCover = p.getBoolean(k + ".accentFromCover", cfg.accentFromCover);
    cfg.coverShape = clampInt(p.getInt(k + ".coverShape", cfg.coverShape), 0, SHAPE_SQUARE);
    cfg.corner = clampInt(p.getInt(k + ".corner", cfg.corner), 0, CORNER_PILL);
    cfg.textSize = clampInt(p.getInt(k + ".textSize", cfg.textSize), 0, SIZE_LARGE);
    cfg.playStyle = clampInt(p.getInt(k + ".playStyle", cfg.playStyle), 0, PLAY_PLAIN);
    cfg.opacity = clampInt(p.getInt(k + ".opacity", cfg.opacity), 20, 100);
    cfg.showCover = p.getBoolean(k + ".showCover", cfg.showCover);
    cfg.showArtist = p.getBoolean(k + ".showArtist", cfg.showArtist);
    cfg.showControls = p.getBoolean(k + ".showControls", cfg.showControls);
    // Migrasi: pengaturan lama hanya punya 3 tingkat sudut.
    int legacyRound = cfg.corner == CORNER_SQUARE ? 0 : cfg.corner == CORNER_PILL ? 100 : 35;
    cfg.roundness = clampInt(p.getInt(k + ".roundness", p.contains(k + ".corner") ? legacyRound : cfg.roundness), 0, 100);
    cfg.glassShine = clampInt(p.getInt(k + ".glassShine", cfg.glassShine), 0, 100);
    cfg.glassThickness = clampInt(p.getInt(k + ".glassThickness", cfg.glassThickness), 0, 100);
    cfg.frost = clampInt(p.getInt(k + ".frost", cfg.frost), 0, 100);
    cfg.showProgress = p.getBoolean(k + ".showProgress", cfg.showProgress);
    cfg.showTime = p.getBoolean(k + ".showTime", cfg.showTime);
    cfg.showLike = p.getBoolean(k + ".showLike", cfg.showLike);
    cfg.showLyrics = p.getBoolean(k + ".showLyrics", cfg.showLyrics);
    return cfg;
  }

  /** Simpan untuk widget `id` dan jadikan bawaan widget berikutnya. */
  void save(Context c, int id) {
    SharedPreferences.Editor e = prefs(c).edit();
    write(e, key(id));
    write(e, DEFAULTS_KEY);
    e.apply();
  }

  private void write(SharedPreferences.Editor e, String k) {
    e.putInt(k + ".theme", theme)
        .putInt(k + ".accent", accent & 0xFFFFFF)
        .putBoolean(k + ".accentFromCover", accentFromCover)
        .putInt(k + ".coverShape", coverShape)
        .putInt(k + ".corner", corner)
        .putInt(k + ".textSize", textSize)
        .putInt(k + ".playStyle", playStyle)
        .putInt(k + ".opacity", opacity)
        .putBoolean(k + ".showCover", showCover)
        .putBoolean(k + ".showArtist", showArtist)
        .putBoolean(k + ".showControls", showControls)
        .putInt(k + ".roundness", roundness)
        .putInt(k + ".glassShine", glassShine)
        .putInt(k + ".glassThickness", glassThickness)
        .putInt(k + ".frost", frost)
        .putBoolean(k + ".showProgress", showProgress)
        .putBoolean(k + ".showTime", showTime)
        .putBoolean(k + ".showLike", showLike)
        .putBoolean(k + ".showLyrics", showLyrics);
  }

  static void delete(Context c, int id) {
    SharedPreferences p = prefs(c);
    String k = key(id) + ".";
    SharedPreferences.Editor e = p.edit();
    for (String name : p.getAll().keySet()) if (name.startsWith(k)) e.remove(name);
    e.apply();
  }

  private static int clampInt(int v, int lo, int hi) {
    return v < lo ? lo : Math.min(v, hi);
  }
}
