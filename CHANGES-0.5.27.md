# 0.5.27 — Notifikasi "Tambah ke playlist" di hasil cari lagu muncul lagi
## Perubahan
- `PlaylistView.tsx`: sheet "Tambah ke playlist" (hasil cari judul / tautan lagu) dan sheet cari manual sekarang memakai toast global (`showToast` dari `TrackMenuContext`), sama seperti tempat lain. Toast lokal lama (posisi tetap, bisa tertutup dock pemutar) dihapus, jadi pesan "Disimpan ke / Dihapus dari / Playlist dibuat" tampil.
## Catatan
- Hanya JS (OTA). Belum diuji di perangkat.
