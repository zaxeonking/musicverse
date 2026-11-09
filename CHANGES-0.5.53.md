# 0.5.53 (Beranda ala StreamBeats: banner bergerak, Recently, deretan kurasi, dan animasi)

Files: src/pages/HomePage.tsx, src/components/home/HomeHeader.tsx, HomeMenuDrawer.tsx, HomeBanner.tsx, HomeRecently.tsx, HomeShelf.tsx, HomeSections.tsx, HomeCards.tsx, homeNav.ts, src/components/ui/Reveal.tsx, src/components/ui/PlayingBars.tsx, src/components/layout/MobileHeader.tsx, src/components/search/BrowseDetail.tsx, src/pages/SearchPage.tsx, src/hooks/useHomeFeed.ts, useHomeShelf.ts, useInView.ts, useMountTransition.ts, src/services/artistApi.ts, src/services/homeFeed.ts, src/config/homeShelves.ts, src/index.css, src/tour/steps.ts, package.json (appVersion 0.5.53), CHANGES.md (0.5.52 diarsipkan), CHANGES-0.5.53.md, PROJECT_STRUCTURE.md

1. Kepala Beranda (`HomeHeader`)
   - Menu (laci dari kiri), sapaan + emoji sesuai jam, nama aplikasi, tombol sleep timer (titik hijau saat aktif), lonceng notifikasi (kini memuat info pembaruan APK), kolom cari, dan tombol filter.
   - Filter membuka kartu kecil: Cari lagu, Cari artis, Jelajah suasana & genre, Semua lagu.
   - Kepala umum (logo + gerigi) tidak lagi tampil di Beranda. Pengaturan, Tema, Riwayat, Rekap, dan Tutorial pindah ke laci menu. Penanda tutorial `settings-btn` dan `tour-restart` kini ada di tombol menu; langkah tutorial "Pengaturan" disesuaikan.

2. Banner (`HomeBanner`)
   - Kartu besar bersudut bulat: playlist pilihan chart Deezer (dengan deskripsi), lalu artis dan lagu rekomendasi. Tombol PUTAR SEKARANG memutar playlist; mengetuk kartu membuka detailnya.
   - Gerak: gulir otomatis tiap 6 detik (berhenti saat disentuh atau tab tersembunyi), gambar mengendap dari sedikit lebih besar, paralaks mengikuti gulir, penanda dan teks naik bergantian, titik aktif terisi sebagai hitungan mundur.

3. Recently (`HomeRecently`)
   - Lagu yang baru diputar dalam tiga baris menyamping dengan judul tegak di kiri. Lagu yang sedang diputar disorot dan bertanda equalizer. Ikon titik tiga membuka menu lagu.

4. Deretan kurasi (`HomeShelf`, `config/homeShelves.ts`)
   - New releases, All Time Hits, Favorit selamanya, Trending community playlists, Featured playlists for you, Indie Corner, Quick picks, Today's Indonesian Hits, Trending songs for you. Judul dan kata kunci diubah di `config/homeShelves.ts` tanpa menyentuh komponen.
   - Deretan baru dimuat saat sudah dekat layar (hemat kuota Deezer), tampil sebagai kerangka berdenyut lalu kartunya masuk bergantian. Deretan yang kosong/gagal tidak tampil.
   - Kartu playlist membuka detail di tab Cari (`/search?view=playlist&id=...`), kartu album `?view=album&id=...`; keduanya punya tombol Kembali ke asalnya.

5. Fungsi baru `artistApi.ts`: `fetchChartPlaylists`, `searchPlaylists`, `fetchPlaylistDetail`, `fetchNewReleases`. Cache: chart dan rilisan 6 jam, deretan dan detail playlist 12 jam (`mv:home:*`).

6. Animasi: semua memakai sistem yang ada (`mv-in`, `mv-swap`, `tap-card`, `Presence`-style via `useMountTransition`) dan ikut Kurangi gerakan. Blok baru muncul saat tergulir ke layar (`Reveal`).

7. Perbaikan aplikasi kadang crash
   - Aplikasi tidak punya penangkap galat: satu galat render mematikan seluruh UI. Ditambah `components/ui/ErrorBoundary.tsx`: di sekitar halaman (layar "Halaman ini bermasalah" dengan Coba lagi / Muat ulang) dan di tiap blok Beranda (banner, Recently, tiap deretan; yang gagal menghilang diam-diam).
   - Memori gambar: kartu memakai sampul playlist ±500px (bukan 1000px); sampul 1000px hanya untuk banner. Blur layar penuh di banner dan backdrop-blur di laci/penanda dihapus (berat di WebView lama).
   - Penyimpanan: banner hanya menyimpan deskripsi playlist (kecil), bukan daftar lagunya; daftar lagu playlist dibatasi 100.

Catatan
- Hanya TS/TSX/CSS: bisa lewat OTA, tanpa APK baru. Deretan online butuh APK dan koneksi (Deezer lewat `pluginFetch`); di web yang tampil banner ajakan, Recently, dan deretan dari riwayat.
- Belum dijalankan `npm run typecheck` / build (lingkungan tanpa node_modules dan jaringan). `tsc` dijalankan sebagian: tidak ada galat selain yang berasal dari tipe React dan paket yang tidak terpasang. Mohon jalankan `npm run typecheck` dan cek tampilan mobile (gelap dan terang).
- Kuota Deezer yang habis membuat deretan kurasi kosong (tidak ada galat tampil).
