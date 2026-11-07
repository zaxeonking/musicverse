# MusicVerse 0.4.7 — impor Spotify: jalur partner (pathfinder) ala StreamBeats

## Apa
Importer langsung (0.4.6) sekarang juga memakai API partner Spotify, seperti plugin `spotify-importer` StreamBeats,
sehingga playlist besar / playlist editorial yang ditolak API resmi untuk token anonim tetap bisa diimpor lengkap.

Urutan di `src/plugins/spotifyImporter.ts`:
1. Token anonim (embed -> embed seed -> /get_access_token).
2. Partner `fetchPlaylist` (hash tetap yang sama dengan plugin asli; judul, pemilik, sampul, paginasi 100). Bila kosong:
   `queryPlaylist` lawas (50 per halaman).
3. API resmi `api.spotify.com/v1`: DILEWATI bila partner sudah memberi semua lagu yang dilaporkan Spotify (`totalCount` > 0);
   selain itu dijalankan dan hasil yang lebih banyak dipakai. Judul/sampul dari partner dipertahankan.
4. Bila semuanya gagal: halaman embed (sebagian lagu).
Lalu, bila importer gagal total: retry sampai 5x, baru nexadev (tidak berubah dari 0.4.6).

## Catatan
- Pemutar sudah ExoPlayer/Media3 sejak 0.4.0, jadi tidak ada perubahan pemutar di versi ini.
- Belum diport: client-credentials (butuh client id/secret). Hash `fetchPlaylist` disalin dari plugin asli dan bisa
  basi bila Spotify mengubahnya; jalur API resmi / embed / nexadev tetap jadi cadangan.
- Diuji dengan Node memakai respons tiruan (partner lengkap -> API resmi tidak dipanggil; partner parsial -> API resmi
  dibandingkan; fetchPlaylist kosong -> queryPlaylist lawas; parser kedua bentuk item). Semua tes 0.4.6 tetap lolos.
  BELUM diuji ke server Spotify asli atau di perangkat. `tsc` tidak menambah galat baru.

## Perlu build ulang APK (bundel web berubah; tidak ada perubahan Java).
