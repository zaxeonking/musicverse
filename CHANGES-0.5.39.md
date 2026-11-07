# 0.5.39 — Warna aksen otomatis dari sampul di pemutar penuh
- Pemutar penuh kini memakai warna dominan sampul (hook `useCoverGlow` yang sama dengan glow mini player) untuk latar gradien dan semua elemen `accent` di dalamnya: hati Suka, tombol acak/ulang/lirik aktif, ikon lirik, dan fokus.
- `tailwind.config.js`: `accent` kini `rgb(var(--mv-accent, 29 185 84) / <alpha-value>)`. Tanpa variabel, tampil hijau seperti biasa; hanya pemutar penuh yang menimpa `--mv-accent`. Varian `accent-soft` dan `accent-deep` tetap hijau.
- Bila sampul tidak bisa dibaca (tanpa CORS), dipakai warna gradien sampul bawaan, lalu hijau aplikasi.
- Hanya JS (OTA). Belum dibuild atau diuji di perangkat; pengecekan tipe belum dijalankan.
