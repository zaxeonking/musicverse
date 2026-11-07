# MusicVerse 0.4.17 — tahan lama di semua lagu, menu menyesuaikan kondisi dan tempat

## Apa
Sistem menu tahan lama (`useLongPress` + `TrackMenuContext`) sudah ada di 0.4.16 untuk daftar playlist, Unduhan, Baru diputar,
Playlist saya, dan "Berikutnya". Versi ini menutup tempat yang masih ketinggalan dan membuat isi menu mengikuti **tempat** dan
**kondisi** lagunya.

### Tempat yang sekarang bisa ditahan lama (atau klik kanan)
| Tempat | Sebelumnya | Sekarang |
|---|---|---|
| Riwayat (`HistoryPage`) | tidak ada | menu lagu + **Hapus dari riwayat** |
| Detail Artis / Album (`BrowsePage`) | tidak ada | menu lagu |
| Mini player (info lagu) | tidak ada | menu lagu yang sedang diputar (tidak aktif saat kartu sedang diseret) |
| Pemutar penuh (sampul / judul) | hanya tombol Simpan | menu lagu yang sedang diputar |
| Antrean > "Sedang diputar" | tidak ada | menu lagu yang sedang diputar (ketuk biasa tetap jeda/putar) |
| Antrean > "Berikutnya" | menu antrean saja | menu antrean + baris baru **Opsi lainnya** (simpan ke playlist, unduh, dll.) |

Sudah ada dan tidak diubah perilakunya: daftar playlist / Cari / hasil cari judul (`playlist/TrackRow`), Unduhan, Baru diputar, Playlist saya.

### Opsi menu menurut tempat
- **Riwayat**: *Hapus dari riwayat* (hanya entri putar yang ditekan; entri lain tidak disentuh). Halaman Riwayat menyegarkan diri.
- **Playlist saya**: *Hapus dari playlist ini* (di samping Salin / Pindahkan yang sudah ada).
- Kode tempat (`place`): `playlist`, `search`, `my-playlist`, `downloads`, `history`, `browse`, `player`, `queue`, diteruskan oleh semua pemanggil.

### Opsi menu menurut kondisi
- **Lagu yang sedang diputar** (dari tempat mana pun): *Putar sekarang* menjadi *Putar ulang dari awal*; antre/antre-berikutnya tetap nonaktif seperti sebelumnya.
- **Tanpa internet**: *Unduh untuk offline* dinonaktifkan dengan keterangan "Perlu internet untuk mengunduh"; *Putar sekarang* untuk lagu yang
  belum diunduh diberi keterangan "Tidak ada internet dan lagu ini belum diunduh" (tetap bisa ditekan; pemutar sendiri menunggu internet kembali).
- Yang sudah ada tetap: sudah diunduh -> *Hapus unduhan*; ada di antrean -> *Hapus dari antrean*; antrean berisi playlist lain -> catatan penjelasan;
  tautan Spotify disembunyikan di APK.

## Sengaja tidak diubah
- **Gelembung kecil (MiniBubble)**: tahan lama di sana sudah berarti jeda/putar; tidak ditimpa.
- **Daftar pilih** di `ManualSearchSheet` / `MoveDownloadSheet` (memilih sumber audio, bukan daftar lagu pustaka).
- `components/music/TrackRow.tsx` dan `QuickPickCard.tsx` tidak dipakai di mana pun (kode mati), jadi tidak disentuh.
- Importer Spotify: 0.4.16 sudah punya cache token + sumber paralel, tidak diubah.

## Diuji / belum
- Diuji di Node (5 kasus): `removePlayLogEntry` (waktu + id cocok, id salah, waktu tak ada, tanpa id, dua entri sama waktu) dan event penyegaran.
- `tsc` dibandingkan dengan 0.4.16 asli di lingkungan yang sama (paket React/Router/Lucide tidak terpasang): tidak ada galat nyata baru; satu-satunya
  selisih adalah 4 pesan `key` pada komponen baris, artefak tipe React yang hilang dan sudah muncul di baseline untuk komponen lain.
- BELUM dirender / dijalankan di perangkat: perlu dicoba di HP: tahan lama di mini player (jangan bentrok dengan seret kartu), pemutar penuh, antrean,
  Riwayat, Artis/Album; serta teks keterangan offline.

Hanya TypeScript; build ulang APK seperti biasa.
