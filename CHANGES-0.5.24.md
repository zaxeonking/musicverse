# 0.5.24 — Tahan lama playlist bisa menghapus
## Perubahan
- `PlaylistMenuSheet.tsx`: menu tahan lama playlist buatanmu kini punya "Hapus playlist" (dengan konfirmasi di dalam menu). Playlist bawaan "Lagu Disukai" tidak bisa dihapus. Playlist hasil "Unduh semua" ikut melepas kartu Spotify-nya (`removeSaved(sourceId)`), sama seperti tombol hapus di halaman playlist.
- `SavedPlaylistMenuSheet.tsx` (baru) + `SavedPlaylistCard.tsx` + `PlaylistsSection.tsx`: playlist tersimpan juga bisa ditahan lama / klik kanan -> Buka atau Hapus dari Koleksi.
- Daftar Koleksi langsung diperbarui begitu playlist dihapus (state context), tanpa perlu pindah halaman atau memuat ulang; muncul toast konfirmasi.
- `LibraryContext.removePlaylist`: bila ID tidak ada di Koleksi, tidak menulis ulang penyimpanan dan tidak menghapus pemberitahuan lain.
## Catatan
- Hanya JS (OTA). Belum diuji di perangkat atau dibuild (tidak ada node_modules di lingkungan pengerjaan); sintaks file yang diubah sudah dicek dengan tsc.
- Yang dihapus hanya daftar playlist; berkas lagu yang sudah diunduh dan antrean yang sedang diputar tidak ikut tersentuh.
