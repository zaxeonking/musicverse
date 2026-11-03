package __APP_ID__;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;

/**
 * Pembantu jaringan native yang dipakai bersama StreamProxy (pemutaran) dan NativeDownloader (unduhan).
 * Tujuannya satu: saat sinyal putus sebentar, kedua pihak MENUNGGU jaringan kembali lalu melanjutkan dari byte terakhir,
 * bukan menyerah dan membuang hasil kerja (pola yang sama dengan pengunduh native StreamBeats).
 */
final class NetWatch {
  private static volatile ConnectivityManager connectivity;

  private NetWatch() {}

  static void attach(Context context) {
    if (context == null) return;
    try {
      connectivity = (ConnectivityManager) context.getApplicationContext().getSystemService(Context.CONNECTIVITY_SERVICE);
    } catch (RuntimeException ignored) {
      connectivity = null;
    }
  }

  /** True bila ada jaringan aktif berinternet. Tidak bisa dibaca = dianggap online (jangan sampai menahan unduhan tanpa alasan). */
  static boolean isOnline() {
    ConnectivityManager cm = connectivity;
    if (cm == null) return true;
    try {
      Network network = cm.getActiveNetwork();
      if (network == null) return false;
      NetworkCapabilities caps = cm.getNetworkCapabilities(network);
      return caps != null && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
    } catch (RuntimeException e) {
      return true;
    }
  }

  /** Menunggu sampai online (polling 500 ms) paling lama maxMs. True bila sudah online. */
  static boolean waitForNetwork(long maxMs) {
    long end = System.currentTimeMillis() + maxMs;
    while (!isOnline()) {
      if (System.currentTimeMillis() >= end) return false;
      if (!sleep(500)) return false;
    }
    return true;
  }

  /** Jeda coba-ulang yang naik bertahap (maks. 5 dtk). False bila thread diinterupsi. */
  static boolean backoff(int attempt) {
    return sleep(Math.min(5000L, 500L * Math.max(1, attempt)));
  }

  static boolean sleep(long ms) {
    try {
      Thread.sleep(ms);
      return true;
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      return false;
    }
  }
}
