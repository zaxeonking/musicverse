# 0.5.37.6 — Geser pada lagu, pilih banyak lagu, lagu belum diunduh dikunci saat offline
## Perubahan
### Geser pada baris lagu (pola dan animasi sama dengan geser pada playlist)
- `hooks/useSwipeSelect.ts`: callback kini menerima arah geser, `onSwipe(index, direction)` (1 = kanan, -1 = kiri). Pemakai lama (daftar playlist) tidak berubah.
- `hooks/useTrackSwipe.ts` (baru): **geser kanan = tambah ke antrean**, **geser kiri = suka / batal suka** (Lagu Disukai). Aturan antrean sama dengan menu lagu (`fromSearch` hanya untuk hasil Cari; lagu playlist tidak dicampur ke antrean playlist lain, toast menjelaskan). Selesai geser muncul toast hasilnya.
- Dipasang di `TrackList.tsx` (Beranda/playlist Spotify, Cari, halaman artis/album) dan `MyPlaylistPage.tsx` (Playlist saya). Menggulir tegak, tekan lama (menu lagu), dan ketuk biasa tidak terpengaruh.
### Mode pilih banyak di daftar lagu Playlist saya
- Tombol ikon **Pilih lagu** di halaman playlist. Dalam mode pilih: ketuk atau geser (kanan/kiri) = pilih / batal pilih; tombol di baris disembunyikan.
- `library/TrackSelectionBar.tsx` (baru): Pilih semua / Selesai, serta ikon **Salin**, **Pindahkan**, **Hapus** (hapus minta konfirmasi di bilah). Back Android keluar dari mode pilih.
- `library/TrackTransferSheet.tsx` (baru): memakai `PlaylistTransferPanel` yang sama dengan menu lagu (konfirmasi pindah mengikuti Pengaturan > Playlist, playlist baru bisa dibuat langsung).
- `myPlaylistStorage.ts` + `MyPlaylistsContext.tsx`: `removeTracks` (hapus banyak lagu dalam satu penulisan).
- Lagu terpilih yang hilang dari playlist (mis. dari tab lain) otomatis dibuang dari pilihan; playlist kosong menutup mode pilih.
### Offline: lagu yang belum diunduh dikunci
- `hooks/useOfflineBlock.ts` (baru): saat perangkat offline, lagu yang belum diunduh (dan bukan dari folder Lokal) diblokir. Yang sudah diunduh tetap bisa diputar.
- Baris lagu yang diblokir tampil redup; mengetuknya (atau tombol putarnya, atau geser kanan ke antrean) tidak memutar, hanya toast "Tidak ada internet. Lagu ini belum diunduh". Tekan lama (menu) dan geser kiri (suka) tetap jalan.
- Berlaku di `TrackList.tsx` dan `MyPlaylistPage.tsx`. Tanda ikon unduhan di baris tidak dibuat (diganti pengunci ini).
## Catatan
- Hanya JS (OTA). Belum dibuild/diuji di perangkat; pengecekan tipe penuh belum dijalankan (dependensi tidak terpasang di sini).
- "Putar semua" saat offline tetap mulai dari lagu pertama, jadi kalau lagu itu belum diunduh akan gagal diputar seperti biasa. Belum ditambah pelewatan otomatis.
- Mode pilih banyak hanya di Playlist saya (tempat hapus/salin/pindah bermakna). Daftar lagu Spotify, Cari, dan Unduhan belum punya mode pilih.
### Petunjuk ikon saat menggeser (lagu dan playlist)
- `useSwipeSelect.ts`: parameter kedua opsional `getHint(index, direction)`. Selama menggeser, ikon + label kecil muncul di celah yang terbuka (makin jelas sambil digeser, membesar sedikit saat "siap"), lalu memudar saat dilepas. Tanpa efek bila "kurangi gerakan" aktif.
- Lagu: kanan = ikon antrean "Antrean" (atau "Offline" bila terkunci), kiri = hati "Suka" (atau "Batal suka" bila sudah disukai). Mode pilih: "Pilih" / "Batal".
- Playlist: "Pilih" / "Batal" (centang / silang); "Lagu Disukai" menampilkan "Bawaan" (tidak bisa dipilih).
