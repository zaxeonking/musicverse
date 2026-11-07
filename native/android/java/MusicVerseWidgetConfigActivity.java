package __APP_ID__;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.Intent;
import android.content.res.ColorStateList;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.text.Editable;
import android.text.InputType;
import android.text.TextWatcher;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.RemoteViews;
import android.widget.ScrollView;
import android.widget.Switch;
import android.widget.TextView;

import java.util.ArrayList;
import java.util.List;

/**
 * Layar pengaturan widget (dibuka saat widget ditambahkan, dan lewat tekan-lama > Atur ulang). Seluruh tampilan dibangun lewat
 * kode (tanpa layout XML / AppCompat) dan pratinjaunya memakai RemoteViews yang sama dengan widget asli, jadi yang terlihat di sini
 * = yang tampil di layar utama.
 *
 * Warna aksen dipilih lewat tiga penggeser yang bisa DISERET (rona, saturasi, kecerahan), 8 warna siap pakai, kolom hex, atau
 * "dari sampul". Penggeser menolak dicuri ScrollView induknya selama jari menyentuhnya, jadi seretan tidak ikut menggulir layar.
 */
public class MusicVerseWidgetConfigActivity extends Activity {
  private static final int BG = 0xFF0E1511;
  private static final int CARD = 0xFF0E1511;
  private static final int CARD_HI = 0xFF1C2A21;
  private static final int TEXT = 0xFFE6F2EA;
  private static final int TEXT_DIM = 0xFF86A08F;
  /** Warna antarmuka layar ini (chip terpilih, tombol Simpan); terpisah dari aksen widget supaya tidak berkedip saat menggeser. */
  private static final int UI_ACCENT = 0xFF1DB954;
  /** Urutan seperti Auralys: ungu, biru, teal, hijau, kuning, oranye, merah muda, merah. */
  private static final int[] SWATCHES = {
    0xFF7C4DFF, 0xFF2979FF, 0xFF00BFA5, 0xFF2ECC71, 0xFFFFB300, 0xFFFF6E40, 0xFFFF4081, 0xFFE53935,
  };

