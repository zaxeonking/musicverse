# 0.5.51.85 (latar kolom cari tidak lagi terpotong, kotak sampul pemutar mini beranimasi)

Files: native/android/java/RelaunchActivity.java, scripts/setup-android.mjs, src/pages/SearchPage.tsx, src/components/player/MiniPlayer.tsx, src/index.css, package.json (appVersion 0.5.51.85), CHANGES.md (0.5.51.7 diarsipkan), CHANGES-0.5.51.85.md, PROJECT_STRUCTURE.md

1. Nomor versi
   - `appVersion` dinaikkan 0.5.51.7 -> 0.5.51.85 (`version` semver tetap 0.5.51). Tidak ada fitur baru, jadi tidak ada entri Yang baru baru.

2. Halaman Cari: tepi gelap di belakang kolom cari dihapus
   - Penyebab: lapisan blur di belakang kolom cari memakai `bg-bg/30` (tint gelap) dengan tepi atas yang keras, sehingga tampak potongan hitam di atas
     cahaya latar biru. Kini lapisan hanya blur (tanpa warna) dan masknya memudar di atas DAN bawah, jadi tidak ada garis potong.
   - Kolom cari sticky lain (TrackList, bar pilih lagu) belum diubah.

3. Kotak sampul di pemutar mini tidak lagi muncul/hilang mendadak
   - Disc -> kartu (`runDiscFly`): kotak sampul kini kosong dulu (sampul disembunyikan karena sedang terbang di luar), membesar + memudar masuk,
     lalu sampul memudar masuk di atasnya saat disc mendarat; kotak kosongnya memudar sesudahnya.
   - Kartu -> disc (`applyCoverSlot` di `applyRoll`): sampul di kotak langsung disembunyikan begitu disc pratinjau terbawa, kotak kosongnya
     mengecil + memudar bersama kartu (dulu sampul tertinggal, hanya tertutup disc).
   - Mini -> pemutar penuh dan kembali: kotak tidak lagi `visibility:hidden` utuh (hilang/muncul mendadak). Yang disembunyikan hanya sampulnya; kotak
     kosong memudar masuk saat pemutar penuh terbuka dan memudar keluar saat tertutup.
   - Elemen baru `[data-mini-slot]` di dalam `[data-mini-cover]`; ikut Kurangi gerakan (tanpa transisi).

4. Ganti tema (ikon ikut tema): tampak seperti aplikasi dimulai ulang, bukan keluar ke layar utama (APK baru)
   - Penyebab: `RelaunchActivity` transparan. Saat ROM menutup proses utama karena ikon peluncur berganti, pengguna melihat layar utama
     di belakang activity transparan itu sampai aplikasi terbuka lagi (~1 dtk).
   - Kini `RelaunchActivity` berlayar penuh: latar warna tema (`PREF_BG`, sama dengan latar jendela MainActivity) + ikon aplikasi memudar masuk,
     status bar dan navigation bar searna. Layar utama tidak lagi terlihat; aplikasi lalu terbuka lagi lewat ikon baru seperti sebelumnya.
   - `setup-android.mjs`: tema activity di manifest diganti `Theme.DeviceDefault.NoActionBar`; manifest lama yang masih bertema transparan ikut diperbarui.
   - Bila ROM tidak menutup aplikasi, layar ini tampil sekitar 1 dtk lalu aplikasi kembali ke depan dengan keadaan sama (tidak dimulai ulang sungguhan).

Catatan
- Bagian 4 mengubah Java dan manifest: butuh APK baru (`npm run android:sync` lalu build). OTA saja tidak cukup.
- Bagian 2 dan 3 hanya TSX/CSS: bisa lewat OTA, tanpa APK baru.
- versionName APK menjadi 0.5.51.85 dan versionCode naik (diisi `scripts/setup-android.mjs` saat `npm run android:sync`). Tanpa perubahan Java/native.
- Belum dijalankan `npm run typecheck` / build.
