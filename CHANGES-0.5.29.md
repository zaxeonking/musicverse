# 0.5.29 — Cari artis dari luar di Beranda (mode Lagu | Artis)
## Perubahan
- `PlaylistImportForm.tsx`: dua chip **Lagu | Artis** di bawah kolom cari. Mode Artis: placeholder "Nama artis", tombol "Cari artis", saran judul dimatikan. Menempel tautan Spotify saat mode Artis otomatis kembali ke mode Lagu (alur lama). Prop baru `mode`, `onModeChange`, `onArtistSearch`; tipe `SearchMode` diekspor.
- `services/artistApi.ts` (baru): `searchArtists` (nama -> daftar artis) dan `fetchArtistSongs` (artistId -> lagu, maks 200, satu per judul) dari katalog iTunes (storefront `ID`) lewat `pluginFetch`. Lagu dibentuk sebagai `PlaylistTrack` biasa; audio tetap dicari lewat plugin (judul + artis) seperti lagu lain.
- `components/playlist/ArtistSearchPanel.tsx` (baru): daftar artis (foto bulat + panah) -> ketuk -> semua lagu artis (Putar semua, Acak, kolom cari bawaan `TrackList`). Artis tidak pernah dibungkus sebagai lagu. Tombol Back (termasuk Android) dari detail artis kembali ke daftar artis lewat `useOverlayHistory`.
- `HomePage.tsx`: menyimpan mode dan permintaan artis; mode Artis menampilkan `ArtistSearchPanel` menggantikan `PlaylistView` (playlist/hasil lagu tidak dihapus, muncul lagi saat kembali ke Lagu).
## Catatan
- Hanya JS (OTA). Belum dibuild/diuji di perangkat; pengecekan tipe penuh belum dijalankan (dependensi tidak terpasang).
- Hanya jalan di APK (HTTP native, seperti saran pencarian). Di browser biasa pencarian artis gagal CORS.
- Batas 200 lagu dari iTunes dan hanya yang ada di katalog Apple Music. Foto artis tidak tersedia: daftar memakai gradien `fallbackCover`, detail memakai cover lagu pertama.
- Lagu dari artis berisi tautan Apple Music (bukan Spotify), jadi "Buka di Spotify" tersembunyi untuk lagu ini.
