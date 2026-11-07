# MusicVerse 0.4.6 — impor Spotify langsung (nexadev jadi cadangan)

## Apa
Impor playlist Spotify sekarang lewat importer langsung ke Spotify (port TypeScript dari plugin `spotify-importer`
StreamBeats/bloom-factory), bukan lagi `api.nexadev.my.id`. nexadev hanya dipakai bila importer gagal setelah
5x retry (1 percobaan + 5 ulang = 6 percobaan, jeda 0,8 / 1,6 / 3,2 / 5 / 5 dtk).

- Baru `src/plugins/spotifyImporter.ts`: token anonim dari halaman embed (lalu playlist embed seed, lalu
  `/get_access_token`) -> API `api.spotify.com/v1` (paginasi 100, lagu lokal dilewati) -> bila gagal, baca data dari halaman embed.
- `spotifyApi.fetchPlaylist`: importer dulu; diulang hanya untuk galat yang masuk akal diulang (jaringan/timeout/5xx).
  Playlist tidak ada/privat (404 di semua jalur) tidak diulang, langsung ke cadangan. Pembatalan (abort) menghentikan retry
  dan tidak memanggil nexadev.

## Tetap lewat nexadev
- Pencarian judul dan info satu lagu dari tautan Spotify (importer hanya menangani playlist/album).

## Batas
- Importer hanya jalan di APK (butuh HTTP native bebas CORS); di browser langsung ke cadangan tanpa retry.
- Jalur partner/pathfinder dan client-credentials dari plugin aslinya BELUM diport. Playlist besar yang API-nya menolak
  token anonim bisa jatuh ke embed (hanya memuat sebagian lagu) atau ke cadangan.
- Diuji dengan Node memakai respons Spotify tiruan (paginasi, lagu lokal, fallback embed, 6 percobaan lalu cadangan,
  berhenti saat berhasil, 404 tidak diulang, abort). BELUM diuji ke server Spotify asli atau di perangkat.
  `tsc` tidak menambah galat baru.

## Perlu build ulang APK (bundel web berubah; tidak ada perubahan Java).
