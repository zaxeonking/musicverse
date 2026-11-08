# 0.5.51.5 (ikon buka-ulang otomatis, tutorial bisa dicoba, disc lebih besar)

Files: native/android/java/{MainActivity,MusicVerseNativePlugin}.java, src/native/musicVerseNative.ts,
src/tour/{steps,TourHost,PracticeStage,DemoStage}.ts(x) (entri Yang baru 0.5.51.5), src/components/player/{MiniPlayer,MiniBubble,FullPlayer}.tsx,
src/index.css, tailwind.config.js, package.json (appVersion 0.5.51.5), CHANGES.md (0.5.51 diarsipkan), PROJECT_STRUCTURE.md

1. Ganti ikon aplikasi -> buka ulang otomatis (APK baru)
   - Sebagian peluncur/ROM menutup aplikasi saat alias ikon berganti. Sebelum alias diganti, plugin memasang alarm (AlarmManager, ±0,7 dtk)
     ke alias baru, jadi aplikasi terbuka lagi sendiri tanpa dibuka manual. Bila aplikasi tidak ditutup, alarm hanya membawanya ke depan.
   - Hanya bila aplikasi sedang dilihat (`MainActivity.foreground`); ganti tema otomatis saat aplikasi di latar tidak memunculkan layar.
   - Tanpa izin alarm tepat (Android 12+) dipakai alarm hemat daya: bisa terlambat sedikit.
2. Tutorial yang tadinya tidak bisa dicoba
   - Penyebab: langkah dengan sorotan + petunjuk jari (Pemutar, Geser jadi disc, Tutup musik, Lirik) menutup seluruh layar, jadi elemen asli
     tidak bisa diketuk/digeser. Kini ada `tryTarget` pada langkah: lubang sorotan tembus sentuhan (sisa layar tetap terkunci).
     Bila ketukan membuka pemutar penuh, tutorial menutupnya lagi di langkah berikutnya.
   - "Main-main dengan disc" tadinya hanya animasi; kini latihan `disc-drag` (seret disc ke sisi lain, tahan untuk putar/jeda).
   - Sleep timer dan Antrean tidak dibuat bisa disentuh: lembarnya tampil di bawah lapisan tutorial.
3. Animasi mini player <-> disc tidak lagi dilewati saat "kurangi gerakan" menyala
   - Dugaan penyebab gejala "langsung jadi disc": `prefers-reduced-motion` melewati gulungan kartu -> disc, dan aturan global mematikan
     animasi CSS `card-from-*`. Kini kartu <-> disc tetap beranimasi; saat "kurangi gerakan" menyala tanpa putaran disc.
4. Disc lebih besar + animasi kartu -> disc meniru video contoh
   - Disc 56 px -> 72 px (`BUBBLE_PX` di MiniPlayer dan `SIZE` di MiniBubble harus sama; lubang tengah, ikon play, klip `card-from-*`, dan
     penghitung sampul FullPlayer ikut disesuaikan).
   - Geser samping: disc pratinjau lahir dari sampul kecil di kartu, membesar sambil meluncur ke pojok, cincin progres tergambar sampai posisi
     lagu sekarang, dan riak halus (`disc-halo`) muncul sekali saat disc mendarat.

Catatan
- Butuh APK baru untuk bagian 1 (Java berubah): `npm run android:sync` lalu build. Bagian 2-4 hanya TS/TSX/CSS dan bisa lewat pembaruan OTA;
  APK lama tetap aman (tanpa buka-ulang otomatis).
- Pengguna lama: tidak ada migrasi data. Disc lebih besar langsung berlaku setelah pembaruan.
- Belum diuji di perangkat dan belum dijalankan `npm run typecheck` (tidak ada node_modules di lingkungan pembuatan): jalankan sebelum rilis.
