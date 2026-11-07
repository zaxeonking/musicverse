# 0.5.24 — Tahan lama playlist bisa menghapus
## Perubahan
- `PlaylistMenuSheet.tsx`: menu tahan lama playlist buatanmu kini punya "Hapus playlist" (dengan konfirmasi di dalam menu). Playlist bawaan "Lagu Disukai" tidak bisa dihapus. Playlist hasil "Unduh semua" ikut melepas kartu Spotify-nya (`removeSaved(sourceId)`), sama seperti tombol hapus di halaman playlist.
- `SavedPlaylistMenuSheet.tsx` (baru) + `SavedPlaylistCard.tsx` + `PlaylistsSection.tsx`: playlist tersimpan juga bisa ditahan lama / klik kanan -> Buka atau Hapus dari Koleksi.
- Daftar Koleksi langsung diperbarui begitu playlist dihapus (state context), tanpa perlu pindah halaman atau memuat ulang; muncul toast konfirmasi.
- `LibraryContext.removePlaylist`: bila ID tidak ada di Koleksi, tidak menulis ulang penyimpanan dan tidak menghapus pemberitahuan lain.
## Catatan
- Hanya JS (OTA). Belum diuji di perangkat atau dibuild (tidak ada node_modules di lingkungan pengerjaan); sintaks file yang diubah sudah dicek dengan tsc.
- Yang dihapus hanya daftar playlist; berkas lagu yang sudah diunduh dan antrean yang sedang diputar tidak ikut tersentuh.
## Batas waktu cek audio playlist
- `registry.ts`: batas cek SATU lagu naik dari 6 dtk menjadi 25–30 dtk menurut durasi lagu di playlist (<= 3 mnt = 25 dtk, >= 6 mnt = 30 dtk, di antaranya naik bertahap; durasi tak diketahui = 25 dtk). Batas baca metadata audio saat cek naik dari 4 dtk menjadi 8 dtk, karena 4 dtk akan tetap memotong stream yang lambat sebelum batas 25 dtk tercapai.
- Konsekuensi: lagu yang benar-benar tidak ada bisa makan sampai 25–30 dtk sebelum dinyatakan "tidak ditemukan", dan selama itu lagu yang belum dicek tetap terkunci. Dengan 2 lagu dicek bersamaan, playlist besar dengan banyak lagu bermasalah akan lebih lama selesai.
