# 0.5.25 — Hapus beberapa playlist sekaligus (mode pilih banyak di Koleksi)
## Perubahan
- `PlaylistsSection.tsx`: tombol **Pilih** baru di header Playlist (Koleksi). Dalam mode pilih, mengetuk kartu = pilih / batal pilih (tidak membuka playlist, tahan lama dimatikan). Berlaku di tampilan kisi maupun daftar, untuk playlist buatanmu dan yang tersimpan.
- `PlaylistSelection.tsx` (baru): `SelectableCard` (kartu dengan tanda centang, `role="checkbox"`) dan `SelectionBar` (bilah menempel di atas: jumlah dipilih, Pilih semua / Batal pilih, Hapus, Selesai). Tombol Hapus meminta konfirmasi di bilah itu juga. Tombol Back (Android) keluar dari mode pilih lewat `useOverlayHistory`.
- "Lagu Disukai" (bawaan) tampil terkunci dan tidak bisa dipilih.
- Menghapus dilakukan sekaligus: playlist buatanmu lewat satu penulisan (`deletePlaylists`), playlist tersimpan lewat satu penulisan (`removePlaylists`). Playlist hasil "Unduh semua" ikut melepas kartu Spotify-nya, sama seperti hapus satuan.
- Setelah dihapus muncul toast "N playlist dihapus" dengan tombol **Urungkan** (mengembalikan playlist buatanmu dan kartu tersimpan yang tadi dihapus). Catatan: playlist tersimpan yang dikembalikan masuk lagi di urutan teratas (tanggal simpan baru).
- `myPlaylistStorage.ts`: `deleteMyPlaylists(list, ids)` (baru); "Lagu Disukai" dan ID yang tidak ada dilewati. `MyPlaylistsContext.tsx`: `deletePlaylists`.
- `libraryStorage.ts`: `removeSavedPlaylists` (baru). `LibraryContext.tsx`: `removePlaylists`; bila tak satu pun ID ada di Koleksi, tidak ada yang ditulis ulang.
- Mode pilih keluar otomatis bila tidak ada lagi playlist yang bisa dipilih (mis. semuanya sudah dihapus di tab lain).
## Catatan
- Hanya JS (OTA). Versi `package.json` menjadi 0.5.25.
- Belum diuji di perangkat atau dibuild (tidak ada node_modules di lingkungan pengerjaan); sintaks file yang diubah dicek lewat transpile TypeScript, tetapi pengecekan tipe penuh (`npm run typecheck`) belum dijalankan.
- Yang dihapus hanya daftar playlist; berkas lagu yang sudah diunduh dan antrean yang sedang diputar tidak ikut tersentuh.
