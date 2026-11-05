# MusicVerse 0.4.19 — menu kecil (tahan lama) selalu paling depan

## Laporan
Menu kecil yang muncul saat menahan lama harus paling depan dan tidak boleh tertutup.

## Penyebab (dari membaca kode; belum direproduksi di perangkat)
Tiga menu bawah dirender DI DALAM wadah halaman (`<main>` yang menggulir + pembungkus `animate-page-in`), padahal mini player
dan bottom nav punya lapisan sendiri (z-40 / z-30) di luar wadah itu. Elemen `fixed` yang berada di dalam wadah beranimasi /
ber-overflow bisa terkurung di lapisannya dan tertimpa mini player atau bottom nav, atau terpotong. Menu yang terdampak:
- `PlaylistMenuSheet` (tahan lama kartu playlist: salin / pindahkan semua lagu)
- `AddToPlaylistSheet` (Tambah ke playlist untuk lagu satuan di Beranda)
- `MoveDownloadSheet` (Pindahkan unduhan ke playlist)
`TrackMenuSheet` sudah di akar aplikasi (di luar halaman), tetapi memakai lapisan 62, di bawah menu lain yang berlapisan 70-80.

## Perubahan
- Baru `components/ui/OverlayPortal.tsx`: akar menu bawah yang dirender lewat portal langsung ke `<body>` dengan lapisan z-90
  (di atas mini player, bottom nav, pemutar penuh, antrean, toast, dan sheet Sleep Timer / Crossfade / Cari manual).
- Keempat menu di atas memakainya. Isi, perilaku, fokus, tombol Kembali, dan tampilan menu tidak diubah.
- Tidak diubah: `TrackActionSheet` di dalam panel Antrean (memang menempel di panel itu), dan sheet yang sudah memakai portal.

## Diuji / belum
- `tsc` dengan stub React/Router/Lucide (paket tidak terpasang di lingkungan ini): tidak ada galat baru selain artefak stub pada
  tipe `ReactNode`; tag JSX seimbang.
- BELUM dirender / dijalankan di perangkat. Bila ada menu yang masih tertutup, catat menunya dan halamannya.

Hanya TypeScript; build ulang APK seperti biasa.
