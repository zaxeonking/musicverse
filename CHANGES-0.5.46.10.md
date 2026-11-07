# MusicVerse 0.5.46.10 — Lagu yang sama dikenali sebagai "sedang diputar" dari sumber mana pun

Hanya JS (tanpa APK baru).

## Masalah
Penanda "sedang diputar" (ikon jeda, judul beraksen) hanya menyala bila ID lagunya sama persis. ID lagu yang sama berbeda antar sumber
(hasil Cari, album, daftar lagu artis, playlist), jadi lagu yang sedang diputar dari satu tempat tidak menyala di tempat lain.

## Perubahan
- Baru `src/utils/sameSong.ts`: `isSameSong` (ID/URL sama, atau judul sama + artis beririsan; awalan "Artis - " pada judul diabaikan)
  dan `makeSongMatcher` (bila lagu aktif ada di daftar dengan ID persis sama, hanya baris itu yang menyala; bila tidak, baris yang lagu sama).
- Dipakai di: `TrackList` (playlist, album, daftar lagu artis, Cari — prop `playingTrackId` diganti `playingTrack`), tombol Putar semua/Jeda
  (`usePlaylistPlayback`), `MyPlaylistPage`, `DownloadsSection`, `LocalFolder`, `RecentlyPlayedList` (prop `currentTrackUrl` diganti `currentTrack`).

## Perilaku
- Mengetuk baris yang menyala (lagu sama dari daftar lain) tidak memuat ulang antrean dari daftar itu; ia membuka pemutar penuh
  seperti baris aktif biasa. Untuk pindah antrean, putar lagu lain dari daftar itu.
- Judul yang berbeda ejaan atau versi lain ("(Live)", "Remix") dianggap lagu berbeda; artis yang berbeda dengan judul sama juga tidak menyala.

## Belum diuji
Hanya cek sintaks (tanpa node_modules / typecheck penuh).
