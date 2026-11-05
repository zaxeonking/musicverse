# MusicVerse 0.4.13 — saran pencarian dari iTunes + MusicBrainz

## Peta plugin StreamBeats (bloomfactory) terhadap MusicVerse
| Plugin StreamBeats | Status di MusicVerse |
| --- | --- |
| `ytmusic` (v5) | Sudah ada (`plugins/ytmusic.ts`) |
| `ytvideo` (v4) | Sudah ada (`plugins/ytvideo.ts`) |
| `spotify-importer` (v4) | Sudah ada (`plugins/spotifyImporter.ts`) |
| `ytmusic-search-suggestion` | Sudah ada (`plugins/suggestions.ts`) |
| `lrcnet` (LRCLIB) | Sudah tercakup, malah lebih lengkap: LRCLIB + NetEase + lyrics.ovh (`services/lyricsApi.ts`) |
| `itunes-search-suggestions` | **Baru di 0.4.13** |
| `musicbrainz-suggestions` | **Baru di 0.4.13** |
| `billboard` (chart) | Belum: butuh bagian baru di UI dan pemilihan sumber data |
| `ytmusic-importer`, `apple-music-importer`, `jiosaavn-importer` | Belum: alur impor di UI masih khusus Spotify (validasi URL, muat otomatis, teks form, `fetchPlaylist`) |

## Apa
Ketik judul di kolom impor: saran sekarang berasal dari tiga sumber.
1. **YouTube Music** dicoba sendirian dulu (seperti sebelumnya). Bila sudah memberi cukup saran, tidak ada permintaan lain.
2. Bila kurang / gagal: **iTunes Search API** (`itunes.apple.com/search`, `entity=song`) dan **MusicBrainz**
   (`musicbrainz.org/ws/2/recording`) dipanggil BERSAMAAN, hasilnya digabung berurutan, tanpa duplikat (tak peka huruf
   besar/kecil), tanpa yang sama dengan teks yang diketik, dan dipotong sesuai batas.
- Format saran: `judul artis` (iTunes dan MusicBrainz; MusicBrainz memakai `artist-credit` + `joinphrase`, mis. "Under Pressure Queen & David Bowie").
- MusicBrainz: hasil dengan `score` < 60 dibuang; teks dicari setelah karakter khusus Lucene di-escape (judul seperti
  `Hello: (Live)` tidak lagi membuat HTTP 400).
- Galat satu penyedia tidak membatalkan yang lain; semua gagal = daftar kosong tanpa melempar. Hasil kosong tidak di-cache.
- Cache kini per (teks, batas) agar batas berbeda tidak saling menimpa.

## Berkas
`src/plugins/suggestions.ts` saja (`itunesSuggestionProvider`, `musicBrainzSuggestionProvider`, `parseItunesSuggestions`,
`parseMusicBrainzSuggestions`, `escapeLucene`, `mergeSuggestions`). Tanpa perubahan Java; build web saja.

## Pengujian
Dijalankan di Node dengan `fetch` tiruan (17 pemeriksaan): parser kedua sumber (duplikat, kosong, respons aneh, limit,
skor rendah, joinphrase), escape Lucene, penggabungan, "YTM cukup = 1 permintaan saja", "YTM kurang = digabung",
"YTM 500 + MusicBrainz error = iTunes tetap jalan", semua gagal, tidak di-cache saat kosong, cache tak peka huruf,
bentuk URL dan header, pembatalan. `tsc`: tidak ada galat baru dibanding 0.4.12.
**BELUM diuji ke server iTunes / MusicBrainz asli maupun di perangkat.**

## Catatan jujur
- Kode plugin aslinya tidak bisa dibaca dari sini (halaman folder GitHub memblokir akses otomatis), jadi ini dibuat dari
  API publik kedua layanan, bukan salinan plugin StreamBeats. Perilakunya bisa sedikit berbeda dari plugin aslinya.
- **MusicBrainz meminta User-Agent berisi kontak pengembang** (email/URL):
  https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting . Isi `MB_USER_AGENT` di `suggestions.ts` sebelum dirilis ke banyak
  orang. Batas MusicBrainz ±1 permintaan/detik; di sini hanya dipanggil bila YouTube Music kurang, dan lewat tunda 300 ms +
  cache, jadi jauh di bawah batas.
- iTunes Search API membatasi sekitar 20 permintaan/menit per IP; sama, hanya sebagai pelengkap.

## Tidak perlu Java baru; build ulang APK seperti biasa (`npm run android:sync`).
