# MusicVerse 0.4.8 — tanpa nexadev untuk info lagu & pencarian judul, lirik hybrid lebih lengkap, saran pencarian

## Apa
1. **Info satu lagu (tautan Spotify) dan pencarian judul tidak lagi lewat nexadev.** `spotifyImporter.ts` mendapat
   `importSpotifyTrack` (API `/v1/tracks/{id}` -> halaman embed track) dan `searchSpotifyTrack` (`/v1/search`, hasil teratas).
   Kebijakan sama dengan impor playlist: diulang sampai 5x (1 + 5 percobaan), baru nexadev sebagai cadangan. Galat yang
   pasti sama bila diulang (400/403/404 di semua jalur, hasil pencarian kosong) tidak diulang, langsung ke cadangan,
   supaya pencarian saat mengetik tidak menunggu belasan detik. Pembatalan menghentikan retry.
2. **Lirik hybrid, urutan lebih adil soal kelengkapan.** Plugin lirik StreamBeats (`lrcnet`) ternyata hanya membungkus
   LRCLIB, sedangkan MusicVerse sudah menggabungkan LRCLIB + NetEase + lyrics.ovh. Yang ditambah: penalti kelengkapan di
   `rankCandidates` — versi yang barisnya < 60% (penalti 25) / < 80% (penalti 10) dari versi terpanjang sumber lain kalah,
   walau bertanda waktu; jadi lirik yang cuma satu-dua bait tidak lagi menang hanya karena punya timestamp.
   Sumber seimbang tetap urut LRCLIB > NetEase.
3. **Saran pencarian (modul penyedia).** `src/plugins/suggestions.ts`: antarmuka `SuggestionProvider` + penyedia YouTube Music
   (port plugin `ytmusic-search-suggestion`), cache 50 query, tidak pernah melempar galat. Muncul sebagai daftar di bawah kolom
   judul/tautan di Beranda (ditunda 300 ms, hanya saat mengetik judul, hanya di APK).

## Belum dikerjakan (sengaja)
- **Chart (Billboard):** butuh halaman baru + desain UI; bukan sekadar modul data.
- **Scrobbler:** katalog bloom-factory TIDAK punya plugin scrobbler (hanya antarmuka WIT), jadi tidak ada acuan untuk
  diport; perlu keputusan layanan (ListenBrainz / Last.fm) dan layar login/token.
- Penyedia saran tambahan (iTunes, MusicBrainz) belum diport; daftar penyedia siap diperluas.

## Batas
- Semua jalur langsung hanya jalan di APK (HTTP native bebas CORS). Pencarian lewat API Spotify memakai token anonim web
  player; bila Spotify menolaknya (403) pencarian jatuh ke nexadev, tanpa retry.
- Diuji dengan Node memakai respons tiruan (18 skenario: impor playlist, partner, info lagu, pencarian, retry/cadangan,
  abort, ranking lirik, parser saran). BELUM diuji ke server Spotify/YouTube asli atau di perangkat. `tsc` tidak
  menambah galat baru.

## Perlu build ulang APK (bundel web berubah; tidak ada perubahan Java).
