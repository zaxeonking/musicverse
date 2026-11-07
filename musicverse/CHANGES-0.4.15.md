# MusicVerse 0.4.15 — perbaikan sheet "Cari manual"

Laporan: ketuk "Cari manual" hanya menggelapkan layar, daftar hasil tidak tampil.

Penyebab pasti belum ketemu (tidak bisa dijalankan di perangkat dari sini). Sheet 0.4.14 dibuat sama seperti sheet lain di
halaman, jadi ini perubahan defensif pada kemungkinan terkuat:
- Sheet kini dirender lewat **portal ke `<body>`** dengan z-index di atas semua lapisan (80), bukan di dalam wadah halaman
  (yang beranimasi/menggulir dan bisa membuat sheet terlempar keluar layar sementara lapisan gelapnya tetap terlihat).
- Animasi naik (`animate-sheet-up`) dilepas: bila animasi macet, sheet tidak tertinggal di luar layar.
- **Galat tampilan kini muncul di dalam sheet** (pesan + tombol Tutup) alih-alih layar gelap tanpa isi, dan dicatat di konsol.
- Ikon `Video` diganti ikon yang sudah dipakai di tempat lain.

Jika sheet tetap kosong setelah ini, pesan di dalamnya (atau ketiadaannya) menunjukkan sebabnya.
Hanya TypeScript; build ulang APK seperti biasa.
