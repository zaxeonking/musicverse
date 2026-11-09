# 0.5.54.7 (Riwayat pencarian, acak cerdas, kartu Rangkuman)

Files: src/components/playlist/PlaylistImportForm.tsx, src/utils/playerQueue.ts, src/utils/smartShuffle.ts (baru), src/hooks/useAudioPlayerController.ts, src/pages/PlaybackSettingsPage.tsx, src/utils/shareCard.ts, src/components/player/TrackMenuSheet.tsx, src/pages/RecapPage.tsx, src/components/layout/BottomNav.tsx, src/components/player/MiniPlayer.tsx, src/components/player/MiniBubble.tsx, src/components/layout/UpdateBanner.tsx, src/components/home/HomeBanner.tsx, src/components/home/HomeArtists.tsx, src/components/ui/SettingSwitch.tsx, src/components/player/LyricsPanel.tsx, src/tour/TourHost.tsx, src/pages/ThemeSettingsPage.tsx, src/components/playlist/PlaylistHeader.tsx, src/index.css, src/tour/steps.ts, package.json (appVersion 0.5.54.7), CHANGES.md (0.5.54.6 diarsipkan), CHANGES-0.5.54.7.md, PROJECT_STRUCTURE.md

1. Pencarian terakhir (halaman Cari)
   - Penyimpanan (`utils/searchHistory.ts`) sudah ada sejak dulu (dipakai rekomendasi Beranda), tetapi belum punya tampilan. Kini saat kolom cari kosong, kata kunci terakhir (maks. 20) tampil sebagai chip di bawah kolom, dengan tombol Hapus semua.
   - Ketuk chip = isi kolom lalu langsung cari, mengikuti jenis pencarian yang aktif (Lagu atau Artis). Hapus semua juga mengosongkan bahan rekomendasi "Karena kamu mencari ..." di Beranda (itu memang sumbernya).

2. Acak cerdas (Pengaturan > Pemutaran, APK)
   - Saklar baru, bawaan MATI (`musicverse:smart-shuffle:v1`). Menyala: artis pertama yang sama tidak berturut-turut (selama masih ada artis lain), dan lagu yang jarang diputar menurut Riwayat cenderung lebih awal (bobot 1 / (1 + jumlah putar); lagu favorit tidak dibuang, hanya condong ke belakang). Bila satu artis menguasai lebih dari separuh sisa antrean, artis itu didahulukan supaya tidak terpaksa berderet di akhir.
   - `playerQueue.ts`: `createSmartShuffleOrder` (fungsi murni). `utils/smartShuffle.ts`: saklar, hitung putaran dari log, dan `makeShuffleOrder` yang dipakai tiga tempat di `useAudioPlayerController.ts` (mulai putar, nyalakan acak, pulihkan sesi) menggantikan `createShuffleOrder` langsung. Antrean kurang dari 3 lagu memakai acak biasa.
   - Diuji dengan skrip sementara (500 putaran, 30 lagu, 6 artis): urutan selalu permutasi lengkap dengan lagu aktif di depan, 0 pasangan artis sama berturut-turut, lagu yang sering diputar rata-rata di posisi 26 dari 30 (acak biasa sekitar 14).

3. Kartu Rangkuman yang bisa dibagikan
   - Halaman Rangkuman punya tombol Bagikan kartu rangkuman: gambar 9:16 berisi waktu dengar, putaran, jumlah lagu, streak, 3 lagu dan 3 artis teratas untuk periode yang dipilih. Digambar di perangkat (tanpa data keluar); lembar bagikan sama dengan kartu Sedang diputar.
   - `shareCard.ts`: bagian kirim gambar dipisah jadi `deliverCard` (dipakai dua kartu); `renderRecapCard` dan `shareRecapCard` baru.

4. Perbaikan: kartu lagu terbagi lagu lama
   - Berkas kartu selalu bernama sama (`sedang-diputar.png`), sehingga aplikasi tujuan bisa menampilkan gambar lama dari cache. Kini nama berkas unik per bagikan (`...-<waktu>.png`) dan berkas lama di folder `share/` dihapus. Berlaku juga untuk kartu Rangkuman.
   - Menu pemutar kini membuat kartu dari `player.currentTrack` saat tombol ditekan, bukan lagu saat menu dibuka.

5. Timer tidur: tidak diubah
   - Pilihan "Setelah lagu ini selesai" dan volume mengecil pelan sudah ada (30 detik terakhir untuk timer menit, 8 detik terakhir untuk akhir lagu), jadi tidak ada yang perlu ditambah.

6. Entri "Yang baru" 0.5.54.7 ditambahkan (dua langkah).

7. Performa animasi (meniru pendekatan Auralys: tanpa blur yang dihitung ulang tiap frame)
   - Pembanding: APK Auralys 4.3.2 adalah aplikasi native Jetpack Compose (animasi di render thread, Baseline Profile). MusicVerse berjalan di WebView, jadi yang bisa dilakukan adalah membuang pekerjaan yang paling memberatkan WebView.
   - `backdrop-filter` dibuang dari: BottomNav (blur 16px + brightness di atas daftar yang digulir), kartu MiniPlayer (blur 40px), MiniBubble, UpdateBanner, `.back-glass` (tombol kembali sticky), dan header sticky Pengaturan Tema. Latar kartu-kartu itu dinaikkan ke 95% buram (bg-card/95, bg-raised/95) supaya terbaca sama. Aturan `[data-morphing]` di index.css dibiarkan (tidak berbahaya).
   - Bulatan cahaya dekoratif (`blur-2xl/3xl`) di HomeBanner, HomeArtists, UpdateBanner diganti gradasi radial (`.mv-orb-accent`, `.mv-orb-coral`). Di HomeBanner bulatan itu bergerak terus (`mv-float`, tak berhingga) sambil ter-blur 100+ px: itu salah satu beban terbesar.
   - `transition-all` diganti transisi properti yang spesifik (LyricsPanel: transform + warna; titik TourHost: lebar + warna). Knob SettingSwitch kini menggeser `transform`, bukan `left` (memicu layout).
   - PlaylistHeader: blur-3xl jadi blur-2xl + `transform-gpu`.
   - Efek yang berubah tampilannya: kaca tembus pandang pada nav/mini player kini lebih pekat (tidak lagi memburamkan isi di belakangnya). Untuk mengembalikan, tambahkan `backdrop-blur` kembali pada elemen itu.
   - Tidak diubah: glow sampul mini player (`data-mini-glow`, blur 20px, sudah statis setelah berdenyut sekali), animasi `clip-path` kartu <-> disc, spring `--sheet-ease` (sudah berupa kurva pegas).

Catatan
- Belum diukur di HP: tidak ada profiler/emulator di lingkungan ini. Bandingkan sebelum dan sesudah dengan "Profile GPU rendering" (Opsi Pengembang) atau `chrome://inspect` pada WebView.
- Tidak butuh APK baru (JS saja; bisa lewat OTA). Pengguna lama: acak cerdas mati sampai dinyalakan.
- Belum diuji: lingkungan tanpa node_modules/jaringan, jadi `npm run typecheck` dan `npm run build` belum dijalankan penuh, dan tampilan belum dilihat di layar. Jalankan keduanya sebelum rilis; periksa chip di mode terang/gelap dan kartu Rangkuman di HP nyata (font Bricolage Grotesque dimuat lewat document.fonts).
