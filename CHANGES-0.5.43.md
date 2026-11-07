# 0.5.43 — Lirik karaoke: baris aktif terisi mengikuti lagu
- Lirik sinkron per baris sudah ada sejak sebelumnya (sorotan, gulir otomatis, ketuk untuk loncat, penyelarasan manual). Rilis ini menambah **efek karaoke di dalam baris**: teks baris yang sedang dinyanyikan terisi putih dari kiri ke kanan, dari waktu barisnya sampai waktu baris berikutnya (maksimal 7 detik bila jedanya panjang). Baris yang membungkus ke beberapa baris terisi berurutan.
- Mengikuti kecepatan putar, penyelarasan manual, dan mode `scaled`. Lebar isi dihitung dari posisi audio langsung tiap frame dan ditulis lewat variabel CSS (`--fill`), tanpa render ulang React. Berhenti saat dijeda.
- Dimatikan (baris tampil putih penuh) bila waktu hanya perkiraan (mode `estimated`) atau pengguna memilih kurangi gerakan.
- Ini isi per baris, bukan per kata: sumber lirik (LRCLIB / NetEase) hanya menyediakan waktu per baris.
- Diubah: `components/player/LyricsPanel.tsx`. Hanya JS (OTA). Belum dibuild atau diuji di perangkat; hanya sintaks yang dicek.
