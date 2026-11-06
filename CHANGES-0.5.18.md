# 0.5.18 — Pilihan manual tersimpan, cek audio saat buka playlist, tombol data terbaru
## 1. Pilihan Cari manual disimpan per lagu
- Baru `src/plugins/manualPins.ts`: pilihan hasil Cari manual disimpan per lagu (kunci judul + artis playlist, huruf kecil) di `mv:manualPins:v1` (maks. 500; ikut Cadangan karena awalan `mv:`).
- `resolveViaPluginsDetailed` (`plugins/registry.ts`) mencoba pilihan tersimpan lebih dulu untuk putar dan unduh. Bila gagal diambil (sinyal lemah, video dihapus) tetap lanjut ke pencarian otomatis; pilihannya tidak dibuang. Pilihan ulang menimpa yang lama.
- `downloadWithPick` menyimpan pilihan dari Cari manual di Unduhan.
- `warmResolve` melewati lagu yang punya pilihan manual (hasil pencarian otomatisnya tidak dipakai).
## 2. Cek ketersediaan audio saat playlist dimuat
- Baru `src/hooks/useTrackAvailability.ts` + `src/components/playlist/AvailabilityPanel.tsx`, dipasang di `PlaylistView` (bukan untuk hasil cari lagu satuan).
- Tiap lagu dicari di YouTube Music/YouTube dengan aturan skor yang sama seperti saat diputar, tanpa mengambil stream (opsi baru `searchOnly`). 2 lagu paralel, jeda 250 ms, tertunda saat offline.
- Lagu yang sudah terunduh atau punya pilihan manual langsung dianggap ada. Hasil "ada" disimpan 12 jam (`mv:availability:v1`) supaya buka ulang playlist tidak mencari lagi.
- Panel menampilkan progres, ringkasan, daftar lagu yang tidak ditemukan dengan tombol Cari manual, dan Cek ulang. Cari manual memakai `ManualSearchSheet` yang sama dengan Unduhan (prop baru `track`); pilihan disimpan tanpa mengunduh.
- Ini perkiraan: audio yang ditemukan tetap diperiksa lagi (durasi file, bukan cuplikan) saat diputar atau diunduh.
## 3. Tombol "Muat data terbaru"
- Di halaman Playlist saya (`MyPlaylistPage`) untuk playlist yang berasal dari Spotify: ambil ulang dari Spotify dan tambahkan lagu baru, tanpa mengunduh (web dan APK). Tombol "Unduh yang baru" (APK) tetap ada.
- Hanya menambah lagu baru; lagu yang kamu hapus dari playlist ikut masuk lagi bila masih ada di Spotify. Judul/sampul lagu lama tidak diperbarui. Playlist buatan sendiri (tanpa sumber Spotify) tidak punya tombol ini.
## Catatan
- Hanya JS (OTA); tidak ada plugin native baru.
- Belum dijalankan: `npm run typecheck`/`build` (tanpa node_modules di sini; hanya tsc parsial, sisa galatnya karena tipe React tidak terpasang) dan uji di perangkat. Penyimpanan pilihan manual sudah diuji terpisah di Node.
