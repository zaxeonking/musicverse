# 0.5.52 (Beranda ala Spotify, pencarian pindah ke tab Cari dengan jelajah suasana dan genre)

Files: src/pages/HomePage.tsx, src/pages/SearchPage.tsx, src/components/search/*, src/config/moods.ts, src/utils/searchResultsFlag.ts, src/components/library/PlaylistsSection.tsx, src/pages/LibraryPage.tsx, src/components/playlist/ArtistMatches.tsx, src/components/home/HomeBanner.tsx, HomeSections.tsx, HomeCards.tsx, homeNav.ts, src/hooks/useHomeFeed.ts, src/services/homeFeed.ts, src/services/artistApi.ts, src/utils/searchHistory.ts, src/components/playlist/PlaylistImportForm.tsx, src/tour/steps.ts, package.json (appVersion 0.5.52), CHANGES.md (0.5.51.85 diarsipkan), CHANGES-0.5.52.md, PROJECT_STRUCTURE.md

0. Pencarian pindah ke tab Cari
   - Kolom cari di Beranda kini tombol yang membuka tab Cari dan langsung memfokuskan kolomnya. Seluruh logika (judul, artis, tautan Spotify, saran, mode Lagu/Artis) dan hasilnya (PlaylistView, ArtistSearchPanel) ada di tab Cari.
   - Membuka playlist dari tab Playlist / Beranda kini mendarat di tab Cari (`searchResults` menandai hasil yang sengaja dibuka; playlist hasil pemulihan saat aplikasi dibuka tidak menutup jelajah).
   - Tab Cari kosong = jelajah: Kejutkan aku (putar acak satu suasana), Di perangkatmu (Semua lagu, Artis & Album, Riwayat, Rekap, Playlist, Unduhan di APK), Suasana (12 kotak, playlist kurasi Deezer), Genre (Deezer, hanya bila ada jaringan di APK). Isi kotak: `/search?view=mood|genre&id=...` atau `?view=all`.
   - "Semua lagu" (isi lama tab Cari) pindah jadi kotak di jelajah, dengan kolom saring sendiri.
   - Langkah tutorial "Mulai dari sini" dan "Cari lagu atau artis" kini di rute /search. Tombol "Muat playlist" di Playlist mengarah ke /search.

1. Susunan Beranda
   - Sapaan, banner, tombol cari (ke tab Cari), lalu deretan: Playlist yang sering kamu dengar, Artis favoritmu, rekomendasi ("Karena kamu sering dengar X" / "Karena kamu mencari ..."), Dengar lagi.
   - Banner bergulir menyamping berisi artis dan lagu acak (urutan acak tiap Beranda dibuka). Pengguna baru mendapat artis dan lagu chart dunia; tanpa data sama sekali (web / offline) banner jadi ajakan "Mulai cari".
   - Artis yang dibuka dari Beranda/jelajah tampil di tab Cari; saat ditutup, tab Cari kembali ke jelajah (bukan daftar mode Artis).

2. Sumber data (semua di perangkat, kecuali bahan rekomendasi)
   - Playlist favorit: `RecentPlay.playlistId` di "Baru diputar", dicocokkan ke Playlist saya / Koleksi; urut jumlah lagu yang diputar. Tanpa perubahan penyimpanan log.
   - Artis favorit: `computeStats(readPlayLog())`. Foto dan id Deezer dicari lewat `resolveArtistByName`; hasil yang namanya tidak cocok dibuang (kartu lalu mencari lewat nama).
   - Rekomendasi: radio artis Deezer dari 2 artis teratas dan kata kunci terbaru (`searchTrackArtist`, maks. 3 benih). Tanpa riwayat: chart dunia.
   - Riwayat cari baru (`utils/searchHistory.ts`, maks. 20): dicatat saat pencarian judul/artis dikirim atau saran dipilih. Tautan Spotify tidak dicatat.
   - Dengar lagi: lagu diputar >= 2 kali dan belum diputar dalam 2 hari terakhir (offline, tanpa jaringan).
   - Cache `mv:home:*` di localStorage: chart 6 jam, radio 12 jam, artis/benih 30 hari; bila jaringan gagal salinan lama dipakai.

3. Fungsi baru `artistApi.ts`: `fetchChartTracks`, `fetchChartArtists`, `searchTrackArtist`, `fetchGenres`, `fetchGenreTracks`, `fetchGenreArtists`, `fetchMoodTracks`. Cache jelajah: genre 7 hari, lagu genre 6 jam, lagu suasana 12 jam (`mv:browse:*`).

Catatan
- Hanya TS/TSX: bisa lewat OTA, tanpa APK baru. Bagian online (chart, radio, foto artis) hanya jalan di APK karena memakai `pluginFetch` (Deezer tanpa CORS); di web yang tampil banner ajakan dan deretan dari riwayat lokal.
- Pengguna lama: deretan terisi dari "Baru diputar" dan Riwayat yang sudah ada; rekomendasi berbasis pencarian mulai terisi setelah mereka mencari lagi.
- Belum dijalankan `npm run typecheck` / build (lingkungan tanpa node_modules dan jaringan). tsc dijalankan sebagian: tidak ada galat selain yang berasal dari tipe React yang tidak terpasang. Mohon jalankan `npm run typecheck` dan cek tampilan mobile (gelap dan terang).
- Deretan memakai Deezer tanpa kunci API; kuota Deezer yang habis membuat bagian online kosong (tidak ada galat tampil).
