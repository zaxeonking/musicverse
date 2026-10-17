package __APP_ID__;

import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    // Plugin lokal harus didaftarkan SEBELUM super.onCreate().
    registerPlugin(MusicVerseNativePlugin.class);
    super.onCreate(savedInstanceState);
  }

  @Override
  public void onPause() {
    super.onPause();
    // Pemutaran ada di WebView. Pastikan timer/JS WebView tidak ikut dibekukan saat layar mati atau
    // app pindah ke latar belakang (event 'ended' dan pergantian lagu bergantung pada JS yang tetap jalan).
    if (getBridge() != null) {
      WebView webView = getBridge().getWebView();
      if (webView != null) webView.resumeTimers();
    }
  }
}
