package __APP_ID__;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.content.Intent;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.text.Editable;
import android.text.InputType;
import android.text.TextWatcher;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.RemoteViews;
import android.widget.ScrollView;
import android.widget.SeekBar;
import android.widget.TextView;

import java.util.ArrayList;
import java.util.List;

/**
 * Layar pengaturan widget (dibuka saat widget ditambahkan, dan lewat tekan-lama > Atur ulang). Seluruh tampilan dibangun lewat
 * kode (tanpa layout XML / AppCompat) dan pratinjaunya memakai RemoteViews yang sama dengan widget asli, jadi yang terlihat di sini
 * = yang tampil di layar utama.
 */
public class MusicVerseWidgetConfigActivity extends Activity {
  private static final int BG = 0xFF121212;
  private static final int CARD = 0xFF1E1E1E;
  private static final int TEXT = 0xFFFFFFFF;
  private static final int TEXT_DIM = 0xFFA0A0A0;
  private static final int[] SWATCHES = {
    0xFF1DB954, 0xFF2196F3, 0xFF7C4DFF, 0xFFE91E63, 0xFFFF5722, 0xFFFFC107, 0xFF00BCD4, 0xFFFFFFFF,
  };

  private int widgetId = AppWidgetManager.INVALID_APPWIDGET_ID;
  private MusicVerseWidget.Form form = MusicVerseWidget.Form.STANDARD;
  private MusicVerseWidgetConfig cfg;
  private FrameLayout previewBox;
  private LinearLayout swatchRow;
  private EditText hexInput;
  private TextView opacityLabel;
  private boolean settingHex;
  /** Penyegar chip/swatch yang dipanggil tiap pengaturan berubah. */
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
    setResult(RESULT_CANCELED, new Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId));
    buildUi();
    renderPreview();
  }

  // ---------------------------------------------------------------------------------------------
  // UI
  // ---------------------------------------------------------------------------------------------

  private void buildUi() {
    ScrollView scroll = new ScrollView(this);
    scroll.setBackgroundColor(BG);
    scroll.setFillViewport(true);
    LinearLayout root = new LinearLayout(this);
    root.setOrientation(LinearLayout.VERTICAL);
    root.setPadding(dp(16), dp(16), dp(16), dp(24));
    scroll.addView(root, new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
    // Layar penuh sampai ke bawah status bar / bilah navigasi (Android 15+): sisihkan ruangnya.
    scroll.setOnApplyWindowInsetsListener((v, insets) -> {
      v.setPadding(0, insets.getSystemWindowInsetTop(), 0, insets.getSystemWindowInsetBottom());
      return insets;
    });

    TextView title = text("Atur widget", 22, TEXT, true);
    root.addView(title);
    TextView sub = text("MusicVerse · " + form.label, 13, TEXT_DIM, false);
    sub.setPadding(0, dp(2), 0, dp(14));
    root.addView(sub);

    // Pratinjau di atas "wallpaper" abu-abu agar kaca/transparan terlihat.
    previewBox = new FrameLayout(this);
    GradientDrawable wall = new GradientDrawable(GradientDrawable.Orientation.TL_BR, new int[] {0xFF3A4A5C, 0xFF5C3A56});
    wall.setCornerRadius(dp(16));
    previewBox.setBackground(wall);
    previewBox.setPadding(dp(16), dp(16), dp(16), dp(16));
    root.addView(previewBox, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

    section(root, "Tema");
    chips(root, new String[] {"Gelap", "Terang", "Kaca", "Warna sampul", "Warna aksen"}, () -> cfg.theme, i -> cfg.theme = i);

    section(root, "Warna aksen");
    swatchRow = new LinearLayout(this);
    swatchRow.setOrientation(LinearLayout.HORIZONTAL);
    swatchRow.setGravity(Gravity.CENTER_VERTICAL);
    root.addView(swatchRow);
    rebuildSwatches();
    LinearLayout hexRow = new LinearLayout(this);
    hexRow.setOrientation(LinearLayout.HORIZONTAL);
    hexRow.setGravity(Gravity.CENTER_VERTICAL);
    hexRow.setPadding(0, dp(10), 0, 0);
    hexRow.addView(text("Warna sendiri", 13, TEXT_DIM, false));
    hexInput = new EditText(this);
    hexInput.setTextColor(TEXT);
    hexInput.setHintTextColor(TEXT_DIM);
    hexInput.setHint("#1DB954");
    hexInput.setSingleLine(true);
    hexInput.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_CHARACTERS | InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD);
    hexInput.setTextSize(15);
    hexInput.setText(WidgetColors.toHex(cfg.accent));
    LinearLayout.LayoutParams hexLp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
    hexLp.setMarginStart(dp(12));
    hexRow.addView(hexInput, hexLp);
    root.addView(hexRow);
    hexInput.addTextChangedListener(new TextWatcher() {
      @Override public void beforeTextChanged(CharSequence s, int a, int b, int c) {}
      @Override public void onTextChanged(CharSequence s, int a, int b, int c) {}
      @Override public void afterTextChanged(Editable s) {
        if (settingHex) return;
        Integer color = WidgetColors.parseHex(s.toString());
        if (color == null) return;
        cfg.accent = color;
        cfg.accentFromCover = false;
        rebuildSwatches();
        renderPreview();
        runRefreshers();
      }
    });

    section(root, "Sudut widget");
    chips(root, new String[] {"Kotak", "Bulat", "Pil"}, () -> cfg.corner, i -> cfg.corner = i);

    section(root, "Bentuk sampul");
    chips(root, new String[] {"Bulat sudut", "Lingkaran", "Kotak"}, () -> cfg.coverShape, i -> cfg.coverShape = i);

    section(root, "Tombol putar");
    chips(root, new String[] {"Terisi", "Polos"}, () -> cfg.playStyle, i -> cfg.playStyle = i);

    if (form.text) {
      section(root, "Ukuran teks");
      chips(root, new String[] {"Kecil", "Sedang", "Besar"}, () -> cfg.textSize, i -> cfg.textSize = i);
    }

    section(root, "Keburaman latar");
    opacityLabel = text("", 13, TEXT_DIM, false);
    root.addView(opacityLabel);
    SeekBar seek = new SeekBar(this);
    seek.setMax(80); // 20..100
    seek.setProgress(cfg.opacity - 20);
    updateOpacityLabel();
    seek.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
      @Override public void onProgressChanged(SeekBar s, int progress, boolean fromUser) {
        cfg.opacity = 20 + progress;
        updateOpacityLabel();
        renderPreview();
      }
      @Override public void onStartTrackingTouch(SeekBar s) {}
      @Override public void onStopTrackingTouch(SeekBar s) {}
    });
    root.addView(seek);

    section(root, "Tampilkan");
    if (form != MusicVerseWidget.Form.TINY) toggle(root, "Sampul", () -> cfg.showCover, v -> cfg.showCover = v);
    if (form.text) toggle(root, "Nama artis", () -> cfg.showArtist, v -> cfg.showArtist = v);
    if (form.controls) toggle(root, "Tombol Sebelumnya / Berikutnya", () -> cfg.showControls, v -> cfg.showControls = v);

    LinearLayout buttons = new LinearLayout(this);
    buttons.setOrientation(LinearLayout.HORIZONTAL);
    buttons.setPadding(0, dp(24), 0, 0);
    TextView cancel = button("Batal", false);
    cancel.setOnClickListener(v -> finish());
    TextView save = button("Simpan", true);
    save.setOnClickListener(v -> saveAndFinish());
    LinearLayout.LayoutParams half = new LinearLayout.LayoutParams(0, dp(48), 1f);
    half.setMarginEnd(dp(8));
    buttons.addView(cancel, half);
    LinearLayout.LayoutParams half2 = new LinearLayout.LayoutParams(0, dp(48), 1f);
    half2.setMarginStart(dp(8));
    buttons.addView(save, half2);
    root.addView(buttons);

    setContentView(scroll);
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
      previewBox.addView(text("Pratinjau tidak tersedia", 13, TEXT_DIM, false));
    }
  }

  private void updateOpacityLabel() {
    opacityLabel.setText(cfg.opacity + "%");
  }

  private void rebuildSwatches() {
    swatchRow.removeAllViews();
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
        setHex(WidgetColors.toHex(color));
        rebuildSwatches();
        renderPreview();
      });
      LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(dp(34), dp(34));
      lp.setMarginEnd(dp(10));
      swatchRow.addView(dot, lp);
    }
    // Dari sampul: aksen mengikuti warna lagu yang sedang diputar.
    TextView fromCover = chip("Dari sampul", cfg.accentFromCover);
    fromCover.setOnClickListener(v -> {
      cfg.accentFromCover = !cfg.accentFromCover;
      rebuildSwatches();
      renderPreview();
    });
    swatchRow.addView(fromCover);
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

  private void section(LinearLayout parent, String label) {
    TextView t = text(label, 13, TEXT_DIM, true);
    t.setAllCaps(true);
    t.setLetterSpacing(0.06f);
    t.setPadding(0, dp(20), 0, dp(8));
    parent.addView(t);
  }

  /** Baris chip pilihan tunggal. Chip yang dipilih diisi aksen. */
  private void chips(LinearLayout parent, String[] labels, IntSource source, IntSink sink) {
    LinearLayout row = new LinearLayout(this);
    row.setOrientation(LinearLayout.HORIZONTAL);
    android.widget.HorizontalScrollView hs = new android.widget.HorizontalScrollView(this);
    hs.setHorizontalScrollBarEnabled(false);
    hs.addView(row);
    parent.addView(hs);
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
        row.addView(c);
      }
    };
    refreshers.add(refresh);
    refresh.run();
  }

  private void runRefreshers() {
    for (Runnable r : refreshers) r.run();
  }

  private TextView chip(String label, boolean selected) {
    TextView c = text(label, 14, selected ? 0xFF000000 : TEXT, false);
    c.setGravity(Gravity.CENTER);
    c.setPadding(dp(14), dp(8), dp(14), dp(8));
    GradientDrawable d = new GradientDrawable();
    d.setCornerRadius(dp(18));
    d.setColor(selected ? 0xFF1DB954 : CARD);
    c.setBackground(d);
    LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
    lp.setMarginEnd(dp(8));
    c.setLayoutParams(lp);
    return c;
  }

  private void toggle(LinearLayout parent, String label, BoolSource source, BoolSink sink) {
    CheckBox box = new CheckBox(this);
    box.setText(label);
    box.setTextColor(TEXT);
    box.setTextSize(15);
    box.setChecked(source.get());
    box.setOnCheckedChangeListener((b, checked) -> {
      sink.set(checked);
      renderPreview();
    });
    parent.addView(box);
  }

  private TextView button(String label, boolean primary) {
    TextView b = text(label, 15, primary ? 0xFF000000 : TEXT, true);
    b.setGravity(Gravity.CENTER);
    GradientDrawable d = new GradientDrawable();
    d.setCornerRadius(dp(24));
    d.setColor(primary ? 0xFF1DB954 : CARD);
    b.setBackground(d);
    return b;
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
}
