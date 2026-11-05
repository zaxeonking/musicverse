# MusicVerse 0.4.16 — playlist Spotify tidak otomatis tersimpan, salin/pindah lagu antar playlist, pengaturan Playlist

## 1. Playlist Spotify yang dibuka tidak lagi masuk daftar otomatis
- Dulu setiap playlist Spotify yang berhasil dimuat langsung muncul di tab Playlist sebagai "Tersimpan" (Koleksi). Sekarang tidak:
  `LibraryContext` tidak lagi menyimpan otomatis.
- Di Beranda, tombol **Simpan ke Koleksi** diganti **Tambah ke playlist**: membuat playlist buatanmu (nama sama, isi lagunya, mengingat
  playlist Spotify asalnya lewat `sourceId`). Menekan lagi (tombol berubah jadi **Perbarui playlist**) hanya menambah lagu yang baru.
  Memakai `saveDownloadedPlaylist` yang sama dengan "Unduh semua", jadi keduanya tetap satu playlist yang sama.
- Entri "Tersimpan" yang sudah ada tidak dihapus (tetap bisa dibuka / dihapus). Kartu Spotify yang sudah punya playlist buatanmu
  tetap disembunyikan seperti sebelumnya.
- Hasil cari judul / tautan lagu tidak berubah (tombol **Tambah ke playlist** satu lagu).

## 2. Menu tahan lama: salin / pindah antar playlist
- **Lagu** (halaman playlist buatanmu): tahan lama barisnya, atau tombol "...": *Salin ke playlist lain*, *Pindahkan ke playlist lain*,
  *Pindahkan semua lagu*. Opsi ini hanya muncul untuk lagu yang berada di playlist buatanmu.
- **Playlist** (kartu di tab Playlist, tampilan daftar maupun kisi): tahan lama (atau klik kanan): *Buka*, *Salin semua lagu*,
  *Pindahkan semua lagu*.
- Tujuan: pilih playlist lain atau buat baru. Pindah meminta konfirmasi karena lagu dihapus dari asal.
- `transferTracks` (`utils/myPlaylistStorage.ts`) = satu perubahan atomik, jadi pindah tidak pernah menghilangkan lagu di tengah:
  duplikat di tujuan tidak ditambah dua kali (pada pindah, tetap dihapus dari asal); lagu yang tak muat karena tujuan penuh tetap di asal.

## 3. Pengaturan > Playlist (baru, hanya APK seperti pengaturan lain)
- **Tambah otomatis saat playlist dibuka** (bawaan: mati): bila dinyalakan, playlist Spotify yang berhasil dimuat langsung dibuat
  sebagai playlist (playlist yang cuma dipulihkan dari penyimpanan tidak diproses).
- **Tanya dulu sebelum memindahkan lagu** (bawaan: nyala).
- Disimpan di `musicverse:playlist-prefs:v1` (ikut Cadangan karena berawalan `musicverse:`).

## Diuji / belum
- Diuji di Node (18 kasus): `transferTracks` salin, pindah, pindah semua, duplikat, tujuan penuh, playlist sama / tidak ada / ID lagu
  tak ada, dan input tidak diubah. Semua lulus.
- `tsc` dengan stub React/Router/Lucide (paket tidak terpasang di lingkungan ini): tidak ada galat tipe baru selain artefak stub;
  satu bentrok nama yang tertangkap (`transfer` di `TrackMenuSheet`) sudah diperbaiki.
- BELUM dirender / dijalankan di perangkat: tampilan menu, tahan lama, dan halaman Pengaturan > Playlist perlu dicoba di HP.

Hanya TypeScript; build ulang APK seperti biasa.
