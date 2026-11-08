# 0.5.51.7 (layar penuh sampai kamera, glow pemutar mini lebih lembut, buka-ulang ikon lebih andal)

Files: native/android/java/{MainActivity,MusicVerseNativePlugin}.java, src/components/player/MiniPlayer.tsx, src/index.css,
semua komponen yang memakai safe-area (BottomNav, MobileHeader, AppShell, FullPlayer, LyricsPanel, QueuePanel, sheet-sheet menu, TrackMenuContext, dst.),
src/tour/steps.ts (entri Yang baru 0.5.51.7), src/native/musicVerseNative.ts (komentar), package.json (appVersion 0.5.51.7), CHANGES.md (0.5.51.5 diarsipkan), PROJECT_STRUCTURE.md

1. Layar penuh sampai area kamera (APK baru)
   - Penyebab: WebView berada di bawah status bar, jadi strip paling atas hanya latar jendela. `MainActivity.enableEdgeToEdge()`: jendela tidak menyisakan
     ruang untuk bar sistem (`setDecorFitsSystemWindows(false)`), status bar dan navigation bar transparan, mode poni `shortEdges`, margin WebView dihapus.
   - Tinggi inset dikirim native ke CSS sebagai `--sat/--sab/--sal/--sar` (px CSS; `--sab` = 0 saat keyboard terbuka). `index.css` memberi nilai awal dari
     `env(safe-area-inset-*)` (cadangan web/iOS). Semua pemakaian `env(safe-area-inset-*)` di src diganti `var(--sat|--sab|--sal|--sar)`.
2. Cahaya latar pemutar mini
   - Dulu `box-shadow` setipis tepi kartu (tampak seperti garis keras). Kini lapisan warna sampul yang di-blur 20 px, menyebar ke atas dan samping; sisi bawah
     ditarik ke dalam supaya tidak menyentuh navbar. Aturan tema terang di `index.css` ikut disesuaikan (`blur(20px) saturate(0.8)`).
3. Buka-ulang otomatis sesudah ganti ikon lebih andal
   - Tanpa izin alarm tepat, Android 12+ memakai alarm hemat daya yang bisa telat/ditahan Doze, dan Android 14+ bisa menolak buka activity dari latar.
     Kini memakai `setAlarmClock` (tepat waktu, tanpa izin tambahan; alarm lama jadi cadangan), PendingIntent diberi izin BAL (API 34+), jeda 0,7 -> 0,6 dtk.

Catatan
- Butuh APK baru untuk bagian 1 dan 3 (Java berubah): `npm run android:sync` lalu build. Bagian 2 hanya TSX/CSS dan bisa lewat OTA; OTA ke APK lama
  tetap aman, tetapi `--sat` dkk. baru terisi dari native di APK baru (APK lama memakai `env()`).
- Beberapa ROM (MIUI, ColorOS, dsb.) memblokir buka activity dari latar; bila ikon berganti tapi aplikasi tidak terbuka, aktifkan izin "Tampilkan di atas aplikasi lain" / mulai otomatis.
- Belum diuji di perangkat dan belum dijalankan `npm run typecheck`.
