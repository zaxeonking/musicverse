# MusicVerse 0.5.46.13 — Animasi logo saat buka aplikasi lebih mulus, dan ditahan lebih lama

Hanya JS/HTML (tanpa APK baru).

## Masalah
- Animasi logo + nama saat aplikasi dibuka terasa patah-patah.
- Splash hilang terlalu cepat: animasinya baru selesai, langsung keluar, hampir tanpa jeda tahan.

## Penyebab
- CSS splash ada di `src/index.css`, jadi baru berlaku setelah bundel dimuat dan animasi bersaing dengan pemuatan aplikasi di thread utama.
- Batang logo adalah elemen SVG (`rect` + `transform-box`), animasinya digambar ulang di thread utama (tidak dikomposit GPU).
- Zoom memakai ukuran dasar kecil lalu diskalakan naik (0,9 -> 1,32): teks dan logo jadi buram dan terasa patah.
- Splash ditutup di 2,2 dtk, sementara zoom baru selesai di 2,6 dtk: tidak ada waktu tahan.

## Perubahan
- `index.html`: gaya splash dipindah ke `<style>` inline di `<head>` (mulai segera, easing ditulis literal). Logo SVG diganti 4 batang
  HTML (`.splash-logo i`) dengan koordinat yang sama dengan logo aslinya. Semua gerakan hanya `transform` + `opacity` (`scale3d`/`translate3d`,
  `will-change`), sehingga jalur compositor tetap mulus saat thread utama sibuk.
- Ukuran dasar = ukuran akhir (logo 138 px, nama 45 px); zoom 0,68 -> 1 (rasio sama seperti sebelumnya) supaya tajam.
- Timing: batang logo 760 ms (jeda antar batang 80 ms), huruf 640 ms (jeda 55 ms), zoom 2,8 dtk. Animasi masuk selesai ±1,7 dtk.
- `src/main.tsx`: `SPLASH_MIN_MS` 2200 -> 3400, jadi logo + nama utuh ditahan sekitar 1,5 dtk sebelum zoom keluar.
  Bila aplikasi belum siap, splash tetap tampil sampai siap (seperti sebelumnya). Mode "kurangi gerakan" tidak berubah (±0,5 dtk).
- `src/index.css`: blok splash dihapus; bagian aplikasi masuk (`#root`) tetap di sini.

## Belum diuji
Hanya diperiksa lewat kode (tanpa perangkat / emulator). Kalau masih terasa kurang, angka yang paling gampang diubah: `SPLASH_MIN_MS`
(lama tahan) dan durasi `splash-zoom` (2800ms) di `index.html`.
