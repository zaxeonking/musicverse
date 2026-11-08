package __APP_ID__;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ComponentName;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.widget.FrameLayout;
import android.widget.ImageView;

/**
 * Pembuka-ulang aplikasi sesudah ikon diganti. Berjalan di proses TERSENDIRI (android:process=":relaunch"), jadi tetap hidup
 * walau ROM menutup proses utama saat pintu peluncur (activity-alias) berganti. Activity ini dibuka SAAT aplikasi masih di depan,
 * sehingga sistem mengizinkannya (activity terlihat = latar depan); dari sinilah aplikasi dibuka lagi lewat ikon baru, tanpa
 * bergantung pada izin "buka dari latar belakang" milik ROM. Menutup dirinya sendiri begitu selesai.
 *
 * Tampilannya BUKAN transparan: layar penuh berlatar warna tema + ikon aplikasi, memudar masuk. Dulu transparan, jadi saat proses
 * utama ditutup ROM pengguna melihat layar utama (terasa "keluar aplikasi"); kini terlihat seperti aplikasi dimulai ulang.
 */
public class RelaunchActivity extends Activity {
  static final String EXTRA_ICON = "icon_id";
  /** Alias baru dinyalakan ±250 ms setelah activity ini dibuka; tunggu sampai sistem selesai mengurus perubahan itu. */
  private static final long FIRST_DELAY_MS = 1100L;
  private static final long RETRY_MS = 400L;
  private static final int MAX_TRIES = 6;
  private final Handler handler = new Handler(Looper.getMainLooper());
  private String iconId;
  private int tries = 0;

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    iconId = getIntent() != null ? getIntent().getStringExtra(EXTRA_ICON) : null;
    showRestartScreen();
    handler.postDelayed(this::launch, FIRST_DELAY_MS);
  }

  /** Layar "memulai ulang": latar sama dengan latar jendela MainActivity (tanpa kedipan) dan ikon aplikasi di tengah. */
  private void showRestartScreen() {
    int bg = getSharedPreferences(MainActivity.APPEARANCE_PREFS, MODE_PRIVATE).getInt(MainActivity.PREF_BG, 0xFF121212);
    getWindow().setBackgroundDrawable(new android.graphics.drawable.ColorDrawable(bg));
    getWindow().setStatusBarColor(bg);
    getWindow().setNavigationBarColor(bg);
    FrameLayout root = new FrameLayout(this);
    root.setBackgroundColor(bg);
    try {
      ImageView logo = new ImageView(this);
      logo.setImageDrawable(getPackageManager().getApplicationIcon(getPackageName()));
      int size = Math.round(96 * getResources().getDisplayMetrics().density);
      root.addView(logo, new FrameLayout.LayoutParams(size, size, Gravity.CENTER));
      logo.setAlpha(0f);
      logo.animate().alpha(1f).setDuration(220L).start();
    } catch (android.content.pm.PackageManager.NameNotFoundException | RuntimeException ignored) {
      // Tanpa ikon: layar polos berlatar tema tetap menutupi layar utama.
    }
    setContentView(root);
  }

  private void launch() {
    tries++;
    try {
      Intent intent;
      if (iconId != null && tries <= MAX_TRIES - 2) {
        intent = new Intent(Intent.ACTION_MAIN)
            .addCategory(Intent.CATEGORY_LAUNCHER)
            .setComponent(new ComponentName(this, "__APP_ID__.MvIcon_" + iconId));
      } else {
        intent = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (intent == null) {
          finish();
          return;
        }
      }
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED);
      startActivity(intent);
      finish();
      overridePendingTransition(0, 0);
    } catch (ActivityNotFoundException | SecurityException e) {
      // Alias baru belum aktif di sistem: coba lagi sebentar; menjelang habis percobaan pakai intent peluncur bawaan.
      if (tries < MAX_TRIES) handler.postDelayed(this::launch, RETRY_MS);
      else finish();
    }
  }

  @Override
  public void onBackPressed() {
    // Diabaikan: activity ini hanya perantara sekejap.
  }

  @Override
  protected void onDestroy() {
    handler.removeCallbacksAndMessages(null);
    super.onDestroy();
  }
}
