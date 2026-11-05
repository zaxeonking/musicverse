# MusicVerse 0.4.13 — geser ke ujung lagu tidak lagi mengulang lagu yang sama; saran pencarian dari 3 sumber

## 1. Geser ke ujung lagu lalu malah mengulang lagu yang sama
**Gejala:** lagu digeser (seek) sampai dekat akhir; saat seharusnya pindah ke lagu berikutnya, lagu yang sama diputar lagi.

**Penyebab yang paling masuk akal (belum bisa direproduksi di perangkat):** setelah geser ke ujung, ExoPlayer bisa tertahan di
BUFFERING di akhir (durasi di wadah lebih panjang dari data yang benar-benar ada, atau permintaan Range di ekor ditolak).
Tangga pemulihan macet (`handleStall`) lalu menganggapnya stream putus: buka ulang -> laporkan galat jaringan ke JS -> JS
memuat ulang LAGU YANG SAMA (`fail` -> percobaan ulang). Hasilnya terdengar seperti "lagu mengulang dari awal".

**Perbaikan (dua lapis):**
- Native `PlaybackService`: macet di dalam 12 dtk terakhir lagu (`nearEnd`) = lagu selesai, bukan stream putus -> `finishTrack()`
  (pindah ke lagu cadangan bila sudah siap, kalau tidak kirim `ended` ke JS). Logika "lagu selesai" yang sama dipakai
  `STATE_ENDED` (dirapikan jadi satu metode).
- JS `useAudioPlayerController`: event `error` yang datang di dalam 12 dtk terakhir lagu (`NEAR_END_SECONDS`) dikirim ulang sebagai
  `ended`, sehingga mode ulang / lanjut ke lagu berikutnya / acak / berhenti-setelah-lagu berjalan seperti biasa.
- Konsekuensi: galat jaringan sungguhan di 12 dtk terakhir melewati sisa lagu (bukan memuat ulang dari awal).

Kalau masih terjadi, cek pengaturan ulang (Ulang 1x / Ulang lagu) dan kirim log `[MusicVerse] Galat ... di ujung lagu`.

## 2. Saran pencarian dari plugin StreamBeats lain
`plugins/suggestions.ts` sekarang memakai TIGA penyedia sekaligus (bersamaan, masing-masing maks. 6 dtk; yang gagal dilewati):
YouTube Music (sudah ada), **iTunes** (Search API, padanan `itunes-search-suggestions`), **MusicBrainz** (`/ws/2/recording`, padanan
`musicbrainz-suggestions`). Hasil digabung bergiliran, duplikat dibuang, YouTube Music di depan.
Diuji dengan fetch tiruan (parser dua API, penggabungan, satu penyedia gagal). Format respons asli kedua API tidak diuji dari jaringan.

## Belum dikerjakan dari daftar plugin StreamBeats
- `apple-music-importer`, `jiosaavn-importer`, `ytmusic-importer`: impor playlist dari layanan lain. `utils/playlistStorage.ts` dan
  form impor mengasumsikan URL Spotify, jadi perlu perubahan identitas playlist di beberapa tempat.
- `billboard`: tangga lagu untuk Beranda.

## Build: ada perubahan Java (`PlaybackService.java`), jadi butuh APK baru.
