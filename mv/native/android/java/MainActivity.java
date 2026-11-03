package __APP_ID__;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  /** Selama activity tidak terlihat, timer WebView didorong tetap jalan tiap sekian ms (antrean unduhan, putar-ulang otomatis, pergantian lagu). */
  private static final long KEEPALIVE_MS = 5000L;
  private final Handler keepAliveHandler = new Handler(Looper.getMainLooper());
  private boolean inBackground = false;
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
    if (getBridge() != null) {
      WebView webView = getBridge().getWebView();
      // Jaga proses renderer WebView tetap berprioritas tinggi walau tidak terlihat; kalau diturunkan,
      // JS (unduhan, lirik, putar-ulang otomatis) diperlambat/dibekukan saat layar mati.
      if (webView != null && android.os.Build.VERSION.SDK_INT >= 26) {
        webView.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, false);
      }
    }
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
    inBackground = false;
    keepAliveHandler.removeCallbacks(keepAlive);
  }

  @Override
  public void onDestroy() {
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
