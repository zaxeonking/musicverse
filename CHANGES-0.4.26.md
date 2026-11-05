# 0.4.26 — saat keyboard terbuka: nav bar tidak ikut naik, mini player jadi piringan (beranimasi)

## Masalah (dari screenshot)
Keyboard layar membuat WebView mengecil, dan karena mini player + bottom nav adalah anak flex paling bawah di `AppShell`, keduanya ikut
naik dan menumpuk di atas keyboard (menutupi hampir separuh area yang tersisa).

## Perubahan
- **Bottom nav** (`BottomNav.tsx`): tidak ikut naik. Saat keyboard terbuka tingginya dianimasikan menutup sampai 0 (grid-rows `1fr` -> `0fr`
  + fade, 200 ms) dan membuka lagi saat keyboard hilang; tidak bisa difokus/ditekan selagi tersembunyi.
- **Mini player** (`MiniPlayer.tsx`): saat keyboard terbuka kartu otomatis mengecil jadi **piringan** (`MiniBubble`) dengan animasi yang sama
  seperti saat diperkecil manual (kartu terbang ke pojok sisi gelembung, lalu piringan muncul). Saat keyboard hilang piringan membesar lagi jadi
  kartu (animasi `grow-left/right`). Ini SEMENTARA dan tidak disimpan: pilihan pengguna di `useMiniPlayerMode` tidak berubah, jadi kalau
  pengguna memang memilih piringan, ia tetap piringan setelah keyboard hilang.
  - Mengetuk piringan saat keyboard terbuka: keyboard ditutup dulu, kartu membesar sesudahnya (bukan kartu muncul di atas keyboard).
  - Keyboard menutup di tengah animasi mengecil: kartu kembali ke tempatnya dengan animasi, tidak sempat jadi piringan.
- **AppShell**: padding konten mengikuti ukuran piringan selama keyboard terbuka.
- Baru `utils/keyboardState.ts` (logika murni) + `hooks/useKeyboardOpen.ts` (satu pendengar DOM dibagi ke semua pemakai).

## Cara mendeteksi keyboard (tanpa plugin native)
Keyboard dianggap terbuka bila SEMUA benar: tinggi layar turun >= max(140 px, 18% tinggi baseline) dari tinggi terbesar yang pernah terlihat,
ada `<input>` teks / `<textarea>` / contenteditable yang fokus, perangkat layar sentuh, dan tidak sedang pinch-zoom. Menutup dengan histeresis
(pulih sampai turun < setengah ambang). Rotasi (lebar berubah) mengukur ulang baseline.
Bergantung pada perilaku WebView yang sekarang (mengecil saat keyboard muncul, seperti terlihat di screenshot). Bila suatu saat memakai
mode yang tidak mengecilkan WebView (`adjustPan` / edge-to-edge), tinggi tidak berubah dan deteksi tidak aktif: perilaku kembali seperti 0.4.25.

## Diuji / belum
- Diuji di Node (13 kasus, lulus): fungsi murni (buka, tanpa fokus, turun kecil/toolbar, histeresis, rotasi, pinch-zoom, desktop, fokus lepas
  duluan, baseline ikut naik) dan store dengan DOM palsu (resize+fokus, fokus menyusul, checkbox diabaikan, pendengar dilepas).
- `tsc` dibanding 0.4.25 asli: tidak ada galat nyata baru (selisih hanya pesan lingkungan karena paket React tidak terpasang: `Cannot find module
  'react'` untuk file hook baru dan tambahan JSX implicit-any di BottomNav).
- BELUM dijalankan/dirender di perangkat. Yang perlu dicoba di HP: (1) fokus kolom cari di Beranda: nav menutup mulus dan kartu terbang jadi
  piringan, (2) tutup keyboard (tombol back/ketuk luar): nav membuka dan piringan membesar jadi kartu, (3) ketuk piringan saat mengetik,
  (4) putar balik keyboard cepat buka-tutup, (5) rotasi layar saat keyboard terbuka, (6) pilihan "piringan" yang disimpan tetap piringan.
  Waktu animasi bergantung kapan Android mengubah ukuran WebView relatif terhadap animasi keyboard; bila terasa terlambat, angka 200 ms dan
  jeda ukur ulang (120/350 ms) di `useKeyboardOpen.ts` bisa disetel.

Hanya TypeScript; build ulang APK seperti biasa.
