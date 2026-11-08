package __APP_ID__;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  /** Warna latar tema terakhir (ditulis MusicVerseNativePlugin.setAppearance), dipakai sejak frame pertama pada pembukaan berikutnya. */
  static final String APPEARANCE_PREFS = "musicverse_appearance";
  static final String PREF_BG = "bg";
  /** Selama activity tidak terlihat, timer WebView didorong tetap jalan tiap sekian ms (antrean unduhan, putar-ulang otomatis, pergantian lagu). */
  private static final long KEEPALIVE_MS = 5000L;
  private final Handler keepAliveHandler = new Handler(Looper.getMainLooper());
  private boolean inBackground = false;
  /** True selama activity di layar (onResume..onPause). Dipakai plugin: buka-ulang otomatis sesudah ganti ikon hanya bila aplikasi sedang dilihat. */
  static volatile boolean foreground = false;
  private final Runnable keepAlive = new Runnable() {
    @Override public void run() {
      if (!inBackground) return;
      resumeWebViewTimers();
      keepAliveHandler.postDelayed(this, KEEPALIVE_MS);
    }
  };

  @Override
  public void onCreate(Bundle savedInstanceState) {
    // Plugin lokal harus didaftarkan SEBELUM super.onCreate().
    registerPlugin(MusicVerseNativePlugin.class);
    super.onCreate(savedInstanceState);
    applyThemeBackground();
    enableEdgeToEdge();
    // Hanya saat benar-benar dibuka dari widget (bukan dibuat ulang karena rotasi layar).
    if (savedInstanceState == null) handleWidgetPlay(getIntent());
    if (getBridge() != null) {
      WebView webView = getBridge().getWebView();
      // Jaga proses renderer WebView tetap berprioritas tinggi walau tidak terlihat; kalau diturunkan,
      // JS (unduhan, lirik, putar-ulang otomatis) diperlambat/dibekukan saat layar mati.
      if (webView != null && android.os.Build.VERSION.SDK_INT >= 26) {
        webView.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, false);
      }
    }
  }


  /**
   * Layar penuh sampai ke area poni/kamera: jendela tidak menyisakan ruang untuk status bar dan navigation bar (keduanya
   * transparan), WebView tanpa margin, dan ukuran inset dikirim ke CSS (--sat/--sab/--sal/--sar, dalam px CSS) supaya
   * header dan mini player tetap tidak tertutup walau env(safe-area-inset-*) WebView bernilai 0.
   */
  private void enableEdgeToEdge() {
    android.view.Window window = getWindow();
    WindowCompat.setDecorFitsSystemWindows(window, false);
    window.setStatusBarColor(android.graphics.Color.TRANSPARENT);
    window.setNavigationBarColor(android.graphics.Color.TRANSPARENT);
    if (android.os.Build.VERSION.SDK_INT >= 29) {
      window.setNavigationBarContrastEnforced(false);
      window.setStatusBarContrastEnforced(false);
    }
    if (android.os.Build.VERSION.SDK_INT >= 28) {
      window.getAttributes().layoutInDisplayCutoutMode = android.view.WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
    }
    if (getBridge() == null || getBridge().getWebView() == null) return;
    final WebView webView = getBridge().getWebView();
    final View host = (View) webView.getParent();
    ViewCompat.setOnApplyWindowInsetsListener(host, (v, insets) -> {
      ViewGroup.LayoutParams lp = webView.getLayoutParams();
      if (lp instanceof ViewGroup.MarginLayoutParams) {
        ((ViewGroup.MarginLayoutParams) lp).setMargins(0, 0, 0, 0);
        webView.setLayoutParams(lp);
      }
      Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
      boolean keyboard = insets.isVisible(WindowInsetsCompat.Type.ime());
      float d = getResources().getDisplayMetrics().density;
      final String js = "(function(){var s=document.documentElement.style;"
          + "s.setProperty('--sat','" + Math.round(bars.top / d) + "px');"
          + "s.setProperty('--sab','" + (keyboard ? 0 : Math.round(bars.bottom / d)) + "px');"
          + "s.setProperty('--sal','" + Math.round(bars.left / d) + "px');"
          + "s.setProperty('--sar','" + Math.round(bars.right / d) + "px');})()";
      webView.post(() -> webView.evaluateJavascript(js, null));
      return WindowInsetsCompat.CONSUMED;
    });
    ViewCompat.requestApplyInsets(host);
    // Halaman dimuat ulang (OTA / reload): kirim ulang nilai inset.
    webView.addOnLayoutChangeListener((v, l, t, r, b, ol, ot, or, ob) -> ViewCompat.requestApplyInsets(host));
  }

  /** Latar jendela + WebView mengikuti tema, supaya tema terang tidak diawali kedipan #121212 sebelum halaman tergambar. */
  private void applyThemeBackground() {
    android.content.SharedPreferences prefs = getSharedPreferences(APPEARANCE_PREFS, MODE_PRIVATE);
    if (!prefs.contains(PREF_BG)) return;
    int color = prefs.getInt(PREF_BG, 0xFF121212);
    getWindow().setBackgroundDrawable(new android.graphics.drawable.ColorDrawable(color));
    if (getBridge() != null && getBridge().getWebView() != null) getBridge().getWebView().setBackgroundColor(color);
  }

  @Override
  protected void onNewIntent(android.content.Intent intent) {
    super.onNewIntent(intent);
    handleWidgetPlay(intent);
  }

  /**
   * Tombol Putar di widget saat aplikasi sudah tertutup: simpan permintaan "lanjut memutar". JS mengambilnya begitu siap
   * (atau langsung bila sudah hidup), mengambil tautan audio baru, lalu memutar dari posisi terakhir.
   */
  private void handleWidgetPlay(android.content.Intent intent) {
    if (intent == null || !intent.getBooleanExtra(MusicVerseWidget.EXTRA_PLAY, false)) return;
    intent.removeExtra(MusicVerseWidget.EXTRA_PLAY); // sekali pakai
    AutoBridge.requestQuiet(getApplicationContext(), "resume");
  }

  private void resumeWebViewTimers() {
    // Pemutaran dan unduhan ada di WebView. Pastikan timer/JS WebView tidak ikut dibekukan saat layar mati atau
    // app pindah ke latar belakang (event 'ended', pergantian lagu, dan antrean unduhan bergantung pada JS yang tetap jalan).
    if (getBridge() != null) {
      WebView webView = getBridge().getWebView();
      if (webView != null) webView.resumeTimers();
    }
  }

  private void startKeepAlive() {
    inBackground = true;
    keepAliveHandler.removeCallbacks(keepAlive);
    keepAliveHandler.post(keepAlive);
  }

  @Override
  public void onPause() {
    super.onPause();
    foreground = false;
    resumeWebViewTimers();
    startKeepAlive();
  }

  @Override
  public void onStop() {
    super.onStop();
    resumeWebViewTimers();
    startKeepAlive();
  }

  @Override
  public void onResume() {
    super.onResume();
    foreground = true;
    inBackground = false;
    keepAliveHandler.removeCallbacks(keepAlive);
  }

  @Override
  public void onDestroy() {
    foreground = false;
    inBackground = false;
    keepAliveHandler.removeCallbacksAndMessages(null);
    // Activity benar-benar ditutup (tombol back sampai keluar, finish(), dsb.; bukan sekadar rotasi layar):
    // WebView ikut hancur sehingga audio dan antrean unduhan berhenti, jadi notifikasinya tidak boleh tertinggal.
    if (isFinishing()) {
      PlaybackService.stop(getApplicationContext());
      DownloadService.stop(getApplicationContext());
    }
    super.onDestroy();
  }
}
