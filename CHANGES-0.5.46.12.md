# MusicVerse 0.5.46.12 — "Sudah ada di playlist ..." muncul di semua daftar lagu dan mengenali lagu yang sama dari sumber lain

Hanya JS (tanpa APK baru).

## Masalah
Penanda "Sudah ada di <playlist>" hanya muncul di hasil Cari lagu satuan dan hanya bila ID Spotify / URL-nya persis sama. Lagu yang
sama dari album, daftar lagu artis, atau sumber dengan ID/URL lain tidak ditandai. Tiap baris juga menyisir semua lagu di semua playlist.

## Perubahan
- Baru `src/utils/playlistMembership.ts` (`buildPlaylistMembership`): indeks lagu -> nama playlist buatan pengguna (termasuk Lagu Disukai),
  dibangun sekali per perubahan playlist. Cocok bila ID/URL sama, atau lagu yang sama menurut `isSameSong` (judul sama + artis beririsan).
- `sameSong.ts`: ekspor `songTitleKey` (kunci judul ternormalisasi untuk pengelompokan).
- `TrackList.tsx`: menghitung daftar playlist per lagu dan mengirimnya ke baris lewat prop `playlistNames`; berlaku untuk semua pemakai
  (Cari, album, lagu artis, tampilan playlist), bukan hanya `searchable`.
- `TrackRow.tsx`: tidak lagi menyisir playlist sendiri; memakai `playlistNames`. Tampilan (centang, judul redup, "Sudah ada di A, B +n") tetap.
- Otomatis ikut berubah saat lagu ditambah/dihapus dari playlist atau playlist diganti nama.

## Batas
- Judul beda ejaan / versi lain ("(Live)", "Remix") dianggap lagu berbeda (aturan `isSameSong`).
- Belum dipasang di Unduhan, Folder Lokal, dan Terakhir Diputar.
- Hanya cek sintaks manual (tanpa node_modules / typecheck penuh).