  private int widgetId = AppWidgetManager.INVALID_APPWIDGET_ID;
  private MusicVerseWidget.Form form = MusicVerseWidget.Form.STRIP;
  private MusicVerseWidgetConfig cfg;
  private FrameLayout previewBox;
  private FlowLayout swatchRow;
  private LinearLayout customBox;
  private EditText hexInput;
  private View colorDot;
  private Slider hueSlider;
  private Slider satSlider;
  private Slider valSlider;
  private boolean settingHex;
  private boolean settingSliders;
  /** Rona 0..360, saturasi 0..1, kecerahan 0..1 dari aksen sekarang. */
  private final float[] hsv = new float[3];
  /** Penyegar chip yang dipanggil tiap pengaturan berubah. */
  private final List<Runnable> refreshers = new ArrayList<>();

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    setResult(RESULT_CANCELED); // dibatalkan (tombol Kembali) = widget tidak jadi dipasang
    Intent intent = getIntent();
    if (intent != null && intent.getExtras() != null) {
      widgetId = intent.getExtras().getInt(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
    }
    if (widgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
      finish();
      return;
    }
    MusicVerseWidget.Form f = MusicVerseWidget.formOf(AppWidgetManager.getInstance(this), widgetId);
    if (f != null) form = f;
    cfg = MusicVerseWidgetConfig.load(this, widgetId);
    Color.colorToHSV(cfg.accent, hsv);
    setResult(RESULT_CANCELED, new Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId));
    buildUi();
    syncColorUi(false);
    renderPreview();
  }

  // ---------------------------------------------------------------------------------------------
  // UI
  // ---------------------------------------------------------------------------------------------

  private void buildUi() {
    FrameLayout frame = new FrameLayout(this);
    frame.setBackgroundColor(BG);

    ScrollView scroll = new ScrollView(this);
    scroll.setFillViewport(true);
    scroll.setVerticalScrollBarEnabled(false);
    LinearLayout root = new LinearLayout(this);
    root.setOrientation(LinearLayout.VERTICAL);
    root.setPadding(dp(16), dp(12), dp(16), dp(72));
    scroll.addView(root, new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
    frame.addView(scroll, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

    // Tombol Selesai tetap di bawah.
    LinearLayout bar = new LinearLayout(this);
    bar.setOrientation(LinearLayout.HORIZONTAL);
    bar.setBackgroundColor(BG);
    bar.setPadding(dp(16), dp(8), dp(16), dp(10));
    TextView done = button("Selesai", true);
    done.setOnClickListener(v -> saveAndFinish());
    bar.addView(done, new LinearLayout.LayoutParams(0, dp(44), 1f));
    FrameLayout.LayoutParams barLp = new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
    barLp.gravity = Gravity.BOTTOM;
    frame.addView(bar, barLp);

    // Layar penuh sampai ke bawah status bar / bilah navigasi (Android 15+): sisihkan ruangnya.
    frame.setOnApplyWindowInsetsListener((v, insets) -> {
      v.setPadding(0, insets.getSystemWindowInsetTop(), 0, insets.getSystemWindowInsetBottom());
      return insets;
    });

    TextView title = text("Pengaturan widget", 22, TEXT, false);
    title.setTypeface(Typeface.SERIF);
    root.addView(title);

    // Pratinjau di atas "wallpaper" keemasan supaya kaca terlihat (seperti Auralys).
    previewBox = new FrameLayout(this);
    GradientDrawable wall = new GradientDrawable(GradientDrawable.Orientation.TL_BR, new int[] {0xFF2E8B57, 0xFF14432B, 0xFF7BC89A});
    wall.setCornerRadius(dp(20));
    previewBox.setBackground(wall);
    previewBox.setPadding(dp(12), dp(14), dp(12), dp(14));
    LinearLayout.LayoutParams pLp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
    pLp.topMargin = dp(10);
    root.addView(previewBox, pLp);

    TextView note = text("Ukuran mengikuti widget yang dipilih. Ubah nanti: tekan lama widget lalu seret pegangannya.", 12, TEXT_DIM, false);
    note.setPadding(0, dp(8), 0, dp(2));
    root.addView(note);

    // --- Gaya ---
    section(root, "Gaya");
    final int[] styleIds = {
      MusicVerseWidgetConfig.THEME_GLASS, MusicVerseWidgetConfig.THEME_CLEAR_GLASS, MusicVerseWidgetConfig.THEME_DARK,
      MusicVerseWidgetConfig.THEME_LIGHT, MusicVerseWidgetConfig.THEME_COVER,
    };
    chips(root, new String[] {"Kaca", "Kaca bening", "Gelap", "Terang", "Warna sampul"},
        () -> indexOf(styleIds, cfg.theme), i -> cfg.theme = styleIds[i]);

    // --- Warna aksen ---
    section(root, "Warna aksen");
    swatchRow = new FlowLayout(this, dp(8), dp(8));
    root.addView(swatchRow);
    rebuildSwatches();

    // Warna kustom (penggeser rona / saturasi / kecerahan + hex) dilipat supaya layar tidak panjang.
    customBox = new LinearLayout(this);
    customBox.setOrientation(LinearLayout.VERTICAL);
    customBox.setVisibility(View.GONE);
    root.addView(customBox);
    hueSlider = new Slider(this);
    hueSlider.setLabel("Rona");
    hueSlider.setOnChange(v -> onHsvDragged(0, v));
    customBox.addView(sliderRow("Rona", hueSlider));
    satSlider = new Slider(this);
    satSlider.setOnChange(v -> onHsvDragged(1, v));
    customBox.addView(sliderRow("Saturasi", satSlider));
    valSlider = new Slider(this);
    valSlider.setOnChange(v -> onHsvDragged(2, v));
    customBox.addView(sliderRow("Kecerahan", valSlider));

    LinearLayout hexRow = new LinearLayout(this);
    hexRow.setOrientation(LinearLayout.HORIZONTAL);
    hexRow.setGravity(Gravity.CENTER_VERTICAL);
    hexRow.setPadding(0, dp(6), 0, 0);
    colorDot = new View(this);
    hexRow.addView(colorDot, new LinearLayout.LayoutParams(dp(32), dp(32)));
    hexInput = new EditText(this);
    hexInput.setTextColor(TEXT);
    hexInput.setHintTextColor(TEXT_DIM);
    hexInput.setHint("#1DB954");
    hexInput.setSingleLine(true);
    hexInput.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_CHARACTERS | InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD);
    hexInput.setTextSize(14);
    hexInput.setTypeface(Typeface.MONOSPACE);
    hexInput.setPadding(dp(12), dp(6), dp(12), dp(6));
    hexInput.setBackground(round(CARD_HI, 14));
    hexInput.setText(WidgetColors.toHex(cfg.accent));
    LinearLayout.LayoutParams hexLp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
    hexLp.setMarginStart(dp(10));
    hexRow.addView(hexInput, hexLp);
    customBox.addView(hexRow);
    hexInput.addTextChangedListener(new TextWatcher() {
      @Override public void beforeTextChanged(CharSequence s, int a, int b, int c) {}
      @Override public void onTextChanged(CharSequence s, int a, int b, int c) {}
      @Override public void afterTextChanged(Editable s) {
        if (settingHex) return;
        Integer color = WidgetColors.parseHex(s.toString());
        if (color == null) return;
        cfg.accent = 0xFF000000 | color;
        cfg.accentFromCover = false;
        Color.colorToHSV(cfg.accent, hsv);
        syncColorUi(true);
        renderPreview();
      }
    });

    // --- Penggeser persen (gaya Auralys: lintasan terisi + penunjuk berdiri) ---
    percent(root, "Kilau kaca", () -> cfg.glassShine, v -> cfg.glassShine = v);
    percent(root, "Tebal kaca", () -> cfg.glassThickness, v -> cfg.glassThickness = v);
    percent(root, "Kebulatan sudut", () -> cfg.roundness, v -> cfg.roundness = v);
    percent(root, "Frost (blur)", () -> cfg.frost, v -> cfg.frost = v);
    // Keburaman latar hanya berpengaruh di gaya non-kaca (Gelap / Terang / Warna sampul).
    percentRange(root, "Keburaman latar", 20, () -> cfg.opacity, v -> cfg.opacity = v);

    // --- Bentuk sampul ---
    section(root, "Bentuk sampul");
    chips(root, new String[] {"Bulat sudut", "Lingkaran", "Kotak"}, () -> cfg.coverShape, i -> cfg.coverShape = i);

    // --- Ukuran teks ---
    if (form.text) {
      section(root, "Ukuran teks");
      chips(root, new String[] {"Kecil", "Sedang", "Besar"}, () -> cfg.textSize, i -> cfg.textSize = i);
    }

    // --- Tombol putar ---
    section(root, "Tombol putar");
    chips(root, new String[] {"Bulat", "Polos"}, () -> cfg.playStyle, i -> cfg.playStyle = i);

    // --- Saklar ---
    LinearLayout switches = new LinearLayout(this);
    switches.setOrientation(LinearLayout.VERTICAL);
    LinearLayout.LayoutParams sLp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
    sLp.topMargin = dp(10);
    root.addView(switches, sLp);
    if (form != MusicVerseWidget.Form.TINY) toggle(switches, "Tampilkan sampul", () -> cfg.showCover, v -> cfg.showCover = v);
    if (form.progress) {
      toggle(switches, "Tampilkan bilah progres", () -> cfg.showProgress, v -> cfg.showProgress = v);
      toggle(switches, "Tampilkan waktu", () -> cfg.showTime, v -> cfg.showTime = v);
    }
    if (form.hasLyric()) toggle(switches, "Tampilkan lirik (baris yang sedang dinyanyikan)", () -> cfg.showLyrics, v -> cfg.showLyrics = v);
    if (form.like) toggle(switches, "Tampilkan tombol suka", () -> cfg.showLike, v -> cfg.showLike = v);
    if (form.controls) toggle(switches, "Tampilkan sebelumnya dan berikutnya", () -> cfg.showControls, v -> cfg.showControls = v);
    if (form.text) toggle(switches, "Tampilkan nama artis", () -> cfg.showArtist, v -> cfg.showArtist = v);

    setContentView(frame);
  }

  private static int indexOf(int[] arr, int value) {
    for (int i = 0; i < arr.length; i++) if (arr[i] == value) return i;
    return -1;
  }

  /** Judul bagian (Gaya, Warna aksen, ...). */
  private void section(LinearLayout parent, String title) {
    TextView t = text(title, 15, TEXT, true);
    t.setPadding(0, dp(12), 0, dp(6));
    parent.addView(t);
  }

  private void percent(LinearLayout parent, String name, IntSource source, IntSink sink) {
    percentRange(parent, name, 0, source, sink);
  }

  /** Penggeser 0..100 % sebaris: nama + nilai di kiri, penggeser di kanan. `min` = batas bawah nilai. */
  private void percentRange(LinearLayout parent, String name, int min, IntSource source, IntSink sink) {
    LinearLayout row = new LinearLayout(this);
    row.setOrientation(LinearLayout.HORIZONTAL);
    row.setGravity(Gravity.CENTER_VERTICAL);
    TextView label = text(name + " " + source.get() + "%", 13, TEXT, false);
    row.addView(label, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 0.9f));
    Slider s = new Slider(this);
    s.setFilled(UI_ACCENT, CARD_HI);
    s.setLabel(name);
    s.setValue((source.get() - min) / (float) (100 - min));
    s.setOnChange(v -> {
      int value = min + Math.round(v * (100 - min));
      sink.set(value);
      label.setText(name + " " + value + "%");
      renderPreview();
    });
    row.addView(s, new LinearLayout.LayoutParams(0, dp(34), 1.1f));
    parent.addView(row, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
  }

  private void saveAndFinish() {
    cfg.save(this, widgetId);
    MusicVerseWidget.refreshOne(this, widgetId);
    setResult(RESULT_OK, new Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId));
    finish();
  }

  private void renderPreview() {
    if (previewBox == null) return;
    previewBox.removeAllViews();
    try {
      RemoteViews views = MusicVerseWidget.build(this, MusicVerseWidget.previewModel(this), form, cfg);
      View v = views.apply(this, previewBox);
      FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(dp(form.previewW), dp(form.previewH));
      lp.gravity = Gravity.CENTER_HORIZONTAL;
      previewBox.addView(v, lp);
    } catch (RuntimeException e) {
      previewBox.addView(text("Pratinjau tidak tersedia", 14, TEXT_DIM, false));
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Warna
  // ---------------------------------------------------------------------------------------------

  /** Salah satu penggeser warna diseret: 0 rona, 1 saturasi, 2 kecerahan. */
  private void onHsvDragged(int which, float v) {
    if (settingSliders) return;
    if (which == 0) hsv[0] = v * 360f;
    else if (which == 1) hsv[1] = v;
    else hsv[2] = v;
    cfg.accent = 0xFF000000 | Color.HSVToColor(hsv);
    cfg.accentFromCover = false;
    syncColorUi(true);
    renderPreview();
  }

  /** Samakan penggeser, titik warna, kolom hex, dan swatch dengan aksen sekarang. `fromSlider` = jangan timpa penggeser yang sedang diseret. */
  private void syncColorUi(boolean skipSliderPositions) {
    settingSliders = true;
    int pureHue = Color.HSVToColor(new float[] {hsv[0], 1f, 1f});
    int satLo = Color.HSVToColor(new float[] {hsv[0], 0f, Math.max(hsv[2], 0.35f)});
    int satHi = Color.HSVToColor(new float[] {hsv[0], 1f, Math.max(hsv[2], 0.35f)});
    int valHi = Color.HSVToColor(new float[] {hsv[0], hsv[1], 1f});
    int accent = cfg.accent | 0xFF000000;
    hueSlider.setColors(0xFFFF0000, 0xFFFFFF00, 0xFF00FF00, 0xFF00FFFF, 0xFF0000FF, 0xFFFF00FF, 0xFFFF0000);
    hueSlider.setThumbColor(pureHue);
    satSlider.setColors(satLo, satHi);
    satSlider.setThumbColor(accent);
    valSlider.setColors(0xFF000000, valHi);
    valSlider.setThumbColor(accent);
    if (!skipSliderPositions) {
      hueSlider.setValue(hsv[0] / 360f);
      satSlider.setValue(hsv[1]);
      valSlider.setValue(hsv[2]);
    }
    settingSliders = false;
    GradientDrawable dot = new GradientDrawable();
    dot.setShape(GradientDrawable.OVAL);
    dot.setColor(accent);
    dot.setStroke(dp(2), 0x66FFFFFF);
    colorDot.setBackground(dot);
    if (!hexInput.hasFocus() || !skipSliderPositions) setHex(WidgetColors.toHex(accent));
    rebuildSwatches();
  }

  private void rebuildSwatches() {
    swatchRow.removeAllViews();
    // Dari sampul: aksen mengikuti warna lagu yang sedang diputar.
    TextView fromCover = chip("Dari sampul", cfg.accentFromCover);
    fromCover.setOnClickListener(v -> {
      cfg.accentFromCover = !cfg.accentFromCover;
      rebuildSwatches();
      renderPreview();
    });
    swatchRow.addView(fromCover, new ViewGroup.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, dp(34)));
    for (int color : SWATCHES) {
      boolean selected = !cfg.accentFromCover && (cfg.accent & 0xFFFFFF) == (color & 0xFFFFFF);
      View dot = new View(this);
      GradientDrawable d = new GradientDrawable();
      d.setShape(GradientDrawable.OVAL);
      d.setColor(color);
      d.setStroke(dp(selected ? 3 : 1), selected ? TEXT : 0x55FFFFFF);
      dot.setBackground(d);
      dot.setOnClickListener(v -> {
        cfg.accent = color;
        cfg.accentFromCover = false;
        Color.colorToHSV(color, hsv);
        syncColorUi(false);
        renderPreview();
      });
      swatchRow.addView(dot, new ViewGroup.LayoutParams(dp(32), dp(32)));
    }
    // Warna kustom: buka / lipat penggeser rona, saturasi, kecerahan dan kolom hex.
    boolean customOpen = customBox != null && customBox.getVisibility() == View.VISIBLE;
    TextView custom = chip("Warna kustom", customOpen);
    custom.setOnClickListener(v -> {
      customBox.setVisibility(customBox.getVisibility() == View.VISIBLE ? View.GONE : View.VISIBLE);
      rebuildSwatches();
    });
    swatchRow.addView(custom, new ViewGroup.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, dp(34)));
  }

  private void setHex(String hex) {
    settingHex = true;
    hexInput.setText(hex);
    settingHex = false;
  }

  // ---------------------------------------------------------------------------------------------
  // Komponen kecil
  // ---------------------------------------------------------------------------------------------

  private interface IntSource { int get(); }
  private interface IntSink { void set(int v); }
  private interface BoolSource { boolean get(); }
  private interface BoolSink { void set(boolean v); }

  private TextView label(LinearLayout parent, String s) {
    TextView t = text(s, 14, TEXT_DIM, false);
    t.setPadding(0, dp(10), 0, dp(8));
    parent.addView(t);
    return t;
  }

  private View sliderRow(String name, Slider slider) {
    LinearLayout row = new LinearLayout(this);
    row.setOrientation(LinearLayout.HORIZONTAL);
    row.setGravity(Gravity.CENTER_VERTICAL);
    TextView t = text(name, 12, TEXT_DIM, false);
    row.addView(t, new LinearLayout.LayoutParams(dp(72), ViewGroup.LayoutParams.WRAP_CONTENT));
    row.addView(slider, new LinearLayout.LayoutParams(0, dp(34), 1f));
    row.setPadding(0, dp(4), 0, 0);
    return row;
  }

  /** Chip pilihan tunggal; baris membungkus ke bawah (tanpa gulir samping yang bisa mencuri seretan). */
  private void chips(LinearLayout parent, String[] labels, IntSource source, IntSink sink) {
    FlowLayout row = new FlowLayout(this, dp(8), dp(8));
    parent.addView(row);
    Runnable refresh = () -> {
      row.removeAllViews();
      for (int i = 0; i < labels.length; i++) {
        final int index = i;
        TextView c = chip(labels[i], source.get() == i);
        c.setOnClickListener(v -> {
          sink.set(index);
          renderPreview();
          runRefreshers();
        });
        row.addView(c, new ViewGroup.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, dp(34)));
      }
    };
    refreshers.add(refresh);
    refresh.run();
  }

  private void runRefreshers() {
    for (Runnable r : refreshers) r.run();
  }

  private TextView chip(String label, boolean selected) {
    TextView c = text(label, 13, selected ? TEXT : TEXT_DIM, selected);
    c.setGravity(Gravity.CENTER);
    c.setPadding(dp(14), 0, dp(14), 0);
    GradientDrawable bg = new GradientDrawable();
    bg.setCornerRadius(dp(14));
    if (selected) {
      bg.setColor(CARD_HI);
    } else {
      bg.setColor(0x00000000);
      bg.setStroke(dp(1), 0xFF2B4034);
    }
    c.setBackground(bg);
    return c;
  }

  private void toggle(LinearLayout parent, String label, BoolSource source, BoolSink sink) {
    LinearLayout row = new LinearLayout(this);
    row.setOrientation(LinearLayout.HORIZONTAL);
    row.setGravity(Gravity.CENTER_VERTICAL);
    TextView t = text(label, 14, TEXT, false);
    row.addView(t, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
    Switch sw = new Switch(this);
    sw.setChecked(source.get());
    if (Build.VERSION.SDK_INT >= 23) {
      sw.setThumbTintList(new ColorStateList(
          new int[][] {new int[] {android.R.attr.state_checked}, new int[] {}},
          new int[] {0xFFFFFFFF, 0xFFB0B4BC}));
      sw.setTrackTintList(new ColorStateList(
          new int[][] {new int[] {android.R.attr.state_checked}, new int[] {}},
          new int[] {UI_ACCENT, 0xFF2B4034}));
    }
    sw.setOnCheckedChangeListener((b, checked) -> {
      sink.set(checked);
      renderPreview();
    });
    row.addView(sw);
    row.setPadding(0, dp(2), 0, dp(2));
    row.setMinimumHeight(dp(40));
    row.setOnClickListener(v -> sw.toggle());
    parent.addView(row);
  }

  private TextView button(String label, boolean primary) {
    TextView b = text(label, 15, primary ? WidgetColors.onColor(UI_ACCENT) : TEXT, true);
    b.setGravity(Gravity.CENTER);
    b.setBackground(round(primary ? UI_ACCENT : CARD_HI, 22));
    return b;
  }

  private GradientDrawable round(int color, int radiusDp) {
    GradientDrawable d = new GradientDrawable();
    d.setCornerRadius(dp(radiusDp));
    d.setColor(color);
    return d;
  }

  private TextView text(String s, int sp, int color, boolean bold) {
    TextView t = new TextView(this);
    t.setText(s);
    t.setTextSize(sp);
    t.setTextColor(color);
    if (bold) t.setTypeface(Typeface.DEFAULT_BOLD);
    return t;
  }

  private int dp(int v) {
    return Math.round(v * getResources().getDisplayMetrics().density);
  }

  // ---------------------------------------------------------------------------------------------
  // Penggeser (bisa diseret) dan tata letak pembungkus
  // ---------------------------------------------------------------------------------------------

  /**
   * Penggeser horizontal bernilai 0..1 dengan lintasan gradien. Menyentuh mana pun pada lintasan memindahkan penunjuk, dan seretan
   * tidak dicuri ScrollView (requestDisallowInterceptTouchEvent) sehingga warna benar-benar bisa digeser.
   */
  static final class Slider extends View {
    interface OnChange { void onChange(float value); }

    private final Paint trackPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint thumbPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint ringPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final RectF rect = new RectF();
    private final float density;
    private int[] colors = {0xFF000000, 0xFFFFFFFF};
    private int thumbColor = 0xFFFFFFFF;
    private float value;
    private boolean shaderDirty = true;
    private OnChange listener;
    /** Mode terisi gaya Auralys: lintasan gelap, bagian kiri terisi warna, penunjuk berupa garis berdiri. */
    private boolean filled;
    private int fillColor;
    private int emptyColor;

    Slider(Context c) {
      super(c);
      density = c.getResources().getDisplayMetrics().density;
      ringPaint.setStyle(Paint.Style.STROKE);
      ringPaint.setStrokeWidth(3f * density);
      ringPaint.setColor(0xFFFFFFFF);
      setContentDescription("Penggeser");
    }

    void setLabel(String name) {
      setContentDescription(name);
    }

    void setColors(int... c) {
      colors = c;
      shaderDirty = true;
      invalidate();
    }

    void setFilled(int fill, int empty) {
      filled = true;
      fillColor = fill;
      emptyColor = empty;
      invalidate();
    }

    void setThumbColor(int c) {
      thumbColor = c;
      invalidate();
    }

    void setValue(float v) {
      value = v < 0f ? 0f : Math.min(v, 1f);
      invalidate();
    }

    void setOnChange(OnChange l) {
      listener = l;
    }

    private float pad() {
      return 14f * density;
    }

    @Override
    protected void onSizeChanged(int w, int h, int oldw, int oldh) {
      shaderDirty = true;
    }

    @Override
    protected void onDraw(Canvas canvas) {
      float w = getWidth();
      float h = getHeight();
      float left = pad();
      float right = w - pad();
      if (right <= left) return;
      if (filled) {
        float th = 16f * density;
        float cy = h / 2f;
        float x = left + value * (right - left);
        float gap = 6f * density;
        trackPaint.setShader(null);
        trackPaint.setColor(fillColor);
        rect.set(left, cy - th / 2f, Math.max(left + th, x - gap), cy + th / 2f);
        canvas.drawRoundRect(rect, th / 2f, th / 2f, trackPaint);
        trackPaint.setColor(emptyColor);
        rect.set(Math.min(right - th, x + gap), cy - th / 2f, right, cy + th / 2f);
        canvas.drawRoundRect(rect, th / 2f, th / 2f, trackPaint);
        thumbPaint.setColor(fillColor);
        rect.set(x - 2f * density, cy - 14f * density, x + 2f * density, cy + 14f * density);
        canvas.drawRoundRect(rect, 2f * density, 2f * density, thumbPaint);
        return;
      }
      if (shaderDirty) {
        trackPaint.setShader(new LinearGradient(left, 0, right, 0, colors, null, Shader.TileMode.CLAMP));
        shaderDirty = false;
      }
      float th = 14f * density;
      rect.set(left, h / 2f - th / 2f, right, h / 2f + th / 2f);
      canvas.drawRoundRect(rect, th / 2f, th / 2f, trackPaint);
      float x = left + value * (right - left);
      float r = 12f * density;
      thumbPaint.setColor(thumbColor);
      canvas.drawCircle(x, h / 2f, r, thumbPaint);
      canvas.drawCircle(x, h / 2f, r, ringPaint);
    }

    @Override
    public boolean onTouchEvent(MotionEvent e) {
      switch (e.getActionMasked()) {
        case MotionEvent.ACTION_DOWN:
          if (getParent() != null) getParent().requestDisallowInterceptTouchEvent(true);
          update(e.getX());
          return true;
        case MotionEvent.ACTION_MOVE:
          update(e.getX());
          return true;
        case MotionEvent.ACTION_UP:
        case MotionEvent.ACTION_CANCEL:
          if (getParent() != null) getParent().requestDisallowInterceptTouchEvent(false);
          return true;
        default:
          return super.onTouchEvent(e);
      }
    }

    private void update(float x) {
      float left = pad();
      float right = getWidth() - pad();
      if (right <= left) return;
      float v = (x - left) / (right - left);
      value = v < 0f ? 0f : Math.min(v, 1f);
      invalidate();
      if (listener != null) listener.onChange(value);
    }
  }

  /** Tata letak sederhana yang membungkus anak ke baris berikutnya bila tidak muat. */
  static final class FlowLayout extends ViewGroup {
    private final int gapX;
    private final int gapY;

    FlowLayout(Context c, int gapX, int gapY) {
      super(c);
      this.gapX = gapX;
      this.gapY = gapY;
    }

    @Override
    protected void onMeasure(int widthSpec, int heightSpec) {
      int maxW = MeasureSpec.getSize(widthSpec) - getPaddingLeft() - getPaddingRight();
      int x = 0;
      int y = 0;
      int rowH = 0;
      int usedW = 0;
      for (int i = 0; i < getChildCount(); i++) {
        View ch = getChildAt(i);
        if (ch.getVisibility() == GONE) continue;
        measureChild(ch, MeasureSpec.makeMeasureSpec(maxW, MeasureSpec.AT_MOST), MeasureSpec.UNSPECIFIED);
        int cw = ch.getMeasuredWidth();
        int chh = ch.getMeasuredHeight();
        if (x > 0 && x + cw > maxW) {
          x = 0;
          y += rowH + gapY;
          rowH = 0;
        }
        x += cw + gapX;
        rowH = Math.max(rowH, chh);
        usedW = Math.max(usedW, x - gapX);
      }
      int h = y + rowH + getPaddingTop() + getPaddingBottom();
      setMeasuredDimension(resolveSize(usedW + getPaddingLeft() + getPaddingRight(), widthSpec), resolveSize(h, heightSpec));
    }

    @Override
    protected void onLayout(boolean changed, int l, int t, int r, int b) {
      int maxW = r - l - getPaddingLeft() - getPaddingRight();
      int x = 0;
      int y = 0;
      int rowH = 0;
      for (int i = 0; i < getChildCount(); i++) {
        View ch = getChildAt(i);
        if (ch.getVisibility() == GONE) continue;
        int cw = ch.getMeasuredWidth();
        int chh = ch.getMeasuredHeight();
        if (x > 0 && x + cw > maxW) {
          x = 0;
          y += rowH + gapY;
          rowH = 0;
        }
        int left = getPaddingLeft() + x;
        int top = getPaddingTop() + y;
        ch.layout(left, top, left + cw, top + chh);
        x += cw + gapX;
        rowH = Math.max(rowH, chh);
      }
    }
  }
}
