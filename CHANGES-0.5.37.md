# 0.5.37 — Pilih banyak lewat geser, sheet playlist tetap terbuka, tombol ikon saja
## Perubahan
### Pilih banyak playlist lewat geser (tombol "Pilih" dihapus)
- `PlaylistsSection.tsx`: tombol **Pilih** dihapus dari header; tinggal tombol "Buat playlist". Untuk memilih banyak, **geser playlist ke kanan atau kiri** (kisi maupun daftar): playlist itu langsung terpilih dan mode pilih terbuka (bilah Pilih semua / Hapus / Selesai seperti sebelumnya). Selama mode pilih, geser atau ketuk lagi untuk memilih / batal pilih. Kalau pilihan terakhir dibatalkan, mode pilih tertutup sendiri. "Lagu Disukai" tidak bisa dipilih.
- `hooks/useSwipeSelect.ts` (baru): satu pendengar pointer di `<ul>` (tanpa mengubah kartu). Geser >= 56 px dan dominan mendatar; menggulir tegak tidak terpengaruh (`touch-pan-y`); getar singkat; klik susulan setelah geser ditelan, jadi playlist tidak ikut terbuka. Sentuhan dari tepi layar (24 px) diabaikan untuk gestur Kembali Android. Tahan lama tetap membuka menu kartu.
### Sheet "pilih playlist" tetap terbuka + tanda lagu yang sudah masuk playlist
- `ArtistPlaylistSheet.tsx` (Tambah ke playlist di halaman artis/album): satu ketukan pada playlist menambahkan lagunya, **sheet tidak menutup**. Barisnya berubah jadi centang + konfirmasi ("N lagu ditambahkan ke ..." / "Semua lagu sudah ada ..."), jadi bisa memilih beberapa playlist berturut-turut. Setiap baris juga menampilkan "X dari N lagu sudah ada". Buat playlist baru juga tidak menutup sheet. Tombol **Selesai** (atau ketuk di luar) menutup dan memunculkan satu toast ringkasan.
- `AddToPlaylistPicker.tsx` (Simpan satu lagu ke playlist, dari menu lagu): sama, tetap terbuka setelah diketuk; ketuk lagi pada playlist berisi lagu itu untuk menghapusnya. Tombol **Selesai** menutup dan merangkum perubahan. Tombol Urungkan di toast dihapus karena ketuk ulang sudah bisa membatalkan.
- `TrackRow.tsx`: lagu di daftar (termasuk lagu artis) yang sudah ada di playlist buatanmu diberi ikon centang di depan judul, selain teks "Sudah ada di ...".
### Tombol aksi ikon saja + daftar lagu lebih rapi
- `ui/RoundAction.tsx` (baru): tombol bulat tanpa teks. "Putar semua" lebih besar dan hijau, sisanya bulat abu-abu. Label tetap ada untuk pembaca layar (`aria-label`) dan tooltip desktop (`title`), hanya tidak tampil sebagai teks. Prop `danger` dan `pressed` tersedia.
- `PlaylistHeader.tsx`: Putar semua, Tambah ke antrean, Tambah ke playlist, Unduh semua, Muat ulang kini ikon saja, satu deret rapi.
- `ArtistSearchPanel.tsx` (halaman artis/album): Putar semua, Acak, Tambah ke playlist, Buat playlist jadi ikon saja dan satu baris dengan chip Populer / A–Z. Tulisan "Urutkan" dihapus.
- `TrackList.tsx`: baris kosong di antara kolom cari dan daftar lagu hilang kecuali saat memfilter (teks "X dari N lagu" tetap diumumkan ke pembaca layar).
### Halaman playlist: tombol ikon saja, pembaruan digabung jadi satu
- `MyPlaylistPage.tsx`: Putar semua, Unduh semua, Sematkan, dan Hapus kini ikon saja. "Muat data terbaru" dan "Unduh yang baru" yang memakai ikon sama digabung jadi **satu tombol Perbarui** (ikon putar). Di APK, mengetuknya membuka sheet kecil untuk memilih **Muat data terbaru** atau **Unduh yang baru**; di web (hanya ada satu pilihan) langsung memuat data terbaru. Ikon berputar selama proses berjalan. Konfirmasi hapus tetap bertulis.
- `library/RefreshChoiceSheet.tsx` (baru): sheet pilihan tersebut.
## Catatan
- Hanya JS (OTA). Belum dibuild/diuji di perangkat; pengecekan tipe belum dijalankan (dependensi tidak terpasang).
- Daftar lagu di dalam playlist belum punya mode pilih banyak, jadi geser hanya berlaku di daftar playlist.
- Penandaan "sudah ada di playlist" memakai identitas lagu yang sama dengan pencegah duplikat (ID Spotify atau URL), jadi lagu yang sama dari sumber berbeda (Deezer vs Spotify) dianggap berbeda.
