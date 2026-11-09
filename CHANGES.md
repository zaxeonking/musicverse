# Riwayat perubahan MusicVerse (arsip)

Gabungan semua catatan versi lama, terbaru di atas. Catatan versi terbaru ada di `CHANGES-0.5.53.md`.
Tiap bagian diawali komentar `sumber:` dengan nama berkas aslinya.

<!-- sumber: CHANGES-0.5.52.md -->
# 0.5.52 (Beranda ala Spotify, pencarian pindah ke tab Cari dengan jelajah suasana dan genre)

Files: src/pages/HomePage.tsx, src/pages/SearchPage.tsx, src/components/search/*, src/config/moods.ts, src/utils/searchResultsFlag.ts, src/components/library/PlaylistsSection.tsx, src/pages/LibraryPage.tsx, src/components/playlist/ArtistMatches.tsx, src/components/home/HomeBanner.tsx, HomeSections.tsx, HomeCards.tsx, homeNav.ts, src/hooks/useHomeFeed.ts, src/services/homeFeed.ts, src/services/artistApi.ts, src/utils/searchHistory.ts, src/components/playlist/PlaylistImportForm.tsx, src/tour/steps.ts, package.json (appVersion 0.5.52), CHANGES.md (0.5.51.85 diarsipkan), CHANGES-0.5.52.md, PROJECT_STRUCTURE.md

0. Pencarian pindah ke tab Cari
   - Kolom cari di Beranda kini tombol yang membuka tab Cari dan langsung memfokuskan kolomnya. Seluruh logika (judul, artis, tautan Spotify, saran, mode Lagu/Artis) dan hasilnya (PlaylistView, ArtistSearchPanel) ada di tab Cari.
   - Membuka playlist dari tab Playlist / Beranda kini mendarat di tab Cari (`searchResults` menandai hasil yang sengaja dibuka; playlist hasil pemulihan saat aplikasi dibuka tidak menutup jelajah).
   - Tab Cari kosong = jelajah: Kejutkan aku (putar acak satu suasana), Di perangkatmu (Semua lagu, Artis & Album, Riwayat, Rekap, Playlist, Unduhan di APK), Suasana (12 kotak, playlist kurasi Deezer), Genre (Deezer, hanya bila ada jaringan di APK). Isi kotak: `/search?view=mood|genre&id=...` atau `?view=all`.
   - "Semua lagu" (isi lama tab Cari) pindah jadi kotak di jelajah, dengan kolom saring sendiri.
   - Kolom cari di tab Cari tidak sticky (diam di atas halaman); isinya tinggi sehingga bila sticky menutupi daftar yang tergulir.
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

<!-- sumber: CHANGES-0.5.51.85.md -->
# 0.5.51.85 (latar kolom cari tidak lagi terpotong, kotak sampul pemutar mini beranimasi)

Files: native/android/java/RelaunchActivity.java, scripts/setup-android.mjs, src/pages/SearchPage.tsx, src/components/player/MiniPlayer.tsx, src/index.css, package.json (appVersion 0.5.51.85), CHANGES.md (0.5.51.7 diarsipkan), CHANGES-0.5.51.85.md, PROJECT_STRUCTURE.md

1. Nomor versi
   - `appVersion` dinaikkan 0.5.51.7 -> 0.5.51.85 (`version` semver tetap 0.5.51). Tidak ada fitur baru, jadi tidak ada entri Yang baru baru.

2. Halaman Cari: tepi gelap di belakang kolom cari dihapus
   - Penyebab: lapisan blur di belakang kolom cari memakai `bg-bg/30` (tint gelap) dengan tepi atas yang keras, sehingga tampak potongan hitam di atas
     cahaya latar biru. Kini lapisan hanya blur (tanpa warna) dan masknya memudar di atas DAN bawah, jadi tidak ada garis potong.
   - Kolom cari sticky lain (TrackList, bar pilih lagu) belum diubah.

3. Kotak sampul di pemutar mini tidak lagi muncul/hilang mendadak
   - Disc -> kartu (`runDiscFly`): kotak sampul kini kosong dulu (sampul disembunyikan karena sedang terbang di luar), membesar + memudar masuk,
     lalu sampul memudar masuk di atasnya saat disc mendarat; kotak kosongnya memudar sesudahnya.
   - Kartu -> disc (`applyCoverSlot` di `applyRoll`): sampul di kotak langsung disembunyikan begitu disc pratinjau terbawa, kotak kosongnya
     mengecil + memudar bersama kartu (dulu sampul tertinggal, hanya tertutup disc).
   - Mini -> pemutar penuh dan kembali: kotak tidak lagi `visibility:hidden` utuh (hilang/muncul mendadak). Yang disembunyikan hanya sampulnya; kotak
     kosong memudar masuk saat pemutar penuh terbuka dan memudar keluar saat tertutup.
   - Elemen baru `[data-mini-slot]` di dalam `[data-mini-cover]`; ikut Kurangi gerakan (tanpa transisi).

4. Ganti tema (ikon ikut tema): tampak seperti aplikasi dimulai ulang, bukan keluar ke layar utama (APK baru)
   - Penyebab: `RelaunchActivity` transparan. Saat ROM menutup proses utama karena ikon peluncur berganti, pengguna melihat layar utama
     di belakang activity transparan itu sampai aplikasi terbuka lagi (~1 dtk).
   - Kini `RelaunchActivity` berlayar penuh: latar warna tema (`PREF_BG`, sama dengan latar jendela MainActivity) + ikon aplikasi memudar masuk,
     status bar dan navigation bar searna. Layar utama tidak lagi terlihat; aplikasi lalu terbuka lagi lewat ikon baru seperti sebelumnya.
   - `setup-android.mjs`: tema activity di manifest diganti `Theme.DeviceDefault.NoActionBar`; manifest lama yang masih bertema transparan ikut diperbarui.
   - Bila ROM tidak menutup aplikasi, layar ini tampil sekitar 1 dtk lalu aplikasi kembali ke depan dengan keadaan sama (tidak dimulai ulang sungguhan).

Catatan
- Bagian 4 mengubah Java dan manifest: butuh APK baru (`npm run android:sync` lalu build). OTA saja tidak cukup.
- Bagian 2 dan 3 hanya TSX/CSS: bisa lewat OTA, tanpa APK baru.
- versionName APK menjadi 0.5.51.85 dan versionCode naik (diisi `scripts/setup-android.mjs` saat `npm run android:sync`). Tanpa perubahan Java/native.
- Belum dijalankan `npm run typecheck` / build.

## Daftar isi

- 0.5.51.7
- 0.5.51.5
- 0.5.51
- 0.5.50.7
- 0.5.50.4
- 0.5.50.3
- 0.5.50
- 0.5.47.8
- 0.5.47.5
- 0.5.46.13
- 0.5.46.12
- 0.5.46.11
- 0.5.46.10
- 0.5.46.9
- 0.5.46.8
- 0.5.46.7
- 0.5.46.6
- 0.5.46.5
- 0.5.46.4
- 0.5.46.3
- 0.5.46
- 0.5.43-ui
- 0.5.43
- 0.5.43-nav
- 0.5.43-anim
- 0.5.43-splash
- 0.5.42-radio
- 0.5.42
- 0.5.41
- 0.5.40.5
- 0.5.40
- 0.5.39.8
- 0.5.39
- 0.5.38.5
- 0.5.37.6
- 0.5.37.5
- 0.5.36
- 0.5.28
- 0.5.27
- 0.5.26
- 0.5.25
- 0.5.24
- 0.5.23
- 0.5.21
- 0.5.20
- 0.5.19
- 0.5.18
- 0.5.17
- 0.5.16
- 0.5.15
- 0.5.14
- 0.5.13
- 0.5.12
- 0.5.11
- 0.5.10
- 0.5.9
- 0.5.8
- 0.5.7
- 0.5.6
- 0.5.4
- 0.5.3
- 0.5.2
- 0.5.1
- 0.5.0
- 0.4.34
- 0.4.33
- 0.4.32
- 0.4.31
- 0.4.30
- 0.4.29
- 0.4.28
- 0.4.27
- 0.4.26
- 0.4.25
- 0.4.24
- 0.4.23
- 0.4.22
- 0.4.21
- 0.4.20
- 0.4.19
- 0.4.18
- 0.4.17
- 0.4.16
- 0.4.15
- 0.4.14
- 0.4.13
- 0.4.12
- 0.4.11
- 0.4.10
- 0.4.9
- 0.4.8
- 0.4.7
- 0.4.6
- 0.4.5
- 0.4.4
- 0.4.3
- 0.4.2
- 0.4.1
- 0.4.0
- 0.3.8
- 0.3.7


---

<!-- sumber: CHANGES-0.5.51.7.md -->

# 0.5.51.7 (layar penuh sampai kamera, glow pemutar mini lebih lembut, buka-ulang ikon lebih andal)

Files: native/android/java/{MainActivity,MusicVerseNativePlugin,PlaybackService,RelaunchActivity}.java, src/components/player/NativeMediaSync.tsx, src/native/musicVerseNative.ts, scripts/setup-android.mjs, src/components/player/{MiniPlayer,LyricsPanel}.tsx, src/pages/SearchPage.tsx, src/components/layout/MobileHeader.tsx, src/index.css,
semua komponen yang memakai safe-area (BottomNav, MobileHeader, AppShell, FullPlayer, LyricsPanel, QueuePanel, sheet-sheet menu, TrackMenuContext, dst.),
src/tour/steps.ts (entri Yang baru 0.5.51.7), src/native/musicVerseNative.ts (komentar), package.json (appVersion 0.5.51.7), CHANGES.md (0.5.51.5 diarsipkan), PROJECT_STRUCTURE.md

1. Layar penuh sampai area kamera (APK baru)
   - Penyebab: WebView berada di bawah status bar, jadi strip paling atas hanya latar jendela. `MainActivity.enableEdgeToEdge()`: jendela tidak menyisakan
     ruang untuk bar sistem (`setDecorFitsSystemWindows(false)`), status bar dan navigation bar transparan, mode poni `shortEdges`, margin WebView dihapus.
   - Tinggi inset dikirim native ke CSS sebagai `--sat/--sab/--sal/--sar` (px CSS; `--sab` = 0 saat keyboard terbuka). `index.css` memberi nilai awal dari
     `env(safe-area-inset-*)` (cadangan web/iOS). Semua pemakaian `env(safe-area-inset-*)` di src diganti `var(--sat|--sab|--sal|--sar)`.
2. Cahaya latar pemutar mini
   - Dulu `box-shadow` setipis tepi kartu (tampak seperti garis keras). Kini lapisan warna sampul yang di-blur 20 px, menyebar ke atas dan samping; sisi bawah
     ditarik ke dalam supaya tidak menyentuh navbar. Aturan tema terang di `index.css` ikut disesuaikan (`blur(20px) saturate(0.8)`).
3. Buka-ulang otomatis sesudah ganti ikon lebih andal
   - Tanpa izin alarm tepat, Android 12+ memakai alarm hemat daya yang bisa telat/ditahan Doze, dan Android 14+ bisa menolak buka activity dari latar.
     Kini memakai `setAlarmClock` (tepat waktu, tanpa izin tambahan; alarm lama jadi cadangan), PendingIntent diberi izin BAL (API 34+), jeda 0,7 -> 0,6 dtk.
4. Cahaya latar tidak lagi terpotong di halaman Cari
   - Pembungkus kolom cari (sticky) dan header seluler memakai `bg-bg` pekat, jadi cahaya latar (`mv-glow` di AppShell) terputus di belakangnya. Kini
     pembungkus transparan dengan lapisan blur yang memudar ke bawah (daftar yang tergulir tidak menabrak kolom), header tanpa latar.
   - Kolom cari berkaca: `bg-raised/60`, blur, garis tipis, dan pantulan warna aksen lembut dari atas.
   - Kolom cari sticky lain (TrackList, bar pilih lagu) belum diubah.
5. Animasi disc -> kartu tidak lagi "macet" sesaat di tengah jalan
   - Penyebab: `runDiscFly` memakai satu animasi dengan keyframe tengah (offset 0.3 dan 0.75) yang masing-masing ber-easing; kecepatan kembali ke 0 di tiap
     batas keyframe, terlihat sebagai disc berhenti sepersekian detik. Kini tiga lapis bersarang: geser dan putar memakai satu kurva mulus tanpa keyframe
     tengah (putaran tetap sebanding jarak), sedangkan mengecil + berubah bentuk mulai setelah jeda 20% (`delay`) dan selesai bersamaan.
6. Buka-ulang sesudah ganti ikon: pembuka di proses tersendiri (`RelaunchActivity`)
   - Alarm saja tidak cukup di ROM yang memblokir buka activity dari latar belakang (izin "pop-up saat di latar" bawaan MATI di MIUI/HyperOS dll.).
     Kini `RelaunchActivity` (transparan, `android:process=":relaunch"`) dibuka SAAT aplikasi masih di depan (diizinkan sistem), alias baru dinyalakan
     ±250 ms sesudahnya, lalu dari activity itu aplikasi dibuka lewat ikon baru (±1,1 dtk, ulang sampai 6x bila alias belum aktif). Proses tersendiri tetap
     hidup walau proses utama ditutup ROM. Alarm `setAlarmClock` tetap jadi cadangan.
   - File baru: `native/android/java/RelaunchActivity.java`; `scripts/setup-android.mjs` memasang entri manifest-nya.
7. Sorotan per kata di lirik pemutar penuh (otomatis, cadangan per kalimat)
   - `LyricsPanel.tsx`: konstanta `LINE_ONLY = true` yang mematikan sorotan kata dihapus. Baris aktif disapu per kata (`KaraokeWords`, per huruf, tepi lembut,
     sama dengan mini player) HANYA bila sumber memberi waktu kata asli (eLRC / TTML / LyricsPlus / BetterLyrics) dan waktu lirik cocok dengan audio (mode `exact`).
     Selain itu (lirik per baris, durasi beda / `scaled` / `estimated`) baris aktif tetap disorot utuh per kalimat.
   - Waktu kata TIDAK lagi ditebak dari panjang huruf di pemutar penuh (dulu dipakai saat LINE_ONLY=false). Romanisasi per kata ikut terisi bila servernya memberi waktu kata.
   - Entri Yang baru 0.5.51.7 bertambah satu langkah (`wn-lyrics-word`).
8. Notifikasi musik hilang saat tabrakan dengan suara lain + sampul tidak muncul saat diputar lagi
   - Notifikasi hilang: saat app lain mengambil audio, sebagian ROM menyingkirkan notifikasi media yang sedang jeda dan mengirim `ACTION_SWIPED`.
     Dulu native hanya memasangnya kembali bila `current.interrupted` / resumer sedang menunggu; selain itu `shutdown()` (notifikasi + pemutar mati).
     Kini ada `focusLossAt`: geseran dalam 3 menit sesudah kehilangan fokus dianggap ulah ROM, notifikasi dipasang lagi (dan sekali lagi ±0,8 dtk kemudian).
   - Sampul hilang: JS mengirim sampul base64 SEKALI per lagu (`sentCover`). Setelah service mati lalu diputar lagi dari aplikasi, service baru tanpa sampul
     sementara JS menganggap sudah terkirim. Kini `updateNowPlaying` mengembalikan `{ fresh }` (service baru dibuat); JS lalu mengirim ulang sampulnya.
   - Pengambilan data sampul: JS juga mengirim `coverUrl` (http/https); bila native belum punya sampul (service dibuat ulang atau JS gagal menyusun sampul,
     mis. canvas ber-CORS), native mengunduhnya sendiri (maks. sekali per 20 dtk bila gagal). Unduhan diabaikan bila lagu sudah berganti.

Catatan
- Butuh APK baru untuk bagian 1 dan 3 (Java berubah): `npm run android:sync` lalu build. Bagian 2 hanya TSX/CSS dan bisa lewat OTA; OTA ke APK lama
  tetap aman, tetapi `--sat` dkk. baru terisi dari native di APK baru (APK lama memakai `env()`).
- Beberapa ROM (MIUI, ColorOS, dsb.) memblokir buka activity dari latar; bila ikon berganti tapi aplikasi tidak terbuka, aktifkan izin "Tampilkan di atas aplikasi lain" / mulai otomatis.
- Belum diuji di perangkat dan belum dijalankan `npm run typecheck`.

---

<!-- sumber: CHANGES-0.5.51.5.md -->

# 0.5.51.5 (ikon buka-ulang otomatis, tutorial bisa dicoba, disc lebih besar)

Files: native/android/java/{MainActivity,MusicVerseNativePlugin}.java, src/native/musicVerseNative.ts,
src/tour/{steps,TourHost,PracticeStage,DemoStage}.ts(x) (entri Yang baru 0.5.51.5), src/components/player/{MiniPlayer,MiniBubble,FullPlayer}.tsx,
src/index.css, tailwind.config.js, package.json (appVersion 0.5.51.5), CHANGES.md (0.5.51 diarsipkan), PROJECT_STRUCTURE.md

1. Ganti ikon aplikasi -> buka ulang otomatis (APK baru)
   - Sebagian peluncur/ROM menutup aplikasi saat alias ikon berganti. Sebelum alias diganti, plugin memasang alarm (AlarmManager, ±0,7 dtk)
     ke alias baru, jadi aplikasi terbuka lagi sendiri tanpa dibuka manual. Bila aplikasi tidak ditutup, alarm hanya membawanya ke depan.
   - Hanya bila aplikasi sedang dilihat (`MainActivity.foreground`); ganti tema otomatis saat aplikasi di latar tidak memunculkan layar.
   - Tanpa izin alarm tepat (Android 12+) dipakai alarm hemat daya: bisa terlambat sedikit.
2. Tutorial yang tadinya tidak bisa dicoba
   - Penyebab: langkah dengan sorotan + petunjuk jari (Pemutar, Geser jadi disc, Tutup musik, Lirik) menutup seluruh layar, jadi elemen asli
     tidak bisa diketuk/digeser. Kini ada `tryTarget` pada langkah: lubang sorotan tembus sentuhan (sisa layar tetap terkunci).
     Bila ketukan membuka pemutar penuh, tutorial menutupnya lagi di langkah berikutnya.
   - "Main-main dengan disc" tadinya hanya animasi; kini latihan `disc-drag` (seret disc ke sisi lain, tahan untuk putar/jeda).
   - Sleep timer dan Antrean tidak dibuat bisa disentuh: lembarnya tampil di bawah lapisan tutorial.
3. Animasi mini player <-> disc tidak lagi dilewati saat "kurangi gerakan" menyala
   - Dugaan penyebab gejala "langsung jadi disc": `prefers-reduced-motion` melewati gulungan kartu -> disc, dan aturan global mematikan
     animasi CSS `card-from-*`. Kini kartu <-> disc tetap beranimasi; saat "kurangi gerakan" menyala tanpa putaran disc.
4. Disc lebih besar + animasi kartu -> disc meniru video contoh
   - Disc 56 px -> 72 px (`BUBBLE_PX` di MiniPlayer dan `SIZE` di MiniBubble harus sama; lubang tengah, ikon play, klip `card-from-*`, dan
     penghitung sampul FullPlayer ikut disesuaikan).
   - Kartu -> disc (geser samping), dua tahap: (1) sampul ikut terbawa geseran sambil membesar dan berubah bentuk (persegi bulat -> lingkaran),
     (2) lalu meroda ke sisi geser sampai pojok (putaran berbanding jarak, berakhir di kelipatan 360). Latar piringan, cincin progres, dan
     lubang tengah muncul bertahap; cincin tergambar sampai posisi lagu sekarang.
   - Perbaikan bug cincin progres di disc: dulu cincin ikut berputar bersama disc pratinjau, jadi busurnya mulai dari sudut miring (kanan-kiri)
     lalu "melompat" ke atas-bawah saat diganti disc asli. Kini hanya sampul yang berputar; cincin diam dan mulai dari jam 12.
   - Disc -> kartu (ketuk disc): salinan disc (sudut putarnya disalin) lebih dulu meroda ke arah sampul di kartu, lalu pelan-pelan berubah
     bentuk dan mengecil sampai pas dengan ukuran sampul; sampul asli memudar masuk menggantikannya (`captureDisc` / `runDiscFly`).
   - Riak halus (`disc-halo`) tetap muncul sekali saat disc mendarat.

Catatan
- Butuh APK baru untuk bagian 1 (Java berubah): `npm run android:sync` lalu build. Bagian 2-4 hanya TS/TSX/CSS dan bisa lewat pembaruan OTA;
  APK lama tetap aman (tanpa buka-ulang otomatis).
- Pengguna lama: tidak ada migrasi data. Disc lebih besar langsung berlaku setelah pembaruan.
- Belum diuji di perangkat dan belum dijalankan `npm run typecheck` (tidak ada node_modules di lingkungan pembuatan): jalankan sebelum rilis.

---

<!-- sumber: CHANGES-0.5.51.md -->

# 0.5.51 (tema -> layar pembuka & ikon)

Files: index.html, src/native/appearance.ts (baru), src/native/musicVerseNative.ts, src/main.tsx, src/pages/ThemeSettingsPage.tsx, src/tour/steps.ts (entri Yang baru), package.json (version 0.5.51),
native/android/java/{MainActivity,MusicVerseNativePlugin}.java, native/android/icon-presets.json (baru),
native/android/res/{drawable,mipmap-*,mipmap-anydpi-v26,values} (varian ikon), scripts/setup-android.mjs, scripts/gen-icon-variants.py (baru)

Warna tema kini ikut ke:
1. Animasi boot (splash web): latar, 4 batang logo, dan nama "MusicVerse" memakai warna tema (mode gelap/terang ikut). Warna dibaca dari cache
   `musicverse:splash:v1` di localStorage yang ditulis aplikasi tiap tema berubah, jadi sudah benar sejak frame pertama splash.
   Tema berubah -> dipakai pada pembukaan berikutnya. Aksen "ikut sampul lagu" tidak dipakai (splash tidak boleh berubah tiap lagu).
2. Latar jendela native: MainActivity memasang warna latar tema (jendela + WebView) sehingga tema terang tidak diawali kedipan gelap.
   Splash sistem Android 12+ sendiri tetap #121212 (tidak bisa diubah per-pengguna); latar splash web memudar dari #121212 ke warna tema.
3. Ikon aplikasi (opsional, Pengaturan > Tema > Layar pembuka & ikon > "Ikon aplikasi ikut tema", bawaan MATI):
   satu `<activity-alias>` per tema siap pakai (15). Pintu LAUNCHER dipindah dari MainActivity ke alias; hanya "hijau" (ikon asli) yang menyala awalnya.
   Tema Kustom memakai tema siap pakai dengan aksen terdekat. Ikon diganti setelah tema tenang ±1,5 dtk, tanpa menutup aplikasi.
   Mematikan pilihan mengembalikan ikon hijau asli.

Catatan
- Butuh APK baru (ada perubahan Java + manifest): `npm run android:sync` lalu build. Pembaruan OTA ke APK lama tidak cukup untuk bagian ikon/latar native
  (splash web tetap ikut tema lewat OTA; APK lama menolak setAppearance dengan UNIMPLEMENTED dan diabaikan).
- Sebagian peluncur melepas pintasan ikon yang sudah ditempel di layar utama saat alias berganti (termasuk sekali saat update pertama,
  karena pintu LAUNCHER pindah ke alias). Pengguna perlu menempel ulang dari laci aplikasi.
- Mengubah preset tema atau ikon dasar: jalankan `python3 scripts/gen-icon-variants.py` (butuh Pillow), dan samakan ICON_IDS di MusicVerseNativePlugin.java
  (setup-android.mjs memeriksa kecocokannya dan berhenti dengan pesan jelas bila ada yang kurang).

---

<!-- sumber: CHANGES-0.5.50.7.md -->

# 0.5.50.7 (animasi premium: #1-#7 + Reduce Motion)

APK tidak perlu diganti (JS/CSS saja, bisa lewat OTA). appVersion 0.5.50.7 (versionCode 505007). Tur "Yang baru" ditambah satu langkah.

# Animasi premium (lanjutan): #3, #4, #5, #7

Hanya JS/CSS (bisa lewat OTA). Cek sintaks TypeScript lulus (tidak ada node_modules, jadi `tsc -b` penuh dan uji di perangkat belum dijalankan).
Tidak menyentuh: Mini Player -> Disc, BottomNav, playback/queue, warna, ukuran, tata letak. Reduce Motion tetap lewat aturan global di index.css (+ cek di hook).

## #3 Indikator equalizer
- `ui/PlayingBars.tsx`: tambah `CoverPlayingBadge` (overlay `absolute inset-0` di atas sampul, tidak mengubah ukuran baris).
- Dipasang di baris tanpa kolom nomor: Riwayat, Unduhan, Lokal. Playlist saya: ikon di atas sampul diganti batang saat aktif/jeda.
- Antrean: nomor di "Sedang diputar" diganti batang (kotak w-6 yang sama).
- Bergerak saat `playing`, diam di tinggi sedang saat `paused`, hilang saat lagu berpindah (mengikuti lagu aktif).

## #4 Hasil pencarian
- `.mv-swap` (index.css): fade opacity saja, 220 ms. Dipakai saat ganti kategori Lagu/Artis (HomePage) dan tab Lagu/Album/buka album (ArtistSearchPanel); kuncinya tampilan, bukan fase muat, jadi tidak berulang tiap mengetik.
- Stagger dan FLIP hasil pencarian di `TrackList` sudah ada dan tidak diubah.

## #5 Microinteraction
- Toast punya ikon kecil yang membal (`ToastTone`: added/removed/like/unlike). Dipasang di: suka/batal suka (geser), tambah ke antrean (geser + menu), hapus dari antrean, hapus dari playlist, mulai unduh, hapus unduhan.
- Pulse tombol saat status lagu berganti (`usePulse`) di baris Riwayat, Unduhan, Lokal, Playlist saya.
- Unduhan selesai: sampul baris baru membal sekali (hanya untuk lagu yang muncul setelah halaman terbuka).
- Playlist saya: hapus lagu = baris memudar + bergeser keluar 180 ms lalu dihapus; baris lain meluncur dengan pegas. Naik/turun juga meluncur, bukan melompat (`hooks/useListFlip.ts`).

## #7 Bottom sheet
- `utils/spring.ts`: easing pegas teredam (`linear()`), cadangan cubic-bezier bila tidak didukung. Lampauan < 0,2%.
- Masuk semua sheet: `--sheet-ease` / `--sheet-ms` (index.css, @supports) dipakai kelas `animate-sheet-up`; pegas kembali di `useSheetDrag` memakai easing yang sama.
- `useSheetDrag` kini juga dipasang di QueuePanel, TrackActionSheet, CrossfadeSheet, SleepTimerSheet, ManualSearchSheet (sebelumnya hanya yang lewat OverlayPortal). Resistance (karet) dan tutup-dengan-seret sama untuk semuanya.

## Batas
- Belum dicoba di perangkat. `linear()` perlu WebView Chrome 113+; di bawah itu otomatis kembali ke kurva lama.
- Penghapusan di Playlist saya ditunda 180 ms (hanya bila Reduce Motion mati).

# Lanjutan: #1 Shared element cover + Reduce Motion

## #1 Shared element transition sampul
- `services/coverOrigin.ts` (baru): baris daftar menandai thumbnail-nya (`data-cover-thumb`) tepat sebelum `openFullPlayer()`; FullPlayer mengambilnya sekali saat dipasang (kedaluwarsa 1,2 dtk, jadi buka lewat mini player/seretan tidak pernah memakai tanda lama).
- Dipasang di baris: playlist/Cari/hasil artis (`playlist/TrackRow`), Riwayat, Unduhan, Lokal. (Playlist saya tidak membuka pemutar penuh saat diketuk, jadi tidak ikut.)
- `FullPlayer.tsx`: titik awal sampul sekarang berurutan: (1) thumbnail daftar bila lagunya sama dan masih terlihat, (2) sampul mini player, (3) Disc Player (`[data-mini-disc]` di `MiniBubble`, sampul terbang ke/dari piringan bulat), (4) cadangan lama (membesar + memudar).
- Memakai mesin `progress` yang sama (satu pegas, transform), jadi seret-untuk-tutup tetap bersambung. Thumbnail sumber disembunyikan (`visibility`) selama sampul terbang dan tampil lagi saat kembali / saat FullPlayer dilepas.
- Radius sudut ikut berinterpolasi hanya untuk thumbnail dan disc (sumbernya bulat/persegi kecil); mini player biasa tetap radius tetap yang murah.
- Tutup dari posisi penuh: tujuan diukur ulang (kembali ke thumbnail yang sekarang, atau ke mini player/disc bila lagu sudah berganti). Tutup lewat seretan: tujuan dari saat dibuka dipertahankan supaya tidak melompat.

## Reduce Motion (audit)
- Sudah patuh: semua pemakai WAAPI (`useExitGhost`, `useSheetDrag`, `usePulse`, `useListFlip`, FLIP `TrackList`, `UpcomingList`, `MiniPlayer`, `MarqueeText`, tur), mesin pegas `playerSheet` (langsung selesai), gulir halus lirik, `PageTransition`, dan animasi CSS lewat aturan global.
- Celah yang diperbaiki: aturan global hanya memendekkan durasi, tapi jeda stagger (`animation-delay` 0–780 ms di `.mv-list`) tetap berjalan; karena fill-mode `backwards`, item daftar tetap tersembunyi selama jeda. Kini `animation-delay` dan `transition-delay` juga dinolkan.
- Dengan Reduce Motion: sampul langsung di posisi akhir (tanpa terbang), sheet muncul/tutup langsung, equalizer diam, FLIP/pulse/hapus-baris tanpa animasi, toast tanpa membal.

## Perbaikan build
- `tour/DemoStage.tsx`: tipe prop `innerRef` di `Finger` dan `Disc` diubah dari `RefObject<T | null>` ke `RefObject<T>` (sesuai `@types/react` 18). Sebelumnya `tsc -b` di Vercel gagal (TS2322) di dua baris itu; tidak ada galat tipe lain yang dilaporkan.



---

<!-- sumber: CHANGES-0.5.50.4.md -->

# 0.5.50.4

- ⚠️ Butuh **APK baru** (resource native).
- Pratinjau widget meniru Auralys: hanya `previewImage` (PNG), `previewLayout` dihapus lagi dari semua `widget_*_info.xml`, dan `layout/widget_pv_*.xml` dibuang. Peluncur pabrikan yang gagal memuat `previewLayout` jatuh ke kotak abu-abu.
- PNG pratinjau dikecilkan (sisi terpanjang ≤640 px, 6–25 KB) dan hanya di `drawable-nodpi`; salinan `hdpi`/`xhdpi`/`xxhdpi` dibuang.
- `widget_*_info.xml` dipisah: `xml/` (tanpa `targetCellWidth/Height`) dan `xml-v31/` (dengan atribut itu, Android 12+).
- `setup-android.mjs` mengisi `__APP_ID__` di kedua folder dan membuang sisa pratinjau/layout lama dari proyek android hasil build sebelumnya.

## Animasi mini player -> disc lebih halus (JS, bisa lewat OTA)

- Kedip "kartu muncul utuh dulu baru jadi disc" dihilangkan. Penyebab: di akhir gerakan, kartu hantu dibersihkan (animasi dibatalkan / gaya direset) SEBELUM React melepasnya, jadi kartu sempat tampil penuh satu frame. Sekarang kartu disembunyikan dulu lalu dilepas (`stopLeave`).
- Geser samping (tahan lalu geser kiri/kanan) lebih panjang dan mengalir: jarak gulungan 130-240 px (dulu 90-170), tampilan mengejar jari dengan penghalusan berbasis waktu (`followRoll`) dan bukan 1:1, kurva klip/pudar kartu pakai smoothstep, disc pratinjau memudar masuk bertahap.
- Lepas jari: penyelesaian 380 ms (dulu 280 ms), dimulai dari posisi yang sedang tampil sehingga tidak melompat.
- Serah-terima ke disc asli: disc asli dipasang tanpa animasi masuk tepat di bawah disc pratinjau, lalu pratinjau memudar. Sebelumnya disc asli muncul dari skala 0.72 dan silang-pudar dengan pratinjau sehingga terlihat masuk-keluar.
- Perbaikan kedip kartu setelah jadi disc (geser samping): `setSide`/`setCollapsed` (store eksternal, render sinkron) dan `setHandoff`/`setLeaving` (state biasa) dulu masuk dua commit React, jadi kartu hantu sempat dilepas lalu dipasang ulang dalam keadaan terlihat. Kini dibungkus `flushSync` di `commitRoll` supaya satu commit.

## Tema: gaya lebih lengkap (JS/CSS, bisa lewat OTA)

Pengaturan > Tema:
- **Gaya permukaan** baru: Solid (bawaan), **Kaca** (kartu tembus pandang + tepi bercahaya, paling cantik bersama Cahaya latar), **Garis** (kartu berupa kerangka tipis). Lewat CSS `html[data-surface]` memakai `:where()` sehingga hover/aktif bawaan tetap berlaku; pemutar penuh (`.mv-dark-scope`) tidak ikut berubah.
- **Ukuran teks**: Kecil / Normal / Besar (skala rem di `<html>`, 93,75% / 100% / 112,5%).
- **Kekuatan cahaya latar**: Lembut / Sedang / Kuat (muncul saat Cahaya latar aktif; variabel `--mv-glow-a`).
- **7 tema siap pakai baru**: Hutan, Sakura, Kopi, Neon, Emas, Malam, Batu (total 15 + Kustom). Semua lolos batas latar gelap/terang.
- Pengaturan baru ikut di kode bagikan `MVT1.…` dan tema tersimpan; kode lama tetap valid (nilai baru memakai bawaan).
- "Kembali ke tema bawaan" juga mereset gaya, ukuran teks, dan kekuatan cahaya.
- Diuji lewat Node (logika, kode bagikan, kode lama, nilai sampah) dan Chromium (selector CSS). Halaman React belum dicoba di perangkat.

## Full player: baris kontrol utama tepat di tengah

- Baris timer · sebelumnya · putar · berikutnya · acak melebar melewati kolom (5 tombol + jarak > lebar layar HP), jadi tombol putar bergeser ke kanan dan tombol acak terpotong. Kini grid 5 kolom (`minmax(0,1fr)` x2, 5rem, `minmax(0,1fr)` x2): tombol putar tepat di tengah layar, timer rata kiri dan acak rata kanan sejajar tombol ulang/crossfade di baris bawah. Hanya `FullPlayer.tsx` (JS/CSS, bisa lewat OTA).

## Tutorial diperbarui + peragaan animasi (JS, bisa lewat OTA)

- **Peragaan animasi di dalam kartu** (`tour/DemoStage.tsx`, baru): gerakan baru diperagakan berulang di kartu tutorial tanpa perlu ada lagu yang diputar. Empat peragaan: `mini-roll` (kartu bergulir mengerut jadi disc lalu diketuk membesar lagi), `mini-close` (kartu tenggelam ke belakang nav), `disc-side` (disc diseret ke sisi lain dan menempel membal), `theme` (gaya Solid / Kaca / Garis, warna aksen, dan cahaya latar bergantian). Memakai Web Animations API; `prefers-reduced-motion` = diam.
- **Peragaan jari baru** di atas sorotan mini player: `animate: 'roll'` (geser kanan lalu kiri) dan `animate: 'down'` (geser ke bawah). Field baru `demo` di `TourStep`.
- **Tutorial utama**: tiga langkah baru setelah "Pemutar" (Geser jadi disc, Main-main dengan disc, Tutup musik) dan satu langkah "Tema sesukamu" (APK) setelah Pengaturan. Kuis jadi 4 pertanyaan (tambah: cara mengecilkan pemutar mini jadi disc).
- **"Yang baru"** rilis `0.5.50.4`: geser jadi disc, geser bawah = tutup musik, gaya tema lebih lengkap. Pengguna yang sudah menamatkan tutorial melihatnya sekali di Beranda.
- Hanya cek sintaks TypeScript yang dijalankan (tidak ada node_modules); tampilan dan gerakan belum dicoba di perangkat.



---

<!-- sumber: CHANGES-0.5.50.3.md -->

# 0.5.50.3

## Gestur mini player: geser bawah = tutup musik, geser samping = jadi disc (bergulir)
Hanya JS (`MiniPlayer.tsx`), tidak butuh APK baru.

- **Geser ke bawah** pada kartu mini player kini **menutup musik**: kartu ikut jari, makin pudar mendekati titik lepas (getar kecil saat lewat), lalu tenggelam ke belakang nav dan pemutar dikosongkan (`cleanup()`: audio berhenti, state kosong). Titik lepas 96 px, atau lemparan cepat (> 0,7 px/ms setelah 40 px). Sebelumnya geser bawah = jadi disc.
- **Geser ke kiri/kanan** pada kartu = kartu **bergulir jadi disc** mengikuti jari:
  - bentuk kartu mengerut (clip-path) ke pojok sisi arah geser, kartu memudar di paruh akhir;
  - disc pratinjau berguling dari tengah kartu turun ke pojok sambil membesar dan berputar satu putaran penuh (mendarat di sudut 0, sama dengan disc asli);
  - melewati 42% jarak (atau dilempar searah) lalu dilepas = jadi disc dan **menempel di sisi arah geser** (geser kiri -> disc di kiri, kanan -> kanan; sisi tersimpan seperti biasa). Kurang dari itu = gulungan berbalik pelan ke kartu.
  - jarak penuh = 40% lebar dock, dibatasi 90-170 px.
- Geser ke atas (buka pemutar penuh) tidak berubah. Seek bar tetap tidak dibajak.
- Pegangan di atas kartu: ketukan tetap jadi disc (cadangan untuk keyboard/pembaca layar), teks bantuan diperbarui.
- `prefers-reduced-motion`: tanpa animasi, langsung jadi disc / tertutup.
- Belum diuji di perangkat dan belum dikompilasi penuh (tidak ada node_modules di lingkungan kerja; hanya cek sintaks). Angka jarak/durasi (`CLOSE_DISTANCE`, `ROLL_*` di atas berkas) tebakan, perlu disetel di HP.

## Glow tombol putar tidak lagi terpotong persegi
- `Collapse` di `FullPlayer.tsx` selalu `overflow-hidden`, jadi `box-shadow` tombol putar (xl) terpotong selebar barisnya dan terlihat seperti kotak. Kini pemotongan hanya aktif saat animasi buka/tutup; setelah terbuka penuh (520 ms) isi dibiarkan terlihat.

## Lirik tanpa waktu: sorotan perkiraan lebih adil
- `estimateActive` (`useLyricTiming.ts`, dipakai pemutar penuh dan mini player) tidak lagi membagi baris sama rata. Waktu tiap baris kini sebanding dengan panjangnya (kana/kanji/Hangul dihitung lebih berat per huruf, baris pendek mendapat minimal bobot 6). Intro ~6% dan outro ~8% tetap dilewati.
- Tetap hanya perkiraan: lirik polos memang tidak punya waktu asli. Diuji lewat Node pada contoh kecil, belum dicoba di perangkat.

## Tema terang: lebih nyaman di mata dan lebih rapi
Hanya JS/CSS (`utils/theme.ts`, `index.css`), tidak butuh APK baru.
- **Latar tidak lagi hampir putih**: `bgLight` semua preset diturunkan ke kecerahan ~0,92 (mis. hijau `#F5F7F5` -> `#ECEFEA`, Mono `#FFFFFF` -> `#EEEEEE`). Batas latar terang kustom jadi 0,86-0,95 (dulu 0,90-1,00), jadi putih murni pun otomatis dilembutkan.
- **Permukaan lebih terang dari latar** (sebelumnya lebih gelap -> abu-abu kusam): kartu, kolom, sheet, dan mini player kini campuran latar + putih (40% / 62%); hover sedikit lebih redup. Ditambah garis tipis 5% hitam supaya batasnya terbaca.
- **Teks bukan hitam pekat**: `#121212` -> `#1E2321`. Kontras tetap tinggi (ink/latar ~13,7:1; teks sekunder 6,2:1; teks samar 5,0:1, semua >= AA). Aksen di mode terang diminta kontras >= 3,8 (sebelumnya 3), jadi aksen pucat (oranye) dipekatkan.
- **Lapisan redup di belakang sheet** (`bg-black/60`) di layar terang jadi 40% abu kehijauan, bukan hitam 60% yang menyilaukan saat muncul.
- **Bayangan**: `shadow-black/xx` di mode terang diganti bayangan lembut; mini player dan disc dapat bayangan + garis tipis khusus terang.
- Pemutar penuh tetap gelap (`mv-dark-scope`), tidak terpengaruh.
- Dihitung lewat Node (kontras per preset). Belum dilihat di perangkat dan belum dikompilasi penuh; angka kecerahan/bayangan perlu dinilai langsung di HP.



---

<!-- sumber: CHANGES-0.5.50.md -->

# 0.5.50

## Tema (Pengaturan > Tema)
- **Pratinjau menempel** (`sticky top-0`) di atas area scroll dan dibuat lebih ringkas (±40% lebih pendek: 2 baris lagu, mini player, nav), jadi perubahan terlihat langsung saat menggulir pengaturan.
- **Acak tema**: satu ketukan membuat tema Kustom serasi (satu rona untuk aksen dan latar, kecerahan latar tetap di rentang aman per mode). `randomThemePatch()` di `utils/theme.ts`.
- **Tema tersimpan**: simpan tema aktif (maks. 6), ketuk untuk memakai, tombol × untuk menghapus. Disimpan sebagai kode `MVT1.…` di `musicverse:theme:saved:v1`; tema yang sama tidak digandakan.
- **Cahaya latar**: semburat aksen di atas layar aplikasi (`.mv-glow`, dipasang di `AppShell`), ikut tampil di pratinjau. Ikut terkirim di kode bagikan tema (kode lama tetap valid, glow mati).
- Tombol "Kembali ke tema bawaan" juga mematikan cahaya latar.
- Cek tipe `utils/theme.ts` lulus dan logika acak/simpan/kode sudah diuji lewat Node. Halaman React belum dikompilasi penuh dan belum dicoba di perangkat.

## Pratinjau widget: cadangan untuk XOS (Infinix)
- ⚠️ Butuh **APK baru** (resource native). Pratinjau yang sama kini juga ada di `drawable-xxhdpi`, `drawable-xhdpi`, dan `drawable-hdpi` (selain `drawable-nodpi`), karena peluncur XOS tampaknya tidak memuat `previewImage` dari folder `nodpi`.
- `widget_*_info.xml` tidak berubah. Belum diuji di perangkat XOS.

## Pratinjau widget (lanjutan): previewLayout statis + versi APK
- ⚠️ Butuh **APK baru**. `appVersion` naik ke 0.5.50 supaya versionCode (55000) lebih besar dari APK sebelumnya (pasang-timpa pasti dianggap pembaruan).
- Tiap `widget_*_info.xml` kini memakai `previewImage` **dan** `previewLayout` (`layout/widget_pv_*.xml`: satu `ImageView` ke PNG pratinjau yang sama, tanpa tampilan yang butuh data). Peluncur Android 12+ memakai layout; yang lain jatuh ke gambar.
- Beda dengan `previewLayout` lama (yang memakai layout widget asli dan gagal di peluncur pabrikan), ini hanya gambar statis.
- Belum diuji di perangkat XOS.

## Widget: jaring pengaman saat gagal digambar (APK 0.5.50.1)
- Laporan: widget Besar menampilkan "Problem loading widget" di layar utama.
- `MusicVerseWidget.update()` kini bertahap: gambar penuh, lalu tanpa sampul, lalu `safeViews()` (judul + nama galat singkat di baris artis, ketukan tetap membuka aplikasi). Juga menangkap `OutOfMemoryError`, dan `load`/`sizeDp` ikut dilindungi.
- Bila widget kini menampilkan "Gagal menggambar: …", nama galatnya menunjuk penyebab sebenarnya.
- Penyebab asli belum dipastikan (tidak ada logcat). `appVersion` 0.5.50.1 (versionCode 55001).

## Animasi mini player -> disc: lebih mulus (0.5.50.2)
Penyebab terasa kaku (dibaca dari kode, belum diuji di perangkat):
- Klip awal morph `inset(-48px)` memotong bagian kartu yang sudah ditarik lebih dari 48px ke bawah, jadi saat jari dilepas kartu **terpotong mendadak** (patah).
- Easing `cubic-bezier(0.65,0,0.35,1)` (ease-in-out) membuat awal gerakan nyaris diam sebelum melesat; kartu juga melompat balik ke atas dalam 208 ms, berlawanan dengan arah jari.
- Kecerahan (opacity) dan bentuk (clip-path) dipaksa satu animasi dengan satu easing.

Perubahan (`MiniPlayer.tsx`, `tailwind.config.js`):
- Klip awal ikut melebar ke bawah sebesar jarak seretan (`dragY` dari matriks transform kartu), jadi tidak ada potongan mendadak.
- Satu easing menurun `cubic-bezier(0.32,0.72,0,1)` untuk kartu dan bentuk; opacity animasi terpisah (penuh sampai 55%, lalu memudar linear). `LEAVE_MS` 520 -> 440.
- Disc dipasang lebih awal (30% gerakan, sebelumnya 50%) dan muncul dari skala 0,72 dengan sedikit membal (340 ms).
- Seretan ke bawah diberi efek karet setelah melewati titik lepas (setengah gerak), plus `will-change` selama seretan dan morph. Pegas kembali (batal) memakai easing menurun.
- Batas: clip-path tetap animasi main-thread (tidak bisa dipercepat compositor), jadi di HP lemah masih bisa terasa kurang mulus. Angka durasi/easing tebakan, perlu dicoba di perangkat.



---

<!-- sumber: CHANGES-0.5.47.8.md -->

# 0.5.47.8

- ⚠️ Pratinjau widget di daftar widget peluncur (resource native, `drawable-nodpi/widget_preview_*.png`) hanya muncul bila **APK** 0.5.47.5 atau lebih baru terpasang; update OTA tidak membawanya. Tidak ada perubahan kode widget di rilis ini.

## Perbaikan build
- `services/spotifyApi.ts`: `searchRelatedTracks` mengubah hasil `withImporterRetry` (`TrackMeta[] | null`) menjadi `[]` bila semua percobaan gagal. Memperbaiki galat TS2322 yang menggagalkan `tsc -b` di Vercel.

## Tombol Sebelumnya di notifikasi
- `NATIVE_PREVIOUS_DEPTH` 3 -> 20 (sama dengan `NATIVE_UPCOMING_DEPTH`): sampai 20 lagu sebelum lagu aktif diserahkan ke native untuk tombol Sebelumnya saat WebView beku.
- Lagu sebelumnya yang tautannya kedaluwarsa (> 90 menit) atau belum ada di cache kini di-resolve ulang di latar (satu per satu, dari yang terdekat), lalu diserahkan ulang ke native, bukan lagi menghentikan daftar. Gagal di-resolve = berhenti di situ, dicoba lagi saat lagu berganti.
- Perubahan sisi JS; terasa di HP setelah build baru.

## Tema (Pengaturan > Tema)
- Mode **Gelap / Terang / Otomatis** (ikut pengaturan sistem), 8 tema siap pakai di tiap mode.
- **Kustom**: aksen dan latar sendiri (slider + hex + aksen cepat); latar gelap dan terang disimpan terpisah, rentang latar dibatasi per mode supaya teks terbaca.
- **Bentuk sudut**: Tajam / Normal / Bulat (`--mv-radius`).
- **Aksen ikut sampul lagu** (opsional), dipasang oleh `ThemeAccentSync`.
- **Bagikan tema**: salin / tempel kode `MVT1.…`.
- Peralihan halus saat tema diganti; pemutar penuh tetap gelap (`.mv-dark-scope`).
- Warna kini variabel CSS (`--mv-*`); lapisan putih transparan jadi `veil` (putih di gelap, hitam di terang). Komponen baru: pakai `bg-veil/10`, bukan `bg-white/10`.
- File baru: `utils/theme.ts`, `hooks/useTheme.ts`, `components/settings/ColorField.tsx`, `components/player/ThemeAccentSync.tsx`, `pages/ThemeSettingsPage.tsx`.
- Belum dikompilasi penuh dan belum diuji di perangkat (hanya cek tipe sebagian dan hitungan kontras).



---

<!-- sumber: CHANGES-0.5.47.5.md -->

# 0.5.47.5

- Pratinjau widget di daftar widget peluncur sebelumnya kosong (hanya ikon aplikasi di kotak abu-abu). Penyebab: `previewImage` berupa
  vector drawable XML yang tidak dimuat banyak peluncur bawaan pabrikan, yang juga mengabaikan `previewLayout`.
- `drawable/widget_preview_*.xml` (vektor) diganti PNG `drawable-nodpi/widget_preview_*.png` (nama sama, `widget_*_info.xml` tidak berubah).
- Deskripsi rilis GitHub kini selalu dikosongkan (apk.yml tidak lagi membaca CHANGES-<versi>.md).

## Lirik layar penuh (mengikuti rekaman referensi)
- `FullPlayer.tsx`: mode layar penuh kini memakai baris ringkas: sampul kecil 48px + judul + artis (warna aksen) + tombol keluar layar penuh + menu "⋮".
  Daftar lirik naik sampai ke bawah status bar (tanpa padding atas), lalu memudar ke latar di bawah; bilah posisi tetap ada.
- `LyricsPanel.tsx`: prop `fullscreen` menambah padding status bar pada keterangan sumber lirik di atas daftar.
- Tombol hati disembunyikan di mode ini (ada di menu lagu). Slider volume pada video tidak dibuat: aplikasi tidak punya kontrol volume sistem.
- Belum dikompilasi/diuji di perangkat (hanya cek sintaks).

## Animasi lirik layar penuh
- Header, tombol transport, baris lirik/ulang/crossfade, dan bar "Berikutnya" kini menutup/membuka dengan halus (tinggi + pudar + geser, 500 ms) lewat komponen `Collapse` di `FullPlayer.tsx`, bukan hilang mendadak. Bagian yang tertutup diberi `inert` + `aria-hidden`.
- Baris judul ringkas masuk dengan animasi `fs-in` (pudar + naik + skala); kembali ke judul besar juga beranimasi. Padding atas ikut bertransisi.
- `LyricsPanel.tsx`: `ResizeObserver` menjaga baris aktif tetap di tengah selama tinggi daftar berubah.
- Semua animasi mati bila "kurangi gerakan" aktif (`motion-reduce`).

## Pratinjau widget (lanjutan) + layar atur widget
- ⚠️ Butuh **APK baru** (Java + resource native berubah). Pratinjau di daftar widget hanya muncul setelah APK 0.5.47 terpasang.
- `previewLayout` dihapus dari semua `widget_*_info.xml`: peluncur pabrikan memakainya lebih dulu lalu gagal dan jatuh ke kotak abu-abu + ikon app. Kini hanya `previewImage` (PNG) yang dipakai.
- `setup-android.mjs` membuang sisa `drawable/widget_preview_*.xml` (vektor lama) dari proyek android hasil build sebelumnya.
- Layar atur widget (`MusicVerseWidgetConfigActivity.java`): tema **hijau** (latar gelap kehijauan, aksen #1DB954, wallpaper pratinjau hijau),
  dan UI dikecilkan (judul/chip/saklar/penggeser lebih kecil, penggeser persen sebaris dengan namanya, tombol Selesai lebih tipis) supaya hampir semua terlihat tanpa menggulir.
- Warna aksen bawaan widget baru: hijau #1DB954 (widget yang sudah dipasang tetap memakai pilihannya).
- Belum dikompilasi/diuji di perangkat.

## Tombol kembali kaca gelap yang menempel
- Kelas baru `.back-glass` (`index.css`): tombol kembali kini **sticky** di atas area gulir (`<main>`), berbentuk pil kaca gelap + blur (`backdrop-filter`), bayangan, dan efek tekan.
  Saat halaman digulir, tombol ikut menempel di atas dan tetap terbaca di atas konten.
- Dipasang di 14 tombol kembali: halaman Cadangan, Unduhan, Equalizer, Pemutaran, Playlist, Pembaruan, Hukum, Riwayat, Rekap, Jelajah (Artis/Album), Playlist saya, dan panel pencarian artis.
- Belum dikompilasi/diuji di perangkat.

## Cari judul di Beranda: banyak hasil + "Terkait"
- Mencari judul lagu di Beranda tidak lagi hanya menampilkan 1 lagu. Hasil teratas (yang paling cocok) tetap di paling atas dengan judul bagian "Hasil teratas";
  di bawahnya ada pemisah dan bagian **"Terkait"** berisi sampai 9 kemungkinan lain dari pencarian Spotify (urut relevansi, tanpa duplikat).
- `plugins/spotifyImporter.ts`: `searchSpotifyTracks` (banyak hasil). `services/spotifyApi.ts`: `searchRelatedTracks` (gagal / web = daftar kosong, bukan galat).
- `PlaylistContext.tsx`: hasil teratas ditampilkan secepatnya; Terkait dicari bersamaan lalu menyusul (bagian muncul dengan animasi fade-in) tanpa menahan hasil teratas.
- `searchPlaylist.ts` + `types/spotify.ts`: `PlaylistDetail.related`. `PlaylistView.tsx`: bagian Terkait memakai `TrackList` (putar, swipe ke antrean, menu lagu seperti biasa).
- Terkait hanya ada di APK (pencarian Spotify langsung hanya tersedia di APK); di web hanya hasil teratas. Belum diuji di perangkat.

## Notifikasi pembaruan: kartu melayang di bawah
- `UpdateBanner.tsx` dibuat ulang: bukan lagi banner di bawah header, melainkan **kartu kaca gelap melayang di bawah** (di atas mini player bila ada, bila tidak di atas bilah navigasi), dengan ikon hijau-aksen, "Versi X tersedia", pesan status, tombol Perbarui/Pasang/Coba lagi, dan tombol tutup.
- Masuk dengan animasi naik + memudar, keluar dengan animasi turun; posisinya ikut bergeser halus saat mini player muncul/hilang/berubah ukuran.
- Saat mengunduh: ikon berputar, persen di pesan, dan bilah progres tipis di dasar kartu. Animasi mati bila "kurangi gerakan" aktif.
- Belum diuji di perangkat.

## Pengingat pembaruan muncul lagi saat aplikasi dibuka
- Menutup kartu pembaruan (X) kini hanya menyembunyikannya selama aplikasi itu hidup (variabel modul `dismissedThisRun` di `useAppUpdate.ts`), tidak lagi disimpan permanen.
  Saat aplikasi dibuka lagi (proses baru), kartunya muncul kembali selama versi baru belum dipasang. Pindah ke aplikasi lain lalu kembali tidak memunculkannya lagi.



---

<!-- sumber: CHANGES-0.5.46.13.md -->

# MusicVerse 0.5.46.13 — Animasi logo saat buka aplikasi lebih mulus, dan ditahan lebih lama

Hanya JS/HTML (tanpa APK baru).

## Masalah
- Animasi logo + nama saat aplikasi dibuka terasa patah-patah.
- Splash hilang terlalu cepat: animasinya baru selesai, langsung keluar, hampir tanpa jeda tahan.

## Penyebab
- CSS splash ada di `src/index.css`, jadi baru berlaku setelah bundel dimuat dan animasi bersaing dengan pemuatan aplikasi di thread utama.
- Batang logo adalah elemen SVG (`rect` + `transform-box`), animasinya digambar ulang di thread utama (tidak dikomposit GPU).
- Zoom memakai ukuran dasar kecil lalu diskalakan naik (0,9 -> 1,32): teks dan logo jadi buram dan terasa patah.
- Splash ditutup di 2,2 dtk, sementara zoom baru selesai di 2,6 dtk: tidak ada waktu tahan.

## Perubahan
- `index.html`: gaya splash dipindah ke `<style>` inline di `<head>` (mulai segera, easing ditulis literal). Logo SVG diganti 4 batang
  HTML (`.splash-logo i`) dengan koordinat yang sama dengan logo aslinya. Semua gerakan hanya `transform` + `opacity` (`scale3d`/`translate3d`,
  `will-change`), sehingga jalur compositor tetap mulus saat thread utama sibuk.
- Ukuran dasar = ukuran akhir (logo 138 px, nama 45 px); zoom 0,68 -> 1 (rasio sama seperti sebelumnya) supaya tajam.
- Timing: batang logo 760 ms (jeda antar batang 80 ms), huruf 640 ms (jeda 55 ms), zoom 2,8 dtk. Animasi masuk selesai ±1,7 dtk.
- `src/main.tsx`: `SPLASH_MIN_MS` 2200 -> 3400, jadi logo + nama utuh ditahan sekitar 1,5 dtk sebelum zoom keluar.
  Bila aplikasi belum siap, splash tetap tampil sampai siap (seperti sebelumnya). Mode "kurangi gerakan" tidak berubah (±0,5 dtk).
- `src/index.css`: blok splash dihapus; bagian aplikasi masuk (`#root`) tetap di sini.

## Belum diuji
Hanya diperiksa lewat kode (tanpa perangkat / emulator). Kalau masih terasa kurang, angka yang paling gampang diubah: `SPLASH_MIN_MS`
(lama tahan) dan durasi `splash-zoom` (2800ms) di `index.html`.



---

<!-- sumber: CHANGES-0.5.46.12.md -->

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



---

<!-- sumber: CHANGES-0.5.46.11.md -->

# MusicVerse 0.5.46.11 — Tombol Sebelumnya di notifikasi tetap berfungsi setelah layar mati beberapa menit

⚠️ Butuh **APK baru** (Java + plugin berubah) dan build JS baru.

## Masalah
Setelah aplikasi di latar belakang beberapa menit (WebView dibekukan, JS tidak lagi mengirim detak), tombol **Sebelumnya** di
notifikasi tidak pindah ke lagu sebelumnya (hanya mengulang lagu aktif dari 0:00). Di dalam aplikasi tetap normal.

## Penyebab
Saat JS beku, native yang memegang kendali (`nativeInCharge`). Riwayat native (`history`) hanya berisi lagu yang ditinggalkan
oleh RANTAI native, dan dikosongkan setiap JS memindahkan lagu. Lagu-lagu yang diputar selagi JS masih hidup (± beberapa menit
pertama) tidak ada di sana. Riwayat kosong -> `chainPrevious()` gagal -> jatuh ke "ulang lagu aktif".

## Perubahan
- `useAudioPlayerController.ts`: ikut menyerahkan sampai 3 lagu tepat SEBELUM lagu aktif (`previous`) bersama daftar berikutnya,
  diambil dari cache resolve yang sudah ada (tanpa jaringan, tautan ≤ 90 menit). Tanda tangan publish ikut memuat daftar ini.
- `audioEngine.ts` / `musicVerseNative.ts`: `setUpcoming` / `engineSetUpcoming` menerima `previous` (opsional; APK lama mengabaikan).
- `MusicVerseNativePlugin.java`: pengurai butir dipisah (`parseUpcomingItems`), dipakai untuk `items` dan `previous`.
- `PlaybackService.java`: bekal `prevSeed`; `chainPrevious()` memakai `history` dulu, bila kosong/kedaluwarsa memakai `prevSeed`
  (termasuk `ytId` supaya tautan mati bisa diambil ulang). Jalur "JS setengah beku" (jaring pengaman 4 dtk) kini juga mencoba
  pindah ke lagu sebelumnya, bukan langsung mengulang lagu aktif.

## Batas
- Hanya lagu yang tautannya ada di cache resolve yang dibekali (lagu yang dulunya "berikutnya" dan masih segar). Lagu yang
  tidak ada di cache menghentikan daftar di situ; Sebelumnya lalu mengulang lagu aktif seperti sebelumnya.
- **Belum dikompilasi / diuji di perangkat** (tidak ada Android SDK, javac, atau node_modules di sini).



---

<!-- sumber: CHANGES-0.5.46.10.md -->

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



---

<!-- sumber: CHANGES-0.5.46.9.md -->

# MusicVerse 0.5.46.9 — Animasi mini player ke pemutar penuh lebih mulus

Hanya JS/CSS (tanpa APK baru).

## Penyebab dugaan (dari kode, belum diukur di perangkat)
1. Latar pemutar penuh: gambar layar penuh diperbesar 1,5x lalu `blur(36px)`. Memburamkan ~1,5 layar saat komponen baru dipasang
   adalah pekerjaan GPU terberat di awal gerakan.
2. `border-radius` sampul dan lapisan penuh (`overflow-hidden`) diubah tiap frame: memaksa sampul + bayangan besar dan topeng
   lapisan digambar ulang terus, bukan hanya digeser compositor.
3. Pegas berbasis waktu: bila frame awal lama (pemasangan komponen, dekode gambar), gerakan "melompat" melewati bagian awalnya.

## Perubahan
- `FullPlayer.tsx`: latar diburamkan pada 1/4 ukuran lalu `scale(6)` (hasil visual setara, ~16x lebih sedikit piksel diburamkan).
- `FullPlayer.tsx`: radius sampul tetap (tanpa interpolasi per frame); radius lapisan tetap 28px dan baru mengecil di 3% terakhir.
- `playerSheet.ts`: bila salah satu dari 4 frame pertama berselang >40 ms, jam pegas dimulai ulang.

## Catatan
- Sudut sampul yang terbang kini sedikit lebih persegi di awal (radius tampak = 28px × skala), bukan menyamai radius sampul mini.
- Belum diuji di perangkat. Bila masih patah-patah, kemungkinan berikutnya: render ulang rute saat `navigate` membuka pemutar
  (`PlayerUiContext.push`) dan `document.body.style.overflow` yang diset saat pemasangan.



---

<!-- sumber: CHANGES-0.5.46.8.md -->

# MusicVerse 0.5.46.8 — Lirik layar penuh + notifikasi tidak ikut hilang saat gangguan sesaat

⚠️ Notifikasi: butuh **APK baru** (`PlaybackService.java` berubah). Lirik layar penuh: hanya JS.

## Lirik layar penuh (`FullPlayer.tsx`)
- Saat tampilan lirik terbuka, ada tombol **Maximize2** di baris judul. Ditekan: header, tombol transport, baris lirik/ulang/crossfade,
  dan bar "Berikutnya" disembunyikan; sisanya judul ringkas, hati, dan bilah posisi. Ikon berubah jadi **Minimize2** untuk kembali.
- Menutup lirik (tombol mikrofon / geser samping) otomatis keluar dari mode layar penuh.

## Notifikasi hilang saat gangguan sesaat (`PlaybackService.java`)
- `deleteIntent` notifikasi dulu sama dengan tombol "Tutup" (`ACTION_DISMISS`) sehingga penghapusan oleh sistem/ROM saat status jeda
  karena gangguan langsung mematikan service (notifikasi + pemutar + putar-ulang otomatis).
- Kini `deleteIntent` memakai `ACTION_SWIPED`: bila sedang terinterupsi / menunggu putar-ulang, notifikasi dipasang lagi dan service tetap hidup.
  Tombol "Tutup" dan geser saat jeda biasa tetap mematikan service.

## Belum diuji
Tidak dikompilasi/diuji di perangkat (tanpa Android SDK); hanya cek sintaks TS. Penyebab notifikasi hilang adalah dugaan dari kode:
bila masih terjadi, kirim `adb logcat -s MusicVerse` saat kejadian.



---

<!-- sumber: CHANGES-0.5.46.7.md -->

# MusicVerse 0.5.46.7 — Klik notifikasi saat lagu jalan tidak lagi "mundur" ke keadaan app lama

## Masalah
Lagu diputar (mis. menit 5), notifikasi diklik: lagu benar tapi app berperilaku seperti baru dibuka setelah lama
(status jeda + posisi lama, harus Play lagi). Terjadi saat WebView/JS dimatikan Android sementara pemutar native
masih berbunyi.

## Penyebab
1. `NativeMediaSync` langsung mengirim `updateNowPlaying` (`playing:false`, posisi simpanan lama) begitu JS boot dari sesi
   tersimpan, menimpa notifikasi/widget sebelum sesi native sempat diadopsi.
2. Pembandingan `session.at <= savedPositionAt()` dibaca SETELAH efek persist di mount menulis `at = Date.now()`, sehingga
   catatan native (bukan live) hampir selalu dianggap lebih lama dan dibuang.

## Perubahan
- `src/native/nativeSession.ts`: gerbang rekonsiliasi (`isNativeSessionReconciled`, `markNativeSessionReconciled`, `onNativeSessionReconciled`).
- `useAudioPlayerController.ts`: `bootSavedAt` diambil sekali sebelum efek persist; gerbang dibuka di semua jalur keluar efek sinkron native.
- `NativeMediaSync.tsx`: tidak mengirim pembaruan notifikasi selagi keadaan hasil pemulihan belum disamakan (batas tunggu 4 dtk;
  pemutaran yang dimulai pengguna tetap lolos). Hanya kode JS, **tidak perlu APK baru** bila APK sudah 0.5.49+ (ada `nativeSessionRead`).

## Belum diuji
Belum dijalankan di perangkat/emulator; hanya cek sintaks. Uji: putar lagu, tutup app dari recent (service tetap hidup),
tunggu menit 5, klik notifikasi — posisi harus lanjut dan tombol jeda langsung bekerja.



---

<!-- sumber: CHANGES-0.5.46.6.md -->

# MusicVerse 0.5.46.6 — Layar atur widget meniru Auralys (kaca, kilau, ketebalan, frost, progres, suka)

⚠️ Butuh **APK baru** (kode native, layout, dan drawable berubah). Belum dikompilasi di perangkat (tidak ada Android SDK di sini).

## Yang ditiru dari Auralys 4.3.2 (layar "Widget settings")
| Auralys | MusicVerse |
|---|---|
| Style: Glass / Clear glass / Dark / Light / Cover colour | Gaya: Kaca / Kaca bening / Gelap / Terang / Warna sampul |
| Accent colour: From the cover + 8 warna | Dari sampul + 8 warna (ungu, biru, teal, hijau, kuning, oranye, merah muda, merah) + Warna kustom (lipat) |
| Glass shine 78% | Kilau kaca (0–100%, bawaan 78) |
| Glass thickness (lens + rim) 39% | Ketebalan kaca (lensa + bingkai) (bawaan 39) |
| Corner roundness 66% | Kebulatan sudut (0–100%, bawaan 66; menggantikan 3 tingkat Kotak/Bulat/Pil) |
| Frost (cover blur) 40% | Frost / blur sampul (bawaan 40) |
| Cover shape: Rounded / Circle / Square | Bentuk sampul (sudah ada) |
| Text size: S / M / L | Ukuran teks (sudah ada) |
| Play button: Round / Plain | Tombol putar: Bulat / Polos |
| Show cover / progress bar / time / like button / previous and next | Saklar yang sama (progres, waktu, suka baru) |
| Tombol "Done" | Tombol **Selesai** tetap di bawah |

## Perubahan teknis
- `WidgetGlass.java` (baru): latar widget digambar jadi satu bitmap: sampul diburamkan (Frost), kilau diagonal, tepi lensa + bingkai, sudut dari persen. Di-cache; ukuran mengikuti ukuran widget (`onAppWidgetOptionsChanged`).
- `MusicVerseWidgetConfig`: field baru `glassShine`, `glassThickness`, `roundness`, `frost`, `showProgress`, `showTime`, `showLike`, tema `THEME_CLEAR_GLASS`. Pengaturan lama dimigrasi (sudut 3 tingkat → persen).
- Bilah progres + waktu di widget Tinggi 2×3 dan Besar 4×2; diperbarui tiap detik lewat `partiallyUpdateAppWidget` (hanya bilah dan teks waktu, dilewati saat layar mati).
- Tombol suka di widget Besar 4×2: widget → `PlaybackService.dispatch("like")` → event `mediaAction: like` → `NativeMediaSync` memanggil `toggleLike` (sama dengan hati di pemutar penuh). Status hati disinkronkan balik lewat `setWidgetLiked({ title, liked })`.
- Layar atur ditata ulang mengikuti Auralys: judul serif, pratinjau di atas latar keemasan, penggeser terisi dengan penunjuk berdiri, chip bergaris, saklar besar.

## Batas
- Progres/waktu hanya di Tinggi 2×3 dan Besar 4×2; tombol suka hanya di Besar 4×2 (lebar Kotak 2×2 / Tinggi 2×3 tidak muat empat tombol; Strip 4×1 dan Mini 1×1 terlalu pendek).
- Efek "lensa" Auralys (pembiasan sungguhan) tidak bisa di RemoteViews; diganti tepi lensa + bingkai gradien.
- Kilau, ketebalan, dan frost hanya berpengaruh di gaya Kaca / Kaca bening.

## Lirik pemutar penuh per kalimat
Di pemutar penuh baris aktif disorot utuh (tanpa sapuan per kata); mini player tetap per kata. Sakelar: `LINE_ONLY` di `LyricsPanel.tsx`.

## Notifikasi: Sebelumnya, banner, dan putar-ulang setelah gangguan
- **Sebelumnya di notifikasi melompat ke lagu yang beda dari aplikasi**: riwayat native (lagu yang ia tinggalkan sendiri) tidak ikut berubah saat JS memindahkan lagu, jadi bisa usang. Sekarang dikosongkan saat JS mengganti lagu.
- **Banner kosong setelah Sebelumnya**: lagu yang dimuat JS tidak punya URL sampul di native, jadi sampulnya tidak pernah diunduh. Sekarang riwayat dan antrean menyimpan bitmap sampul, ditambah memori 10 sampul terakhir per judul + artis.
- **Banner telat**: JS menyimpan sampul yang sudah disusun per lagu (12 terakhir) dan mengirimnya bersama pembaruan judul.
- **Tidak berbunyi/tampil jeda setelah gangguan**: putar-ulang otomatis native hanya memanggil play() tanpa memperbarui status notifikasi. Sekarang status ikut pemutar saat JS tidak melapor (`onIsPlayingChanged` / `onPlayWhenReadyChanged`).



---

<!-- sumber: CHANGES-0.5.46.5.md -->

# MusicVerse 0.5.46.5 — Widget dirapikan: warna bisa digeser, tanpa ukuran kembar, teks lebih besar, ada pratinjau

⚠️ Butuh **APK baru** (kode native, layout, dan manifest berubah).

## Masalah (dari pemakaian)
- Warna aksen tidak bisa digeser (hanya 8 titik warna + ketik hex).
- Layar atur widget jelek.
- Widget tidak punya gambar pratinjau di daftar widget peluncur.
- Ada dua widget berukuran sama: **Standar 4×1** dan **Strip 4×1**.
- Teks widget terlalu kecil (Strip 12/10 sp, Kotak 13/11 sp, sampul 32 dp).
- Daftar widget tidak diurutkan dari yang terkecil.

## Perubahan
**Warna bisa digeser** (`MusicVerseWidgetConfigActivity.java`)
- Tiga penggeser berlintasan gradien: **Rona**, **Saturasi**, **Kecerahan**, plus kolom hex dua arah dan 8 warna siap pakai. Pratinjau berubah langsung saat digeser.
- Penggeser memanggil `requestDisallowInterceptTouchEvent`, jadi seretan tidak dicuri ScrollView. Baris chip tidak lagi `HorizontalScrollView` (dibungkus ke baris berikutnya).

**Layar atur ditata ulang** (gaya gelap bersudut bulat ala Auralys: kartu per kelompok — Tema, Warna aksen, Bentuk, Teks dan latar, Tampilkan)
- Bilah **Batal / Simpan** tetap di bawah, tombol & chip tinggi 40–52 dp, teks 14–17 sp, saklar untuk "Tampilkan".

**Tanpa ukuran kembar**
- Widget **Standar 4×1** dihapus dari daftar widget (kembar dengan Strip 4×1). Kelas `MusicVerseWidget` tetap terdaftar di manifest **hanya** sebagai penerima tombol (tanpa `intent-filter`/`meta-data`). `setup-android.mjs` membuang entri Standar lama dari manifest yang sudah ada (idempoten, sudah diuji di manifest tiruan).
- Sisa lima bentuk: Mini 1×1, Strip 4×1, Kotak 2×2, Tinggi 2×3, Besar 4×2 (Auralys: 1×1, 4×1, 2×2, 2×4, 4×2).

**Urut dari terkecil**
- Label diberi awalan angka: `1 · Mini 1×1`, `2 · Strip 4×1`, `3 · Kotak 2×2`, `4 · Tinggi 2×3`, `5 · Besar 4×2`, dan receiver dideklarasikan dalam urutan itu. Peluncur yang mengurutkan menurut abjad pun tetap menampilkan urutan ini.

**Pratinjau di daftar widget**
- Tiap `widget_*_info.xml` kini punya `previewLayout` (Android 12+, memakai layout widget asli) dan `previewImage` (`drawable/widget_preview_*.xml`, vektor, untuk Android lama).
- Latar bawaan `widget_bg_*` diganti dari putih ke gelap dan sampul bawaan dipasang di layout, supaya `previewLayout` tidak tampak kosong (warna asli tetap diatur lewat `setColorFilter`).

**Teks dan tombol lebih besar**
| Bentuk | Judul/artis sebelumnya | Sekarang |
|---|---|---|
| Strip | 12 / 10 sp, sampul 32 dp | 15 / 12 sp, sampul 44 dp, tombol 38–42 dp |
| Kotak | 13 / 11 sp | 15 / 12 sp, sampul 64 dp |
| Tinggi | 14 / 12 sp | 16 / 13 sp |
| Besar | 16 / 13 sp | 18 / 14 sp |
Skala "Kecil" 0,88 → 0,93; "Besar" 1,18 → 1,2.

## Belum / batas
- **Belum dikompilasi dan diuji di perangkat/emulator** (tidak ada Android SDK di sini). Sintaks Java dicek dengan javac (hanya error simbol Android yang wajar), XML divalidasi, dan tes `WidgetColors` lulus.
- Widget Standar 4×1 yang sudah terpasang di layar utama akan hilang setelah pembaruan; pasang ulang sebagai Strip 4×1.
- Layar atur tidak meniru Auralys piksel-per-piksel (Auralys memakai Compose; yang diambil: kartu, chip, penggeser, bilah bawah).
- "Visual" di sini ditafsirkan sebagai pratinjau di daftar widget. Visualizer audio hidup (batang naik-turun) di widget belum ada: RemoteViews tidak bisa menganimasikan, dan datanya perlu jembatan dari `PlaybackService`.



---

<!-- sumber: CHANGES-0.5.46.4.md -->

# MusicVerse 0.5.46.4 — Gestur mini player <-> pemutar penuh dibuat halus

## Masalah
- Seret mini player ke atas: kartu hanya bergeser sedikit, pemutar penuh baru muncul (animasi berbasis waktu) SETELAH jari dilepas, jadi terasa patah-patah.
- Seret pemutar penuh ke bawah lalu lepas: animasi tutup memakai keyframe (radius sudut dianimasikan di CPU, pengukuran ulang layout, latar blur full-layar ikut digambar ulang), jadi tersendat.

## Perubahan
- `services/playerSheet.ts` (BARU): satu angka `progress` (0 = mini, 1 = penuh) + pegas teredam kritis yang mewarisi kecepatan jari. Dipakai untuk buka, tutup, dan batal, jadi semuanya terasa sama.
- `MiniPlayer.tsx`: seret ke atas memasang pemutar penuh sejak awal seretan dan menggerakkannya 1:1 mengikuti jari. Entri riwayat baru dibuat hanya saat dilepas dan memang membuka (seretan yang dibatalkan tidak meninggalkan jejak di tombol Kembali). Keputusan buka/tutup memakai proyeksi posisi + momentum, jadi lemparan cepat pendek tetap membuka. Kecepatan jari dihaluskan, dan jari yang diam sebelum dilepas = tanpa momentum.
- `FullPlayer.tsx`: seluruh tampilan ditulis dari progress (hanya transform + opacity, langsung ke DOM tanpa render ulang React): lapisan naik/turun, latar memudar, sampul terbang dari sampul mini ke ukuran penuh (posisi, skala, radius), elemen lain muncul bergantian. Seret ke bawah memakai mesin yang sama; seretan bisa menangkap lapisan di tengah animasi buka.
- `PlayerDock.tsx`: pemutar penuh dipasang juga selama seretan dari mini player; tidak ada lagi `key` untuk memulai ulang animasi (dibuka ulang di tengah animasi tutup kini melanjutkan dari posisi sekarang).
- `index.css`: keyframe `fp-rise`, `fp-out`, `fp-bg-in` dihapus (digantikan progress).
- Bar "Berikutnya": `backdrop-blur-xl` dibuang (latarnya sudah buram; blur backdrop dihitung ulang tiap frame saat bergerak).
- `services/flyOrigin.ts` dihapus (tidak diperlukan lagi).

## Belum / batas
- Belum diuji di perangkat. Angka yang mungkin perlu disetel rasa: `OMEGA` (kecepatan pegas) di `playerSheet.ts`, `OPEN_PROJECTION` (MiniPlayer), `CLOSE_PROJECTION`, `ITEM_START/STEP/SPAN` dan `BG_FADE` (FullPlayer).
- Seret kartu mini ke BAWAH (jadi gelembung) tidak diubah.



---

<!-- sumber: CHANGES-0.5.46.3.md -->

# 🎵 MusicVerse 0.5.46.3

> Dibangun di atas 0.5.46 (rilis gabungan 0.5.44 → 0.5.62, lihat `CHANGES-0.5.46.md`). Isi: **widget layar utama lebih banyak + bisa diatur** dan **animasi tarik mini player ↔ pemutar penuh lebih halus**. Nomor versi aplikasi (`appVersion` di `package.json` dan APK): **0.5.46.3** (versionCode 54603).

⚠️ Butuh **APK baru** (kode native + manifest berubah, sidik jari native berubah, jadi pembaruan tampilan OTA lama tidak cocok).

---


## 🧩 Widget lebih banyak + bisa diatur
Terinspirasi widget Auralys (5 bentuk + layar atur). Sebelumnya MusicVerse hanya punya 1 widget (4×1) tanpa pengaturan.

## ✨ 6 bentuk widget
| Bentuk | Ukuran | Isi |
|---|---|---|
| Standar | 4×1 | sampul, judul, artis, ◀ ▶❚❚ ▶▶ (sama seperti sebelumnya) |
| Kotak | 2×2 | sampul + judul/artis di atas, tombol di bawah |
| Tinggi | 2×3 | sampul besar, judul/artis, tombol |
| Besar | 4×2 | sampul besar di kiri, judul/artis + tombol di kanan |
| Strip | 4×1 tipis | satu baris ringkas |
| Mini | 1×1 | hanya sampul + tombol putar/jeda |

Semua bentuk memakai satu aliran data dari `PlaybackService` (tidak ada polling) dan satu receiver perintah, jadi perilaku tombol sama di semua bentuk (termasuk "Putar" saat aplikasi tertutup).

## 🎛️ Bisa diatur per widget
Dibuka saat widget ditambahkan, dan lewat **tekan lama widget > Atur ulang** (Android 9+). Pratinjau langsung memakai RemoteViews yang sama dengan widget asli.
- **Tema**: Gelap, Terang, Kaca (transparan), Warna sampul, Warna aksen
- **Warna aksen**: 8 warna siap pakai, **warna sendiri (hex)**, atau **dari sampul** lagu yang sedang diputar
- **Sudut**: Kotak / Bulat / Pil
- **Bentuk sampul**: Bulat sudut / Lingkaran / Kotak
- **Tombol putar**: Terisi / Polos
- **Ukuran teks**: Kecil / Sedang / Besar
- **Keburaman latar**: 20–100%
- **Tampilkan**: sampul, nama artis, tombol Sebelumnya/Berikutnya
Pengaturan terakhir yang disimpan jadi bawaan untuk widget baru berikutnya. Pengaturan dihapus otomatis saat widget dihapus.

## 🔧 Berkas
- Baru: `MusicVerseWidget{Square,Tall,Large,Strip,Tiny}.java`, `MusicVerseWidgetConfig.java`, `MusicVerseWidgetConfigActivity.java`, `WidgetColors.java` (hitungan warna murni, ada tesnya), layout `widget_{square,tall,large,strip,tiny}.xml`, `res/xml/widget_*_info.xml`, `res/drawable/widget_bg_{square,round,pill}.xml`
- Diubah: `MusicVerseWidget.java` (kini mengurus semua bentuk), `widget_player.xml`, `widget_player_info.xml`, `scripts/setup-android.mjs` (receiver + layar atur; manifest lama otomatis ditambah, XML provider diisi appId), `AndroidManifest.additions.xml`
- Tes warna: lihat `native/android/test/README.md`

## ⚠️ Belum / batas
- ⚠️ Butuh **APK baru** (kode native + manifest berubah; sidik jari native ikut berubah).
- **Belum dikompilasi dan diuji di perangkat/emulator** (tidak ada Android SDK di lingkungan penyusunan). Yang sudah dicek: sintaks Java, XML valid, ID layout cocok dengan kode, `setup-android.mjs` idempoten di proyek tiruan, dan tes logika warna.
- Tema "Kaca" hanya transparan berwarna (RemoteViews tidak bisa blur).
- Tombol Suka (seperti Auralys) belum ada: perlu jembatan ke JS.
- Widget Mini tanpa teks; ukuran teks tidak berlaku di sana.

---


## 🎞️ Animasi tarik lebih halus
Dari rekaman layar: tarik full player ke bawah terasa patah di akhir, dan tarik mini player ke atas kurang mulus.

## Penyebab dan perbaikan
**Full player ditarik ke bawah lalu dilepas** (`FullPlayer.tsx`)
- Dulu: saat animasi tutup mulai, sisa seretan (turun + mengecil) dikembalikan ke posisi penuh lewat transisi, jadi seluruh kartu "membalik" naik sambil sampul terbang ke mini player, lalu latar menghilang. Itu yang tampak sebagai lompatan/kabur.
- Kini: kartu dibiarkan di posisi seretannya dan hanya memudar. Sampul terbang dari posisi TAMPAKNYA sekarang ke sampul mini (target dikonversi ke koordinat lokal kartu: kebalikan dari `translate + scale` seretan).
- Easing setelah seretan `EASE_DRAG_CLOSE` (cepat di awal, mengendap di akhir) supaya terasa melanjutkan gerak jari; latar mulai memudar lebih awal.

**Mini player ditarik ke atas lalu dilepas** (`MiniPlayer.tsx`, `services/flyOrigin.ts`)
- Dulu: kartu langsung memantul balik (spring) tepat saat pemutar penuh membaca posisi sampul, jadi titik awal terbang sampul tidak tentu dan terlihat melompat.
- Kini: posisi sampul dicatat tepat saat dilepas dan dipakai sebagai asal terbang; kartu kembali meluncur halus tanpa membal.

**Beban gambar per frame**
- `box-shadow` besar tidak lagi dianimasikan di keyframe terbang (digambar ulang tiap frame); bayangan statis di kelas sampul tetap. `will-change: transform` dipasang selama terbang.

## Belum / batas
- Belum diuji di perangkat (tidak ada emulator di lingkungan penyusunan); hanya typecheck bagian yang diubah.
- Gerak sampul saat seret masih lompat-sekali saat dilepas, belum "interaktif" mengikuti jari (sampul mengecil sebanding jarak seret). Itu perubahan lebih besar bila masih kurang.
- Penyetelan: `EASE_DRAG_CLOSE`, `CLOSE_MS` di `FullPlayer.tsx`; durasi `settleAfterOpen` di `MiniPlayer.tsx`.



---

<!-- sumber: CHANGES-0.5.46.md -->

# 🎵 MusicVerse 0.5.46

> Rilis gabungan **0.5.44 → 0.5.62**. Catatan per versi 0.5.44 sampai 0.5.62 (sebelumnya satu berkas per versi) digabung di sini, urut dari yang terlama, isinya apa adanya. Nomor versi aplikasi di `package.json` dan APK: **0.5.46**.

## ✨ Sorotan

- 📻 **Radio otomatis** dan **Mulai radio dari lagu ini** (0.5.44)
- 🔊 **Normalisasi volume** antar lagu (0.5.45)
- ⏯️ **Notifikasi unduhan**: Jeda/Lanjutkan jalan tanpa JS (0.5.46)
- 🧾 **Jurnal putar native** dan posisi + lagu aktif disimpan native, Riwayat tidak bolong (0.5.47, 0.5.49)
- 🚗 **Android Auto**: Lagu Disukai, Playlist saya, dan Unduhan (0.5.48)
- 🔗 **Link audio YouTube diambil ulang native** dan pencarian radio di native (0.5.50 sampai 0.5.53)
- 🎤 **Lirik per kata**: karaoke per kata, duet, vokal latar, provider yang bisa diatur, terjemahan dan romanisasi, ISRC Deezer (0.5.54 sampai 0.5.59)
- ✨ **Animasi pemutar**: sorotan lirik menyapu halus, mini player ke pemutar penuh, dan mini player ke disc di belakang nav (0.5.60 sampai 0.5.62)

Tiap bagian di bawah memuat bagian **Belum / batas** miliknya; banyak yang belum diuji di perangkat.

## 0.5.44 — Radio otomatis + "Mulai radio dari lagu ini"
### Cara kerja (keterangan)
- **Radio otomatis** (Pengaturan > Pemutaran, APK, **mati secara bawaan**): saat lagu yang tersisa di antrean setelah lagu aktif tinggal 1 atau kurang, app mencari lagu mirip dan **menambahkannya di akhir antrean** (15 lagu per isi ulang). Antrean yang sudah ada tidak diubah.
- **Mulai radio dari lagu ini** (menu lagu, di mana saja, termasuk web): memutar lagu itu, **mengganti antrean**, lalu mengisinya dengan lagu mirip. Radio ini terus diisi ulang sampai pengguna memutar lagu di luar radio.
- **Sumber "lagu mirip":**
  1. Online (hanya APK, sama seperti pencarian artis): artis utama lagu dicari di Deezer, lalu diambil *radio artis* Deezer (`/artist/{id}/radio`): campuran lagu artis itu dan artis serupa pilihan Deezer. Diacak, lagu yang sudah ada di antrean dibuang.
  2. Cadangan (web, tanpa internet, atau Deezer gagal): lagu dari **Riwayat**, artis yang sama didahulukan. Bila Riwayat kosong, tidak ada yang ditambahkan (tampil pemberitahuan pada radio yang dimulai manual).
- Lagu radio diputar lewat jalur yang sama dengan lagu lain (judul + artis dicocokkan ke sumber audio), jadi sesekali bisa gagal atau salah cocok seperti lagu hasil pencarian.
### Batasan
- Radio tidak aktif saat mode ulang "satu lagu" atau saat "berhenti setelah lagu ini" (sleep timer).
- Isi ulang berjalan di latar saat lagu masih diputar. Bila pencarian lebih lama dari sisa lagu terakhir (internet sangat lambat), lagu terakhir bisa selesai dulu dan lagu tambahan baru masuk daftar "Berikutnya" tanpa langsung diputar.
- Saklar otomatis hanya ada di APK (halaman Pemutaran hanya di APK). Di web radio hanya lewat menu lagu dan memakai Riwayat.
- Lagu radio tidak diberi penanda khusus di daftar antrean.
### Teknis
- File baru: `services/radio.ts`, `components/player/AutoRadioSync.tsx` (dipasang di `App.tsx` setelah `AutoResumeSync`).
- Diubah: `services/artistApi.ts` (`fetchArtistRadio`, pemetaan baris Deezer dipisah jadi `mapDeezerRows`), `components/player/TrackMenuSheet.tsx`, `pages/PlaybackSettingsPage.tsx`.
- Memakai `addToQueue(track, { fromSearch: true })` yang sudah ada, jadi sinkron antrean native ikut jalan seperti biasa.
- Hanya JS (OTA). Belum dibuild atau diuji di perangkat; hanya sintaks yang dicek.

---

## 0.5.45 — Normalisasi volume
### Cara kerja (keterangan)
- YouTube menyertakan **kekerasan tiap lagu** (`playerConfig.audioConfig.loudnessDb`, dB relatif acuan YouTube; positif = lebih keras) di respons stream. Nilai itu kini dibaca plugin `ytmusic` (dan `ytvideo`, yang memakai pengambil yang sama), dibawa lewat `StreamSource.loudnessDb` -> `PlaybackInfo.loudnessDb`.
- `VolumeNormSync` meneruskannya ke `audioEngine.setNormalizationDb()`. Lagu yang lebih keras dari acuan **diredam sebesar selisihnya** (maksimal 12 dB). Redaman ikut dikalikan ke volume akhir (master x akhir-lagu x normalisasi), jadi fade, crossfade, dan sleep timer tetap bekerja. Di APK lewat `ExoPlayer.setVolume`, di web lewat `audio.volume`.
- Tidak perlu mengukur audio sendiri, tidak ada perubahan native, tidak perlu APK baru.
### Batasan
- **Hanya meredam, tidak menaikkan.** Lagu yang lebih pelan dari acuan tetap pelan (volume tidak bisa dinaikkan di atas 100% lewat `audio.volume`/`setVolume`). Akibatnya volume rata-rata sedikit turun; naikkan volume perangkat bila perlu.
- Hanya lagu yang datang dari YouTube dan **punya data `loudnessDb`**. Bergantung klien yang dipakai plugin (VISIONOS / ANDROID / IOS); bila klien tidak menyertakannya, lagu itu diputar tanpa perubahan. Unduhan, lagu lokal, dan sumber lain tidak berubah.
- Belum diketahui seberapa sering nilainya tersedia di klien yang dipakai; perlu dicek di perangkat (catat `loudnessDb` di log atau lihat hasil dengar).
- iOS Safari mengabaikan `audio.volume`, jadi tidak berpengaruh di sana.
- Saat pindah lagu dengan crossfade, redaman lagu baru berlaku begitu info lagu itu terpasang (bisa ada selisih beberapa dB yang terdengar sebagai lompatan kecil di tengah crossfade).
### Pengaturan
- Pengaturan > Pemutaran > **Normalisasi volume** (APK). **Menyala secara bawaan**, tersimpan di `musicverse:volnorm:v1`. Di web (tanpa halaman Pemutaran) selalu menyala.
### Teknis
- File baru: `services/volumeNorm.ts`, `components/player/VolumeNormSync.tsx` (dipasang di `App.tsx`).
- Diubah: `plugins/types.ts`, `plugins/ytmusic.ts`, `plugins/registry.ts`, `types/spotify.ts`, `services/audioEngine.ts`, `pages/PlaybackSettingsPage.tsx`.
- Hanya JS (OTA). Belum dibuild atau diuji di perangkat; hanya sintaks yang dicek.

---

## 0.5.46 — Tombol Jeda/Lanjutkan notifikasi unduhan jalan tanpa JS
### Cara kerja
- Saat app digeser / WebView mati, antrean native (`DownloadQueue`) memegang notifikasinya sendiri. Sekarang notifikasi itu punya tombol **Jeda**; sebelumnya tidak ada tombol sama sekali dan tombol hanya diteruskan ke JS.
- **Jeda** (native): lagu yang sedang berjalan diselesaikan dulu (notifikasi: "Unduhan dijeda — Berhenti setelah lagu ini"), lalu antrean berhenti dan notifikasi berubah jadi "Unduhan dijeda" + tombol **Lanjutkan**. Pekerja tidak lagi menyala ulang sendiri selama dijeda.
- **Lanjutkan** (native): pekerja dinyalakan lagi dan service kembali jadi foreground.
- Bila JS hidup, perilaku lama tidak berubah: tombol diteruskan ke JS (`downloadAction`).
- Jeda native dilepas bila JS mengambil alih: `queueAdd` (JS menyerahkan lagu) atau `queueSync` (app dibuka). Jadi tidak ada keadaan macet "dijeda di native, jalan di JS".
### Batasan
- Jeda tidak memutus lagu yang sedang diunduh; menunggu lagu itu selesai.
- Saat JS hidup tapi **beku** (bukan mati), notifikasi masih dimiliki JS sehingga tombolnya tetap diteruskan ke JS beku. Belum ditangani.
- Android 12+: service dinyalakan dari tombol notifikasi; bila sistem menolak jadi foreground, unduhan tetap jalan tanpa perlindungan service.
### Teknis
- Diubah: `native/android/java/DownloadQueue.java` (`paused`, `setPaused`, `isPaused`, `nextLocked`, guard restart pekerja, `notifyText`, `finishNotification`, `isBusy`), `native/android/java/DownloadService.java` (`onStartCommand`).
- **Perubahan native: perlu build APK baru** (naikkan `version` di package.json). Belum dibuild atau diuji di perangkat; javac tidak tersedia saat mengubah, hanya keseimbangan kurung dicek.

---

## 0.5.47 — Jurnal putar native (Riwayat tidak bolong saat JS beku/mati)
### Masalah
- Riwayat dan "Baru diputar" dicatat oleh JS (`LibraryContext`) saat status `playing`. Saat rantai native memutar lagu sendiri (WebView beku di latar belakang, atau activity sudah dihancurkan), JS tidak melihat lagu itu mulai: lagu hilang dari Riwayat, statistik, Recap, dan radio berbasis Riwayat.
### Cara kerja
- **Native** (`PlayJournal.java`, baru): tiap lagu yang dimulai rantai native (`chainAdvance`, `chainPrevious`) dicatat di `files/playjournal.json` (maks 300 entri, ditulis atomik di thread IO sendiri) bila lagunya punya id.
- JS kini menyertakan `trackId` + `trackUrl` pada tiap lagu yang diserahkan lewat `engineSetUpcoming`, supaya native punya id lagu untuk entri Riwayat. Native hanya mempercayai id itu selama judul lagu aktif masih sama dengan judul lagu rantai (lagu yang dimuat ulang JS tidak mewarisi id lama).
- **JS** (`native/playJournal.ts`, `LibraryContext.syncNativePlays`): saat app dibuka dan tiap kembali ke depan (`appStateChange` + `visibilitychange`), jurnal dibaca (`playJournalRead`), dimasukkan ke Riwayat (`mergeNativePlays`) dan Baru diputar, lalu dihapus dari jurnal (`playJournalClear`, hanya setelah berhasil masuk).
- **Dedupe:** JS yang hidup juga mencatat lagu yang sama. Entri jurnal dilewati bila Riwayat sudah punya id yang sama dalam jendela -90 dtk..+15 mnt dari waktu native (JS yang baru bangun mencatat lagu aktif paling lambat satu lagu sesudah native memulainya). Sebaliknya, `appendPlayLog` tidak menambah entri bila entri terakhir berasal dari jurnal (`native: true`) untuk lagu yang sama dalam 15 mnt. Entri jurnal yang sama tidak masuk dua kali (aman bila `clear` gagal).
- "Baru diputar" tidak dimundurkan: lagu yang sudah punya catatan JS lebih baru tidak ditimpa, dan daftar diurutkan menurut waktu putar.
### Batasan
- Hanya lagu rantai native yang punya id yang tercatat. Lagu yang dimuat JS dicatat JS sendiri (tidak berubah).
- Lagu dicatat saat native **memulainya**, bukan saat audio benar-benar terdengar (gagal dimuat tetap tercatat; lagu berikutnya yang dilompati akibat error tidak).
- Pemutaran balik lewat Previous native ikut dicatat sebagai pemutaran baru.
- Replay lagu yang sama < 15 mnt setelah entri jurnal-nya dianggap satu pemutaran (tidak dihitung dua kali).
- Jurnal hanya dibaca saat app dibuka / kembali ke depan, bukan realtime.
- Daftar telusur Android Auto, pencarian radio, dan resolver YouTube tetap di JS (item berikutnya).
### Teknis
- Baru: `native/android/java/PlayJournal.java`, `src/native/playJournal.ts`.
- Diubah: `PlaybackService.java` (`UpcomingItem`/`HistoryItem` + `trackId`/`trackUrl`, `journalPlay`), `MusicVerseNativePlugin.java` (`playJournalRead`, `playJournalClear`, parsing `trackId`/`trackUrl`), `src/native/musicVerseNative.ts`, `src/services/audioEngine.ts`, `src/hooks/useAudioPlayerController.ts`, `src/utils/playLog.ts`, `src/context/LibraryContext.tsx`.
- APK lama: `playJournalRead` melempar UNIMPLEMENTED, ditangkap dan diabaikan (Riwayat berjalan seperti biasa).
- **Perubahan native: perlu build APK baru** (naikkan `version`). Belum dibuild atau diuji di perangkat; sintaks TS dicek (transpile), Java hanya keseimbangan kurung (javac tidak tersedia).

---

## 0.5.48 — Android Auto: Lagu Disukai, Playlist saya, dan Unduhan
### Cara kerja
- Pohon telusur Android Auto sebelumnya hanya "Baru diputar" dan "Antrean". Kini:
  - **Lagu Disukai** (playlist bawaan `my-liked`), tampil bila ada isinya.
  - **Playlist saya**: tiap playlist buatan (bukan Lagu Disukai, yang berisi lagu) jadi folder; ketuk playlist untuk melihat lagunya.
  - **Unduhan**: lagu yang sudah diunduh, terbaru dulu. Bisa diputar tanpa internet.
- Ketuk lagu: lagu itu dan semua sesudahnya di daftar yang sama diputar (sama seperti Baru diputar). Id item: `liked:<id>`, `pl:<idPlaylist>:<id>`, `dl:<id>`; JS mempercayai id lagu, bukan posisi, jadi aman bila daftar berubah sejak diterbitkan.
- **Pustaka disimpan native** (`AutoBridge.setLibrary`, SharedPreferences, kunci terpisah dari `browse`), jadi mobil bisa menelusurinya walau aplikasi belum dibuka. Dipisah karena ukurannya lebih besar dan jarang berubah; JS hanya menulisnya bila isinya benar-benar berubah (dibandingkan dengan yang terakhir dikirim, ditunda 1,5 dtk).
- **Pencarian suara** ("Ok Google, putar …") kini juga mencari di Lagu Disukai, Unduhan, dan playlist buatan (sebelumnya hanya Riwayat, lalu artis lewat Deezer). Urutan: Riwayat, Disukai, Unduhan, playlist; lagu yang sama dihitung sekali.
### Batas
- Maks. 100 lagu per daftar (Disukai, Unduhan, tiap playlist) dan 30 playlist di daftar mobil. Memutar tetap memakai seluruh daftar dari lagu yang diketuk.
- Folder yang kosong tidak ditampilkan. Daftar belum punya sampul (sama seperti sebelumnya).
- Resolve audio untuk lagu non-unduhan tetap oleh JS: memutar dari mobil saat app belum berjalan masih bergantung pada app terbuka (batas lama Android 10+).
- Unduhan di mobil memakai urutan `savedAt` (terbaru dulu), bukan urutan playlist asal.
### Teknis
- Diubah: `AutoBridge.java` (`setLibrary`, `readLibrary`), `AutoBrowserService.java` (simpul `NODE_LIKED`, `NODE_PLAYLISTS`, `NODE_DOWNLOADS`, awalan `PL_PREFIX`, `songItems`, `refresh` memberi tahu semua simpul), `MusicVerseNativePlugin.java` (`setAutoLibrary`), `src/native/musicVerseNative.ts`, `src/components/player/AutoSync.tsx` (`libraryPayload`, `tracksFromMediaId`, `tracksFromQuery`, efek 1b).
- APK lama: `setAutoLibrary` melempar UNIMPLEMENTED dan diabaikan (telusur tetap Baru diputar + Antrean).
- **Perubahan native: perlu build APK baru** (naikkan `version`). Belum dibuild atau diuji di perangkat / Desktop Head Unit; TS dicek sintaksnya (transpile), Java hanya keseimbangan kurung.

---

## 0.5.49 — Posisi & lagu aktif disimpan native saat activity dihancurkan
### Masalah
- Penyimpanan JS (antrean, lagu aktif, posisi) hanya diperbarui selama JS hidup. Saat Android menghancurkan activity (WebView mati) pemutar native bisa terus jalan dan pindah lagu sendiri; saat app dibuka lagi JS memulihkan lagu / posisi LAMA, dan tombol Play memuat ulang lagu itu.
### Cara kerja
- **Native** (`NativeSession.java`, baru): `PlaybackService` mencatat lagu aktif + posisi (id lagu bila lagu rantai, judul, artis, indeks, durasi, status putar, sumber). Memori tiap ~1 dtk; ke penyimpanan (SharedPreferences) saat lagu pindah, dijeda, service berhenti / app digeser, dan tiap ~10 dtk saat native memegang kendali (JS tidak mengirim detak).
- **JS** (`native/nativeSession.ts`, `useAudioPlayerController`): saat app dibuka dan sesi baru dipulihkan dari penyimpanan, catatan native dibaca (`nativeSessionRead`) lalu dicocokkan ke antrean tersimpan (id lagu, lalu judul + artis; indeks native hanya petunjuk). Lagu aktif dan posisi disamakan, lalu catatan dihapus (`nativeSessionClear`).
  - Catatan **hidup** (pemutar native masih ada) selalu dipakai. Catatan **tersimpan** hanya dipakai bila lebih baru dari posisi simpanan JS (`savePlayerPosition` kini menyimpan `at`).
  - Bila native **masih memutar**, JS mengadopsi audionya (`audioEngine.adoptNative`): tanpa memuat ulang, status jadi "memutar", event native diteruskan lagi, jeda / seek bekerja pada suara yang sedang berbunyi.
  - Bila native dijeda / sudah berhenti: tampil dijeda di lagu + posisi yang benar; Play mengambil tautan baru dan lanjut dari posisi itu (alur lama).
### Batasan
- Lagu yang tidak ditemukan di antrean tersimpan tidak diadopsi (tidak menebak).
- Proses dimatikan sistem tanpa callback: posisi bisa tertinggal sampai ~10 dtk.
- Setelah adopsi, `playbackInfo` kosong sampai lagu berikutnya (info kualitas / sumber tidak tampil untuk lagu itu).
- Posisi yang disimpan sesaat setelah adopsi bisa 0 sampai detak `timeupdate` pertama.
### Teknis
- Baru: `native/android/java/NativeSession.java`, `src/native/nativeSession.ts`.
- Diubah: `PlaybackService.java` (`recordSession`), `MusicVerseNativePlugin.java` (`nativeSessionRead`, `nativeSessionClear`), `src/native/musicVerseNative.ts`, `src/services/audioEngine.ts` (`adoptNative`), `src/utils/playerSession.ts`, `src/hooks/useAudioPlayerController.ts`.
- APK lama: `nativeSessionRead` melempar UNIMPLEMENTED, ditangkap dan diabaikan (perilaku lama).
- **Perubahan native: perlu build APK baru.** Belum dibuild atau diuji di perangkat; TS dicek sintaksnya (transpile), Java hanya keseimbangan kurung (javac tidak tersedia).

---

## 0.5.50 — Link unduhan YouTube diambil ulang oleh native
### Masalah
- Antrean unduhan native (`DownloadQueue`) hanya menerima link yang sudah di-resolve JS. Bila link kedaluwarsa (>90 menit di antrean) atau ditolak server video (HTTP 401/403/404/410) saat JS mati / beku, lagu dikembalikan ke JS (`handback`) dan menunggu app dibuka lagi.
### Cara kerja
- **`YtResolver.java` (baru)**: port native `getStreams` plugin `ytmusic` / `ytvideo` (id video -> stream audio). Urutan klien sama dengan JS (VISIONOS, ANDROID_VR, ANDROID tanpa `androidSdkVersion`, IOS), visitorData di-cache (memori + SharedPreferences), klien yang URL-nya baru ditolak dilewati 10 menit, MP4/AAC dulu lalu bitrate tertinggi.
- **JS** membawa id video ke native: `PlaybackInfo.ytVideoId` (diisi `registry.ts` untuk plugin `ytmusic` / `ytvideo`, termasuk pilihan manual) -> `NativeQueueJob.ytId` (`native/downloads.ts`; hanya bila link yang diserahkan memang stream YouTube langsung itu).
- **`DownloadQueue.process`**: bila job punya `ytId` dan link kedaluwarsa, atau unduhan ditolak 401/403/404/410, native mengambil link baru lewat `YtResolver` dan melanjutkan (maks. 2 kali per lagu per giliran; `.part` disambung, dan pengunduh memulai ulang sendiri bila ukuran sumber baru berbeda). Gagal resolve / bukan lagu YouTube: `handback` ke JS seperti sebelumnya.
### Batasan
- Hanya mengambil ulang link untuk video yang SUDAH dipilih JS. Pencarian judul + artis -> id video, pencocokan kandidat, dan sumber pihak ketiga tetap di JS (item #1/#2).
- Pilihan kualitas unduhan pengguna tidak dibawa ke native: link baru memakai urutan bawaan (MP4/AAC, bitrate tertinggi).
- Link baru tidak diperiksa durasinya oleh WebView seperti hasil resolve JS; native hanya memakai pemeriksaan ukuran / durasi yang sudah ada.
- Respons YouTube bisa berubah; klien yang gagal dilewati, tetapi bila semuanya gagal lagu kembali ke JS.
### Teknis
- Baru: `native/android/java/YtResolver.java`.
- Diubah: `DownloadQueue.java` (`refreshLink`, `MAX_LINK_REFRESHES`, loop unduh), `src/types/spotify.ts`, `src/plugins/registry.ts`, `src/native/downloads.ts`, `src/native/musicVerseNative.ts`.
- APK lama: field `ytId` diabaikan (perilaku lama).
- **Perubahan native: perlu build APK baru.** Belum dibuild atau diuji di perangkat; TS dicek sintaksnya (transpile), Java hanya keseimbangan kurung (javac tidak tersedia).

---

## 0.5.51 — Link audio diambil ulang native saat stream aktif gagal (langkah 1 dari resolve YouTube)
### Masalah
- Saat link lagu yang SEDANG diputar kedaluwarsa / ditolak server video / macet dan JS beku di latar belakang, pemutar native hanya bisa melompat ke lagu berikutnya. Link baru tetap butuh JS.
### Cara kerja
- `PlaybackService.relinkActive`: pada `onPlayerError` (setelah cadangan proxy `fallbackActive` gagal) dan pada macet tahap 3 (`handleStall`), bila JS beku, native mengambil link BARU untuk lagu yang SAMA di thread sendiri:
  - id video diketahui (`activeYtId`, lagu rantai hasil resolve native) -> `YtResolver.getStreams`;
  - id tidak diketahui (lagu dimuat JS, lagu dari Sebelumnya) -> `YtMatcher.resolve` (judul + artis + durasi, mode pemutaran).
  - Link baru didaftarkan ke `StreamProxy`, lalu `loadMedia` dari posisi terakhir (kunci cache sama, jadi bagian yang sudah ter-cache terpakai). Status putar/jeda dipertahankan; indikator memuat dipasang selama menunggu.
- Penolakan server (HTTP 401/403/404/410) menandai klien YouTube penghasil link itu dilewati 10 menit (`YtResolver.markRejected`) supaya link baru memakai klien lain. Galat jaringan biasa tidak menandai klien.
- Maks. 2 kali per lagu (`MAX_RELINKS`). Gagal / habis jatah: lompat ke lagu berikutnya seperti sebelumnya; bila tidak ada lagu berikutnya, galat dilaporkan dan indikator memuat dilepas.
- Hasil resolve yang datang setelah lagu berganti / berhenti dibuang (`relinkSeq`). Bila JS terbangun selagi native mengambil link, galat diserahkan ke JS (alur lama).
### Batasan
- Lagu yang dimuat JS tidak membawa id video ke native, jadi dicari ulang lewat judul + artis. Pilihan manual pengguna (`manualPins`) tidak ikut: link baru bisa berasal dari video lain. (Langkah berikutnya: JS membawa `ytId` ke native untuk lagu aktif dan antrean.)
- Hanya saat JS beku. Saat JS hidup, JS yang mengambil link baru seperti biasa.
- Sumber pihak ketiga dan cache hasil / nama lain lagu tetap di JS.
- Pencarian radio (Deezer + cocokkan ke YouTube, `services/radio.ts`) belum dipindah (langkah berikutnya).
### Teknis
- Diubah: `native/android/java/PlaybackService.java` (`relinkActive`, `onRelinked`, `resetRelink`, `isRejectedByServer`, titik reset di `doLoad`, `doStopEngine`, `doCrossfade`, `chainAdvance`, `chainPrevious`), `package.json` (0.5.51).
- Tidak ada perubahan JS/TS. APK lama: tidak relevan (perilaku lama).
- **Perubahan native: perlu build APK baru.** Belum dibuild atau diuji di perangkat; javac tidak tersedia, Java hanya dicek keseimbangan kurung (tambahan seimbang).

---

## 0.5.52 — JS membawa id video YouTube ke native (link baru untuk video yang sama, pilihan manual terjaga)
### Masalah
- 0.5.51: saat stream aktif gagal dan JS beku, native mengambil link baru. Untuk lagu yang dimuat / diserahkan JS, native tidak tahu id videonya, jadi mencari ulang lewat judul + artis. Pilihan manual pengguna (`manualPins`) ikut hilang: link baru bisa dari video lain.
### Cara kerja
- `info.ytVideoId` (diisi `registry.ts` untuk plugin `ytmusic` / `ytvideo`, termasuk pilihan manual) kini ikut dikirim ke native:
  - lagu yang dimuat JS: `audioEngine.load(url, cacheKey, ytId)` -> `engineLoad({ ytId })` -> `PlaybackService.doLoad` -> `resetRelink(ytId)`;
  - lagu antrean yang sudah di-resolve JS: `items[].ytId` di `engineSetUpcoming` -> `UpcomingItem.ytId` (hanya bila item punya URL); `chainAdvance` memakainya saat lagu itu mulai diputar.
- `relinkActive` (0.5.51) memakai id itu lewat `YtResolver.getStreams` (video yang sama); pencarian judul + artis hanya cadangan bila id kosong atau resolve id gagal.
### Batasan
- Lagu dari Sebelumnya (`chainPrevious`) dan lagu yang dikembalikan ke antrean belum membawa id (riwayat native belum menyimpannya): memakai pencarian judul + artis.
- Lagu dari sumber pihak ketiga / berkas lokal / unduhan tidak punya id: perilaku 0.5.51.
- Pencarian radio (Deezer + cocokkan ke YouTube) belum dipindah (langkah berikutnya).
### Teknis
- Diubah: `src/hooks/useAudioPlayerController.ts` (`load`, item upcoming), `src/services/audioEngine.ts` (`load`, `nativeLoad`, tipe `setUpcoming`), `src/native/musicVerseNative.ts`, `MusicVerseNativePlugin.java` (`engineLoad`, `engineSetUpcoming`), `PlaybackService.java` (`LoadRequest`, `engineLoad` + overload, `doLoad`).
- APK lama menerima field `ytId` tetapi mengabaikannya; APK baru dengan JS lama: id kosong, pencarian judul + artis seperti 0.5.51.
- **Perubahan native: perlu build APK baru.** Belum dibuild atau diuji di perangkat; TS dicek sintaksnya (transpile, tanpa error), Java hanya keseimbangan kurung (javac tidak tersedia).

---

## 0.5.53 — Pencarian radio di native (langkah 2a: pencari lagu mirip, belum dipasang)
### Masalah
- Antrean radio diisi `services/radio.ts` di JS (Deezer + urutan genre/tempo). Saat WebView dibekukan di latar belakang, antrean radio tidak terisi lagi; workaround hanya mengisi lebih awal (>= 12 lagu).
### Isi langkah ini
- **`RadioFinder.java` (baru)**: port native `findSimilarTracks` / `onlineSimilar` / `rankByVibe` (`radio.ts` + `artistApi.ts`): artis utama -> "radio artis" Deezer (60 calon) -> urut genre album sama (+2) lalu tempo <= 15 BPM (+1, hanya 12 teratas), diacak dulu, maks. 15 lagu (`BATCH`), tanpa lagu yang kuncinya ada di `exclude` (`trackKey` = judul + artis pertama, sama dengan JS). Id / URL lagu berbentuk sama dengan `mapDeezerRows` (`dz-<id>`), supaya nanti JS menganggapnya lagu yang sama.
- Sumber data lewat antarmuka `Source` (`DeezerSource` = HTTP sungguhan; cache genre / tempo selama proses). Gangguan pada genre / tempo hanya melewati penilaian itu; gangguan pada pencarian utama dilempar sebagai `IOException`; pembatalan dicek di sela langkah.
- **Tes lokal** `native/android/test/` (lihat README di sana): 11 pemeriksaan (ukuran batch, seed dikecualikan, tanpa duplikat, urutan genre lalu tempo, `exclude`, genre gagal, seed gagal -> cari artis, batal, artis kosong, kesamaan `trackKey` dengan TS). Semua lolos dengan JDK 21 + stub org.json.
### Belum / batasan
- **`RadioFinder` belum dipanggil `PlaybackService`**: perilaku aplikasi tidak berubah di versi ini.
- Cadangan dari Riwayat (`historySimilar`) tidak ada di native (Riwayat milik JS); hasil kosong = tidak ada tambahan.
- Langkah berikutnya (2b): saat JS beku dan sisa antrean native menipis, panggil `RadioFinder` untuk lagu aktif, tambahkan hasilnya sebagai item tanpa URL (di-resolve `YtMatcher` seperti sekarang), dan simpan daftar tambahan itu di native.
- Langkah 2c: saat JS hidup lagi, tambahan itu dimasukkan ke antrean JS (urut, sebelum sesi native disamakan dan sebelum JS menerbitkan daftar berikutnya), supaya indeks / id lagu cocok.
### Teknis
- Baru: `native/android/java/RadioFinder.java`, `native/android/test/**`. Diubah: `package.json` (0.5.53).
- Belum dibuild di Android. `javac` tidak ada; kompilasi dicek lewat `jdk.compiler` JDK 21 dengan stub `org.json` (API yang dipakai ada di org.json Android). `RadioFinder` belum pernah dijalankan terhadap Deezer sungguhan (jaringan dimatikan di sini).

---

## 0.5.54 — Lirik per kata asli (langkah 1: data + parser + strip mini; panel penuh belum)
### Masalah
- Sorotan "per kata" di strip lirik mini hanya TEBAKAN: LRC cuma punya waktu per baris, jadi `LyricLine.tsx` membagi baris ke kata menurut panjang huruf di rentang waktu perkiraan. Hasilnya sering meleset, dan tidak ada duet / vokal latar.
- Dibandingkan Auralys 4.3.2 (fork Metrolist; hasil bedah APK): Auralys mengambil lirik berwaktu KATA dari LyricsPlus / BetterLyrics (TTML / JSON `syllabus`) dan menggambarnya sesuai posisi pemutar.
### Isi langkah ini
- **Model data** (`utils/lrc.ts`): `LyricLine` kini boleh punya `words` (waktu kata asli), `end`, `agent` (penyanyi, duet), `background` (vokal latar). Semua opsional: kode lama yang hanya memakai `time`/`text` tidak berubah. `parseLrc` kini juga membaca **eLRC** (`<mm:ss.xx>kata`), awalan `v1:`/`v2:`, dan `[offset:ms]`.
- **Parser TTML** (`utils/ttml.ts`, baru): tanpa DOMParser; kata, penyanyi, vokal latar (`x-bg`), entity, semua format waktu.
- **Adapter LyricsPlus** (`utils/lyricsPlus.ts`, baru): JSON `syllabus` (ms) -> `LyricLine[]`; `ttmlFromBetterLyrics`.
- **Sinkron kata** (`utils/wordSync.ts`, baru): `wordsFor` (waktu asli, atau perkiraan berbobot persis seperti logika lama), `activeWordIndex`, `wordFill` (isi 0..1 untuk efek karaoke halus; belum dipakai UI).
- **Provider** (`services/wordLyrics.ts`, baru): LyricsPlus (3 mirror, failover) dan BetterLyrics, dengan validasi (min. 3 baris, tidak melewati durasi lagu +12 dtk), batas waktu 4 dtk/permintaan dan 7 dtk total. **Tidak pernah melempar galat.**
- **Preferensi** (`utils/lyricProviderPrefs.ts`, baru): saklar utama, urutan, matikan per provider (disimpan di `musicverse:lyricProviders`). Belum ada UI-nya.
- **Integrasi** (`services/lyricsApi.ts`): `fetchLyrics` kini menjalankan provider kata BERSAMAAN dengan rantai lama (`fetchLegacyLyrics`, isinya tidak diubah). Hasil kata menang hanya bila lebih baik (`shouldPreferWord`): sumber lama polos/kosong, atau sumber lama berwaktu tetapi hasil kata berwaktu KATA dan barisnya >= 60% dari sumber lama. Instrumental dari LRCLIB tidak dibantah.
- **Cache offline** (`native/offlineLyrics.ts`): `parseResult` kini memvalidasi `words`/`agent`/`background`/`source`; field rusak dibuang, berkas lama tetap terbaca.
- **Strip mini** (`LyricLine.tsx`, `useLyricTiming.ts`): memakai waktu kata asli bila ada; kalau tidak, perkiraan yang SAMA dengan sebelumnya (diuji: 38.412 titik waktu, 0 selisih). `WordStrip` tidak lagi menyisipkan spasi sendiri (teks kata membawa spasinya) supaya suku kata asli tidak terpisah.
### Keputusan penting
- Hasil provider kata memakai `duration: null` (anggap "exact"). Mengisinya dengan waktu baris terakhir akan membuat `useLyricTiming` salah masuk mode `scaled`/`estimated`, karena lirik selalu lebih pendek dari lagu.
- `alternatives: []` untuk hasil kata, supaya `useLyricTiming` tidak diam-diam berpindah ke versi LRC lain dan membuang waktu kata.
### Belum / batasan
- **Panel lirik penuh (`LyricsPanel.tsx`) belum diubah**: sorotan per kata, duet, vokal latar di sana belum ada. Strip mini sudah.
- **Nama parameter & bentuk respons LyricsPlus / BetterLyrics BELUM diverifikasi** ke server (jaringan mati saat ditulis; berasal dari ingatan kode Metrolist + nama field di DEX Auralys). Bila salah, provider gagal diam-diam dan sumber lama tetap jalan. Cara cek: `docs/HANDOFF-lyrics-wordsync.md`.
- **Web (bukan APK)**: belum ada route proxy untuk kedua provider, jadi kena CORS bila server tidak mengizinkan. APK aman (CapacitorHttp aktif).
- Tidak ada UI pengaturan provider, tidak ada lencana sumber, tidak ada terjemahan / romanisasi.
- Belum dijalankan di browser / perangkat; `tsc -b` penuh tidak bisa dijalankan (node_modules tidak ada). Yang sudah dicek: 20 tes unit Node, `tsc --strict` pada file murni, transpile sintaksis semua file yang disentuh.
### Teknis
- Baru: `src/utils/{ttml,lyricsPlus,wordSync,lyricProviderPrefs}.ts`, `src/services/wordLyrics.ts`, `scripts/{test-lyrics,ts-resolve}.mjs`, `docs/HANDOFF-lyrics-wordsync.md`.
- Diubah: `src/utils/lrc.ts`, `src/services/lyricsApi.ts`, `src/native/offlineLyrics.ts`, `src/hooks/useLyricTiming.ts`, `src/components/player/LyricLine.tsx`, `package.json` (hanya script `test:lyrics`; versi TIDAK dinaikkan).
- Tes: `npm run test:lyrics` (Node >= 22.6).
- Tidak ada perubahan native / Java: **tidak perlu build APK khusus**, cukup build web + `cap sync` (atau OTA).

---

## 0.5.55 — Panel lirik penuh: karaoke per kata, duet, vokal latar
### Isi
- `LyricsPanel.tsx`: baris aktif yang punya waktu kata ASLI diisi per kata (`WordFilledText`), halus tiap frame lewat variabel CSS, tanpa render ulang React. Mode `estimated` tetap memakai isi per baris lama.
- Duet: bila ada >= 2 penyanyi, penyanyi pertama rata kiri, lainnya rata kanan. Tanpa duet tetap di tengah.
- Vokal latar (`background`): lebih kecil dan redup; saat aktif, baris induknya ikut menyala dan jadi jangkar gulir.
- Keterangan sumber di ujung daftar: "Lirik per kata dari LyricsPlus / BetterLyrics".
- Gerak dikurangi: kata menyala utuh saat gilirannya, tanpa isi bertahap.
- `useLyricTiming.ts`: `LyricItem` membawa `agent` dan `background`.
### Belum
- Belum dijalankan di browser/perangkat; hanya tes unit (20 lolos) dan cek sintaksis. `tsc -b` penuh belum bisa (tanpa node_modules).
- Vokal latar yang waktunya jauh dari induknya bisa terlihat terpisah; periksa dengan data asli (langkah 3.1).
- Verifikasi API, UI pengaturan, proxy web, cache persisten: lihat handoff.

---

## 0.5.56 — Pengaturan provider, proxy web, cache lirik persisten
### Isi
- **Pengaturan** (`LyricProviderSettings.tsx`, di halaman Pemutaran): saklar "Lirik per kata", urutan provider (naik/turun), matikan per provider, Reset. Tersimpan langsung; mengubahnya mengosongkan cache lirik sesi (`onProviderPrefsChange`).
- **Proxy web**: `api/proxy.js` (+`lyricsplus`, `boidu`), `vercel.json`, `vite.config.ts`. `wordLyrics.ts` memilih basis: APK langsung (LyricsPlus 3 mirror), web lewat `/lyricsplus` dan `/boidu` (satu mirror). Bisa ditimpa `VITE_LYRICS_PLUS_BASE` / `VITE_LYRICS_BETTER_BASE`.
- **Cache persisten** (`native/lyricsCache.ts`): IndexedDB untuk SEMUA lagu, LRU 500, TTL 30 hari, "tidak ditemukan" tidak disimpan, entri basi bila pengaturan provider berubah (`providerSignature`). Dipakai `useLyrics` dan `prefetchLyrics` setelah cache offline unduhan. Semua operasi best-effort, tidak pernah melempar.
- **Housekeeping**: `PlaybackService.java.orig` dihapus; `PROJECT_STRUCTURE.md ` (spasi di nama) diganti nama dan ditambah bagian lirik. Versi `package.json` tetap 0.5.43 (tidak dinaikkan).
- Tes: 21 lolos (+1: web memakai proxy).
### Belum
- Verifikasi nama parameter / bentuk respons ke server asli (butuh internet): lihat handoff 3.1. Proxy web hanya menunjuk satu mirror LyricsPlus.
- Halaman pengaturan hanya ada di APK (halaman Pemutaran memang native-only), jadi web memakai pengaturan bawaan.
- Belum dijalankan di browser/perangkat; `tsc -b` penuh belum bisa (tanpa node_modules).
- ISRC (3.6), terjemahan/romanisasi, Paxsenix/KuGou: belum.

---

## 0.5.57 — Vokal latar LyricsPlus, Binimum, jalur ISRC
Dasar: bedah `classes.dex` / `classes2.dex` Auralys 4.3.2 (fork Metrolist). Yang tertulis "terbukti" = terbaca dari kode klien Auralys; belum diuji ke server sungguhan.

### Sudah
- **Perbaikan vokal latar** (`utils/lyricsPlus.ts`): di respons asli `isBackground` ada di tingkat KATA (`syllabus[]`), bukan baris. Kata latar kini dipisah jadi baris latar sendiri (`background: true`, penyanyi sama), serupa parser TTML. Baris yang semua katanya latar menjadi baris latar. `isBackground` tingkat baris tetap dihormati.
- **Binimum** (`services/wordLyrics.ts`, `viaBinimum`): dicoba SEBELUM mirror LyricsPlus, seperti Auralys. `GET https://lyrics-api.binimum.org/?isrc=…`, lalu cadangan `?track&artist&album&duration`; respons `{total, source, results[{lyricsUrl, timing_type…}], error}`; hasil pertama ber-`lyricsUrl` (wajib https) diunduh sebagai TTML dan diurai `parseTtml`. Hanya APK (lyricsUrl ke host lain, tak bisa lewat proxy tetap). Hasil harus lolos `plausibleFor`, kalau tidak lanjut ke mirror.
- **Jalur ISRC**: `PlaylistTrack.isrc?`, `WordLyricsQuery.isrc?`, `normalizeIsrc()` (huruf besar, `^[A-Z]{2}[A-Z0-9]{3}\d{7}$`, strip "-"), `lyricsApi.fetchLyrics` meneruskan `track.isrc`, helper `artistApi.fetchTrackIsrc(dzId)` (Deezer `/track/{id}`).
- **Verifikasi parameter (dari dex Auralys)**: LyricsPlus `/v2/lyrics/get` (`title, artist, duration, album`) dan BetterLyrics `/getLyrics` (`s, a, d, al` → `{ttml}`) COCOK dengan kode musicverse. Tidak ada perubahan.
- Tes: 28 lolos (+7: vokal latar x2, normalizeIsrc, Binimum x4). Helper tes `withFetch` kini memisahkan panggilan Binimum (`calls` tanpa Binimum, `all` lengkap).
- Versi `package.json` tetap 0.5.43 (tidak dinaikkan).

### Belum
- **ISRC belum terisi di data nyata**: lagu dari playlist (`/api/spotifypl`) tidak punya ISRC, dan `dzId` Deezer tidak disimpan di `PlaylistTrack`. `fetchTrackIsrc` belum dipanggil dari mana pun. Langkah: simpan `dzId`/`isrc` saat lagu berasal dari Deezer, atau cari lewat judul+artis (satu panggilan ekstra, cache per lagu).
- **Verifikasi ke server asli** (butuh internet): bentuk respons Binimum, TTML dari `lyricsUrl`, isi respons LyricsPlus (`metadata`, `translation`, `transliteration`). Lihat `docs/HANDOFF-lyrics-wordsync.md` 3.1.
- **Terjemahan & romanisasi**: Auralys menerima `translation{lang,text}` dan `transliteration{lang,text,syllabus}` per baris dari LyricsPlus; parser musicverse belum membacanya. Terjemahan lokal Auralys: Google, DeepL (kunci pengguna, `DeepL-Auth-Key`), OpenRouter/LLM, Custom. Romanisasi di perangkat: kana→romaji, Hangul, Hindi, Sirilik.
- **KuGou** (LRC cadangan): pencarian `mobileservice.kugou.com/api/v3/search/song` (`data.info[]`: `hash, songname, singername, duration`) atau `lyrics.kugou.com/search` (`candidates[]`: `id, accesskey, song, singer, duration`), unduh `lyrics.kugou.com/download` (`{content}`). Bentuk `content` belum dicek.
- **Paxsenix**: sengaja TIDAK dikerjakan. Auralys memakai token Bearer yang diambil dari situs web Apple Music (`AppleTokenManager`) untuk `amp-api.music.apple.com`; rapuh dan di wilayah abu-abu syarat layanan.
- Web tidak memakai Binimum; proxy web tetap satu mirror LyricsPlus.
- Belum dijalankan di browser/perangkat; `tsc -b` penuh belum bisa (tanpa node_modules). Jalankan `npm i && npm run typecheck && npm run test:lyrics`.

### File directory (yang disentuh)
```
src/
├─ utils/lyricsPlus.ts          [UBAH]  isBackground tingkat kata -> baris latar
├─ services/
│  ├─ wordLyrics.ts             [UBAH]  viaBinimum, getTextQuiet, normalizeIsrc, WordLyricsQuery.isrc
│  ├─ lyricsApi.ts              [UBAH]  fetchLyrics meneruskan track.isrc
│  └─ artistApi.ts              [UBAH]  fetchTrackIsrc (Deezer)
└─ types/spotify.ts             [UBAH]  SpotifyApiTrack.isrc?
scripts/test-lyrics.mjs         [UBAH]  28 tes (+7), withFetch memisahkan panggilan Binimum
docs/HANDOFF-lyrics-wordsync.md [UBAH]  status + temuan dex Auralys
```

---

## 0.5.58 — ISRC Deezer otomatis, terjemahan & romanisasi dari LyricsPlus
Lanjutan 0.5.57. Dasar tetap bedah dex Auralys 4.3.2; belum diuji ke server sungguhan.

### Sudah
- **ISRC otomatis** (`services/lyricsApi.ts`, `resolveIsrc`): `track.isrc`, atau untuk lagu asal Deezer (`id` = `dz-<angka>`) diambil dari `/track/{id}` lewat `fetchTrackIsrc`; di-cache per sesi, galat = tanpa ISRC (tidak di-cache), hanya di APK (hanya Binimum yang memakainya). Diteruskan ke `fetchWordLyrics`.
- **Terjemahan & romanisasi** (`utils/lyricsPlus.ts`, `subText`): `translation` dan `transliteration` per baris dibaca (objek `{lang,text}` atau string); kosong / sama dengan teks asli diabaikan. Field baru `LyricLine.translation` / `.transliteration` -> `LyricItem` -> `LyricsPanel` (teks kecil di bawah baris; vokal latar tidak diberi). Ikut tersimpan di cache offline (`offlineLyrics.cleanLine`).
- Tes: 29 lolos (+1). Sintaks 8 file yang diubah diperiksa (transpile); `tsc -b` penuh tetap belum bisa (tanpa node_modules).

### Belum
- **Lagu playlist Spotify tetap tanpa ISRC** (sumbernya tidak menyediakan); Binimum memakai pencarian metadata untuk itu. Ide: cari ISRC Deezer lewat judul+artis (`findDeezerSeed`) untuk lagu non-Deezer, dengan cache.
- **Tidak ada saklar tampilan** terjemahan/romanisasi: selalu tampil bila server menyediakan. Perlu pengaturan "tampilkan terjemahan / romanisasi" (Auralys punya `translateMode`, `translateLanguage`).
- **Terjemahan buatan sendiri** (Google, DeepL dengan kunci pengguna, OpenRouter/LLM, Custom) dan **romanisasi lokal** (kana, Hangul, Hindi, Sirilik) belum ada; sekarang hanya yang dikirim server.
- **Bentuk `translation` / `transliteration` belum diverifikasi** ke respons asli (hanya dari nama field di dex). `transliteration.syllabus` (romanisasi per kata) belum dipakai.
- **KuGou** (cadangan LRC) belum; **Paxsenix** sengaja tidak (token Apple Music hasil scraping).
- Verifikasi server asli (Binimum, TTML `lyricsUrl`, LyricsPlus): lihat `docs/HANDOFF-lyrics-wordsync.md` 3.1.
- Belum dijalankan di browser/perangkat.

### File directory (yang disentuh)
```
src/
├─ utils/
│  ├─ lrc.ts                    [UBAH]  LyricLine.translation / .transliteration
│  └─ lyricsPlus.ts             [UBAH]  subText, baca translation/transliteration
├─ services/lyricsApi.ts        [UBAH]  resolveIsrc (+cache), wordJob memakai ISRC
├─ hooks/useLyricTiming.ts      [UBAH]  LyricItem.translation / .transliteration
├─ components/player/LyricsPanel.tsx [UBAH]  tampil romanisasi + terjemahan di bawah baris
└─ native/offlineLyrics.ts      [UBAH]  cleanLine menyimpan dua field baru
scripts/test-lyrics.mjs         [UBAH]  29 tes (+1)
```

---

## 0.5.59 — saklar terjemahan/romanisasi, romanisasi per kata, romanisasi lokal, ISRC Deezer lewat judul+artis
Lanjutan 0.5.58. Bentuk data diverifikasi ke dex Auralys 4.3.2 (`classes.dex`): `Translation {lang, text}`, `Transliteration {lang, text, syllabus: List}`,
`LyricLine {time, duration, text, element, syllabus, translation, transliteration}`. Belum diuji ke server sungguhan / perangkat.

### Sudah
- **Saklar tampilan** (`utils/lyricDisplayPrefs.ts`, `hooks/useLyricDisplayPrefs.ts`, `LyricProviderSettings`): "Tampilkan terjemahan" dan "Tampilkan romanisasi" di Pengaturan > Pemutaran > Lirik. Bawaan nyala (sama seperti sebelumnya). Hanya memengaruhi tampilan, data di cache tetap utuh, berlaku seketika.
- **Romanisasi per kata** (`LyricLine.transliterationWords`, `lyricsPlus.ts` `syllabusWords`): `transliteration.syllabus` dibaca (`{time, duration, text}` ms). Pada baris aktif, romanisasi ikut terisi karaoke seperti teks utama. Dipakai hanya bila rangkaian katanya sama dengan teks romanisasi; `text` kosong dirangkai dari syllabus. Ikut tersimpan di cache offline.
- **Romanisasi lokal** (`utils/romanize.ts`): kana (Hepburn), Hangul (Revised Romanization + liaison, asimilasi nasal, ㄹ), Hindi (gaya Bollywood + penghapusan schwa, virama, anusvara, nukta, ज्ञ), Sirilik (Rusia/Ukraina/Serbia). Dipakai bila server tidak memberi romanisasi (`utils/lyricSubtext.ts`, `subTextsFor`), juga untuk lirik polos. Ikut saklar romanisasi.
- **ISRC lagu non-Deezer** (`services/lyricsApi.ts` `resolveIsrc`, `artistApi.findDeezerTrackId`, `utils/deezerMatch.ts`): lagu playlist Spotify dicari di Deezer lewat judul + artis + durasi, lalu `/track/{id}`. Hanya rekaman yang cocok persis yang dipakai (judul sama, artis cocok, durasi selisih <= 4 dtk; tanpa durasi, judul harus persis), tanpa cadangan "artis sama saja" milik `findDeezerSeed`, karena ISRC lagu lain membuat Binimum memberi lirik yang salah. "Tidak ketemu" di-cache per sesi, galat tidak. Hanya di APK.
- Tes: 36 lolos (+7). Sintaks 13 file yang diubah diperiksa (transpile); modul murni (`romanize`, `lyricSubtext`, `deezerMatch`, `lyricsPlus`) lolos `tsc --strict --noUnusedLocals`. `tsc -b` penuh tetap belum bisa (tanpa node_modules).

### Belum / batas
- **Kanji / hanzi tidak diromanisasi**: baris yang memuat Han dilewati (tanpa kamus, bacaannya tak bisa ditebak; romanisasi parsial menyesatkan). Pinyin (Mandarin) karenanya tidak ada. Jepang hanya yang ditulis kana.
- **Kana**: は / へ dibaca "wa" / "e" hanya bila berdiri sendiri (dipisah spasi) atau pada こんにちは / こんばんは; selain itu "ha" / "he".
- **Hangul**: aturan per kata (antar-spasi); asimilasi lintas kata dan aturan ㅎ jarang tidak dibuat. **Hindi**: penghapusan schwa itu heuristik, kata tertentu bisa meleset.
- **Elemen `transliteration.syllabus` belum diverifikasi**: dex hanya memberi tipe `List`; diasumsikan sama dengan `syllabus` utama (`{time, duration, text}`). Elemen yang bentuknya lain dilewati, bukan error.
- **Terjemahan buatan sendiri** (Google, DeepL, OpenRouter/LLM, Custom; di Auralys lewat `LyricsTranslationHelper` + `translateMode` / `translateLanguage`) belum ada: terjemahan hanya yang dikirim server.
- **KuGou** (cadangan LRC) belum; **Paxsenix** sengaja tidak (token Apple Music hasil scraping).
- ISRC lewat judul+artis menambah 2 panggilan Deezer per lagu (sekali per sesi); batas laju Deezer (±50 / 5 dtk) belum diuji.
- Verifikasi server asli (Binimum, TTML `lyricsUrl`, LyricsPlus): lihat `docs/HANDOFF-lyrics-wordsync.md` 3.1. Belum dijalankan di browser/perangkat.

### File directory (yang disentuh)
```
src/
├─ utils/
│  ├─ romanize.ts               [BARU]  kana / Hangul / Devanagari / Sirilik -> Latin
│  ├─ lyricSubtext.ts           [BARU]  subTextsFor: saklar + romanisasi lokal
│  ├─ lyricDisplayPrefs.ts      [BARU]  preferensi tampilan terjemahan / romanisasi
│  ├─ deezerMatch.ts            [BARU]  pickDeezerTrackId (pencocokan ketat)
│  ├─ lrc.ts                    [UBAH]  LyricLine.transliterationWords
│  └─ lyricsPlus.ts             [UBAH]  syllabusWords, transliteration.syllabus
├─ hooks/
│  ├─ useLyricDisplayPrefs.ts   [BARU]
│  └─ useLyricTiming.ts         [UBAH]  items memakai subTextsFor + preferensi
├─ services/
│  ├─ lyricsApi.ts              [UBAH]  resolveIsrc: lagu non-Deezer lewat judul+artis
│  └─ artistApi.ts              [UBAH]  findDeezerTrackId
├─ components/
│  ├─ player/LyricsPanel.tsx    [UBAH]  romanisasi berkaraoke, romanisasi lokal lirik polos
│  └─ settings/LyricProviderSettings.tsx [UBAH]  dua saklar baru
└─ native/offlineLyrics.ts      [UBAH]  cleanLine menyimpan transliterationWords
scripts/test-lyrics.mjs         [UBAH]  36 tes (+7)
```

---

## 0.5.60 — sorotan lirik menyapu halus (pemutar penuh + mini player)
Referensi: rekaman layar pemutar lain. Sorotan mengisi tiap kata dari kiri ke kanan per huruf dengan tepi lembut, bukan loncat per kata.
Belum diuji di browser / perangkat (tanpa node_modules di lingkungan kerja).

### Sudah
- **Satu komponen bersama** `components/player/KaraokeWords.tsx`: tiap kata terisi halus mengikuti posisi audio langsung (rAF, ditulis ke variabel CSS `--p` per kata, tanpa render ulang React). Pemutar penuh dan mini player memakainya, jadi sorotan di kedua tempat selalu sama.
- **Tepi lembut** (`utils/wordSync.ts` `sweepGradient`): gradien 20% yang bergerak lewat `--p` (0..1). Sebelumnya tepi keras.
- **Mini player**: `WordStrip` tidak lagi mengganti warna per kata (loncat, transisi 150 ms); sekarang disapu halus. Geseran supaya kata aktif tetap di tengah strip tetap ada, digerakkan oleh `onIndex`.
- **Pemutar penuh**: baris tanpa waktu kata dari sumber (LRC biasa) dulu disapu sebagai satu baris lurus sepanjang jarak ke baris berikutnya (maks 7 dtk). Sekarang waktu kata diperkirakan dari panjang huruf (`wordsFor`, sama dengan mini player), jadi sapuan mengikuti kata dan selesai pada perkiraan lama menyanyi. Romanisasi per kata dan vokal latar ikut komponen yang sama.
- Gerak dikurangi (`prefers-reduced-motion`): kata menyala utuh saat gilirannya, tanpa sapuan bertahap.
- Tes: 37 lolos (+1, `sweepGradient`).

### Belum / batas
- Tidak diverifikasi di tampilan nyata: lebar tepi 20% dan warna redup (`REST_COLOR`) perlu dilihat di perangkat, mudah diubah di `SWEEP_FEATHER` / `KaraokeWords.tsx`.
- Mode "estimated" (durasi audio jauh beda dari lirik) tetap tanpa sapuan: baris aktif menyala utuh.
- Tata letak lirik (rata kiri, baris aktif di sepertiga atas) dan cincin hitung mundur intro seperti di rekaman tidak disentuh; yang diubah hanya animasi sorotan.

### File directory (yang disentuh)
```
src/
├─ utils/wordSync.ts                    [UBAH]  sweepGradient
└─ components/player/
   ├─ KaraokeWords.tsx                  [BARU]  sapuan per kata, dipakai bersama
   ├─ LyricsPanel.tsx                   [UBAH]  FilledText / WordFilledText diganti KaraokeWords
   └─ LyricLine.tsx                     [UBAH]  WordStrip memakai KaraokeWords
scripts/test-lyrics.mjs                 [UBAH]  37 tes (+1)
```

---

## 0.5.61 — animasi mini player -> pemutar penuh lebih halus (sampul tetap "terbang" ke atas)
Referensi: rekaman layar pemutar lain. Gerakan yang sama seperti sebelumnya (sampul mini membesar jadi sampul pemutar penuh, FLIP); yang diperbaiki rasa dan ketepatannya. Belum diuji di perangkat.

### Sudah
- **Sudut sampul mulus** (`FullPlayer.tsx` `flyKeyframes`): skala murni ikut mengecilkan radius (28px x 0,15 ~ 4px), jadi sudut melompat. Radius tiap langkah dihitung ulang supaya radius TAMPAK berubah dari radius sampul mini ke 28px. Bayangan juga memudar masuk selama naik. Dipakai di buka dan tutup (tutup = urutan dibalik).
- **Buka lebih meluncur**: 440 -> 560 ms dengan ease-out kuat (`EASE_OPEN`): melesat naik lalu mengendap pelan di posisi akhir.
- **Latar & isi diselaraskan**: latar memudar 360 -> 480 ms (searah sampul), header muncul paling awal, judul / seek / kontrol menyusul setelah sampul hampir sampai (jeda 60 / 240 / 290 / 340 / 390 / 430 ms).
- Tutup tidak berubah durasinya (`CLOSE_MS` 380, dipakai juga oleh tur). Gerak dikurangi tetap dihormati.

### Belum / batas
- Tidak diuji di perangkat: durasi, ease, dan jeda adalah tebakan dari rekaman, mudah disetel di `OPEN_MS` / `EASE_OPEN` / `delay()`.
- Beranda di belakang tidak ikut mengecil / mengabur; hanya meredup lewat latar.

### File directory (yang disentuh)
```
src/
├─ index.css                          [UBAH]  .fp-bg 480 ms
└─ components/player/FullPlayer.tsx   [UBAH]  flyKeyframes, EASE_OPEN, OPEN_MS, jeda masuk
```

---

## 0.5.62 — mini player -> disc: kartu turun ke BELAKANG nav, lalu mengabur dan hilang
Referensi: rekaman layar pemutar lain. Sebelumnya kartu turun menimpa nav (pembungkus z-40 di atas nav z-30) lalu mengecil jadi lingkaran (clip-path). Belum diuji di perangkat.

### Sudah
- **Di belakang nav** (`MiniPlayer.tsx` `behindNav`): selama diseret ke bawah dan selama morph, pembungkus mini player diturunkan ke z-20 (di bawah nav z-30), lalu dikembalikan ke z-40. Nav kaca (blur + redup) otomatis mengaburkan kartu yang lewat di belakangnya. Seret ke atas (buka pemutar penuh) tetap di depan.
- **Masuk nav = mengabur lalu hilang** (`flyToBubble`): kartu melanjutkan turun dari posisi jari sampai bagian atasnya di tengah nav (diukur dari `nav[aria-label="Navigasi utama"]`), bertahan jernih ~30% pertama, lalu memudar + blur 10px + mengecil 8%. 440 ms (`LEAVE_MS`). Tanpa nav (desktop): turun dan memudar saja.
- **Disc muncul sesudah kartu hampir hilang** (pada 72% gerakan): `bubble-morph` sekarang naik 14px dari arah nav sambil membesar dari 0,6 (sebelumnya 0,8 tanpa geser, karena tak ada lagi lingkaran clip-path yang menyatu).
- Dihapus: morph clip-path kartu -> lingkaran dan konstanta `BUBBLE_SIZE`.
- Gerak dikurangi: tetap langsung berganti tanpa animasi.

### Belum / batas
- Tidak diuji di perangkat: durasi, titik mulai memudar (30%), dan kekuatan blur adalah tebakan dari rekaman.
- Arah kebalikan (disc -> kartu, `grow-left/right`) tidak diubah.
- Elemen lain di antara z-20 dan z-40 (mis. toast) sempat di atas kartu selama gerakan ini.

### File directory (yang disentuh)
```
tailwind.config.js                      [UBAH]  keyframe bubble-morph
src/components/player/MiniPlayer.tsx    [UBAH]  behindNav, flyToBubble, LEAVE_MS
```

---

## 📦 Catatan versi

- Berkas ini menggantikan `CHANGES-0.5.44.md` sampai `CHANGES-0.5.62.md` (sudah dihapus).
- Rujukan lama ke `CHANGES-0.5.54.md` sekarang berarti bagian **0.5.54** di berkas ini; begitu juga untuk `0.5.57` dan `0.5.58`.
- Versi `package.json` (`version` dan `appVersion`) diatur ke `0.5.46`, sehingga `versionName` APK 0.5.46 dan `versionCode` dihitung ulang dari angka itu oleh `scripts/setup-android.mjs`.

```
CHANGES-0.5.46.md          [GABUNGAN]  catatan 0.5.44 sampai 0.5.62 (berkas ini)
package.json               [UBAH]      version / appVersion 0.5.46
```



---

<!-- sumber: CHANGES-0.5.43-ui.md -->

# 0.5.43 (UI)


- Splash (index.html + main.tsx): logo muncul di tengah, memudar keluar, Beranda memudar masuk (hanya APK).
- Perpindahan halaman (layout/PageTransition.tsx): halaman lama memudar (130 ms), halaman baru masuk geser horizontal (260 ms). Arah mengikuti urutan tab / dalam-luar.
- Mini player -> pemutar penuh (player/FullPlayer.tsx, PlayerDock.tsx): sampul "terbang" dari mini player (FLIP), latar artwork blur + gradient gelap memudar masuk, judul/artis/kontrol masuk bertahap. Penutupan berjalan terbalik (juga untuk tombol Kembali Android); Beranda tidak dilepas, jadi scroll tetap.
- Tombol: efek tekan (scale), ikon putar/jeda berganti halus, hati berganti + membal, progres bar mengalir.
- Easing seragam di index.css (--ease, --ease-hero).


Baris lagu (Album, Artis, Cari, hasil cari lagu di Beranda) yang sudah ada di playlist buatanmu kini tampil beda:
judul abu-abu terang (tetap terbaca, kontras >7:1), sampul sedikit redup, ikon centang, dan keterangan "Sudah ada di ...".
Lagu yang sedang diputar/dipilih tetap berwarna aksen.

File: src/components/playlist/TrackRow.tsx

## Splash native (butuh APK baru, tidak bisa lewat OTA)
- Splash bawaan Android (ikon launcher besar di tengah) diganti layar polos #121212 layar penuh; logo beranimasi hanya tampil sekali, di splash web.
- Dipasang oleh scripts/setup-android.mjs (patch styles.xml) + native/android/res/values/mv_splash.xml, drawable/mv_splash_empty.xml.



---

<!-- sumber: CHANGES-0.5.43.md -->

# 0.5.43 — Lirik karaoke: baris aktif terisi mengikuti lagu
- Lirik sinkron per baris sudah ada sejak sebelumnya (sorotan, gulir otomatis, ketuk untuk loncat, penyelarasan manual). Rilis ini menambah **efek karaoke di dalam baris**: teks baris yang sedang dinyanyikan terisi putih dari kiri ke kanan, dari waktu barisnya sampai waktu baris berikutnya (maksimal 7 detik bila jedanya panjang). Baris yang membungkus ke beberapa baris terisi berurutan.
- Mengikuti kecepatan putar, penyelarasan manual, dan mode `scaled`. Lebar isi dihitung dari posisi audio langsung tiap frame dan ditulis lewat variabel CSS (`--fill`), tanpa render ulang React. Berhenti saat dijeda.
- Dimatikan (baris tampil putih penuh) bila waktu hanya perkiraan (mode `estimated`) atau pengguna memilih kurangi gerakan.
- Ini isi per baris, bukan per kata: sumber lirik (LRCLIB / NetEase) hanya menyediakan waktu per baris.
- Diubah: `components/player/LyricsPanel.tsx`. Hanya JS (OTA). Belum dibuild atau diuji di perangkat; hanya sintaks yang dicek.



---

<!-- sumber: CHANGES-0.5.43-nav.md -->

# 0.5.43 (nav)

File: src/components/layout/BottomNav.tsx (hanya animasi; bentuk / tata letak navbar tidak diubah)

- Lensa kaca sekarang digerakkan fisika pegas lewat satu loop rAF (tanpa render ulang React per frame, jadi tidak patah-patah):
  - Saat digeser: mengejar jari dengan pegas kaku (halus, tidak menempel kasar).
  - Saat dilepas: mendarat ke tab tujuan dengan pegas lebih lembut (sedikit membal), kecepatan geser terbawa.
  - Melar searah geseran sesuai kecepatan nyata, lalu menyusut saat melambat.
  - Pindah tab lewat ketukan / Back memakai pegas yang sama.
- Tiap tab punya `--p` (0..1) = kedekatan lensa dengan tab itu. Ikon (membesar), nama tab (memudar + naik), dan warna aksen mengikuti `--p`, jadi tab menyala/meredup pelan saat lensa lewat, bukan berganti mendadak.
- Nama tab hanya terlihat di tab yang sedang di bawah lensa / aktif. aria-label tetap ada di tiap tab.
- "Kurangi gerakan": lensa langsung pindah tanpa pegas.



---

<!-- sumber: CHANGES-0.5.43-anim.md -->

# 0.5.43 (animasi muncul / bergerak)

Prinsip: semua animasi masuk memakai `fill-mode: backwards`, jadi tidak menahan `transform`/`opacity` setelah selesai (gestur geser baris tetap normal). "Kurangi gerakan" tetap dihormati (aturan global di index.css + cek di useExitGhost).

## Baru
- index.css: kelas `mv-in`, `mv-pop`, `mv-drop`(+`-out`), `mv-rise`(+`-out`), `mv-slide-x`, `mv-list` (anak daftar masuk bergantian, 12 pertama), `tap-card` / `tap-row` (mengecil sedikit saat ditekan, kembali membal).
- hooks/useExitGhost.ts: animasi KELUAR sheet. Sheet dilepas React saat ditutup, jadi isinya digandakan ke <body> sebentar: latar memudar, panel turun. Dipakai di OverlayPortal (semua sheet menu/playlist) dan CrossfadeSheet, SleepTimerSheet, QueuePanel, ManualSearchSheet, TrackActionSheet.
- ui/Presence.tsx: tahan elemen sebentar supaya animasi keluarnya sempat jalan (mode `collapse` untuk banner, `float` untuk toast).

## Dipasang di
- Sheet: buka lebih halus (340 ms), tutup turun + latar memudar; daftar pilihan di dalamnya masuk bergantian.
- Banner Offline & Pembaruan, toast: masuk/keluar dengan tinggi menyusut mulus (konten di bawah tidak melompat).
- Bilah mode pilih (playlist & lagu): turun dari atas. Kotak centang muncul geser + membal saat masuk mode pilih.
- Semua daftar (lagu, playlist, unduhan, riwayat, hasil artis/album, pengaturan, dst.) masuk bergantian.
- Saran judul, form playlist baru, pesan error/sukses, panel pemulihan, tombol hapus teks pencarian, lencana, EmptyState: muncul dengan drop/pop.
- Sampul: memudar masuk saat gambar selesai dimuat.
- Kartu & baris: efek tekan (tap-card / tap-row), termasuk item di dalam sheet.



---

<!-- sumber: CHANGES-0.5.43-splash.md -->

# 0.5.43 (splash)

Files: index.html, src/index.css (bagian Splash), src/main.tsx

Urutan animasi masuk aplikasi (hanya APK):
1. Logo (4 batang) naik, seperti sebelumnya, tapi lebih besar (104 px).
2. Nama "MusicVerse" muncul di bawah logo, huruf per huruf (naik + membesar sedikit, membal tipis).
3. Logo + nama sebagai satu kesatuan membesar pelan (zoom 0.9 -> 1.32, ±2,6 dtk, melambat di akhir).
4. Setelah aplikasi siap (minimal ±2,2 dtk sejak dibuka): splash zoom menembus ke depan sambil memudar, dan aplikasi masuk dari sedikit mengecil + transparan ke ukuran normal.

Catatan
- Preferensi "kurangi gerakan": splash cukup ±0,5 dtk, tanpa zoom.
- transitionend dari anak splash tidak lagi menghapus splash lebih awal (hanya opacity splash itu sendiri).
- Splash native Android (layar polos #121212) tidak berubah.



---

<!-- sumber: CHANGES-0.5.42-radio.md -->

# 0.5.42 (radio native, bagian 2b) — Radio native menambah lagu sendiri saat JS beku (langkah 2b; 2c belum)
## Masalah
- Saat WebView dibekukan di latar belakang dan antrean native habis, radio tidak bisa mengisi lagi (pengisi ada di JS).
## Cara kerja
- JS (`useAudioPlayerController`) menambahkan field opsional `radio: { tailIndex, exclude }` ke `engineSetUpcoming`. Dikirim HANYA bila: antrean JS benar-benar berakhir di daftar yang diserahkan (bukan sekadar jendela 20 lagu penuh), semua lagunya ikut diserahkan (tanpa pilihan manual yang memotong daftar), radio menyala (`getRadioAuto()` / `isRadioActive()`), dan shuffle mati. `tailIndex` = panjang antrean JS; `exclude` = `trackKey` (<= 500 lagu terakhir antrean JS).
- `PlaybackService.maybeFillRadio` (dicek ~1 dtk sekali dari ticker): JS beku, sedang memutar, lagu tersisa di antrean native <= 2 -> `RadioFinder.findSimilar` untuk lagu aktif di thread sendiri (`exclude` = antrean JS + antrean native + riwayat native + tambahan sebelumnya).
- Hasilnya masuk antrean native sebagai item TANPA URL, indeks `tailIndex`, `tailIndex+1`, ...; `resolveLazy` mencocokkannya ke YouTube lewat `YtMatcher` seperti item lazy lainnya. Id lagu = `dz-<id>` (sama dengan JS).
- Daftar tambahan disimpan di native: `RadioExtras` (`files/radioextras.json`, maks. 200). Belum ada yang membacanya (itu tugas 2c).
- Pencarian dibatalkan / hasilnya dibuang bila: service berhenti, JS mengirim daftar baru, JS lagu dimuat ulang, atau JS bangun lagi (JS mengisi radio sendiri lewat `AutoRadioSync`).
- Gagal / kosong tidak diulang untuk lagu aktif yang sama; lagu berikutnya mencoba lagi.
## Belum / batasan (penting)
- **2c belum ada.** Saat app bangun, antrean JS belum memuat tambahan itu. Event `advanced` untuk indeks di luar antrean JS diabaikan JS (`judgeNativeAdvance`: tidak `mappable`), jadi tidak merusak, tetapi JS belum tahu lagu yang sedang diputar native itu, dan `AutoRadioSync` bisa menambah radio sendiri (duplikat / indeks bentrok) sampai 2c selesai. Rilis 2b dan 2c sebaiknya bersamaan.
- Tidak aktif saat shuffle menyala atau antrean JS lebih panjang dari jendela yang diserahkan (native belum tahu ujung antrean).
- Pencarian dimulai saat sisa <= 2 lagu; bila antrean native sudah kosong dan lagu terakhir selesai sebelum hasil datang, pemutaran berhenti seperti sebelumnya.
- Cadangan dari Riwayat (`historySimilar`) tetap tidak ada di native.
## Teknis
- Baru: `native/android/java/RadioExtras.java`. Diubah: `PlaybackService.java` (`setUpcoming` + info radio, `maybeFillRadio`, `onRadioFound`, `resetRadio`; `stopped` / `lastJsUpdateAt` jadi `volatile`), `MusicVerseNativePlugin.java` (`engineSetUpcoming` membaca `radio`), `useAudioPlayerController.ts`, `audioEngine.ts`, `musicVerseNative.ts` (`NativeRadioTail`), `package.json` (0.5.54).
- APK lama dengan JS baru: field `radio` diabaikan. APK baru dengan JS lama: tanpa `radio`, native tidak menambah apa pun.
- **Perubahan native: perlu build APK baru.** Belum dibuild / diuji di perangkat; javac + Android tidak tersedia di sini. Sintaks TS dicek (transpile, tanpa error), Java hanya keseimbangan kurung (sama dengan berkas asli). Tidak ada tes baru untuk `PlaybackService` / `RadioExtras` (butuh Android).

# 0.5.42 (radio native, bagian 2c) — JS memasukkan tambahan radio native ke antrean saat bangun (langkah 2c)
## Masalah
- bagian 2b: native menambah lagu radio sendiri saat JS beku, tetapi antrean JS tidak tahu. Saat app bangun, indeks / id lagu yang dipakai native tidak ada di antrean JS, dan pemulihan sesi bisa salah.
## Cara kerja
- Plugin: `radioExtrasRead` / `radioExtrasClear` (membaca / mengosongkan `RadioExtras`). Modul baru `src/native/radioExtras.ts`.
- `mergeRadioExtras` (`useAudioPlayerController`): membaca daftar, memastikan lagu pertama bernomor tepat `queue.length` dan indeksnya berurutan (`extrasToAppend`), menandainya lagu radio, menambahkannya ke ujung antrean berurutan (`addToQueue`, `fromSearch`), lalu mengosongkan daftar di native. Lagu yang idnya sudah ada dilewati. Daftar yang tidak cocok dengan antrean (panjang berubah) dibuang, tidak ditempelkan ke antrean lain.
- Dipanggil LEBIH DULU dari semua jalur yang bergantung pada antrean:
  1. pemulihan sesi native (saat app dibuka): `await merge` sebelum `readNativeSession` / `matchSessionIndex`;
  2. app kembali ke depan (`visibilitychange` -> visible);
  3. event `advanced` dengan indeks di luar antrean JS: merge, lalu event diproses ulang satu kali (indeks dan id lagu sudah cocok);
  4. `AutoRadioSync`: menunggu merge sebelum mencari radio sendiri; bila ada yang ditambahkan, putaran itu dilewati (tidak ada radio ganda).
- Penerbitan daftar berikutnya ke native tidak perlu ditahan: native mengabaikan daftar JS yang `currentIndex`-nya belum sama dengan lagu yang diputar native, dan efek penerbitan berjalan lagi saat antrean berubah.
## Batasan
- Daftar yang tidak cocok dibuang (mis. pengguna sempat memuat playlist lain); lagu yang sedang diputar native dari daftar itu tidak bisa dipetakan JS sampai lagu berikutnya.
- Bila ada lagu duplikat (id sudah di antrean), lagu sesudahnya bergeser satu indeks dari angka native; pemetaan memakai id, bukan indeks.
- Tidak ada tes otomatis untuk jalur TS (proyek belum punya kerangka tes); `extrasToAppend` diuji manual (cocok, indeks salah, loncat, duplikat, kosong) lewat transpile + stub.
## Teknis
- Baru: `src/native/radioExtras.ts`. Diubah: `useAudioPlayerController.ts`, `AutoRadioSync.tsx`, `musicVerseNative.ts` (`NativeRadioExtra`, 2 metode), `MusicVerseNativePlugin.java` (2 metode), `package.json` (0.5.55).
- **Perlu build APK baru** (metode plugin baru). APK lama dengan JS baru: `radioExtrasRead` UNIMPLEMENTED -> daftar kosong, perilaku lama. Belum dibuild / diuji di perangkat; sintaks TS dicek (transpile), Java hanya keseimbangan kurung.

# 0.5.42 (UI) — Tombol utama playlist ikut keadaan pemutar
- Tombol hijau besar (Putar semua) kini ikut keadaan pemutar: bila lagu yang sedang aktif ada di daftar itu, ikonnya menjadi **Jeda** saat memutar (ketuk = jeda) dan kembali **Putar** saat dijeda (ketuk = lanjut dari posisi terakhir, bukan mengulang dari awal). Daftar lain / pemutar berhenti / selesai / galat: Putar semua seperti biasa.
- Berlaku di: halaman Playlist saya (`MyPlaylistPage`), hasil pencarian / playlist di Beranda (`PlaylistHeader` lewat `PlaylistView`), dan halaman artis / album (`ArtistSearchPanel`).
- Baru: `src/hooks/usePlaylistPlayback.ts`. Label tombol (pembaca layar) ikut berubah: Jeda / Lanjutkan / Putar semua.
- Catatan: penentuan "daftar ini sedang diputar" memakai id lagu aktif; lagu yang sama di dua playlist membuat kedua tombol ikut menjadi Jeda. Hanya sintaks TS yang dicek; belum dicoba di perangkat.



---

<!-- sumber: CHANGES-0.5.42.md -->

# 0.5.42 — Bagikan kartu lagu
- Menu lagu (titik tiga di pemutar penuh, tahan lama di mini player/antrean) punya **Bagikan kartu lagu**: gambar PNG 1080×1920 (ukuran story) berisi sampul, judul, artis, dan latar gradien warna aksen dari sampul. Lalu membuka lembar bagikan.
- Web: Web Share dengan berkas bila didukung; selain itu PNG diunduh.
- APK: PNG ditulis ke `share/sedang-diputar.png` (folder files app) lalu dibagikan lewat `shareFile` native. `shareFile` kini menerima `mimeType` (default tetap `application/json`, jadi cadangan data tidak berubah). `update_file_paths.xml` menambah folder `share/`. **Butuh APK baru.**
- Bila sampul tidak bisa dibaca (host tanpa CORS), kartu memakai gradien bawaan dengan not musik, bukan sampul asli. Warna aksen tetap dari gradien bawaan.
- `useCoverGlow.ts`: ditambah `resolveCoverGlow()` (versi non-hook, cache sama).
- File baru: `utils/shareCard.ts`. Belum dibuild atau diuji di perangkat; hanya sintaks yang dicek.



---

<!-- sumber: CHANGES-0.5.41.md -->

# 0.5.41 — Rangkuman (seperti Wrapped), dihitung lokal
- Halaman baru **Riwayat > Rangkuman** (`/history/recap`): total waktu dengar, jumlah putaran / lagu / artis, **hari paling aktif** (plus grafik putaran per hari), jam favorit, rekor hari terpadat, 5 lagu dan 5 artis teratas. Pilih periode 7 hari, 30 hari, atau Semua.
- Semua dihitung di perangkat dari log Riwayat (`utils/recap.ts`); tidak ada server dan tidak ada data keluar.
- **Total waktu dengar adalah perkiraan:** jumlah durasi lagu per putaran. Lagu yang dilewati di tengah tetap dihitung penuh, dan lagu tanpa durasi dihitung 3,5 menit. Log hanya mencatat awal putaran, bukan lama dengar sebenarnya.
- `MAX_LOG` dinaikkan 500 -> 1500 supaya Rangkuman mencakup periode yang lebih panjang (sekitar 1 MB di penyimpanan lokal bila penuh). Riwayat lama tetap terbaca. Halaman Riwayat menampilkan semua entri, jadi daftarnya bisa lebih panjang.
- File baru: `utils/recap.ts`, `pages/RecapPage.tsx`. Diubah: `App.tsx` (rute), `pages/HistoryPage.tsx` (tombol Rangkuman), `utils/playLog.ts`.
- Hanya JS (OTA). Belum dibuild atau diuji di perangkat; hanya sintaks yang dicek.



---

<!-- sumber: CHANGES-0.5.40.5.md -->

# 0.5.40.5 — Radio tanpa akhir, Previous & sleep timer native, seek notifikasi
## Radio, tombol prev, dan seek notifikasi
- **Radio tanpa akhir**: radio terus mengisi antrean tanpa batas. Bila lagu mirip dari lagu aktif habis, dicoba dari 5 lagu terakhir di antrean, lalu Riwayat didaur ulang (20 lagu terakhir di antrean dilewati). `services/radio.ts` (`findEndlessTracks`), `components/player/AutoRadioSync.tsx`. Hanya JS.
- **Tombol prev memakai audio tersimpan**: data audio tiap lagu yang berhasil dimuat disimpan 20 menit per lagu (maks 50 lagu); prev memutarnya langsung tanpa mencari ulang. Bila gagal dimuat atau lewat 20 menit, otomatis ambil URL baru. Lagu lokal/unduhan dan pilihan manual tidak disimpan. `hooks/useAudioPlayerController.ts` (`playedCacheRef`, opsi `useSaved`). Hanya JS.
- **Seek di notifikasi langsung berlaku**: sebelumnya geseran bilah progres hanya diteruskan ke JS sehingga bilah mental balik sampai aplikasi dibuka. Sekarang `PlaybackService.handleSeek` langsung seek pemutar native dan memperbarui sesi + notifikasi; JS tetap diberi tahu. Digeser sampai ujung: JS pindah ke lagu berikutnya. **Perubahan native: perlu build APK baru.**
- Belum dibuild atau diuji di perangkat.
- **Prev di notifikasi: bilah langsung ke 0:00**: setelah aplikasi lama di latar belakang (JS beku / lambat), menekan Previous di notifikasi tidak mengubah bilah (native hanya `seekTo(0)` pemutar, posisi sesi tetap lama). Sekarang `PlaybackService.showPositionZero` mengatur posisi sesi ke 0 dan memperbarui sesi + notifikasi saat tombol ditekan. Perubahan native (perlu build APK baru).

## Fitur latar belakang dipindah ke native (tetap jalan saat JS/WebView beku atau activity dihancurkan)
- **Sleep timer native**: JS menyerahkan waktu berakhir lewat `engineSetSleep({ endsAtMs })` (0 = batal). `PlaybackService` memudarkan volume 30 dtk terakhir (hanya bila JS tidak hidup, supaya tidak dobel dengan fade JS), lalu menjeda tepat waktu. Bila JS hidup, JS yang menjeda; native menjeda sendiri bila JS belum menjeda 5 dtk setelah waktu habis. Volume kembali penuh setelah jeda. Timer bertahan walau service dibuat ulang.
- **Previous native**: native menyimpan riwayat 20 lagu terakhir yang ditinggalkan rantai native (sumber audio, metadata, sampul; berlaku 20 menit). Previous saat JS beku: lagu sudah jalan > 3 dtk = ulang dari awal; selain itu kembali ke lagu sebelumnya (lagu yang ditinggalkan kembali jadi "berikutnya"). Bilah progres langsung ke 0:00. Saat JS bangun, event `advanced` dipetakan lewat data audio tersimpan (cache 20 menit) sehingga state aplikasi ikut menyamakan diri.
- **Radio tidak habis di latar belakang**: `LOW_WATER` 1 -> 12 (antrean diisi lebih awal, selalu ada >= 12 lagu di depan) dan `NATIVE_UPCOMING_DEPTH` 12 -> 20 (lebih banyak lagu yang URL-nya sudah disiapkan untuk native). Pencarian lagu mirip itu sendiri (Deezer + resolve YouTube) tetap di JS, jadi radio baru mengisi lagi saat aplikasi hidup.
- **Normalisasi volume ikut pindah ke native**: JS kini mengirim normalisasi terpisah dari volume utama (`engineSetNorm`), dan tiap lagu yang diserahkan ke native membawa `norm` (dihitung dari `loudnessDb`, `normGainFor`). Saat native pindah lagu sendiri (maju, mundur, riwayat), ia mengganti redaman sesuai lagu itu. APK lama tanpa `engineSetNorm`: JS otomatis menggabungkannya ke volume seperti dulu.
- **Retry stream error**: lompat ke lagu berikutnya saat JS beku sudah ada di native (`onPlayerError` -> `chainAdvance`). Mengambil link BARU untuk lagu yang rusak tetap butuh JS (resolver YouTube).
- **Belum dipindah ke native**: pencarian radio + resolve audio YouTube (port besar), simpan posisi/lagu aktif saat activity dihancurkan (butuh JS mengadopsi pemutaran native yang masih jalan), riwayat putar, daftar Android Auto. Lirik hanya tampilan, tidak perlu native.
- Diubah: `PlaybackService.java`, `MusicVerseNativePlugin.java`, `native/musicVerseNative.ts`, `context/SleepTimerContext.tsx`, `hooks/useAudioPlayerController.ts`, `components/player/AutoRadioSync.tsx`. **Perlu build APK baru.** Hanya dicek sintaks (javac) dan tipe TS yang disentuh; belum diuji di perangkat.



---

<!-- sumber: CHANGES-0.5.40.md -->

# 0.5.40 — Kecepatan putar
- Menu lagu yang sedang diputar (mini player, pemutar penuh, antrean) punya **Kecepatan putar**: 0,75x, 0,9x, normal, 1,1x, 1,25x, 1,5x, 2x. Nada suara tetap (pitch dipertahankan). Pilihan tersimpan (`musicverse:speed:v1`) dan berlaku untuk semua lagu.
- Web: `playbackRate` + `defaultPlaybackRate` + `preservesPitch` di setiap elemen audio (default ikut diisi karena `load()` mengembalikan rate).
- APK: bridge baru `engineSetSpeed` -> `PlaybackService.engineSetSpeed` memakai `PlaybackParameters(speed, 1f)` pada pemutar aktif, cadangan, dan yang baru dibuat. Jam tiruan JS (`getLiveTime`) ikut dikali kecepatan agar sorotan lirik tidak meleset.
- File baru: `services/playbackSpeed.ts`, `components/player/SpeedSheet.tsx`.
- **Butuh APK baru** (ada perubahan Java). Di APK lama, panggilan diabaikan: kecepatan hanya berubah di web.
- Belum dibuild atau diuji di perangkat; hanya sintaks yang dicek.



---

<!-- sumber: CHANGES-0.5.39.8.md -->

# 🎵 MusicVerse 0.5.39.8

> Rilis gabungan **0.5.39 → 0.5.46** (termasuk perbaikan 0.5.39.5 sampai 0.5.39.8), dibangun di atas 0.5.38.5 (tutorial di dalam aplikasi). Pemutar lebih personal, lebih pintar, dan kini ikut ke layar utama serta dashboard mobil.

## ✨ Sorotan

- 🎨 **Warna aksen dari sampul**: pemutar penuh ikut berwarna sesuai lagunya
- ⏩ **Kecepatan putar** 0,75x sampai 2x, nada tetap
- 📊 **Rangkuman** ala Wrapped, dihitung di perangkat
- 📤 **Bagikan kartu lagu** untuk status dan story
- 🎤 **Lirik karaoke**: baris aktif terisi mengikuti lagu
- 📻 **Radio otomatis** dan **Mulai radio dari lagu ini**
- 🔊 **Normalisasi volume** antar lagu
- 📱 **Widget layar utama** dan 🚗 **Android Auto**
- 🛠️ **Perbaikan** tombol Putar di notifikasi/widget setelah lama dijeda

---

## 🎨 Warna aksen otomatis dari sampul
Pemutar penuh memakai warna dominan sampul untuk latar gradien dan semua elemen aksen: hati Suka, tombol acak/ulang/lirik yang aktif, ikon lirik, dan fokus. Bila sampul tidak bisa dibaca, dipakai warna gradien bawaan, lalu hijau aplikasi. Bagian lain aplikasi tetap hijau.

## ⏩ Kecepatan putar
Buka menu lagu yang sedang diputar (mini player, pemutar penuh, antrean) lalu pilih **Kecepatan putar**: 0,75x, 0,9x, normal, 1,1x, 1,25x, 1,5x, 2x. Nada suara tetap, pilihan tersimpan dan berlaku untuk semua lagu. Sorotan lirik tetap pas karena jam tiruan ikut dikali kecepatan.
- ⚠️ Butuh **APK baru**. Di APK lama kecepatan hanya berubah di web.

## 📊 Rangkuman (seperti Wrapped)
**Riwayat > Rangkuman**: total waktu dengar, jumlah putaran / lagu / artis, **hari paling aktif** dengan grafik putaran per hari, jam favorit, rekor hari terpadat, serta 5 lagu dan 5 artis teratas. Pilih periode 7 hari, 30 hari, atau Semua. Semua dihitung di perangkat, tanpa server dan tanpa data keluar.
- Total waktu dengar adalah **perkiraan**: jumlah durasi lagu per putaran (lagu yang dilewati tetap dihitung penuh, lagu tanpa durasi dihitung 3,5 menit).
- Riwayat kini menyimpan hingga 1500 putaran (sebelumnya 500).

## 📤 Bagikan kartu lagu
Dari menu lagu di pemutar penuh: gambar PNG 1080×1920 berisi sampul, judul, artis, dan gradien warna aksen. Di web memakai Web Share (atau diunduh), di APK dibuka lewat lembar bagikan.
- Bila sampul tidak bisa dibaca, kartu memakai gradien bawaan dengan not musik.
- ⚠️ Butuh **APK baru**.

## 🎤 Lirik karaoke
Teks baris yang sedang dinyanyikan terisi putih dari kiri ke kanan mengikuti lagu (maksimal 7 detik bila jeda ke baris berikutnya panjang). Mengikuti kecepatan putar dan penyelarasan manual.
- Efeknya per baris, bukan per kata (sumber lirik hanya menyediakan waktu per baris).
- Dimatikan bila waktu hanya perkiraan atau pengguna memilih kurangi gerakan.

## 📻 Radio otomatis + Mulai radio dari lagu ini
- **Mulai radio dari lagu ini** (menu lagu, termasuk di web): memutar lagu itu, mengganti antrean, lalu mengisinya dengan lagu mirip, terus diisi ulang.
- **Radio otomatis** (Pengaturan > Pemutaran, APK, **menyala secara bawaan**; yang sudah pernah mengubah pilihannya tidak berubah): saat sisa antrean tinggal 1 lagu atau kurang, 15 lagu rekomendasi ditambahkan di akhir antrean sehingga musik langsung lanjut tanpa jeda.
- Sumber lagu mirip: *radio artis* Deezer (APK, perlu internet). Cadangan: lagu dari Riwayat, artis yang sama didahulukan.
- **Cocok dengan lagu sebelumnya**: calon lagu diurutkan menurut **genre** album yang sama dengan lagu terakhir, lalu **tempo (BPM)** yang berdekatan (selisih ≤ 15) sebagai ukuran suasana santai atau berenergi. Genre dan tempo dibaca dari Deezer (maks. 20 album dan 12 lagu per pengisian, disimpan sementara). Bila gagal atau datanya kosong, dipakai urutan radio Deezer biasa.
- Genre Deezer cukup kasar (mis. Pop, Rap/Hip Hop), dan BPM tidak selalu tersedia, jadi ini pendekatan suasana, bukan jaminan.
- Tidak aktif saat mode ulang "satu lagu" atau "berhenti setelah lagu ini". Lagu radio dicocokkan ke sumber audio lewat judul + artis, jadi sesekali bisa salah cocok.

## 🔊 Normalisasi volume
Lagu yang lebih keras dari acuan YouTube diredam sebesar selisihnya (maksimal 12 dB), jadi volume antar lagu lebih rata. Fade, crossfade, dan sleep timer tetap bekerja. Tidak perlu APK baru.
- Pengaturan > Pemutaran > **Normalisasi volume** (APK), **menyala secara bawaan**.
- Hanya meredam, tidak menaikkan. Berlaku untuk lagu YouTube yang membawa data kekerasan (`loudnessDb`); unduhan dan lagu lokal tidak berubah. iOS Safari mengabaikan pengaturan volume.
- Seberapa sering datanya tersedia belum diketahui, perlu dicek di perangkat.

---

## 📱 Widget Layar Utama

Widget **4×1** (bisa diperlebar) yang menampilkan:

- 🖼️ Sampul, judul, dan nama artis
- ⏮️ ▶️/⏸️ ⏭️ Tombol Sebelumnya, Putar/Jeda, dan Berikutnya
- 👆 Ketuk di luar tombol untuk membuka aplikasi
- ⏳ Saat lagu dimuat tampil "Memuat lagu…"
- 🌫️ Tombol Sebelumnya/Berikutnya redup bila memang tidak tersedia

**Di balik layar**
- Widget **didorong** oleh `PlaybackService` hanya saat lagu, status, tombol, atau sampul berubah (`updatePeriodMillis=0`). Detak JS tiap ~2 dtk tidak menggambar ulang widget.
- Tombol widget memakai jalur yang sama dengan tombol notifikasi (`handleAction`), jadi perilakunya identik, termasuk saat "JS beku, native yang mengerjakan".
- Bila belum ada service berjalan, widget tampil **"siap"** dan semua tombolnya membuka aplikasi.

## 🚗 Android Auto

MusicVerse kini muncul sebagai aplikasi media di mobil.

**Telusur**
- 🕘 **Baru diputar**: Riwayat, 40 lagu terbaru tanpa duplikat
- 📜 **Antrean**: dari lagu aktif ke depan, sesuai urutan antrean
- Ketuk lagu untuk memutarnya, lalu lanjut ke lagu berikutnya di daftar yang sama
- Kartu "sedang diputar" berbagi sesi media dengan notifikasi (judul, artis, sampul, tombol, bilah posisi)

**🎙️ Perintah suara** ("Ok Google, putar …")
- "Putar musik": lanjut dari Riwayat (atau Antrean bila Riwayat kosong)
- Selain itu dicari di Riwayat (judul + artis), lalu sebagai **nama artis** beserta lagu-lagunya (APK, via Deezer, perlu internet)

**Bisa menelusuri tanpa membuka aplikasi**: daftar telusur disimpan ke native lewat `setAutoBrowse` (SharedPreferences), jadi mobil bisa menelusuri walau aplikasi belum dibuka.

---

## 🛠️ Perbaikan: tombol Putar di notifikasi dan widget setelah lama dijeda
Sebelumnya, setelah dijeda lama lalu menekan **Putar** dari notifikasi atau widget, lagu bisa macet di "memuat" dan tidak pernah berbunyi. Penyebabnya, tautan audio lama (yang bisa kedaluwarsa) dipakai lagi, dan "jaring pengaman" native memaksa memutar audio lama itu sementara aplikasi sedang mengambil tautan baru.
- Dijeda lebih dari **10 menit**: Putar kini mengambil **tautan audio baru** lalu lanjut dari posisi terakhir. Berlaku sama untuk tombol di aplikasi, notifikasi, widget, dan Android Auto.
- Mesin audio sudah berhenti atau gagal melanjutkan: aplikasi otomatis meminta tautan baru, bukan menampilkan galat.
- Native tidak lagi memaksa memutar audio lama bila aplikasi sudah bereaksi terhadap tombol itu.
- Konsekuensi: setelah jeda lebih dari 10 menit, Putar butuh beberapa detik untuk mengambil tautan baru.
- **Loading kini terlihat di notifikasi dan widget**: begitu Putar ditekan, native langsung menampilkan "Memuat lagu…" (notifikasi: bilah berjalan; widget: teks + bilah tipis di bawahnya) tanpa menunggu JS. Berlangsung selama tautan baru diambil sampai audio berbunyi. Bila JS tidak bereaksi dalam 20 dtk, tampilan kembali ke jeda.
- ⚠️ Butuh **APK baru**.

## 📱 Widget: Putar saat aplikasi sudah tertutup
Bila proses aplikasi sudah mati (widget tampil "siap"), tombol **Putar** di widget kini membuka aplikasi, mengambil tautan audio baru, lalu memutar dari posisi terakhir, lalu aplikasi kembali ke layar utama. Sebelumnya tombol itu hanya membuka aplikasi tanpa memutar.
- Memakai PendingIntent aktivitas langsung dari ketukan widget (boleh membuka aplikasi dari latar belakang), bukan startActivity dari receiver yang ditolak Android 10+.
- Permintaan "lanjut memutar" lewat jalur `AutoBridge` yang sama dengan Android Auto (`kind = resume`), diambil JS saat siap.
- Tanpa sesi tersimpan, aplikasi hanya terbuka. Tombol Sebelumnya/Berikutnya pada keadaan siap tetap hanya membuka aplikasi.
- Layar aplikasi tetap sempat tampil sebentar karena WebView (yang mencari audio) hanya hidup bila aplikasi dibuka.
- ⚠️ Butuh **APK baru**.

## ⚠️ Batasan yang perlu diketahui

**Android Auto**
- APK yang dipasang manual (bukan dari Play Store) **tidak muncul** sampai kamu aktifkan: Pengaturan Android Auto → ketuk "Versi" 10× → menu ⋮ → Pengaturan pengembang → **Sumber tidak dikenal**.
- Memutar dari mobil saat aplikasi belum berjalan: Android 10+ sering menolak membuka layar dari latar belakang. Bila gagal, Auto menampilkan "Buka MusicVerse di ponsel, lalu coba lagi." Buka aplikasi sekali di ponsel, lalu semuanya normal. Telusur tetap jalan.
- Daftar telusur belum punya sampul (sampul lagu yang sedang diputar tetap tampil).
- Telusur baru mencakup Baru diputar dan Antrean. Suka, playlist sendiri, dan Unduhan belum ada. Antrean mengikuti urutan antrean, bukan acak (shuffle).
- Pencarian suara tidak menemukan judul yang belum pernah diputar dan bukan nama artis. Tanpa hasil, tidak ada pesan di mobil.
- Host yang diizinkan terbatas: Android Auto, Asisten Google, Android Automotive, Wear, dan kontrol media sistem (daftar `ALLOWED_PACKAGES`).

**Widget**
- Tanpa bilah progres (butuh gambar ulang tiap detik, boros baterai).
- Ikon tombol memakai `ic_media_*` milik notifikasi dan diasumsikan putih di latar gelap. Bila terlihat gelap, perlu ikon widget sendiri.
- Widget bisa "usang" bila proses dimatikan sistem. Ketukan pertama mengembalikannya ke "siap", ketukan berikutnya membuka aplikasi.

**Perubahan perilaku**
- `MediaSession` kini dimiliki `MediaSessionHolder` dan **tidak di-release** saat `PlaybackService` berhenti, hanya dinonaktifkan (tetap aktif selama Android Auto tersambung).

---

## 🛠️ Untuk pengembang

**Pemasangan (otomatis)**
- `npm run android:sync` (`scripts/setup-android.mjs`) kini juga menambahkan ke `AndroidManifest.xml`: receiver widget, service `AutoBrowserService` (`exported=true`), dan `meta-data` `com.google.android.gms.car.application`. Aman dijalankan berulang (idempoten).
- Berkas Java dan resource baru (`res/layout`, `res/drawable`, `res/xml`) ikut tersalin oleh langkah salin yang sudah ada. Penanda `__APP_ID__` diganti seperti berkas Java lain.
- `R.drawable.notif_default_cover` dan `ic_media_*` tidak ditambah, dipakai ulang.
- `native/android/AndroidManifest.additions.xml` hanya contoh rujukan, bukan bagian build.

**File baru**
- Java: `MusicVerseWidget`, `MediaSessionHolder`, `AutoBridge`, `AutoBrowserService`
- Res: `layout/widget_player.xml`, `drawable/widget_bg.xml`, `drawable/widget_play_bg.xml`, `xml/widget_player_info.xml`, `xml/automotive_app_desc.xml`
- JS: `components/player/AutoSync.tsx`, `AutoRadioSync.tsx`, `SpeedSheet.tsx`, `VolumeNormSync.tsx`, `pages/RecapPage.tsx`, `services/playbackSpeed.ts`, `radio.ts`, `volumeNorm.ts`, `utils/recap.ts`, `shareCard.ts`

**File diubah**
- Native: `PlaybackService.java` (sesi lewat `MediaSessionHolder`, widget, jaring pengaman Putar/Jeda, aksi `PLAY_FROM_MEDIA_ID` / `PLAY_FROM_SEARCH`, `engineSetSpeed`), `MusicVerseNativePlugin.java` (`setAutoBrowse`, `consumeAutoRequest`, event `autoRequest`, `engineSetSpeed`, `shareFile` dengan `mimeType`), `res/xml/update_file_paths.xml` (folder `share/`)
- JS: `App.tsx`, `musicVerseNative.ts`, `audioEngine.ts` (`resume`), `useAudioPlayerController.ts` (`togglePlayPause`), `FullPlayer.tsx`, `LyricsPanel.tsx`, `TrackMenuSheet.tsx`, `useCoverGlow.ts` (`resolveCoverGlow`), `HistoryPage.tsx`, `PlaybackSettingsPage.tsx`, `plugins/ytmusic.ts` / `registry.ts` / `types.ts`, `types/spotify.ts`, `artistApi.ts` (`fetchArtistRadio`), `utils/playLog.ts`, `tailwind.config.js` (`accent` lewat `--mv-accent`)
- `scripts/setup-android.mjs`, `package.json` (`version` 0.5.39, `appVersion` 0.5.39.8)

**Catatan versi**: catatan per versi 0.5.39 sampai 0.5.43 masih ada sebagai `CHANGES-0.5.39.md` sampai `CHANGES-0.5.43.md`; 0.5.44 dan 0.5.45 kini ada di `CHANGES-0.5.46.md`; berkas ini menggabungkannya bersama 0.5.46.

**Catatan build**
- 📦 **Butuh APK baru** (Java + manifest + resource). Sidik jari native berubah, jadi paket OTA tidak akan terpasang di APK lama. Di APK lama, `setAutoBrowse` / `consumeAutoRequest` melempar UNIMPLEMENTED dan diabaikan, `AutoSync` tidak berbuat apa pun.
- 🧪 Belum dibuild dan belum diuji di perangkat atau Desktop Head Unit. Fitur 0.5.39 sampai 0.5.45 hanya dicek sintaksnya. Java belum dikompilasi, TypeScript baru dicek sintaksnya, XML lolos `xmllint`.



---

<!-- sumber: CHANGES-0.5.39.md -->

# 0.5.39 — Warna aksen otomatis dari sampul di pemutar penuh
- Pemutar penuh kini memakai warna dominan sampul (hook `useCoverGlow` yang sama dengan glow mini player) untuk latar gradien dan semua elemen `accent` di dalamnya: hati Suka, tombol acak/ulang/lirik aktif, ikon lirik, dan fokus.
- `tailwind.config.js`: `accent` kini `rgb(var(--mv-accent, 29 185 84) / <alpha-value>)`. Tanpa variabel, tampil hijau seperti biasa; hanya pemutar penuh yang menimpa `--mv-accent`. Varian `accent-soft` dan `accent-deep` tetap hijau.
- Bila sampul tidak bisa dibaca (tanpa CORS), dipakai warna gradien sampul bawaan, lalu hijau aplikasi.
- Hanya JS (OTA). Belum dibuild atau diuji di perangkat; pengecekan tipe belum dijalankan.



---

<!-- sumber: CHANGES-0.5.38.5.md -->

# 0.5.38.5 — Tutorial di dalam aplikasi (coach marks)
## Perubahan
- **Tutorial interaktif** yang menyorot elemen asli di layar: bagian lain digelapkan, elemen yang dijelaskan diberi bingkai hijau, kartu penjelasan muncul di dekatnya (atas/bawah menyesuaikan ruang). Titik peraga bergerak di atas sorotan: bergeser (gestur geser), berdenyut (tekan lama), atau beriak (ketuk).
- **9 langkah** (8 di web, tanpa Unduhan): sambutan -> kolom cari/tautan -> geser lagu -> tekan lama lagu -> tab Playlist -> geser playlist & mode pilih -> tab Unduhan (APK) -> pemutar mini -> selesai.
- **Interaktif, bisa langsung dipraktikkan:** langkah geser lagu, tekan lama, dan geser playlist memuat **baris contoh di dalam kartu** yang benar-benar bisa digeser / ditahan (memakai hook geser dan tekan-lama yang sama dengan aplikasi: animasi, bingkai hijau, dan ikon petunjuk sama). Data pengguna tidak tersentuh (tidak ada lagu yang masuk antrean atau disukai). Ada label "Coba: ..." dan penanda yang tercentang saat tiap gerakan berhasil (kanan = antrean, kiri = suka). Setelah semua berhasil muncul "Berhasil!" lalu **lanjut otomatis**; tombol Lanjut tetap ada untuk yang mau melewati. Tekan lama menampilkan menu contoh sebentar. Ketukan biasa pada baris contoh memberi petunjuk. Langkah tab Playlist memakai tab asli dan lanjut begitu diketuk. Karena memakai baris contoh, langkah ini tidak lagi bergantung pada ada-tidaknya lagu atau playlist.
- **Konsisten antar langkah:** tombol **Lanjut** selalu ada dan membuka halaman langkah berikutnya otomatis (mis. dari Beranda ke Playlist). Langkah yang menyorot tab juga lanjut sendiri bila tab itu diketuk. Ada Kembali, Lewati, penghitung "n / total", dan titik progres. Escape juga melewati.
- **Elemen target tidak ada** (mis. belum ada lagu/playlist/pemutar): kartu tampil di tengah dengan penjelasan yang tetap berguna, jadi alurnya tidak macet.
- **Mulai otomatis sekali** di Beranda sekitar 1,5 detik setelah dibuka; selesai atau dilewati tersimpan (`mv:tour:v1`), tidak muncul lagi. Pengguna lama juga melihatnya sekali. Bisa diulang dari **Pengaturan > Tutorial** (APK) atau tombol **Tutorial** di sidebar (layar lebar).
- File baru: `tour/steps.ts` (daftar langkah; tambah langkah = satu entri + atribut `data-tour`), `tour/tourStore.ts`, `tour/TourHost.tsx` (dipasang di `AppShell`).
- Atribut `data-tour` ditambahkan di: kolom cari (`PlaylistImportForm`), baris lagu (`playlist/TrackRow`), tab navigasi (`BottomNav`, `Sidebar`), daftar playlist (`PlaylistsSection`), pemutar mini (`MiniPlayer`), ikon Pengaturan (`MobileHeader`) dan tombol Tutorial (`Sidebar`).
## Catatan
- Hanya JS (OTA). Belum dibuild/diuji di perangkat; pengecekan tipe penuh belum dijalankan (dependensi tidak terpasang).
- Di web layar sempit belum ada tombol untuk mengulang tutorial (Pengaturan hanya di APK dan sidebar hanya di layar lebar).
- Tombol Back Android selama tutorial berjalan seperti biasa (tidak menutup tutorial); gunakan Lewati.
## Rilis otomatis: deskripsi dari CHANGES
- `.github/workflows/apk.yml`: deskripsi GitHub Release sekarang diambil dari `CHANGES-<versi>.md` versi saat ini (versi dari `appVersion`, mis. `CHANGES-0.5.38.5.md` untuk tag `v0.5.38.5`). Sebelumnya rilis dibuat dengan catatan kosong. Bila rilis sudah ada (build ulang tag yang sama), APK diganti dan deskripsinya ikut diperbarui. Bila berkasnya tidak ada, rilis tetap dibuat tanpa deskripsi dan ada peringatan di log. Penamaan berkas harus persis `CHANGES-<appVersion>.md`.
- Halaman Pembaruan di app menampilkan deskripsi itu apa adanya (teks mentah, tanda `#` dan `**` ikut terlihat); di GitHub tampil terformat.
## Pembaruan tutorial (perbaikan + langkah baru)
- **Perbaikan:** mengetuk tab yang disorot (mis. Playlist) tidak sampai ke tab karena wadah tutorial menangkap semua sentuhan. Wadah luar sekarang `pointer-events-none`; hanya penghalang, lubang sorotan, dan kartu yang menangkap sentuhan.
- **Langkah baru (tutorial utama jadi 18 langkah, 15 di web; lihat bagian berikutnya untuk jumlah terbaru):** Cari lagu atau artis (chip Lagu/Artis), Simpan ke playlist (latihan tahan baris lalu pilih playlist), Sukai lagu (latihan ketuk hati), Salin/pindah/perbarui playlist, Pengaturan (ketuk gerigi) dan isi Pengaturan (APK), Sleep timer, Lirik, dan Antrean (pemutar penuh dibuka otomatis bila ada lagu diputar, ditutup lagi oleh tutorial; tanpa lagu tampil kartu penjelasan di tengah).
- **Lanjut dari langkah terakhir:** bila aplikasi ditutup di tengah tutorial, saat dibuka lagi tutorial lanjut dari langkah itu. Tombol Tutorial di Pengaturan/sidebar tetap mulai dari awal. Lewati = tidak muncul lagi.
- **Tur kecil per halaman:** Playlist dan Unduhan (APK) masing-masing 2 langkah, muncul sekali saat halamannya pertama dibuka, hanya bila tutorial utama sudah selesai atau dilewati dan halaman itu belum dikunjungi lewat tutorial utama.
- **Konfeti** di langkah Selesai (dimatikan bila pengguna memilih kurangi gerakan).
- Versi penanda dinaikkan ke `mv:tour:v2`, jadi semua pengguna melihat tutorial baru sekali.
- `data-tour` baru: `search-mode`, `settings-btn` (berbagi dengan `tour-restart`, penyorot kini mencocokkan nama per kata), `settings-list`, `sleep-timer`, `lyrics-btn`, `queue-bar`, `downloads-header`, `downloads-settings`.
- Belum dibuild atau diuji di perangkat (dependensi tidak terpasang di sini); hanya dicek sintaksnya.
## Tutorial: latihan pilih banyak lagu, kuis, dan tur "Yang baru"
- **Latihan pilih banyak lagu** (langkah baru setelah geser playlist): baris contoh dengan tombol Pilih lagu, centang beberapa lagu, Pilih semua / Batal pilih, lalu Salin atau Pindahkan (contoh, data tidak berubah). Hapus menjelaskan bahwa selalu ada konfirmasi.
- **Kuis kilat** (sebelum Selesai): 3 pertanyaan pilihan ganda tentang gestur dan lokasi Lagu Disukai. Jawaban salah boleh dicoba lagi. Lulus menyimpan lencana (`mv:tour:v2:quiz`) yang tampil sebagai **Lulus tutorial** di kartu Tutorial pada Pengaturan. Melewati kuis lewat Lanjut tetap menamatkan tutorial tanpa lencana.
- **Tur "Yang baru"** (`WHATS_NEW` di `tour/steps.ts`): 1 sampai 2 langkah per rilis, muncul sekali di Beranda sekitar 2 detik setelah dibuka, hanya untuk pengguna yang tutorial utamanya sudah selesai atau dilewati di sesi sebelumnya. Penanda per rilis: `mv:tour:whatsnew:<id>`. Menambah fitur baru cukup menambah satu entri di akhir daftar, tanpa menaikkan versi tutorial utama. Rilis yang terlewat digabung (paling banyak 4 langkah terbaru).
- Pengguna yang menamatkan tutorial utama sampai **Selesai** dianggap sudah melihat semua entri "Yang baru". Yang menekan **Lewati** tidak: "Yang baru" muncul di pembukaan berikutnya, tidak langsung di sesi yang sama.
- Tutorial utama sekarang 20 langkah (17 di web).
- `data-tour` baru: `tutorial-btn` (tombol Tutorial di Pengaturan).
- Belum dibuild atau diuji di perangkat; hanya dicek sintaksnya.



---

<!-- sumber: CHANGES-0.5.37.6.md -->

# 0.5.37.6 — Geser pada lagu, pilih banyak lagu, lagu belum diunduh dikunci saat offline
## Perubahan
### Geser pada baris lagu (pola dan animasi sama dengan geser pada playlist)
- `hooks/useSwipeSelect.ts`: callback kini menerima arah geser, `onSwipe(index, direction)` (1 = kanan, -1 = kiri). Pemakai lama (daftar playlist) tidak berubah.
- `hooks/useTrackSwipe.ts` (baru): **geser kanan = tambah ke antrean**, **geser kiri = suka / batal suka** (Lagu Disukai). Aturan antrean sama dengan menu lagu (`fromSearch` hanya untuk hasil Cari; lagu playlist tidak dicampur ke antrean playlist lain, toast menjelaskan). Selesai geser muncul toast hasilnya.
- Dipasang di `TrackList.tsx` (Beranda/playlist Spotify, Cari, halaman artis/album) dan `MyPlaylistPage.tsx` (Playlist saya). Menggulir tegak, tekan lama (menu lagu), dan ketuk biasa tidak terpengaruh.
### Mode pilih banyak di daftar lagu Playlist saya
- Tombol ikon **Pilih lagu** di halaman playlist. Dalam mode pilih: ketuk atau geser (kanan/kiri) = pilih / batal pilih; tombol di baris disembunyikan.
- `library/TrackSelectionBar.tsx` (baru): Pilih semua / Selesai, serta ikon **Salin**, **Pindahkan**, **Hapus** (hapus minta konfirmasi di bilah). Back Android keluar dari mode pilih.
- `library/TrackTransferSheet.tsx` (baru): memakai `PlaylistTransferPanel` yang sama dengan menu lagu (konfirmasi pindah mengikuti Pengaturan > Playlist, playlist baru bisa dibuat langsung).
- `myPlaylistStorage.ts` + `MyPlaylistsContext.tsx`: `removeTracks` (hapus banyak lagu dalam satu penulisan).
- Lagu terpilih yang hilang dari playlist (mis. dari tab lain) otomatis dibuang dari pilihan; playlist kosong menutup mode pilih.
### Offline: lagu yang belum diunduh dikunci
- `hooks/useOfflineBlock.ts` (baru): saat perangkat offline, lagu yang belum diunduh (dan bukan dari folder Lokal) diblokir. Yang sudah diunduh tetap bisa diputar.
- Baris lagu yang diblokir tampil redup; mengetuknya (atau tombol putarnya, atau geser kanan ke antrean) tidak memutar, hanya toast "Tidak ada internet. Lagu ini belum diunduh". Tekan lama (menu) dan geser kiri (suka) tetap jalan.
- Berlaku di `TrackList.tsx` dan `MyPlaylistPage.tsx`. Tanda ikon unduhan di baris tidak dibuat (diganti pengunci ini).
## Catatan
- Hanya JS (OTA). Belum dibuild/diuji di perangkat; pengecekan tipe penuh belum dijalankan (dependensi tidak terpasang di sini).
- "Putar semua" saat offline tetap mulai dari lagu pertama, jadi kalau lagu itu belum diunduh akan gagal diputar seperti biasa. Belum ditambah pelewatan otomatis.
- Mode pilih banyak hanya di Playlist saya (tempat hapus/salin/pindah bermakna). Daftar lagu Spotify, Cari, dan Unduhan belum punya mode pilih.
### Petunjuk ikon saat menggeser (lagu dan playlist)
- `useSwipeSelect.ts`: parameter kedua opsional `getHint(index, direction)`. Selama menggeser, ikon + label kecil muncul di celah yang terbuka (makin jelas sambil digeser, membesar sedikit saat "siap"), lalu memudar saat dilepas. Tanpa efek bila "kurangi gerakan" aktif.
- Lagu: kanan = ikon antrean "Antrean" (atau "Offline" bila terkunci), kiri = hati "Suka" (atau "Batal suka" bila sudah disukai). Mode pilih: "Pilih" / "Batal".
- Playlist: "Pilih" / "Batal" (centang / silang); "Lagu Disukai" menampilkan "Bawaan" (tidak bisa dipilih).



---

<!-- sumber: CHANGES-0.5.37.5.md -->

# 0.5.37.5 — Pilih banyak lewat geser, sheet playlist tetap terbuka, tombol ikon saja
## Perubahan
### Pilih banyak playlist lewat geser (tombol "Pilih" dihapus)
- `PlaylistsSection.tsx`: tombol **Pilih** dihapus dari header; tinggal tombol "Buat playlist". Untuk memilih banyak, **geser playlist ke kanan atau kiri** (kisi maupun daftar): playlist itu langsung terpilih dan mode pilih terbuka (bilah Pilih semua / Hapus / Selesai seperti sebelumnya). Selama mode pilih, geser atau ketuk lagi untuk memilih / batal pilih. Kalau pilihan terakhir dibatalkan, mode pilih tertutup sendiri. "Lagu Disukai" tidak bisa dipilih.
- `hooks/useSwipeSelect.ts` (baru): satu pendengar pointer di `<ul>` (tanpa mengubah kartu). **Animasi:** baris ikut jari (sedikit tertahan seperti karet, maks 96 px), mengecil tipis, dan bingkai hijau makin jelas sampai melewati ambang 64 px (getar sekali = "siap"). Jari dilepas setelah "siap" memilih playlist; kalau kurang, batal. Baris kembali ke tempat dengan efek pegas, dan ikon centang muncul dengan animasi pop. Menggulir tegak tidak terpengaruh (`touch-pan-y`); klik susulan setelah geser ditelan, jadi playlist tidak ikut terbuka. Sentuhan dari tepi layar (24 px) diabaikan untuk gestur Kembali Android. Mengikuti "kurangi gerakan" (tanpa efek geser). Tahan lama tetap membuka menu kartu.
### Sheet "pilih playlist" tetap terbuka + tanda lagu yang sudah masuk playlist
- `ArtistPlaylistSheet.tsx` (Tambah ke playlist di halaman artis/album): satu ketukan pada playlist menambahkan lagunya, **sheet tidak menutup**. Barisnya berubah jadi centang + konfirmasi ("N lagu ditambahkan ke ..." / "Semua lagu sudah ada ..."), jadi bisa memilih beberapa playlist berturut-turut. Setiap baris juga menampilkan "X dari N lagu sudah ada". Buat playlist baru juga tidak menutup sheet. Tombol **Selesai** (atau ketuk di luar) menutup dan memunculkan satu toast ringkasan.
- `AddToPlaylistPicker.tsx` (Simpan satu lagu ke playlist, dari menu lagu): sama, tetap terbuka setelah diketuk; ketuk lagi pada playlist berisi lagu itu untuk menghapusnya. Tombol **Selesai** menutup dan merangkum perubahan. Tombol Urungkan di toast dihapus karena ketuk ulang sudah bisa membatalkan.
- `TrackRow.tsx`: lagu di daftar (termasuk lagu artis) yang sudah ada di playlist buatanmu diberi ikon centang di depan judul, selain teks "Sudah ada di ...".
### Tombol aksi ikon saja + daftar lagu lebih rapi
- `ui/RoundAction.tsx` (baru): tombol bulat tanpa teks. "Putar semua" lebih besar dan hijau, sisanya bulat abu-abu. Label tetap ada untuk pembaca layar (`aria-label`) dan tooltip desktop (`title`), hanya tidak tampil sebagai teks. Prop `danger` dan `pressed` tersedia.
- `PlaylistHeader.tsx`: Putar semua, Tambah ke antrean, Tambah ke playlist, Unduh semua, Muat ulang kini ikon saja, satu deret rapi.
- `ArtistSearchPanel.tsx` (halaman artis/album): Putar semua, Acak, Tambah ke playlist, Buat playlist jadi ikon saja dan satu baris dengan chip Populer / A–Z. Tulisan "Urutkan" dihapus.
- `TrackList.tsx`: baris kosong di antara kolom cari dan daftar lagu hilang kecuali saat memfilter (teks "X dari N lagu" tetap diumumkan ke pembaca layar).
### Halaman playlist: tombol ikon saja, pembaruan digabung jadi satu
- `MyPlaylistPage.tsx`: Putar semua, Unduh semua, Sematkan, dan Hapus kini ikon saja. "Muat data terbaru" dan "Unduh yang baru" yang memakai ikon sama digabung jadi **satu tombol Perbarui** (ikon putar). Di APK, mengetuknya membuka sheet kecil untuk memilih **Muat data terbaru** atau **Unduh yang baru**; di web (hanya ada satu pilihan) langsung memuat data terbaru. Ikon berputar selama proses berjalan. Konfirmasi hapus tetap bertulis.
- `library/RefreshChoiceSheet.tsx` (baru): sheet pilihan tersebut.
## Catatan
- Hanya JS (OTA). Belum dibuild/diuji di perangkat; pengecekan tipe belum dijalankan (dependensi tidak terpasang).
- Daftar lagu di dalam playlist belum punya mode pilih banyak, jadi geser hanya berlaku di daftar playlist.
- Penandaan "sudah ada di playlist" memakai identitas lagu yang sama dengan pencegah duplikat (ID Spotify atau URL), jadi lagu yang sama dari sumber berbeda (Deezer vs Spotify) dianggap berbeda.
- **Penomoran versi:** versi rilis kini 4 angka (0.5.37.5). Pengecek pembaruan di app (`native/appUpdate.ts`) sudah membaca sampai 4 angka, jadi 0.5.37.5 dianggap lebih baru dari 0.5.37. `package.json` memakai field baru `appVersion` ("0.5.37.5"); `version` tetap "0.5.37" karena npm menolak versi 4 angka. `apk.yml` (tag rilis `v0.5.37.5`), `make-ota.mjs`, dan `setup-android.mjs` membaca `appVersion` dulu. `versionCode` Android kini memuat angka ke-4 (rumus ((major*100+minor)*100+patch)*100+revisi → 53705), jadi tetap naik walau hanya revisi yang berubah dan jauh di atas skala lama (536).



---

<!-- sumber: CHANGES-0.5.36.md -->

# 0.5.36 — Cari artis dari luar di Beranda (mode Lagu | Artis)
## Perubahan
- `PlaylistImportForm.tsx`: dua chip **Lagu | Artis** di bawah kolom cari. Mode Artis: placeholder "Nama artis", tombol "Cari artis", saran judul dimatikan. Menempel tautan Spotify saat mode Artis otomatis kembali ke mode Lagu (alur lama). Prop baru `mode`, `onModeChange`, `onArtistSearch`; tipe `SearchMode` diekspor.
- `services/artistApi.ts` (baru): `searchArtists` (nama -> daftar artis) dan `fetchArtistSongs` (artis -> lagu gabungan, satu per judul). Profil iTunes hanya dipakai kalau ada lagunya yang juga ada di daftar Deezer, supaya tidak tercampur artis lain yang namanya sama hybrid lewat `pluginFetch`: artis + foto profil + jumlah penggemar dari Deezer; lagu = 100 terpopuler Deezer di urutan atas, dilengkapi lagu dari iTunes (sampai 200 per profil, maks 3 profil bernama sama). Lagu dibentuk sebagai `PlaylistTrack` biasa; audio tetap dicari lewat plugin (judul + artis) seperti lagu lain.
- `components/playlist/ArtistSearchPanel.tsx` (baru): daftar artis (foto bulat + panah) -> ketuk -> semua lagu artis (Putar semua, Acak, kolom cari bawaan `TrackList`). Artis tidak pernah dibungkus sebagai lagu. Tombol Back (termasuk Android) dari detail artis kembali ke daftar artis lewat `useOverlayHistory`.
- `HomePage.tsx`: menyimpan mode dan permintaan artis; mode Artis menampilkan `ArtistSearchPanel` menggantikan `PlaylistView` (playlist/hasil lagu tidak dihapus, muncul lagi saat kembali ke Lagu).
- **Tetap ada saat pindah halaman:** mode Artis, daftar artis, artis yang sedang dibuka, dan daftar lagunya disimpan di `utils/artistSearchStore.ts` (di luar halaman), jadi pindah ke Playlist/Cari lalu kembali ke Beranda tidak menghilangkannya. Kolom cari ikut terisi kata kunci terakhir. Hanya selama app berjalan.
- **Di halaman artis:** tombol **Tambah ke playlist** (sheet `ArtistPlaylistSheet.tsx`: pilih playlist yang ada atau buat baru dengan nama sendiri; lagu yang sudah ada dilewati) dan **Buat playlist** (satu ketukan, playlist bernama artis; kalau sudah pernah dibuat dari artis yang sama, lagu baru ditambahkan ke playlist itu).
- **Layar awal mode Artis:** teks petunjuk, lalu daftar "Terakhir dibuka" (maks 8 artis, foto + penggemar, tombol Hapus riwayat; disimpan di perangkat, kunci `mv:artistRecent:v1`). Ketuk artis di riwayat langsung membuka lagunya; Kembali mengarah ke riwayat.
- **Cache:** hasil cari artis dan daftar lagu artis di-cache di memori 30 menit (maks 30 entri), jadi mencari/membuka yang sama lagi langsung muncul tanpa request ulang. Hasil kosong dan kegagalan tidak di-cache.
- **Urutkan lagu artis:** chip Populer | A–Z. Urutan tampil = urutan putar (Putar semua, Acak, ketuk baris). Pilihan ikut tersimpan selama app berjalan.
- **Hasil muncul saat mengetik (mode Artis):** ditunda 400 ms, minimal 2 huruf; tombol Cari artis tetap bisa dipakai. Kata kunci yang sudah dicari tidak diulang, jadi kembali ke Beranda dengan artis terbuka tidak menimpanya.
- **Tab Lagu | Album di halaman artis:** diskografi dari Deezer (terbaru dulu, satu entri per judul, tahun + jenis). Ketuk album untuk lagunya sesuai urutan album, dengan tombol Putar semua / Acak / Tambah ke playlist / Buat playlist sendiri (playlist bernama "Album – Artis"). Back Android: album -> halaman artis -> daftar artis.
- **Blok Artis di tab Cari:** `ArtistMatches.tsx`. Mengetik nama artis di tab Cari menampilkan sampai 3 baris artis (foto bulat) di atas hasil lagu; ketuk membuka halaman artis di Beranda. Online (hanya APK); kalau gagal/kosong blok tidak tampil. Memakai cache yang sama dengan Beranda.
- Refactor: `ArtistList.tsx` (daftar artis bersama), `ArtistPlaylistSheet` menerima artis atau album.
- **Urutan hasil artis:** penggemar terbanyak di paling atas (di Beranda dan blok Artis tab Cari). Foto bawaan Deezer berupa siluet abu-abu (artis tanpa foto) kini dianggap kosong dan diganti gradien app.
- **Perbaikan tab Album kosong:** (1) galat Deezer (HTTP 200 + `{ error }`, mis. kuota habis) kini dianggap gagal ("Gagal memuat" + Coba lagi), bukan "tidak ada hasil". (2) Kalau daftar album Deezer kosong atau gagal, album disusun dari lagu yang sudah dimuat (dikelompokkan menurut nama album, subtitle "N lagu"); ketuk album menampilkan lagunya tanpa request baru.
## Catatan
- Hanya JS (OTA). Belum dibuild/diuji di perangkat; pengecekan tipe penuh belum dijalankan (dependensi tidak terpasang).
- Hanya jalan di APK (HTTP native, seperti saran pencarian). Di browser biasa pencarian artis gagal CORS.
- Foto profil dari Deezer; kalau tidak ada / gagal dimuat, dipakai gradien `fallbackCover`. Kalau salah satu sumber gagal, hasil sumber lain tetap tampil. Lagu yang judulnya sedikit beda antar sumber (mis. tambahan "(feat. …)") bisa muncul dua kali.
- Lagu dari artis berisi tautan Deezer/Apple Music (bukan Spotify), jadi "Buka di Spotify" tersembunyi untuk lagu ini.
## Perbaikan build
- `PlaylistsSection.tsx`: `restorePlaylist` dari `usePlaylist()` dan dari `useMyPlaylists()` dideklarasikan dua kali (TS2451, memicu TS2345/TS2339 di tombol "Urungkan"). Yang dari `usePlaylist()` diganti nama jadi `restoreActivePlaylist`; "Urungkan" kini memakai `restorePlaylist` milik `useMyPlaylists()` (yang mengembalikan `{ ok }`).



---

<!-- sumber: CHANGES-0.5.28.md -->

# 0.5.28 — Urungkan setelah menghapus lagu dari playlist, plus getar dan animasi ikon
## Perubahan
- `AddToPlaylistPicker.tsx`: toast "Dihapus dari “nama”" sekarang punya tombol **Urungkan** (toast bertahan 6 dtk). Urungkan menyimpan lagu itu lagi ke playlist yang sama dan mengembalikannya ke posisi semula, lalu menampilkan "Dikembalikan ke “nama”". Berlaku di menu lagu dan "Tambah ke playlist", termasuk "Lagu Disukai".
- Getar pendek saat berhasil menyimpan/menghapus (pola ganda untuk hapus), getar lebih panjang saat gagal. Ikon baris yang baru berganti (centang ⇄ daftar) membal sebentar (`animate-pop`), dan sheet menutup ±260 ms kemudian supaya animasinya terlihat. Ketukan ganda selama jeda itu diabaikan.
- `SheetAction.tsx`: prop baru `iconClassName`. `tailwind.config.js`: animasi `pop`. `AddToPlaylistSheet.tsx` dan `TrackMenuSheet.tsx`: `onDone`/`onToast` meneruskan tombol aksi toast.
## Catatan
- Hanya JS (OTA). Belum dibuild/diuji di perangkat. Pengecekan tipe penuh belum bisa dijalankan di sini (dependensi tidak terpasang); perubahan sudah diperiksa terhadap tipe yang ada dan tidak ada error baru di logika.
- Urungkan hanya berlaku untuk hapus; menyimpan lagu tidak punya tombol urungkan (cukup ketuk lagi).



---

<!-- sumber: CHANGES-0.5.27.md -->

# 0.5.27 — Notifikasi "Tambah ke playlist" di hasil cari lagu muncul lagi
## Perubahan
- `PlaylistView.tsx`: sheet "Tambah ke playlist" (hasil cari judul / tautan lagu) dan sheet cari manual sekarang memakai toast global (`showToast` dari `TrackMenuContext`), sama seperti tempat lain. Toast lokal lama (posisi tetap, bisa tertutup dock pemutar) dihapus, jadi pesan "Disimpan ke / Dihapus dari / Playlist dibuat" tampil.
## Catatan
- Hanya JS (OTA). Belum diuji di perangkat.



---

<!-- sumber: CHANGES-0.5.26.md -->

# 0.5.26 — Ketuk lagi di "Simpan ke playlist saya" untuk menghapus lagu dari playlist itu
## Perubahan
- `AddToPlaylistPicker.tsx`: playlist yang sudah berisi lagu ini tidak lagi nonaktif. Ketukan pertama menyimpan, ketukan berikutnya pada playlist bertanda centang menghapus lagu itu dari playlist tersebut (toast "Dihapus dari “nama”"). Keterangan baris berubah jadi "Sudah ada di sini · ketuk untuk menghapus".
- Berlaku di semua tempat picker ini dipakai (menu lagu dan "Tambah ke playlist"), termasuk "Lagu Disukai" (sama dengan batal suka).
## Catatan
- Hanya JS (OTA). Belum dibuild/diuji di perangkat; sintaks dicek lewat transpile TypeScript.
- Yang dihapus hanya lagu dari playlist yang diketuk; playlist lain dan berkas unduhan tidak tersentuh.



---

<!-- sumber: CHANGES-0.5.25.md -->

# 0.5.25 — Hapus beberapa playlist sekaligus (mode pilih banyak di Koleksi)
## Perubahan
- `PlaylistsSection.tsx`: tombol **Pilih** baru di header Playlist (Koleksi). Dalam mode pilih, mengetuk kartu = pilih / batal pilih (tidak membuka playlist, tahan lama dimatikan). Berlaku di tampilan kisi maupun daftar, untuk playlist buatanmu dan yang tersimpan.
- `PlaylistSelection.tsx` (baru): `SelectableCard` (kartu dengan tanda centang, `role="checkbox"`) dan `SelectionBar` (bilah menempel di atas: jumlah dipilih, Pilih semua / Batal pilih, Hapus, Selesai). Tombol Hapus meminta konfirmasi di bilah itu juga. Tombol Back (Android) keluar dari mode pilih lewat `useOverlayHistory`.
- "Lagu Disukai" (bawaan) tampil terkunci dan tidak bisa dipilih.
- Menghapus dilakukan sekaligus: playlist buatanmu lewat satu penulisan (`deletePlaylists`), playlist tersimpan lewat satu penulisan (`removePlaylists`). Playlist hasil "Unduh semua" ikut melepas kartu Spotify-nya, sama seperti hapus satuan.
- Setelah dihapus muncul toast "N playlist dihapus" dengan tombol **Urungkan** (mengembalikan playlist buatanmu dan kartu tersimpan yang tadi dihapus). Catatan: playlist tersimpan yang dikembalikan masuk lagi di urutan teratas (tanggal simpan baru).
- `myPlaylistStorage.ts`: `deleteMyPlaylists(list, ids)` (baru); "Lagu Disukai" dan ID yang tidak ada dilewati. `MyPlaylistsContext.tsx`: `deletePlaylists`.
- `libraryStorage.ts`: `removeSavedPlaylists` (baru). `LibraryContext.tsx`: `removePlaylists`; bila tak satu pun ID ada di Koleksi, tidak ada yang ditulis ulang.
- Mode pilih keluar otomatis bila tidak ada lagi playlist yang bisa dipilih (mis. semuanya sudah dihapus di tab lain).
## Catatan
- Hanya JS (OTA). Versi `package.json` menjadi 0.5.25.
- Belum diuji di perangkat atau dibuild (tidak ada node_modules di lingkungan pengerjaan); sintaks file yang diubah dicek lewat transpile TypeScript, tetapi pengecekan tipe penuh (`npm run typecheck`) belum dijalankan.
- Yang dihapus hanya daftar playlist; berkas lagu yang sudah diunduh dan antrean yang sedang diputar tidak ikut tersentuh.



---

<!-- sumber: CHANGES-0.5.24.md -->

# 0.5.24 — Tahan lama playlist bisa menghapus
## Perubahan
- `PlaylistMenuSheet.tsx`: menu tahan lama playlist buatanmu kini punya "Hapus playlist" (dengan konfirmasi di dalam menu). Playlist bawaan "Lagu Disukai" tidak bisa dihapus. Playlist hasil "Unduh semua" ikut melepas kartu Spotify-nya (`removeSaved(sourceId)`), sama seperti tombol hapus di halaman playlist.
- `SavedPlaylistMenuSheet.tsx` (baru) + `SavedPlaylistCard.tsx` + `PlaylistsSection.tsx`: playlist tersimpan juga bisa ditahan lama / klik kanan -> Buka atau Hapus dari Koleksi.
- Daftar Koleksi langsung diperbarui begitu playlist dihapus (state context), tanpa perlu pindah halaman atau memuat ulang; muncul toast konfirmasi.
- `LibraryContext.removePlaylist`: bila ID tidak ada di Koleksi, tidak menulis ulang penyimpanan dan tidak menghapus pemberitahuan lain.
## Catatan
- Hanya JS (OTA). Belum diuji di perangkat atau dibuild (tidak ada node_modules di lingkungan pengerjaan); sintaks file yang diubah sudah dicek dengan tsc.
- Yang dihapus hanya daftar playlist; berkas lagu yang sudah diunduh dan antrean yang sedang diputar tidak ikut tersentuh.
## Batas waktu cek audio playlist
- `registry.ts`: batas cek SATU lagu naik dari 6 dtk menjadi 25–30 dtk menurut durasi lagu di playlist (<= 3 mnt = 25 dtk, >= 6 mnt = 30 dtk, di antaranya naik bertahap; durasi tak diketahui = 25 dtk). Batas baca metadata audio saat cek naik dari 4 dtk menjadi 8 dtk, karena 4 dtk akan tetap memotong stream yang lambat sebelum batas 25 dtk tercapai.
- Konsekuensi: lagu yang benar-benar tidak ada bisa makan sampai 25–30 dtk sebelum dinyatakan "tidak ditemukan", dan selama itu lagu yang belum dicek tetap terkunci. Dengan 2 lagu dicek bersamaan, playlist besar dengan banyak lagu bermasalah akan lebih lama selesai.



---

<!-- sumber: CHANGES-0.5.23.md -->

# 0.5.23 — Audio pilihan manual (Cari manual) bebas dari pemeriksaan playlist, di pemutar dan di unduhan
## Masalah
- Lagu yang dipilih manual (mis. "DJ Clbk - Cinta Lama Bersemi kembali") tetap ditolak pemutar: "Audio dari server tidak sama dengan lagu di playlist (cuplikan atau versi lain dengan durasi berbeda)". Penyebabnya, pemeriksa klip di pemutar (`createClipGuard`) dan pemeriksaan preload/crossfade membandingkan durasi file dengan durasi lagu di playlist, padahal pilihan manual memang beda versi. `resolveManualPick` juga masih menolak lewat `isLikelyClip` / `strictDurationProblem`, lalu pencarian otomatis diam-diam menggantikan pilihan pengguna.
## Perubahan
- `PlaybackInfo.manualPick` (baru): menandai audio yang dipilih pengguna.
- `registry.ts` `resolveManualPick`: tidak ada lagi pemeriksaan judul/artis/durasi (terhadap playlist maupun hasil pencarian). Syaratnya hanya ada stream; stream yang metadatanya terbaca didahulukan, bila tidak ada yang terbaca stream pertama tetap dipakai. Tanpa stream = gangguan sesaat ('failed', diulang), bukan "lagu tidak ada".
- `registry.ts` `resolveViaPluginsDetailed`: bila lagu punya pilihan manual, hasilnya dikembalikan apa adanya dan TIDAK jatuh ke pencarian otomatis. Hanya yang dipilih pengguna yang diputar.
- `useAudioPlayerController.ts`: pemeriksa klip dimatikan untuk `manualPick`; pemeriksaan klip pada preload dan crossfade lagu berikutnya juga dilewati.
- `FullPlayer.tsx`: catatan di bawah pemutar untuk pilihan manual berbunyi "Memutar pilihan manualmu: …", bukan "Audio yang ditemukan server berbeda…".
- `downloads.ts`: `isManualJob` = unduhan dari "Cari manual" ATAU lagu yang punya pilihan manual tersimpan. Untuk itu tidak ada durasi acuan, tidak ada cek klip/durasi/laju bit, tidak ada putaran coba-ulang ke sumber lain. Yang tetap dijaga: berkas tidak terpotong, isinya audio sungguhan, dan durasinya sama dengan sumber yang dibaca sebelum diunduh.
- `DownloadQueue.java` + `NativeQueueJob.free`: jalur native ikut melewati pemeriksaan durasi/laju bit untuk pekerjaan `free`.
## Pengecekan audio playlist (kenapa U&I dkk lolos padahal audionya tidak ada)
- Penyebab: mode cek (`searchOnly`) hanya menilai METADATA hasil pencarian (judul/artis/durasi yang tertulis di YouTube) lalu berhenti; stream tidak diambil dan file audio tidak dibaca. Lagu yang muncul di pencarian tetapi streamnya tidak bisa diambil/dibaca (itulah yang menggantung di "Mencari audio…") tetap dinyatakan "ada", dan hasil "ada" disimpan 12 jam.
- `registry.ts`: cek sekarang memakai jalur yang sama dengan pemutaran: cari, ambil stream, baca durasi file (batas baca 4 dtk), tolak klip/versi lain. Batas waktu SATU lagu = 6 dtk (`CHECK_BUDGET_MS`); lewat batas = tidak ditemukan. Stream yang lolos masuk cache sehingga memutar lagunya nanti lebih cepat.
- `useTrackAvailability.ts`: hasil cek selain "ok" (tidak ketemu, ditolak, stream tak terbaca, lewat 6 dtk) = "tidak ditemukan" (muncul di daftar Cari manual). Cache hasil "ada" dinaikkan ke `mv:availability:v2` sehingga hasil palsu lama terbuang dan semua lagu dicek ulang sekali.
## Lagu dikunci selama pengecekan
- Lagu yang BELUM selesai dicek tidak bisa diketuk/diputar (baris redup, tombol putar dan menu tekan-lama nonaktif); terbuka satu per satu begitu hasilnya keluar, jadi lagu yang sudah dicek (atau ada di cache 12 jam) langsung bisa dipakai. Tombol "Putar semua" nonaktif sampai pengecekan selesai. Panel pengecekan menampilkan keterangannya. (`TrackRow`, `TrackList`, `PlaylistHeader`, `PlaylistView`, `AvailabilityPanel`.)
## Lirik: YouTube Music lebih dulu
- `plugins/ytLyrics.ts` + `utils/ytLyricsParse.ts` (baru): lirik diambil dari YouTube Music lebih dulu (video = pilihan manual bila ada, kalau tidak hasil pencarian YouTube Music yang judul+artis+durasinya cocok; lalu tab lirik; bertanda waktu lewat klien ANDROID_MUSIC, cadangan lirik biasa lewat klien web). Batas 7 dtk.
- `lyricsApi.ts` `fetchLyrics`: bila YouTube Music punya lirik, itu yang dipakai; bila tidak ada / gagal, LRCLIB + NetEase + lyrics.ovh seperti sebelumnya.
- Parser sudah dites dengan data contoh buatan sendiri; panggilan jaringan ke YouTube Music BELUM diuji (tidak ada akses dari lingkungan pengerjaan).
## Catatan
- Bagian unduhan native butuh APK baru; bagian pemutar dan jalur unduhan JS cukup OTA.
- Belum diuji di perangkat (tidak ada akses ke YouTube dari lingkungan pengerjaan): tolong coba putar dan unduh lagu CLBK yang sudah dipilih manual.
- Konsekuensi: kalau video pilihan manual dihapus dari YouTube, lagunya tidak akan pindah ke sumber lain otomatis. Belum ada tombol "lepas pilihan manual" di UI (`forgetManualPin` sudah ada di kode, hanya belum dipanggil dari mana pun).



---

<!-- sumber: CHANGES-0.5.21.md -->

# 0.5.21 — Kartu "Sedang dibuka" dihapus, mini player menunggu di belakang keyboard
## Halaman Playlist
- Kartu "<judul> · N lagu · Sedang dibuka, belum ada di Koleksi" + tombol "Simpan ke Koleksi" dihapus dari `LibraryPage.tsx` (beserta variabel dan impor yang tidak terpakai lagi). Menyimpan playlist ke Koleksi tetap bisa lewat menu playlist.
## Mini player saat keyboard naik
- Sebelumnya kartu langsung menghilang saat keyboard naik. Sekarang kartu TIDAK ikut naik bersama keyboard: ditahan di posisi layar semula, jadi tertutup keyboard (`MiniPlayer.tsx`: `startPin`/`applyPin`, dock diberi `translateY` sebesar penyusutan layar, dihitung ulang tiap perubahan ukuran).
- Setelah ukuran layar tenang (`viewportSettle.ts`, tetap 140 ms / 800 ms), kartu berganti disc, lalu disc naik dari belakang keyboard ke atas keyboard (`bubble-rise`, 380 ms). Jarak awalnya mengikuti seberapa jauh kartu ditahan (`--rise-from`, prop `riseFrom` di `MiniBubble`), bukan lagi 28 px tetap.
- Posisi dock dicatat tepat sebelum keyboard naik (saat kolom isian difokus, layar masih penuh).
- Bila keyboard menutup sebelum kartu berganti disc: penahan dilepas dan kartu kembali bersama layar yang melebar. Animasi saat keyboard menutup (disc membesar jadi kartu) dan animasi disc pilihan pengguna tidak berubah.
## Catatan
- Hanya JS (OTA); kodenya sudah termasuk folder Lokal dari 0.5.20 (yang itu butuh APK baru).
- Belum diuji di perangkat: nilai penahan dihitung dari posisi layar, jadi tolong cek di HP-mu apakah kartu benar-benar tersembunyi di belakang keyboard dan disc naik mulus. Bila masih terlihat meloncat satu frame, kabari model HP dan jenis keyboard-nya.



---

<!-- sumber: CHANGES-0.5.20.md -->

# 0.5.20 — Folder "Lokal" di Unduhan: semua audio di HP, terpisah dari unduhan MusicVerse
## Folder Lokal
- Tab Unduhan sekarang punya folder **Lokal** yang selalu paling atas (di atas semua playlist dan "Lagu satuan"). Isinya semua audio di HP, KECUALI milik MusicVerse sendiri supaya tidak tercampur: unduhan di `Android/data/<paket>/files/download`, salinan di `Music/MusicVerse/`, dan berkas yang pemiliknya aplikasi ini.
- Folder ini tidak bisa dihapus: tidak ada tombol hapus, hanya tombol pindai ulang. Lagu di dalamnya juga tidak punya aksi hapus/unduh (berkasnya bukan milik MusicVerse; aplikasi hanya MEMBACA, tidak mengubah atau menghapus apa pun).
- Nada dering, nada notifikasi, dan alarm tidak dihitung. Audio lain (termasuk rekaman dan pesan suara) ikut tampil.
- Diurutkan A-Z menurut judul. Default tertutup; dibuka bertahap 100 lagu sekali tampil (daftar bisa ribuan). Sampul diambil dari tag lagu / thumbnail sistem, disimpan di cache aplikasi.
- Ketuk memutar langsung dari berkasnya (tanpa internet, tanpa proxy, tanpa pencarian YouTube); tahan lama membuka menu lagu (antrean, tambah ke playlist). Seluruh daftar Lokal menjadi antrean saat satu lagu diputar.
## Izin
- Android 13+: `READ_MEDIA_AUDIO`; Android 12 ke bawah: `READ_EXTERNAL_STORAGE` (maxSdkVersion 32). Ditambahkan otomatis oleh `scripts/setup-android.mjs`.
- Dialog izin muncul otomatis SEKALI saat Unduhan pertama kali dibuka. Bila ditolak, folder Lokal menampilkan tombol "Izinkan akses"; bila ditolak permanen, tombolnya menjadi "Buka pengaturan".
- Dipindai saat Unduhan dibuka dan saat aplikasi kembali aktif (paling cepat tiap 5 dtk), jadi lagu baru dan perubahan izin langsung terbaca.
## Detail teknis
- Native: `LocalAudioScanner.java` (kueri MediaStore + sampul), metode baru di `MusicVerseNativePlugin.java`: `localAudioPermission`, `requestLocalAudioPermission`, `scanLocalAudio`, `localAudioCover`, `openAppSettings`.
- JS: `src/native/localMusic.ts` (penyimpanan di memori + hook + pemutaran), `src/utils/localTrack.ts`, `src/components/library/LocalFolder.tsx`.
- Lagu lokal memakai `url` = `local:<id MediaStore>` dan kunci `lc-<id>` (`trackKey`), sehingga tidak pernah tertukar dengan unduhan yang judulnya sama. `fetchPlaybackInfo` memutarnya lewat `content://media/external/audio/media/<id>` (sumber `local`), melewati pemeriksaan klip. `downloadTrack(s)` dan `useTrackAvailability` menganggapnya sudah ada.
- Sampul: `cache/localcovers/<id>.jpg`; folder cache bisa dibersihkan sistem kapan saja dan dibuat ulang saat dibutuhkan.
## Catatan
- Ada perubahan native + manifest: **butuh APK baru** (bukan OTA). APK lama yang menerima pembaruan JS menampilkan "Butuh APK terbaru" di folder Lokal (metode native tidak ada).
- Belum dijalankan: `npm run typecheck`/`build` (tanpa node_modules di sini; tsc parsial hanya mengeluh soal tipe React/Capacitor yang belum terpasang), kompilasi Java, dan uji di perangkat.



---

<!-- sumber: CHANGES-0.5.19.md -->

# 0.5.19 — Disc muncul setelah keyboard naik, Enter menutup keyboard
## Mini player ke disc saat keyboard naik
- Sebelumnya: begitu keyboard terdeteksi, kartu mini player "terbang" mengecil (220 ms) selagi keyboard masih naik, lalu diganti disc. Dua gerakan itu bertabrakan dan terasa patah.
- Sekarang: kartu langsung hilang tanpa animasi, lalu disc baru muncul setelah ukuran layar berhenti berubah (keyboard selesai naik; `src/utils/viewportSettle.ts`: tenang 140 ms, batas tunggu 800 ms). Disc masuk dengan animasi naik pelan (`bubble-rise`, 320 ms) lewat prop `rise` di `MiniBubble`.
- Tidak berubah: animasi saat keyboard menutup (disc membesar jadi kartu), animasi disc karena pilihan pengguna (seret/ketuk pegangan), dan animasi lainnya.
- Bila keyboard menutup sebelum disc sempat muncul, penantian dibatalkan dan kartu kembali dengan animasi masuk bawaan.
## Enter menutup keyboard
- `src/hooks/useEnterClosesKeyboard.ts` (dipasang di `AppShell`): Enter di kolom isian satu baris (cari, tempel tautan, ganti nama, dst.) menutup keyboard setelah penangan Enter kolom itu selesai. `<textarea>` dikecualikan.
## Catatan
- Hanya JS (OTA). Belum diuji di perangkat; penunggu ukuran layar sudah diuji terpisah di Node (4 skenario). Waktu tunggu 140 ms / 800 ms bisa disetel di `viewportSettle.ts` bila disc masih terasa terlalu cepat atau lambat di HP-mu.



---

<!-- sumber: CHANGES-0.5.18.md -->

# 0.5.18 — Pilihan manual tersimpan, cek audio saat buka playlist, tombol data terbaru
## 1. Pilihan Cari manual disimpan per lagu
- Baru `src/plugins/manualPins.ts`: pilihan hasil Cari manual disimpan per lagu (kunci judul + artis playlist, huruf kecil) di `mv:manualPins:v1` (maks. 500; ikut Cadangan karena awalan `mv:`).
- `resolveViaPluginsDetailed` (`plugins/registry.ts`) mencoba pilihan tersimpan lebih dulu untuk putar dan unduh. Bila gagal diambil (sinyal lemah, video dihapus) tetap lanjut ke pencarian otomatis; pilihannya tidak dibuang. Pilihan ulang menimpa yang lama.
- `downloadWithPick` menyimpan pilihan dari Cari manual di Unduhan.
- `warmResolve` melewati lagu yang punya pilihan manual (hasil pencarian otomatisnya tidak dipakai).
## 2. Cek ketersediaan audio saat playlist dimuat
- Baru `src/hooks/useTrackAvailability.ts` + `src/components/playlist/AvailabilityPanel.tsx`, dipasang di `PlaylistView` (bukan untuk hasil cari lagu satuan).
- Tiap lagu dicari di YouTube Music/YouTube dengan aturan skor yang sama seperti saat diputar, tanpa mengambil stream (opsi baru `searchOnly`). 2 lagu paralel, jeda 250 ms, tertunda saat offline.
- Lagu yang sudah terunduh atau punya pilihan manual langsung dianggap ada. Hasil "ada" disimpan 12 jam (`mv:availability:v1`) supaya buka ulang playlist tidak mencari lagi.
- Panel menampilkan progres, ringkasan, daftar lagu yang tidak ditemukan dengan tombol Cari manual, dan Cek ulang. Cari manual memakai `ManualSearchSheet` yang sama dengan Unduhan (prop baru `track`); pilihan disimpan tanpa mengunduh.
- Ini perkiraan: audio yang ditemukan tetap diperiksa lagi (durasi file, bukan cuplikan) saat diputar atau diunduh.
## 3. Tombol "Muat data terbaru"
- Di halaman Playlist saya (`MyPlaylistPage`) untuk playlist yang berasal dari Spotify: ambil ulang dari Spotify dan tambahkan lagu baru, tanpa mengunduh (web dan APK). Tombol "Unduh yang baru" (APK) tetap ada.
- Hanya menambah lagu baru; lagu yang kamu hapus dari playlist ikut masuk lagi bila masih ada di Spotify. Judul/sampul lagu lama tidak diperbarui. Playlist buatan sendiri (tanpa sumber Spotify) tidak punya tombol ini.
## Catatan
- Hanya JS (OTA); tidak ada plugin native baru.
- Belum dijalankan: `npm run typecheck`/`build` (tanpa node_modules di sini; hanya tsc parsial, sisa galatnya karena tipe React tidak terpasang) dan uji di perangkat. Penyimpanan pilihan manual sudah diuji terpisah di Node.



---

<!-- sumber: CHANGES-0.5.17.md -->

# 0.5.17 — Judul dengan angka 2 (kata ulang) tidak lagi ditolak
- Akar masalah: lagu \"GUB3RNUR - Mati Matian\" ketemu di pencarian sebagai \"Mati2an\", tetapi `scoreCandidate` menilai kedua judul tidak punya kata yang sama (skor judul 0), sehingga gerbang judul membatasi skor ke 0,45 dan unduhan ditolak. Di StreamBeats lagu yang sama ketemu.
- Perbaikan: `expandReduplication` di `src/utils/matchTrack.ts` membaca angka 2 yang diapit huruf sebagai pengulangan kata (\"Mati2an\" = \"Matimatian\"). Dipakai di `tokens` dan `compact`, jadi `sameSpelling` dan skor judul ikut benar. \"U2\", \"2Pac\", \"Blink 182\" tidak berubah.
- Hanya JS (OTA).
- Belum diuji di perangkat: hanya skor pencocokan yang dicek terpisah di Node. Lagu lain di tangkapan layar (Suzume, Yumetourou, CLBK, U&I) sudah lolos skor dengan data perkiraan; jika masih ditolak, kirim pesan galat di daftar Unduhan.



---

<!-- sumber: CHANGES-0.5.16.md -->

# 0.5.16 — Saran dan ulasan di situs web
- Baru: bagian "Saran dan ulasan" di landing page (`src/site/FeedbackSection.tsx`, anchor `#masukan`, tautan "Masukan" di header). Pilih jenis (Saran / Ulasan / Laporan bug), bintang 1–5 untuk ulasan, pesan (maks. 1000 karakter), nama dan versi/perangkat opsional. Ada validasi dan pesan galat.
- Cara kirim: tanpa server sendiri. Jika `VITE_CONTACT_EMAIL` diisi, tombol membuka email yang sudah terisi; jika kosong, membuka GitHub Issue baru yang sudah terisi (label enhancement/review/bug) di `REPO_URL`. Pengguna menekan kirim sendiri di tujuan itu.
- Teks Kebijakan Privasi bagian 7 (Situs web) diperbarui agar cocok dengan perilaku formulir.
- Hanya situs web; APK tidak berubah (tidak perlu APK baru atau OTA).
- Belum dijalankan: `npm run typecheck` / `npm run build` (node_modules tidak ada di lingkungan ini). Jalankan sebelum deploy.



---

<!-- sumber: CHANGES-0.5.15.md -->

# 0.5.15 — Tombol tempel (clipboard) berfungsi di APK
- Akar masalah: `navigator.clipboard.readText()` ditolak WebView Android tanpa dialog izin, jadi tombol tempel selalu menampilkan "Tidak bisa membaca clipboard".
- Baru: `src/native/clipboard.ts` memakai plugin native `@capacitor/clipboard` di APK (API web tetap dipakai di peramban). Dipakai tombol tempel di Beranda dan "Salin tautan" di menu lagu (yang punya masalah sama).
- Pesan galat diganti: bila tetap gagal, kolom difokuskan dan pengguna diarahkan menekan lama lalu memilih Tempel.
- PERLU APK BARU: menambah plugin native (`@capacitor/clipboard`). Jalankan `npm install` lalu `npm run android:sync`; paket OTA saja tidak cukup.



---

<!-- sumber: CHANGES-0.5.14.md -->

# 0.5.14 — Web jadi halaman unduh APK; Kebijakan Privasi dan Ketentuan Layanan
- Web tidak lagi punya pemutar. `/` kini landing untuk memasang APK (hero, fitur, platform Android/Windows/iOS, cara pasang, tanya jawab). Windows dan iOS ditandai "Menyusul".
- Alamat app lama di web (`/search`, `/library`, `/settings`, `/my/:id`, dst.) dialihkan ke `/` (client: `SiteApp`, server: `vercel.json` redirects). Kode pemutar tidak ikut dimuat di web (`main.tsx` memakai import dinamis: APK -> `App`, peramban -> `site/SiteApp`).
- Baru: Kebijakan Privasi dan Ketentuan Layanan. Satu sumber isi (`src/legal/content.ts`), tampil di web (`/privacy`, `/terms`) dan di APK (Pengaturan > Tentang > Kebijakan Privasi / Ketentuan Layanan, rute `/settings/privacy` dan `/settings/terms`).
- Dihapus: banner `ApkPromo` (web tidak lagi memuat AppShell) dan `APK_ONLY_FEATURES`.
- `config/apk.ts`: bila `VITE_GITHUB_REPO` kosong, memakai repo rilis bawaan yang sama dengan workflow (`zaxeonking/musicverse-releases`), jadi tombol unduh tidak pernah mati.
- Baru (opsional): `VITE_CONTACT_EMAIL` untuk email kontak di dokumen hukum; kosong = tautan Issues GitHub.
- Hanya JS (OTA). Tidak ada perubahan native.
- Saat isi dokumen hukum berubah, perbarui `LEGAL_UPDATED` di `src/config/site.ts`.



---

<!-- sumber: CHANGES-0.5.13.md -->

# 0.5.13 — Lagu dengan judul beda aksara ditemukan lewat artis, bukan cuma durasi
- Akar masalah: judul Spotify berhuruf Latin ("Pure Pure Heart") vs YouTube Music berhuruf Jepang ("ぴゅあぴゅあはーと") tidak bisa dibandingkan, jadi hanya durasi yang menentukan, dengan toleransi 1,5 dtk. Master Spotify dan YouTube Music sering beda beberapa detik, sehingga lagu yang benar ditolak sementara lagu lain berdurasi pas (kebetulan) lolos.
- `scoreCandidate`: judul beda aksara + artis cocok -> toleransi durasi dilonggarkan sampai 6 dtk (`gapDurationFit`). Artis tidak cocok tetap kena gerbang artis dari 0.5.12.
- `registry`: pada kasus itu pemeriksaan durasi file audio juga memakai toleransi 6 dtk (hanya pemutaran; unduhan tetap ketat). Hanya 2 hasil teratas pencarian yang dipercaya.
- Pencarian: varian artis tanpa tanda hubung ("HO - KAGO TEA TIME" -> "HOKAGO TEA TIME") dicoba lebih dulu.
- Hanya JS (OTA).



---

<!-- sumber: CHANGES-0.5.12.md -->

# 0.5.12 — Lagu dengan artis yang jelas beda tidak lagi lolos
- Gerbang artis di `scoreCandidate`: bila artis hasil sama sekali tidak cocok (skor 0, aksara sama sehingga bisa dibandingkan), skor dibatasi 0,45 (di bawah `ACCEPT_SCORE`). Judul dan durasi yang mirip tidak lagi menutupi artis yang salah (mis. "Pure Heart — Nymith" tidak lagi diterima untuk "Ho - Kago Tea Time - Pure Pure Heart").
- Pengecualian: judul persis sama (ejaan hampir identik) tetap lolos, karena channel label/uploader sering mengisi field artis dengan nama lain.
- `artistScore`: nama artis yang muncul di judul hasil ("Artis - Judul") kini dihitung cocok.
- `titleScore`: kata berulang dihitung per kemunculan ("Pure Pure Heart" vs "Pure Heart" = 2 dari 3 kata, bukan 3 dari 3).
- Hasil cache lama yang salah dinilai ulang dan dibuang otomatis.
- Hanya JS (OTA).



---

<!-- sumber: CHANGES-0.5.11.md -->

# 0.5.11 — Artis yang sama diutamakan walau aksaranya beda
- Nama lain dari katalog iTunes kini juga membawa penulisan lain ARTIS (mis. "RADWIMPS" = "ラッドウィンプス"), termasuk saat judulnya sama.
- `artistVerified`: artis hasil dianggap sama bila cocok dengan artis di playlist ATAU salah satu penulisan lain itu.
- Peringkat kandidat: artis yang terverifikasi sama mendapat +0,2, jadi lagu dari artis lain tidak menang atas lagu dengan artis yang sama
  (judul+artis beda aksara yang artisnya terverifikasi lewat nama lain juga tidak lagi kena penalti "tak bisa dibandingkan").
- Hanya JS (OTA). Termasuk 0.5.7 - 0.5.10.



---

<!-- sumber: CHANGES-0.5.10.md -->

# 0.5.10 — Judul dicek lintas bahasa (arti sama)

Judul lagu yang sama sering berbeda per bahasa: Spotify "Yuzutsu", YouTube Music "夕星-ゆうづつ-". Kini aplikasi mencari NAMA LAIN lagu itu
dan memakainya untuk pencarian DAN penilaian.
- Baru `src/services/titleAliases.ts`: mencari di katalog iTunes (negara us, jp, kr) dengan judul+artis. Nama lain hanya diterima bila
  durasinya sama (<= 2,5 dtk) dan artisnya cocok (atau beda aksara), supaya lagu lain tidak ikut. Dicari paralel dengan pencarian pertama
  (ditunggu maks. 1,5 dtk); gagal / lambat = diabaikan. Hasil di-cache selama sesi.
- Penilaian (`scoreWithAliases`): judul hasil cukup cocok dengan judul asli ATAU salah satu nama lain; artis ikut sesuai nama lain itu.
  Gerbang judul 0.5.9 tetap berlaku untuk semuanya.
- Pencarian: bila kata kunci biasa (judul+artis / judul / artis) tidak menghasilkan yang lolos, dicoba kata kunci dengan nama lain
  ("<judul Jepang> <artis>" dan "<judul Jepang>").
- Cache lagu lama dinilai ulang dengan nama lain yang sama.
- Hanya JS (OTA). Butuh internet ke itunes.apple.com; bila tidak terjangkau, perilaku sama seperti 0.5.9.



---

<!-- sumber: CHANGES-0.5.9.md -->

# 0.5.9 — Judul dinilai terpisah dari artis (gerbang judul)

Pencarian boleh memakai judul + artis, tetapi PENILAIAN hasil kini memeriksa judul sendiri dulu:
- Judul hasil harus cocok dengan judul lagu (tanpa awalan artis) — skor judul >= 0,4. Bila tidak, skor dibatasi 0,45 (di bawah ambang 0,7) berapa pun artis dan durasinya.
  Contoh: "Pure Pure Heart" tidak bisa lagi dijawab oleh "U&I" hanya karena artisnya (Houkago Teatime) dan durasinya sama.
- Artis tetap dinilai terpisah (menambah skor; ejaan mirip dikenali) dan tidak menutupi judul yang salah.
- Judul beda aksara (Latin vs Jepang dst.) tidak kena gerbang; ia dinilai lewat artis + durasi seperti di 0.5.7.
- Pencarian bertahap tetap: judul+artis -> judul saja -> artis saja; karena hasil yang salah kini ditolak, tahap berikutnya ikut dicoba.
- Hanya JS (OTA). Termasuk 0.5.7 dan 0.5.8.



---

<!-- sumber: CHANGES-0.5.8.md -->

# 0.5.8 — Lagu salah ambil (Pure Pure Heart memutar U&I)

Akar masalah (bug lama, bukan dari 0.5.7): saat menilai hasil pencarian YouTube Music, `resolveViaPluginsDetailed` mengisi
`spotifyUrl` tiap kandidat dengan tautan lagu yang diminta. `scoreCandidate` lalu menganggapnya "ID Spotify sama" dan memberi
bonus +0,25 ke SEMUA kandidat. Lagu lain berdurasi mirip (U&I 4:35 vs Pure Pure Heart 4:35): skor 0,5 + 0,25 = 0,75 >= 0,7 -> lolos.

- `spotifyUrl` kandidat pencarian kini kosong saat penilaian (bonus ID hanya berlaku bila sumbernya benar-benar membawa ID).
  Lagu yang judulnya tidak cocok DAN artisnya tidak cocok sekarang ditolak walau durasinya sama.
- Ejaan Latin yang mirip kini dikenali (judul/artis): "Ho - Kago Tea Time" ~ "Houkago Teatime" (spasi/tanda baca dibuang, ou/oo->o, uu->u,
  kemiripan >= 85%). Tanpa ini kandidat yang benar bisa ikut ditolak setelah bonus liar dicabut.
- Hanya JS (bisa OTA). Termasuk 0.5.7 (judul+artis beda aksara).
- Hasil lama di cache (yang sudah salah) kini dinilai ulang saat dipakai dan dibuang bila tidak cocok, jadi lagu itu dicari ulang otomatis.



---

<!-- sumber: CHANGES-0.5.7.md -->

# 0.5.7 — Audio lagu beda aksara tidak lagi dipilih "asal"

Kasus: judul di Spotify Latin/romaji ("Yuzutsu" / "RADWIMPS"), di YouTube Music aksara asli ("夕星-ゆうづつ-").
Penyebab di 0.5.6: bila judul DAN artis sama-sama beda aksara, tak ada teks yang bisa dicocokkan, jadi skor tinggal durasi
(0,92). Lagu apa pun dengan durasi mirip (<=1,5 dtk) lolos, walau bukan lagunya.

Perbaikan (JS saja, bisa OTA):
- `scoreCandidate`: judul+artis sama-sama beda aksara -> skor x0,8 (hanya durasi yang nyaris sempurna yang masih lolos; selisih 1,5-5 dtk kini ditolak).
- `resolveViaPluginsDetailed`: untuk kasus itu hanya 3 hasil teratas pencarian YouTube Music yang dipercaya (urutan relevansi YouTube paham alih aksara); hasil di bawahnya diabaikan.
- Judul NON-Latin vs Latin dengan artis yang cocok tetap berjalan seperti sebelumnya (artis + durasi pas).
Catatan: belum diuji dengan data YouTube sungguhan di lingkungan ini; bila masih salah ambil, kirim log "[MusicVerse] Plugin ytmusic: ... skor ...".



---

<!-- sumber: CHANGES-0.5.6.md -->

# 0.5.6 — Pemutaran latar belakang lebih stabil

- Minta izin mematikan "Jeda aktivitas aplikasi jika tidak digunakan" (Android 11+), setelah izin penghemat baterai. Ditanya saat app dibuka, maksimal 3 kali per jenis.
- Notifikasi: setelah native pindah lagu sendiri, bilah progres dan tombol Sebelumnya/Berikutnya tidak lagi nyangkut di status "memuat" (dilepas dari keadaan pemutar, bukan hanya dari satu event).
- Tombol notifikasi Berikutnya/Sebelumnya dikerjakan native bila JS tidak merespons.
- Lagu yang gagal diputar saat JS beku dilompati, bukan membuat musik mati.
- Antrean yang diserahkan ke native diperpanjang dari 5 menjadi 12 lagu.
- Perubahan native: butuh APK baru (OTA tidak cukup).
- Animasi navbar bawah dioptimalkan: lensa tab aktif kini bergeser lewat `transform` (GPU) bukan `left`, cahaya `blur` diganti gradien statis, blur kaca dikurangi 24px → 16px, dan lapisan bar diberi `will-change`.
- Sumber audio lebih akurat: klien stream `ANDROID_VR` ditambahkan sebagai cadangan YouTube Music (urutan: VISIONOS → ANDROID_VR → ANDROID → IOS). Pencocokan lagu kini mengurutkan versi yang sama dengan playlist di atas versi live/remix/cover; versi lain tetap diterima bila hanya itu yang ada. Perubahan ini hanya JS (bisa lewat OTA).
- Lagu beda aksara (judul/artis Spotify berhuruf Latin/romaji, di YouTube Music berhuruf Jepang/Korea/Mandarin/dst., atau sebaliknya) tidak lagi ditolak hanya karena kata-katanya tak cocok. Skor judul/artis dianggap "tidak bisa dibandingkan" dan durasi file yang menentukan; durasi harus pas (selisih sedang tetap ditolak). Hanya JS (OTA).
- Pengaturan > Pembaruan (baru): tombol "Cek pembaruan" manual (tanpa menunggu jeda 30 menit), menampilkan versi terpasang, catatan rilis, lalu Perbarui/Pasang langsung dari halaman itu. Hanya JS (OTA); butuh `VITE_GITHUB_REPO` terisi seperti banner pembaruan.
- Mini player: glow berwarna sampul lagu di belakang kartu (warna dominan dibaca dari gambar, cadangan: warna gradien sampul bawaan lalu warna aksen). Berdenyut tiap ganti lagu lalu redup menetap, lebih redup saat jeda. Hanya di belakang kartu mini player, condong ke atas/samping sehingga tidak menyentuh navbar atau layar lain. Ikut bergerak saat kartu diseret. Hanya JS (OTA).
- Pencarian audio: versi instrumental/karaoke tidak pernah dipilih bila lagu di playlist bukan versi itu (juga dibuang dari cache). Pencarian bertahap tanpa menambah kata apa pun pada judul: judul + artis, lalu judul saja, lalu artis saja (berhenti di yang pertama menghasilkan lagu lolos). Nama artis yang memuat tanda hubung ("Ho - Kago Tea Time - Pure Pure Heart") kini dibersihkan dari judul pencarian dan pencocokan. Judul yang ditampilkan tidak berubah. Hanya JS (OTA).



---

<!-- sumber: CHANGES-0.5.4.md -->

# MusicVerse v0.5.4

## Perbaikan
- Memperbaiki pergantian lagu otomatis saat aplikasi berada di background.
- Metadata notifikasi (judul, artis, album, durasi, dan sampul) ikut diperbarui saat native mengambil alih pergantian lagu.
- Mempertahankan sisa antrean setelah crossfade agar pemutaran tidak berhenti setelah lagu standby pertama.
- Menggunakan audio standby yang sudah siap tanpa memuat ulang URL lagu.
- Pemutar penuh kini pas satu layar dan tidak bisa di-scroll naik/turun; ukuran sampul menyesuaikan ruang yang tersisa.
- Menghapus teks deskripsi di halaman Playlist, daftar playlist, "Baru diputar", dan header playlist.
- Hasil cari lagu satuan kini menampilkan label "Sudah ada di <playlist>" jika lagunya sudah ada di playlist buatanmu (termasuk Lagu Disukai).



---

<!-- sumber: CHANGES-0.5.3.md -->

# 0.5.3 — Penyederhanaan tampilan publik

- Menghapus menu/log pemutaran dari Pengaturan karena hanya untuk kebutuhan internal.
- Mempertahankan pengaturan pemutaran yang digunakan pengguna.
- Pesan error menggunakan istilah umum “server” tanpa menyebut layanan atau pihak lain.
- Versi aplikasi dinaikkan menjadi 0.5.3.



---

<!-- sumber: CHANGES-0.5.2.md -->

# 0.5.2 — Sampah APK pembaruan dibersihkan otomatis

- Tiap aplikasi dibuka, berkas `musicverse-update.apk` beserta entri unduhan sistem dihapus bila versinya sudah terpasang (atau berkas rusak/sisa). Unduhan yang sedang berjalan dan pembaruan yang belum dipasang tidak disentuh.
- Perubahan native: butuh APK baru (OTA tidak cukup).
- `apk.yml`: push ke `main`/`master` selalu membuild APK. Bila release `v<versi>` sudah ada, APK lama di tag yang sama diganti dengan APK baru (tag/rilis tidak dibuat ulang). Opsi `force` dihapus. Naikkan `version` hanya bila ingin tag baru.



---

<!-- sumber: CHANGES-0.5.1.md -->

# 0.5.1

- Release APK otomatis dibuat tanpa catatan/keterangan (judul dan APK saja).
- Nav bawah: penanda tab aktif jadi kotak melengkung ringkas di sekitar ikon.
- Pemutar penuh (APK): tombol lirik di tengah baris bawah.



---

<!-- sumber: CHANGES-0.5.0.md -->

# 0.5.0 — Rilis APK otomatis dari versi package.json

- `apk.yml`: tiap push ke `main`/`master` membaca `version` di `package.json`. Bila release `v<versi>` belum ada di repo rilis, APK dibuild, ditandatangani, dan dirilis dengan tag itu. Bila sudah ada, build dilewati. Tidak perlu lagi `git tag` manual.
- `apk.yml` dan `ota.yml` memakai secret `RELEASES_TOKEN` (wajib) untuk menulis ke repo rilis.
- Run manual `apk.yml` punya opsi `force` untuk membuild ulang dan menimpa APK versi yang sama.

Rilis baru: naikkan `version` di `package.json`, buat `CHANGES-<versi>.md`, lalu push.



---

<!-- sumber: CHANGES-0.4.34.md -->

# 0.4.34 — Pembaruan tampilan otomatis (OTA), tanpa install APK baru

Cukup push source ke GitHub. Perubahan tampilan sampai ke HP sendiri.

## Alur
1. Push ke `main`/`master` -> workflow `Publish OTA` build web, zip `dist`, unggah `bundle.zip` + `ota.json` ke Release `ota`.
2. Aplikasi (`src/native/liveUpdate.ts`) cek `ota.json`; bila lebih baru dan cocok dengan APK-nya, unduh lalu pakai saat dibuka ulang.

## Pengaman
- Tidak pernah mundur: bandingkan `builtAt` paket dengan `__BUILD_TIME__` JS yang sedang berjalan.
- Hanya bila sidik jari native sama (`scripts/native-hash.mjs`, ditanam APK lewat `res/values/mv_native.xml`, dibaca plugin `nativeHash`).
  Ada perubahan native = lewati OTA; APK baru tetap lewat kenaikan `version` di package.json.
- `notifyAppReady` dipanggil 2,5 dtk setelah UI tampil; bila paket baru macet sebelum itu, plugin mundur sendiri (batas 15 dtk).
- Release `ota` pre-release dan `--latest=false`, jadi cek "rilis terbaru" APK tidak terganggu. `statsUrl` dikosongkan: tidak ada laporan ke cloud Capgo.

## Berkas
Baru: `.github/workflows/ota.yml`, `scripts/make-ota.mjs`, `scripts/native-hash.mjs`, `src/native/liveUpdate.ts`.
Diubah: `package.json` (+`@capgo/capacitor-updater`), `capacitor.config.ts`, `vite.config.ts` (`__BUILD_TIME__`, `mv-build.json`),
`scripts/setup-android.mjs`, `MusicVerseNativePlugin.java` (+`nativeHash`), `musicVerseNative.ts`, `main.tsx`, `vite-env.d.ts`, README.

## Perlu APK baru SEKALI
Pluginnya native, jadi build APK 0.4.34 (tag `v0.4.34`). Sesudah itu perubahan web ikut otomatis.

## Belum diuji (jujur)
Tidak ada jaringan di lingkungan saya: `npm install` plugin, build Gradle, dan alur unduh-pakai di HP BELUM dijalankan. API plugin
(`download`/`next`/`list`/`current`/`delete`/`notifyAppReady`) ditulis dari dokumentasi `@capgo/capacitor-updater` v8 dan diketik
longgar agar build tidak pecah; bila versi ^8 tidak ada di npm, ubah versinya di package.json. Cek log `[MusicVerse] Pembaruan tampilan`.



---

<!-- sumber: CHANGES-0.4.33.md -->

# 0.4.33 — Lagu Disukai benar-benar di paling atas (halaman Playlist/Koleksi)
Penyebab: halaman Playlist (PlaylistsSection) mengurutkan ulang semua kartu menurut "Terbaru"/"Nama", mengabaikan urutan tetap di context.
- Urutan kini tetap di semua mode (Terbaru / Nama A-Z, kisi / daftar): Lagu Disukai -> disematkan -> sisanya.
- Kartu: ikon hati (bawaan) / pin (disematkan) di depan nama; subtitle "Bawaan · N lagu".
- Menu tahan-lama kartu: "Sematkan di atas" / "Lepas sematan" (tidak muncul untuk Lagu Disukai).



---

<!-- sumber: CHANGES-0.4.32.md -->

# 0.4.32 — Sistem pin playlist
- Urutan Playlist saya kini TETAP: (1) "Lagu Disukai" — bawaan, tak bisa digeser/dihapus/diganti nama/disematkan; (2) playlist yang DISEMATKAN; (3) sisanya menurut perubahan terbaru.
- Tombol Pin/PinOff di halaman playlist (aksen hijau saat disematkan); ikon pin kecil di kartu playlist.
- Menyematkan tidak mengubah `updatedAt`. Data: `MyPlaylist.pinned?`, `setPinnedIn`, `setPinned` di context. Playlist lama tidak berubah.



---

<!-- sumber: CHANGES-0.4.31.md -->

# 0.4.31 — Playlist bawaan "Lagu Disukai" + tombol hati
- Playlist bawaan `my-liked` ("Lagu Disukai") selalu ada, selalu paling atas di Playlist saya, tidak bisa dihapus / diganti namanya (tombol disembunyikan; ditolak juga di lapisan data).
- Ikon hati di pemutar penuh = suka / batal suka (ikon terisi hijau bila disukai, toast konfirmasi). Lagu baru disukai masuk paling atas.
- Menu lagu "Simpan ke playlist" tetap bisa dipakai untuk playlist biasa (dan Lagu Disukai ikut tampil di daftar).
- Data: `myPlaylistStorage.ts` (LIKED_ID, ensureLiked, toggleLikeIn, alasan gagal `protected`), `MyPlaylistsContext` (isLiked, toggleLike), UI: FullPlayer, MyPlaylistPage, MyPlaylistsSection.
- Data lama (playlist buatan sendiri) tidak diubah.



---

<!-- sumber: CHANGES-0.4.30.md -->

# 0.4.30 — Nav bar: gelap sesuai tema + glow aksen
- Bar kaca kini GELAP (latar #161616 translusen, blur 24px, brightness 0.55, saturasi 120%): tidak lagi terang/kehijauan saat lewat tombol hijau.
- Tab aktif: kapsul kaca gelap + cahaya (glow) warna aksen tema (`accent`) di belakang ikon.



---

<!-- sumber: CHANGES-0.4.29.md -->

# 0.4.29 — UI pemutar penuh dirombak
- Header: turun · "Sedang diputar" + album/artis (2 baris) · menu lagu (⋮).
- Sampul besar membulat; judul + ikon hati (simpan ke playlist), artis huruf besar.
- Seek bar dengan waktu di atas bar.
- Baris 1: timer (ikon alarm) · sebelumnya · PUTAR besar bercahaya · berikutnya · acak.
- Baris 2: ulang · lirik | crossfade · buka di Spotify (tombol berbentuk ikon; sisa waktu timer/crossfade tampil kecil di bawah ikon).
- Bar "Berikutnya" menempel di bawah untuk membuka antrean.
- Semua fitur lama tetap ada (Simpan, Lirik, Crossfade, Timer, Antrean, Spotify, error, notice).
- File: FullPlayer, PlayerControls (size xl + leading/trailing), SeekBar (stacked), SleepTimerSheet/CrossfadeSheet (varian ikon).



---

<!-- sumber: CHANGES-0.4.28.md -->

# 0.4.28 — Nav bar kaca cair ala iOS 26
- Bar: kaca lebih bening (blur 26px + saturasi 210%) sehingga warna konten/cover di belakangnya menembus dan menyesuaikan.
- Tab aktif: kapsul kaca yang lebih tinggi & lebar dari bar (sedikit menonjol keluar), tepi berkilau, tinted warna aksen tema.
- Teks/ikon aktif memakai accent-soft, tidak aktif putih ~85%.
- Hanya `src/components/layout/BottomNav.tsx`.



---

<!-- sumber: CHANGES-0.4.27.md -->

# 0.4.27 — bottom nav bergaya "kaca cair" (liquid glass)

## Apa
Bottom nav (mobile) dibuat seperti referensi: pil melayang, latar kaca tembus pandang, dan tab aktif ditandai lensa kaca yang meluncur.

- **Bentuk**: pil penuh (`rounded-full`) yang melayang dengan jarak dari tepi layar (aman terhadap safe area), tinggi 4rem, lebar maks `max-w-md`.
- **Kaca**: `bg-raised/55` + `backdrop-blur-2xl` + `backdrop-saturate-150`, tepi 1px putih transparan, kilau di tepi atas, bayangan lembut.
  Warna kaca mengikuti konten yang lewat di belakangnya. Tanpa dukungan `backdrop-filter`, jatuh ke `bg-raised/90` (tetap terbaca).
- **Warna menyesuaikan tema**: tab aktif memakai `accent` (hijau), permukaan memakai token `raised`, teks tidak aktif `ink/70`. Mengganti token di
  `tailwind.config.js` mengubah nav ikut berubah; tidak ada warna biru iOS yang di-hardcode.
- **Lensa aktif**: satu elemen kaca beraksen (`accent` 22%, rim terang, kilau atas) di belakang tab aktif yang meluncur antar tab dengan pantulan
  pegas 500 ms; ikon aktif sedikit membesar; tekan = mengecil sedikit. Di halaman di luar tab (Pengaturan/Riwayat) lensa memudar. Letaknya
  dihitung dari alamat (`utils/navActive.ts`, aturan sama dengan NavLink).
- **Keyboard terbuka** (dari 0.4.26): bar turun keluar layar sambil memudar, naik lagi saat keyboard hilang.

## Perubahan tata letak (penting)
Agar kaca benar-benar menampilkan konten di belakangnya, nav tidak lagi mengambil ruang sendiri di kolom flex. Ia pembungkus setinggi 0 dengan bar
diposisikan absolut di dasar (pola yang sama dengan dock mini player), jadi `<main>` meluas sampai tepi bawah dan konten lewat di bawah kaca.
- Ruang yang dipesan bar = variabel CSS `--dock-offset` (`4.5rem + safe-area-bawah`) yang diatur di akar `AppShell`. Nilainya `0` di layar lebar
  (tidak ada nav bawah) dan saat keyboard terbuka.
- Padding bawah konten (`AppShell`) kini `rem` lama + `--dock-offset`, jadi item terakhir tidak tertutup nav.
- Mini player memakai `margin-bottom = --dock-offset + 1rem` (dengan transisi 300 ms), jadi tetap duduk tepat di atas nav dan turun halus saat
  keyboard terbuka.

## Diuji / belum
- Node (6 kasus, lulus): aturan tab aktif (`/`, tab biasa, rute turunan, awalan mirip `/libraryx`, halaman di luar tab, tanpa tab Unduhan di web, daftar kosong).
- `tsc` dibanding 0.4.25 asli: tidak ada galat nyata baru (selisih hanya pesan lingkungan karena paket React tidak terpasang).
- Pratinjau visual: CSS bar diterjemahkan manual ke HTML dan dirender di Chromium (3 keadaan: tab Beranda, tab Playlist, keyboard terbuka) untuk
  memeriksa kaca, lensa, dan geseran. Tailwind tidak terpasang di lingkungan ini, jadi class Tailwind itu sendiri BELUM dikompilasi: nilai
  arbitrer seperti `[--dock-offset:calc(4.5rem_+_env(...))]`, `data-[keyboard=open]:`, `supports-[backdrop-filter]:` perlu dipastikan lewat build asli.
- BELUM dijalankan di perangkat. Yang perlu dilihat di HP: (1) apakah blur kaca terasa mulus saat scroll (WebView lemah bisa patah-patah; bila ya,
  turunkan `backdrop-blur-2xl` ke `xl`), (2) padding bawah di semua halaman (item terakhir tidak tertutup nav), (3) posisi mini player/gelembung
  di atas nav, (4) transisi saat keyboard buka-tutup, (5) toast yang dipasang pada offset tetap (`bottom-44` di PlaylistView, `9.5rem+` di
  TrackMenuContext) masih terlihat di atas kartu mini player.

Hanya TypeScript/CSS; build ulang APK seperti biasa.



---

<!-- sumber: CHANGES-0.4.26.md -->

# 0.4.26 — saat keyboard terbuka: nav bar tidak ikut naik, mini player jadi piringan (beranimasi)

## Masalah (dari screenshot)
Keyboard layar membuat WebView mengecil, dan karena mini player + bottom nav adalah anak flex paling bawah di `AppShell`, keduanya ikut
naik dan menumpuk di atas keyboard (menutupi hampir separuh area yang tersisa).

## Perubahan
- **Bottom nav** (`BottomNav.tsx`): tidak ikut naik. Saat keyboard terbuka tingginya dianimasikan menutup sampai 0 (grid-rows `1fr` -> `0fr`
  + fade, 200 ms) dan membuka lagi saat keyboard hilang; tidak bisa difokus/ditekan selagi tersembunyi.
- **Mini player** (`MiniPlayer.tsx`): saat keyboard terbuka kartu otomatis mengecil jadi **piringan** (`MiniBubble`) dengan animasi yang sama
  seperti saat diperkecil manual (kartu terbang ke pojok sisi gelembung, lalu piringan muncul). Saat keyboard hilang piringan membesar lagi jadi
  kartu (animasi `grow-left/right`). Ini SEMENTARA dan tidak disimpan: pilihan pengguna di `useMiniPlayerMode` tidak berubah, jadi kalau
  pengguna memang memilih piringan, ia tetap piringan setelah keyboard hilang.
  - Mengetuk piringan saat keyboard terbuka: keyboard ditutup dulu, kartu membesar sesudahnya (bukan kartu muncul di atas keyboard).
  - Keyboard menutup di tengah animasi mengecil: kartu kembali ke tempatnya dengan animasi, tidak sempat jadi piringan.
- **AppShell**: padding konten mengikuti ukuran piringan selama keyboard terbuka.
- Baru `utils/keyboardState.ts` (logika murni) + `hooks/useKeyboardOpen.ts` (satu pendengar DOM dibagi ke semua pemakai).

## Cara mendeteksi keyboard (tanpa plugin native)
Keyboard dianggap terbuka bila SEMUA benar: tinggi layar turun >= max(140 px, 18% tinggi baseline) dari tinggi terbesar yang pernah terlihat,
ada `<input>` teks / `<textarea>` / contenteditable yang fokus, perangkat layar sentuh, dan tidak sedang pinch-zoom. Menutup dengan histeresis
(pulih sampai turun < setengah ambang). Rotasi (lebar berubah) mengukur ulang baseline.
Bergantung pada perilaku WebView yang sekarang (mengecil saat keyboard muncul, seperti terlihat di screenshot). Bila suatu saat memakai
mode yang tidak mengecilkan WebView (`adjustPan` / edge-to-edge), tinggi tidak berubah dan deteksi tidak aktif: perilaku kembali seperti 0.4.25.

## Diuji / belum
- Diuji di Node (13 kasus, lulus): fungsi murni (buka, tanpa fokus, turun kecil/toolbar, histeresis, rotasi, pinch-zoom, desktop, fokus lepas
  duluan, baseline ikut naik) dan store dengan DOM palsu (resize+fokus, fokus menyusul, checkbox diabaikan, pendengar dilepas).
- `tsc` dibanding 0.4.25 asli: tidak ada galat nyata baru (selisih hanya pesan lingkungan karena paket React tidak terpasang: `Cannot find module
  'react'` untuk file hook baru dan tambahan JSX implicit-any di BottomNav).
- BELUM dijalankan/dirender di perangkat. Yang perlu dicoba di HP: (1) fokus kolom cari di Beranda: nav menutup mulus dan kartu terbang jadi
  piringan, (2) tutup keyboard (tombol back/ketuk luar): nav membuka dan piringan membesar jadi kartu, (3) ketuk piringan saat mengetik,
  (4) putar balik keyboard cepat buka-tutup, (5) rotasi layar saat keyboard terbuka, (6) pilihan "piringan" yang disimpan tetap piringan.
  Waktu animasi bergantung kapan Android mengubah ukuran WebView relatif terhadap animasi keyboard; bila terasa terlambat, angka 200 ms dan
  jeda ukur ulang (120/350 ms) di `useKeyboardOpen.ts` bisa disetel.

Hanya TypeScript; build ulang APK seperti biasa.



---

<!-- sumber: CHANGES-0.4.25.md -->

# 0.4.25 — lagu mengulang dari awal setelah digeser: penyebab ketemu di log

## Bukti (log pemutaran dari perangkat)
```
17:59:06.745 seek 268.0 / 278.0
17:59:14.662 fail clip_only pos=0.0 dur=266.2      <- posisi 0.0 dan durasi 266.2, padahal lagu yang diputar 278.0
17:59:17.091 mulai #1 "moumoon - Hello, shooting-star" retry=false resumeAt=-
```
Yang bertanya "lagu ini klip?" sudah menjawab untuk durasi pertama (278.0, cocok). Tetapi pemeriksa klip (`clipGuardRef`) tidak pernah
dimatikan: ia tetap menunggu SETIAP event `durationchange` / `loadedmetadata` sepanjang lagu. Saat lagu hampir habis, mesin native
pindah ke lagu cadangan (crossfade / gapless) dan melapor durasi lagu BERIKUTNYA (266.2) di posisi 0.0. Durasi itu dibandingkan dengan
durasi lagu YANG LAMA (278, toleransi cuma 1,5 dtk), dianggap "klip", lalu lagu lama dihentikan dan dimuat ulang dari awal dengan sumber
lain (atau berakhir `fail clip_only` lalu diputar lagi). Dari luar tampak seperti "lagu yang baru diputar diulang".

## Perbaikan
- `createClipGuard` (`utils/clipDetect.ts`): memeriksa SEKALI, pada durasi pertama yang terbaca untuk lagu itu. Event durasi sesudahnya
  tidak lagi membuat lagu dianggap klip. Klip sungguhan (mis. 30 dtk untuk lagu 278 dtk) tetap terdeteksi pada durasi pertamanya.
- `useAudioPlayerController` memakainya untuk lagu hasil unduhan (offline) maupun streaming. Isi penanganan klip tidak diubah.

## Diuji / belum
- Diuji di Node (4 kasus, lulus): durasi lagu lain setelah pemeriksaan pertama diabaikan (kasus log), klip sungguhan tetap terdeteksi
  tepat sekali, lagu kedaluwarsa (stale) diabaikan, tanpa durasi acuan tidak dianggap klip.
- `tsc` dengan stub: tidak ada galat baru (satu galat `implicit any` yang lama justru hilang).
- BELUM dijalankan di perangkat. Jalur yang menjelaskan "hanya setelah digeser" (balapan antara event durasi dan `requestId++`
  saat pergantian native) disimpulkan dari log dan kode, belum dibuktikan satu per satu. Bila masih berulang: salin log lagi.

Hanya TypeScript; build ulang APK seperti biasa.



---

<!-- sumber: CHANGES-0.4.24.md -->

# 0.4.24 — lagu mengulang setelah digeser (seek) ke dekat akhir

## Laporan
Menggeser posisi (menit) beberapa kali sampai dekat akhir lagu, lalu saat waktunya ganti lagu, lagu yang SAMA diputar lagi.

## Yang jujur
Penyebab pastinya **belum terkonfirmasi** (tidak bisa dijalankan di perangkat dari sini; empat ronde "lagu berulang" sebelumnya
menutup jalur lain). Dari membaca kode ada beberapa jalur yang bisa memutar ulang lagu yang sama setelah seek di dekat ujung,
semuanya ditutup di sini, dan **log pemutaran baru** ditambahkan supaya kalau masih terjadi, sebabnya terbaca.

## Jalur yang ditutup
1. **Muat ulang dari posisi di ujung lagu = mulai dari awal (JS).** Bila jaringan putus saat menggeser ke dekat akhir, JS memuat
   ulang lagu dengan `resumeAt`; posisi yang < 3 dtk dari ujung dibuang sehingga lagu mulai dari 0:00. Sekarang muat ulang dengan
   posisi <= 12 dtk dari ujung dianggap lagu SELESAI -> lanjut ke lagu berikutnya (`startPlayback`, dan ambang `fail()` 5 -> 12 dtk).
2. **ExoPlayer berstatus ENDED hidup lagi karena `seekTo` (Java).** `engineSeek` yang datang terlambat (sesudah `ended`, saat JS
   memuat lagu berikutnya) membangunkan lagu lama dan memutarnya dari posisi itu. `engineSeek` kini diabaikan bila ENDED.
3. **Buka ulang di posisi 0 (Java).** Setelah galat saat seek / di ujung stream, ExoPlayer bisa melapor posisi 0; `reopenActive`
   dan `fallbackActive` membuka ulang di 0 = lagu mulai dari awal. Kini memakai posisi valid terakhir (`lastPosMs`, dari detak
   pemutar dan seek) bila yang dilaporkan jelas keliru (<= 0,5 dtk padahal sebelumnya > 5 dtk).
4. **Event `ended` ganda (JS).** Macet di ujung lagu bisa menghasilkan `ended` dari `handleStall` DAN dari ExoPlayer; yang kedua
   memindah lagu sekali lagi (lagu berikutnya dimuat dua kali / terlewati). `ended` kedua untuk lagu yang sama dalam 2,5 dtk dibuang.
5. **Menggeser ke ujung = ganti lagu (JS).** Menggeser sampai < 0,75 dtk dari akhir (mode ulang mati) langsung ke lagu berikutnya,
   tanpa menunggu ExoPlayer "selesai".

## Log pemutaran (Pengaturan > Pemutaran > Log pemutaran)
Mencatat 200 baris terakhir: `mulai #i`, `seek x / durasi`, `ended #i/n pos dur berikutnya`, `error mesin`, `fail`, `advanced`.
Cara pakai bila masih berulang: ulangi masalahnya, buka Pengaturan > Pemutaran, **Salin log**, tempel ke chat.

## Diuji / belum
`tsc` identik dengan 0.4.23 (satu-satunya selisih: lebih banyak elemen JSX yang dihitung karena tipe React tidak terpasang di sini).
Java belum dikompilasi (kurung kawat seimbang) dan belum diuji di perangkat. Perlu build ulang APK.



---

<!-- sumber: CHANGES-0.4.23.md -->

# 0.4.23 — Lagu berulang terus saat habis (mode ulang mati), ronde 3

Dua penyebab NYATA ditemukan dengan membaca kode (belum dijalankan di perangkat):

1. **Antrean habis diputar ulang otomatis.** `canRestartQueue` selalu true untuk antrean > 1 lagu: saat lagu terakhir selesai,
   `restartQueue` memutar antrean yang sama lagi secara acak dan menyalakan mode acak — terus-menerus, walau ulang = mati.
   Ini perilaku yang sengaja ditulis (README) tetapi tidak bisa dimatikan dan terasa seperti lagu mengulang.
   Sekarang mati: `AUTO_RESTART_QUEUE = false` di `utils/playerQueue.ts`. Antrean habis = berhenti (`ended`).
2. **Native masih punya jalur pindah-lagu sendiri saat JS hidup.** Di `PlaybackService.java`, saat lagu selesai dan lagu cadangan
   siap (`autoAdvance`), native crossfade ke cadangan walau JS juga memproses `ended`. Hasilnya lagu berikutnya diputar dua kali.
   0.4.21 hanya menutup jalur `chainAdvance`; jalur ini terlewat. Sekarang ditambah `!jsAlive()`: JS hidup = JS yang memindah lagu
   (pindah mulus tetap lewat crossfade JS di detik-detik terakhir).

Termasuk semua perbaikan 0.4.21 dan 0.4.22. Perlu build ulang APK (ada perubahan Java). Java belum dikompilasi di sini.

Bila MASIH berulang: kirim log yang memuat `[MusicVerse] lagu selesai #...` (menunjukkan ulang=..., berikutnya=...).



---

<!-- sumber: CHANGES-0.4.22.md -->

# 0.4.22 — Lagu berulang terus saat habis (ronde 2)

Kandidat penyebab baru: galat/macet di UJUNG lagu memicu "muat ulang lagu yang sama".
- JS `fail()`: galat network/timeout saat posisi >= durasi-5 dtk = lagu selesai -> lanjut ke lagu berikutnya (bukan muat ulang).
- Penghitung percobaan ulang tidak lagi direset oleh event `playing`; ada batas total per lagu (6x) sehingga tidak bisa berputar selamanya.
- Java `handleStall`: macet <4 dtk dari ujung = lagu selesai (rantai/`ended`), tidak membuka ulang sumber.
- Termasuk semua perbaikan 0.4.21. Java belum dikompilasi/diuji di perangkat.
Bila masih berulang: kirim logcat/console yang memuat `[MusicVerse]` (mis. "lagu selesai #..", "Audio putus", "Galat ... di ujung lagu").



---

<!-- sumber: CHANGES-0.4.21.md -->

# 0.4.21 — Fix lagu berulang terus (mode ulang mati)

Akar masalah ada di Java (rantai lagu native, `PlaybackService.java`), bukan di JS:

1. **Dua pengendali sekaligus.** Saat lagu selesai, native memindah lagu sendiri lewat `chainAdvance` walau JS masih hidup
   (layar menyala), padahal JS juga memproses `ended`. Dua-duanya berebut urutan lagu -> daftar usang -> lagu sama dimuat lagi.
   Sekarang native hanya mengambil alih bila JS beku (`!jsAlive()`); JS hidup = JS yang mengatur.
2. **Daftar rantai usang setelah pindah via lagu cadangan (crossfade/gapless).** Isinya lagu cadangan yang barusan diputar,
   jadi saat lagu itu selesai native memutarnya LAGI. Daftar kini dibuang saat pindah lewat cadangan.
3. **Pengaman loop di native.** Bila "lagu berikutnya" sama dengan lagu yang sedang diputar (`knownIndex`), daftar dibuang
   dan native tidak memutarnya lagi (jatuh ke `ended` -> JS lanjut).
4. **Pemulih gangguan** tidak lagi memutar ulang lagu dari awal bila lagu sudah selesai (`STATE_ENDED`).

Catatan: Java belum pernah dikompilasi/diuji di perangkat dari sisi saya. Bila masih berulang, kirim log
`[MusicVerse] lagu selesai #...` dari logcat.



---

<!-- sumber: CHANGES-0.4.20.md -->

# Patch untuk 0.4.19 — pengaman bila lagu tidak lanjut dan berulang terus (rantai native)

## Gejala
Lagu tidak pindah ke lagu berikutnya dan terus berulang, padahal mode ulang mati.

## Yang BISA dipastikan dari kode
- Alur `ended` (lagu selesai -> lagu berikutnya) di `useAudioPlayerController.ts` **identik** dengan 0.4.17: tidak ada perubahan di sana.
- Perubahan sejak 0.4.17 hanya penambahan rantai lagu native (0.4.18): daftar `setUpcoming` + event `advanced` berindeks.
- Di kode itu ada celah: event `advanced` dengan indeks yang SAMA dengan lagu aktif jatuh ke cabang "tak dikenal" (daftar yang
  diserahkan sudah diganti setelah lagu itu aktif) dan **diabaikan diam-diam**. Kalau native memutar ulang lagu yang sama lewat
  rantai, JS tidak pernah tahu, state tidak berubah, daftar tidak dikirim ulang, dan loop berlanjut selamanya.

## Yang TIDAK bisa dipastikan
Kenapa native mengulang lagu yang sama ada di sisi Java (`PlaybackService.java`, `MusicVerseNativePlugin.java`), dan folder `native/`
tidak ikut terbaca (zip 0.4.19 yang sampai terpotong di tengah). Jadi akar masalahnya belum terkonfirmasi; patch ini adalah pengaman,
bukan perbaikan akar.

## Perubahan (hanya TypeScript)
- Baru `src/utils/nativeAdvance.ts`: `judgeNativeAdvance` memutuskan `accept` / `ignore` / `loop` untuk event `advanced` berindeks.
  Indeks sama dengan lagu aktif yang datang lagi (beruntun, `LOOP_STREAK = 2`) = `loop`.
- `useAudioPlayerController.ts`: pada `loop`, rantai native dimatikan selama sesi (`setUpcoming(..., [])` + penanda), lalu JS melanjutkan
  persis seperti alur `ended` (lagu berikutnya; bila antrean habis: putar ulang antrean atau berhenti). Efek `setUpcoming` tidak
  mengirim daftar lagi sesudah itu, jadi perilaku kembali seperti 0.4.17 sampai app dibuka ulang.
- Log diagnostik ringan: `[MusicVerse] lagu selesai #i dari n: ulang=..., berikutnya=..., rantaiNative=...` dan
  `[MusicVerse] rantai native pindah ke lagu #i`; plus peringatan `Rantai native mengulang lagu #i ...` saat pengaman bekerja.

## Diuji / belum
- Node (7 kasus) untuk `judgeNativeAdvance` + simulasi reducer: rantai normal 1,2,3 diterima; 1,1,... terdeteksi loop pada pengulangan
  pertama; indeks tak dikenal tidak mereset deteksi; 1,2,1,2 bukan loop; indeks = lagu aktif tanpa riwayat hanya diabaikan; `currentIndex` null aman.
- `tsc` (di pohon gabungan 0.4.17 + file 0.4.19 yang terbaca) tidak menambah galat dibanding tanpa patch.
- BELUM dijalankan di perangkat dan Java belum dibaca. Kalau lagu masih berulang setelah patch ini, loop-nya bukan lewat rantai native.

## Cara pasang
Salin dua file ke proyek 0.4.19 (timpa `useAudioPlayerController.ts`), lalu naikkan versi di `package.json` ke 0.4.20 sendiri.
Hanya TypeScript; build ulang APK seperti biasa.



---

<!-- sumber: CHANGES-0.4.19.md -->

# MusicVerse 0.4.19 — menu kecil (tahan lama) selalu paling depan

## Laporan
Menu kecil yang muncul saat menahan lama harus paling depan dan tidak boleh tertutup.

## Penyebab (dari membaca kode; belum direproduksi di perangkat)
Tiga menu bawah dirender DI DALAM wadah halaman (`<main>` yang menggulir + pembungkus `animate-page-in`), padahal mini player
dan bottom nav punya lapisan sendiri (z-40 / z-30) di luar wadah itu. Elemen `fixed` yang berada di dalam wadah beranimasi /
ber-overflow bisa terkurung di lapisannya dan tertimpa mini player atau bottom nav, atau terpotong. Menu yang terdampak:
- `PlaylistMenuSheet` (tahan lama kartu playlist: salin / pindahkan semua lagu)
- `AddToPlaylistSheet` (Tambah ke playlist untuk lagu satuan di Beranda)
- `MoveDownloadSheet` (Pindahkan unduhan ke playlist)
`TrackMenuSheet` sudah di akar aplikasi (di luar halaman), tetapi memakai lapisan 62, di bawah menu lain yang berlapisan 70-80.

## Perubahan
- Baru `components/ui/OverlayPortal.tsx`: akar menu bawah yang dirender lewat portal langsung ke `<body>` dengan lapisan z-90
  (di atas mini player, bottom nav, pemutar penuh, antrean, toast, dan sheet Sleep Timer / Crossfade / Cari manual).
- Keempat menu di atas memakainya. Isi, perilaku, fokus, tombol Kembali, dan tampilan menu tidak diubah.
- Tidak diubah: `TrackActionSheet` di dalam panel Antrean (memang menempel di panel itu), dan sheet yang sudah memakai portal.

## Diuji / belum
- `tsc` dengan stub React/Router/Lucide (paket tidak terpasang di lingkungan ini): tidak ada galat baru selain artefak stub pada
  tipe `ReactNode`; tag JSX seimbang.
- BELUM dirender / dijalankan di perangkat. Bila ada menu yang masih tertutup, catat menunya dan halamannya.

Hanya TypeScript; build ulang APK seperti biasa.



---

<!-- sumber: CHANGES-0.4.18.md -->

# MusicVerse 0.4.18 — pemutaran latar belakang tidak putus setelah 2-3 lagu

## Gejala
Layar mati / app di latar belakang: lagu jalan 2-3 lagu lalu berhenti, dan Putar di notifikasi tidak bisa menghidupkannya lagi.

## Penyebab (dari membaca kode; belum direproduksi di perangkat)
1. **Pindah lagu bergantung pada JS.** Link lagu berikutnya di-resolve JS (kode plugin ada di JS). 0.4.0 sudah mencatat batasnya:
   "native hanya bisa berantai 1 lagu sampai JS aktif lagi". Saat WebView di latar belakang dibatasi/dibekukan, JS tidak sempat
   me-resolve lagu berikutnya, jadi setelah 1-3 lagu tidak ada yang bisa diputar lagi.
2. **Tombol notifikasi (Putar/Jeda/Berikutnya/Sebelumnya) semuanya diteruskan ke JS.** JS beku = tombol tidak bereaksi. Itu
   sebabnya "Putar dari notifikasi" pun tidak berhasil.
3. **Watchdog `PlaybackService` mematikan service bila JS diam 90 dtk saat `playing`**, walau ExoPlayer masih berbunyi.

## Perubahan
- **Rantai lagu native.** Selama JS masih jalan, 5 lagu di depan di-resolve lebih awal dan diserahkan ke native
  (`audioEngine.setUpcoming` -> `engineSetUpcoming`). Saat lagu aktif selesai, native memutar yang berikutnya sendiri (memakai pemutar
  cadangan bila sudah dimuat, tanpa jeda), memperbarui notifikasi (judul, artis, durasi, sampul diunduh native), dan mengirim
  event `advanced` dengan `reason: "idx:<indeks antrean>"`. JS menyamakan state saat hidup lagi (bisa beberapa event sekaligus).
  Daftar dikosongkan saat ulang lagu (`one`/`once`) atau sleep timer "akhir lagu" menyala, supaya aturan itu tidak dilewati.
  Daftar usang (JS belum tahu native sudah pindah) diabaikan lewat `currentIndex`.
- **Tombol notifikasi jalan tanpa JS.** Bila JS tidak mengirim detak > 6 dtk saat memutar, atau native sudah pindah lagu sendiri,
  Berikutnya / Sebelumnya (ulang dari awal) / Putar / Jeda dikerjakan native. Saat jeda biasa, tombol tetap diteruskan ke JS,
  dengan jaring pengaman: bila 1,2 dtk kemudian Putar/Jeda belum berefek (JS beku), native mengerjakannya.
- **Watchdog**: service tidak lagi dimatikan karena JS diam selama ExoPlayer masih berbunyi.
- Pembaruan notifikasi dari native tidak dihitung sebagai detak JS (supaya deteksi JS beku tidak keliru).

## Berkas
`PlaybackService.java` (rantai, tombol, watchdog), `MusicVerseNativePlugin.java` (`engineSetUpcoming`), `audioEngine.ts`
(`setUpcoming`, event `advanced` berindeks), `useAudioPlayerController.ts` (resolve lagu di depan, penanganan `advanced`),
`musicVerseNative.ts`.

## Batas / belum diuji
- **Java belum dikompilasi dan belum diuji di perangkat** (Media3 / `javac` tidak ada di lingkungan ini); kurung/kawat diperiksa dan
  semua metode yang dipanggil ada. `tsc` identik dengan 0.4.17 asli (tanpa galat baru). Mohon dicoba: putar playlist 10+ lagu,
  matikan layar 20-30 menit.
- Daftar berisi maksimum 5 lagu. Bila JS beku lebih lama dari itu, pemutaran berhenti di ujung daftar (tombol Putar di notifikasi
  mengulang lagu terakhir). Link lagu yang diserahkan dibuang bila > 90 menit.
- Akhir antrean (antrean habis lalu diacak ulang) tetap keputusan JS; native berhenti di akhir.
- **Sleep timer berdurasi (menit) masih timer JS.** Bila JS beku, timer bisa telat; sekarang pemutaran tidak lagi putus sendiri,
  jadi ini lebih terasa. Memindahkannya ke native adalah pekerjaan terpisah.
- Crossfade berbasis JS tidak jalan saat JS beku; pindah lagu native memakai peralihan 150 ms.
- Bila lagu yang diserahkan gagal diputar (link kedaluwarsa), galatnya baru ditangani JS ketika hidup lagi.

## Perlu build ulang APK (Java berubah): `npm run android:sync`.



---

<!-- sumber: CHANGES-0.4.17.md -->

# MusicVerse 0.4.17 — tahan lama di semua lagu, menu menyesuaikan kondisi dan tempat

## Apa
Sistem menu tahan lama (`useLongPress` + `TrackMenuContext`) sudah ada di 0.4.16 untuk daftar playlist, Unduhan, Baru diputar,
Playlist saya, dan "Berikutnya". Versi ini menutup tempat yang masih ketinggalan dan membuat isi menu mengikuti **tempat** dan
**kondisi** lagunya.

### Tempat yang sekarang bisa ditahan lama (atau klik kanan)
| Tempat | Sebelumnya | Sekarang |
|---|---|---|
| Riwayat (`HistoryPage`) | tidak ada | menu lagu + **Hapus dari riwayat** |
| Detail Artis / Album (`BrowsePage`) | tidak ada | menu lagu |
| Mini player (info lagu) | tidak ada | menu lagu yang sedang diputar (tidak aktif saat kartu sedang diseret) |
| Pemutar penuh (sampul / judul) | hanya tombol Simpan | menu lagu yang sedang diputar |
| Antrean > "Sedang diputar" | tidak ada | menu lagu yang sedang diputar (ketuk biasa tetap jeda/putar) |
| Antrean > "Berikutnya" | menu antrean saja | menu antrean + baris baru **Opsi lainnya** (simpan ke playlist, unduh, dll.) |

Sudah ada dan tidak diubah perilakunya: daftar playlist / Cari / hasil cari judul (`playlist/TrackRow`), Unduhan, Baru diputar, Playlist saya.

### Opsi menu menurut tempat
- **Riwayat**: *Hapus dari riwayat* (hanya entri putar yang ditekan; entri lain tidak disentuh). Halaman Riwayat menyegarkan diri.
- **Playlist saya**: *Hapus dari playlist ini* (di samping Salin / Pindahkan yang sudah ada).
- Kode tempat (`place`): `playlist`, `search`, `my-playlist`, `downloads`, `history`, `browse`, `player`, `queue`, diteruskan oleh semua pemanggil.

### Opsi menu menurut kondisi
- **Lagu yang sedang diputar** (dari tempat mana pun): *Putar sekarang* menjadi *Putar ulang dari awal*; antre/antre-berikutnya tetap nonaktif seperti sebelumnya.
- **Tanpa internet**: *Unduh untuk offline* dinonaktifkan dengan keterangan "Perlu internet untuk mengunduh"; *Putar sekarang* untuk lagu yang
  belum diunduh diberi keterangan "Tidak ada internet dan lagu ini belum diunduh" (tetap bisa ditekan; pemutar sendiri menunggu internet kembali).
- Yang sudah ada tetap: sudah diunduh -> *Hapus unduhan*; ada di antrean -> *Hapus dari antrean*; antrean berisi playlist lain -> catatan penjelasan;
  tautan Spotify disembunyikan di APK.

## Sengaja tidak diubah
- **Gelembung kecil (MiniBubble)**: tahan lama di sana sudah berarti jeda/putar; tidak ditimpa.
- **Daftar pilih** di `ManualSearchSheet` / `MoveDownloadSheet` (memilih sumber audio, bukan daftar lagu pustaka).
- `components/music/TrackRow.tsx` dan `QuickPickCard.tsx` tidak dipakai di mana pun (kode mati), jadi tidak disentuh.
- Importer Spotify: 0.4.16 sudah punya cache token + sumber paralel, tidak diubah.

## Diuji / belum
- Diuji di Node (5 kasus): `removePlayLogEntry` (waktu + id cocok, id salah, waktu tak ada, tanpa id, dua entri sama waktu) dan event penyegaran.
- `tsc` dibandingkan dengan 0.4.16 asli di lingkungan yang sama (paket React/Router/Lucide tidak terpasang): tidak ada galat nyata baru; satu-satunya
  selisih adalah 4 pesan `key` pada komponen baris, artefak tipe React yang hilang dan sudah muncul di baseline untuk komponen lain.
- BELUM dirender / dijalankan di perangkat: perlu dicoba di HP: tahan lama di mini player (jangan bentrok dengan seret kartu), pemutar penuh, antrean,
  Riwayat, Artis/Album; serta teks keterangan offline.

Hanya TypeScript; build ulang APK seperti biasa.



---

<!-- sumber: CHANGES-0.4.16.md -->

# MusicVerse 0.4.16 — playlist Spotify tidak otomatis tersimpan, salin/pindah lagu antar playlist, pengaturan Playlist

## 1. Playlist Spotify yang dibuka tidak lagi masuk daftar otomatis
- Dulu setiap playlist Spotify yang berhasil dimuat langsung muncul di tab Playlist sebagai "Tersimpan" (Koleksi). Sekarang tidak:
  `LibraryContext` tidak lagi menyimpan otomatis.
- Di Beranda, tombol **Simpan ke Koleksi** diganti **Tambah ke playlist**: membuat playlist buatanmu (nama sama, isi lagunya, mengingat
  playlist Spotify asalnya lewat `sourceId`). Menekan lagi (tombol berubah jadi **Perbarui playlist**) hanya menambah lagu yang baru.
  Memakai `saveDownloadedPlaylist` yang sama dengan "Unduh semua", jadi keduanya tetap satu playlist yang sama.
- Entri "Tersimpan" yang sudah ada tidak dihapus (tetap bisa dibuka / dihapus). Kartu Spotify yang sudah punya playlist buatanmu
  tetap disembunyikan seperti sebelumnya.
- Hasil cari judul / tautan lagu tidak berubah (tombol **Tambah ke playlist** satu lagu).

## 2. Menu tahan lama: salin / pindah antar playlist
- **Lagu** (halaman playlist buatanmu): tahan lama barisnya, atau tombol "...": *Salin ke playlist lain*, *Pindahkan ke playlist lain*,
  *Pindahkan semua lagu*. Opsi ini hanya muncul untuk lagu yang berada di playlist buatanmu.
- **Playlist** (kartu di tab Playlist, tampilan daftar maupun kisi): tahan lama (atau klik kanan): *Buka*, *Salin semua lagu*,
  *Pindahkan semua lagu*.
- Tujuan: pilih playlist lain atau buat baru. Pindah meminta konfirmasi karena lagu dihapus dari asal.
- `transferTracks` (`utils/myPlaylistStorage.ts`) = satu perubahan atomik, jadi pindah tidak pernah menghilangkan lagu di tengah:
  duplikat di tujuan tidak ditambah dua kali (pada pindah, tetap dihapus dari asal); lagu yang tak muat karena tujuan penuh tetap di asal.

## 3. Pengaturan > Playlist (baru, hanya APK seperti pengaturan lain)
- **Tambah otomatis saat playlist dibuka** (bawaan: mati): bila dinyalakan, playlist Spotify yang berhasil dimuat langsung dibuat
  sebagai playlist (playlist yang cuma dipulihkan dari penyimpanan tidak diproses).
- **Tanya dulu sebelum memindahkan lagu** (bawaan: nyala).
- Disimpan di `musicverse:playlist-prefs:v1` (ikut Cadangan karena berawalan `musicverse:`).

## Diuji / belum
- Diuji di Node (18 kasus): `transferTracks` salin, pindah, pindah semua, duplikat, tujuan penuh, playlist sama / tidak ada / ID lagu
  tak ada, dan input tidak diubah. Semua lulus.
- `tsc` dengan stub React/Router/Lucide (paket tidak terpasang di lingkungan ini): tidak ada galat tipe baru selain artefak stub;
  satu bentrok nama yang tertangkap (`transfer` di `TrackMenuSheet`) sudah diperbaiki.
- BELUM dirender / dijalankan di perangkat: tampilan menu, tahan lama, dan halaman Pengaturan > Playlist perlu dicoba di HP.

Hanya TypeScript; build ulang APK seperti biasa.



---

<!-- sumber: CHANGES-0.4.15.md -->

# MusicVerse 0.4.15 — perbaikan sheet "Cari manual"

Laporan: ketuk "Cari manual" hanya menggelapkan layar, daftar hasil tidak tampil.

Penyebab pasti belum ketemu (tidak bisa dijalankan di perangkat dari sini). Sheet 0.4.14 dibuat sama seperti sheet lain di
halaman, jadi ini perubahan defensif pada kemungkinan terkuat:
- Sheet kini dirender lewat **portal ke `<body>`** dengan z-index di atas semua lapisan (80), bukan di dalam wadah halaman
  (yang beranimasi/menggulir dan bisa membuat sheet terlempar keluar layar sementara lapisan gelapnya tetap terlihat).
- Animasi naik (`animate-sheet-up`) dilepas: bila animasi macet, sheet tidak tertinggal di luar layar.
- **Galat tampilan kini muncul di dalam sheet** (pesan + tombol Tutup) alih-alih layar gelap tanpa isi, dan dicatat di konsol.
- Ikon `Video` diganti ikon yang sudah dipakai di tempat lain.

Jika sheet tetap kosong setelah ini, pesan di dalamnya (atau ketiadaannya) menunjukkan sebabnya.
Hanya TypeScript; build ulang APK seperti biasa.



---

<!-- sumber: CHANGES-0.4.14.md -->

# MusicVerse 0.4.14 — "Cari manual" dan cadangan pihak ketiga (opsional)

Untuk lagu yang tidak ketemu otomatis (mis. "Audio yang ditemukan di YouTube tidak sesuai dengan lagunya").

## 1. Cari manual (kartu unduhan gagal)
- Kartu gagal punya tombol **Cari manual**. Muncul sampai **5 hasil** YouTube Music dan YouTube (bergantian, tanpa duplikat)
  dengan **judul, artis, durasi**, dan sumbernya.
- Ketuk yang benar: unduhan jalan lewat jalur yang sama (antrean native, sampul, tag, metadata).
- Pemeriksaan audio tetap ketat, tetapi acuannya **hasil yang kamu pilih**, bukan playlist: audio harus terbaca, bukan
  cuplikan, durasinya cocok dengan hasil pilihan (toleransi sama seperti biasa), dan isi berkas harus benar-benar audio.
  Judul/artis tidak dicocokkan dengan playlist (kamu yang menentukan). Berkas tetap diberi tag judul/artis dari playlist.
- Pilihan manual yang tidak lolos **langsung gagal** dengan alasannya (tidak ada putaran ulang ke sumber lain).
- Hasil kosong / pencarian gagal ditampilkan di sheet, dengan tombol "Coba lagi".

## 2. Cadangan pihak ketiga (Pengaturan unduhan, DEFAULT MATI)
- Saklar baru **Cadangan pihak ketiga**. Bila menyala, dan YouTube Music + YouTube sama-sama tidak menemukan yang cocok,
  dicoba dua sumber pihak ketiga berurutan (`thirdParty.ts`): Cadangan 1 (`app.kyzznekoo.my.id`) lalu Cadangan 2
  (`api.nexadev.my.id`). Hanya **unduhan**; pemutaran tetap hanya lewat YouTube.
- Butuh tautan lagu Spotify (lagu dari impor Spotify punya). Lagu tanpa tautan dilewati.
- **Tetap diverifikasi**: audio terbaca di WebView, bukan cuplikan, judul + artis cocok dengan playlist, durasi file sangat
  dekat dengan playlist; lalu isi berkas diperiksa lagi setelah diunduh. Yang tidak lolos ditolak seperti sumber lain.
- Hanya dipakai bila plugin sungguh "tidak menemukan yang cocok". Bila plugin gagal karena jaringan/timeout, itu diulang
  seperti biasa dan tidak dialihkan ke pihak ketiga.
- Ini membalik keputusan 0.4.x yang membuang API pihak ketiga, tetapi hanya sebagai pilihan sadar pengguna.
- Lagu yang memang tidak ada di YouTube belum tentu ada di sumber pihak ketiga.

## Berkas
`plugins/thirdParty.ts` (baru), `plugins/registry.ts` (`searchManualCandidates`, `resolveManualPick`, langkah pihak ketiga),
`plugins/types.ts`, `services/spotifyApi.ts` (opsi `thirdParty` / `manual`), `native/offline.ts`, `native/downloads.ts`
(`findManualCandidates`, `downloadWithPick`, `setThirdPartyFallbackEnabled`), `components/library/ManualSearchSheet.tsx` (baru),
`DownloadsSection.tsx`, `DownloadSettingsPage.tsx`. Tanpa perubahan Java.

## Batas / catatan jujur
- Belum diuji ke server YouTube / pihak ketiga asli maupun di perangkat. `tsc` dibandingkan dengan 0.4.13: tidak ada galat
  baru selain galat lingkungan (tipe React/Capacitor tidak terpasang di tempat saya mengerjakan).
- Pilihan manual hanya berlaku untuk sesi itu: bila app ditutup sebelum selesai, lagunya kembali ke daftar gagal dan
  "Coba lagi" memakai pencarian otomatis.
- Bila plugin gagal karena jaringan terus-menerus sampai batas percobaan, pihak ketiga tidak ikut dicoba (sengaja).
- Format respons kedua API pihak ketiga diambil dari kode lama proyek; bila servernya berubah, langkah ini gagal diam-diam
  dan unduhan berakhir seperti sebelumnya.

## Perlu build ulang APK (`npm run android:sync`).



---

<!-- sumber: CHANGES-0.4.13.md -->

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



---

<!-- sumber: CHANGES-0.4.12.md -->

# MusicVerse 0.4.12 — lagu tidak lagi berhenti di tengah, geser lancar, unduhan tidak macet di "Menyiapkan"

## Masalah
1. Lagu jalan beberapa detik lalu berhenti di "memuat"; digeser maju/mundur spinner tidak selesai (StreamBeats mulus).
2. Unduhan berputar di "Menyiapkan…" tanpa pernah mulai (StreamBeats langsung jalan).

## Penyebab (satu akar untuk keduanya)
`plugins/ytmusic.ts` mengambil stream dengan klien `ANDROID` yang membawa `androidSdkVersion` (21.26.364). Ini memicu syarat
**PO token** di server video YouTube: playerResponse-nya OK dan beberapa detik/MB pertama terbaca (jadi lolos pemeriksaan
durasi di `resolveViaPlugins`), tetapi permintaan Range berikutnya (lanjut lagu, geser/seek) ditolak 403.
- Pemutar: stream terpotong -> buffering -> tangga pemulihan -> link di-resolve ulang, tetapi hasilnya diambil dari cache
  resolve (±30 menit) = URL sama yang sudah ditolak -> spinner tidak pernah selesai.
- Unduhan: URL ditolak 403 -> di-resolve ulang -> klien sama -> ditolak lagi. Plugin `ytvideo` memakai pengambil stream yang
  SAMA, jadi "lewati plugin" tidak menolong. Status kembali ke "Menyiapkan…" tiap putaran, sampai 12 percobaan.
Rujukan yang dibaca (2026): yt-dlp 2026.08.19 menghapus `android_vr` dari klien bawaan (PO token selektif sejak Juli 2026,
format 1.65.10 403 sejak 17 Agustus) dan memakai `visionos` yang tanpa JS runtime dan tanpa PO token; wiki unduhan
YouTube/ytdl-material menjelaskan gejala "beberapa chunk pertama berhasil lalu ditolak" untuk klien yang butuh PO token.

## Perubahan
- **`ytmusic.ts`**: urutan klien sekarang `VISIONOS` (konteks yt-dlp: versi 1.02, Apple RealityDevice17,1, visionOS,
  X-YouTube-Client-Name 101) -> `ANDROID` TANPA `androidSdkVersion` (20.10.38) -> `IOS`. `ANDROID` 21.26.364 dibuang.
  User-Agent tiap klien ikut ke StreamProxy / ExoPlayer / pengunduh seperti sebelumnya (`stream.headers`).
- **`markClientRejected(userAgent)`** (baru, `ytmusic.ts`): stream suatu klien yang ditolak server video (HTTP 401/403/410)
  membuat klien itu dilewati 10 menit; resolve berikutnya memakai klien lain. Dipanggil dari alur unduhan (JS dan antrean
  native yang mengembalikan "rejected").
- **Pemutar** (`useAudioPlayerController`): muat-ulang karena jaringan putus sekarang membuang cache resolve lagu itu
  (`forgetResolved`) supaya link benar-benar baru, dan putus ke-2 saat internet ada = ganti klien (`markClientRejected`).
- **Unduhan**: percobaan ke-2 dst. menampilkan "Menyiapkan… Mencoba lagi (n/12)" (tidak lagi tampak macet tanpa keterangan).

## Pengujian
`getStreams` diuji dengan fetch tiruan: VISIONOS dipakai lebih dulu dengan konteks/header yang benar (tanpa
`androidSdkVersion`, X-YouTube-Client-Name 101); jatuh ke ANDROID sdkless bila VISIONOS gagal; klien yang ditandai ditolak
dipindah ke belakang; semua gagal -> galat jelas. TypeScript hanya diperiksa sintaksnya.
**BELUM diuji ke server YouTube asli maupun di perangkat.** Klien YouTube berubah-ubah; bila `visionos` berhenti jalan,
perbarui konstanta `VISIONOS` (cocokkan dengan `visionos` di yt-dlp `_base.py`).

## Batas
- TVHTML5 + dekode cipher (cadangan di plugin Bloomee) belum dibawa.
- Hasil resolve non-strict tetap di-cache; hanya jalur muat-ulang karena putus yang membuangnya.

## Tidak perlu Java baru; bundel web berubah. Build ulang APK seperti biasa (`npm run android:sync`).



---

<!-- sumber: CHANGES-0.4.11.md -->

# MusicVerse 0.4.11 — putar otomatis setelah gangguan, di native (ala StreamBeats)

## Masalah
Musik berhenti karena panggilan / app lain, lalu **tidak lanjut sendiri bila gangguannya lama**. Penyebabnya: putar-ulang
otomatis dijalankan di JavaScript (`AutoResumeSync`, polling tiap 1,5 dtk), jadi bergantung pada WebView yang hidup dan
CPU yang terjaga. CPU hanya dijaga 20 menit (`INTERRUPT_WAKE_MS`), JS menyerah di 60 menit, dan service ikut berhenti saat
dijeda 60 menit (`IDLE_LIMIT_MS`).

## Yang ditemukan di StreamBeats (dari APK; kode Dart-nya terkompilasi, jadi ini hasil membaca nama fungsi/string)
- `audio_service` (`AudioService` foreground `mediaPlayback`, `MediaButtonReceiver`, `MediaBrowserService`) + `audio_session`.
- Pemutar mendengarkan gangguan lewat event, bukan polling: `_setupInterruptionListeners`, `_handleInterruptionSync`,
  `_resumePlaybackAfterInterruption`; sesi audio diaktifkan sebelum memutar (`_activateAudioSession`, pesan "Audio focus
  denied. Cannot start playback.") dan dilepas saat berhenti.
- Headset dicabut = jeda biasa (`_onHeadphonesUnplugged`), tidak diputar ulang.
- Saat app dibuka lagi: `_ensurePlayerHealthyOnResume`; sesi/antrean disimpan dan dipulihkan (`_saveSession`, `_restoreLastSession`).
- Tidak ada layanan foreground terpisah untuk unduhan; unduhan hidup di proses yang sama.

## Perubahan
- **`InterruptionResumer.java` (baru)**: penantian + putar-ulang sepenuhnya di native, tanpa JS. Pemicunya hanya ExoPlayer
  berhenti karena kehilangan fokus audio. Jeda pengguna / notifikasi / headset dicabut / lagu habis membatalkan penantian.
  - Deteksi app lain berhenti lewat `AudioPlaybackCallback` (Android 8+, berbasis event) + pengecekan berkala 3 dtk sebagai
    jaring pengaman; panggilan terdeteksi dari `AudioManager.getMode()`.
  - Harus sepi 2 dtk berturut-turut sebelum memutar (jeda antar lagu app lain tidak memicu). Bila app lain tak pernah
    terlihat memutar, lanjut setelah 8 dtk (suara navigasi, dsb.).
  - CPU ditahan sebentar (wake lock berbatas) hanya saat sudah sepi tetapi belum cukup lama, jadi layar mati tidak menunda.
  - Tanpa batas waktu pendek: menunggu sampai 24 jam (batas pengaman), lalu service dibereskan.
- **`PlaybackService`**: service tidak berhenti karena `IDLE_LIMIT_MS` selama menunggu; hook di `onPlayWhenReadyChanged`
  (fokus hilang = mulai menunggu; lainnya/`play` = selesai); dibersihkan di `shutdown`, `doStopEngine`, `onDestroy`.
- **Pengaturan > Pemutaran > "Putar otomatis setelah gangguan"** (default menyala). Mematikannya membatalkan penantian
  yang sedang berjalan. `AutoResumeSync` (JS) tetap ada sebagai cadangan untuk APK lama dan ikut mengikuti pengaturan ini.

## Tidak diubah (sudah ada)
- Unduhan di latar belakang: antrean native (0.4.4), `DownloadService` dengan wake lock + Wi-Fi lock + `onTimeout`.
- Pemulihan sesi antrean/posisi (`playerSession.ts`), pemeriksaan mesin saat lanjut (`engineResume` mengembalikan false
  bila service sudah mati sehingga lagu dimuat ulang).
- Belum ada: Android Auto (`MediaBrowserService`) seperti di StreamBeats.

## Pengujian
`InterruptionResumer` dikompilasi dan dijalankan terhadap stub API Android dengan jam virtual: app lain berbunyi 1 jam
lalu berhenti -> lanjut 2 dtk kemudian; tanpa sinyal -> 8 dtk; jeda antar lagu app lain tidak memicu; panggilan 10 menit;
jeda pengguna membatalkan; masih menunggu di jam ke-23 dan menyerah di jam ke-24; pengaturan dimatikan; pendaftaran
callback tidak ganda. TypeScript lolos `tsc` untuk file yang disentuh. **BELUM diuji di perangkat / Media3 asli**; kode di
`PlaybackService` hanya diperiksa sintaksnya (struktur kurung) karena Media3 tidak tersedia di sini.

## Perlu build ulang APK (Java berubah): `npm run android:sync`.



---

<!-- sumber: CHANGES-0.4.10.md -->

# MusicVerse 0.4.10 — pemulihan buffering macet + saklar mode langsung

## Masalah
Di tengah lagu kadang "Buffering…", lalu digeser dan spinner tidak pernah selesai.

## Perubahan
- **Mode langsung jadi opsi, default MATI** (Pengaturan > Pemutaran). Default kembali lewat StreamProxy (potongan 1 MB) yang
  sudah teruji; mode langsung (satu koneksi panjang ke sumber) bisa dinyalakan untuk dibandingkan. Dugaan: sumber YouTube
  membatasi kecepatan satu koneksi panjang / menahan Range tak terbatas.
- **Tangga pemulihan macet di native** (tiap 10 dtk buffering terus-menerus): 1) buka ulang sumber di posisi sekarang,
  2) pindah ke proxy (atau buka ulang lagi), 3) laporkan galat jaringan ke JS -> link diambil ulang, lagu dimuat ulang dari
  posisi terakhir. Sebelumnya hanya ada satu langkah, dan hanya untuk mode langsung.
- **Seek**: pemutar yang berhenti karena galat dibangunkan lagi (`prepare`), hitungan macet diulang dari nol, dan
  `SeekParameters.CLOSEST_SYNC` (loncat ke titik sinkron terdekat).
- **Pemulihan status**: bila event `playing` hilang tapi ExoPlayer sudah berbunyi, `timeupdate` mengembalikan status dari
  "Buffering" ke "Playing".

## Catatan
- Cache disk hanya berlaku untuk sumber API yang punya kunci; setelah 0.4.5 audio hanya dari plugin (tanpa kunci), jadi cache
  praktis tidak aktif.
- BELUM diuji di perangkat. Perlu build ulang APK (Java berubah).



---

<!-- sumber: CHANGES-0.4.9.md -->

# MusicVerse 0.4.9 — pencarian judul hybrid (Spotify langsung + pihak ketiga berbarengan)

## Apa
- `searchTrackByTitle`: Spotify langsung dan nexadev dijalankan BERSAMAAN; hasil pertama yang berhasil dipakai, yang lain
  dibatalkan. Salah satu gagal = yang lain tetap ditunggu; galat hanya bila keduanya gagal.
- Token Spotify di-cache (dipakai ulang oleh pencarian, info lagu, impor); dibuang bila API menjawab 401/403.
- Sumber token (embed seed 1-3 + endpoint anonim) kini dibalapkan, bukan berurutan.

## Batas
- Belum diuji ke server asli / perangkat. `tsc` tidak menambah galat baru pada file yang disentuh.
- Info satu lagu via tautan (`searchTrackByLink`) masih Spotify dulu lalu cadangan (belum hybrid).

## Perlu build ulang APK (bundel web berubah; tidak ada perubahan Java).



---

<!-- sumber: CHANGES-0.4.8.md -->

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



---

<!-- sumber: CHANGES-0.4.7.md -->

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



---

<!-- sumber: CHANGES-0.4.6.md -->

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



---

<!-- sumber: CHANGES-0.4.5.md -->

# MusicVerse 0.4.5 — sumber audio sama seperti StreamBeats (tanpa API pihak ketiga)

## Apa
Audio untuk memutar dan mengunduh sekarang HANYA berasal dari plugin yang langsung ke YouTube, seperti StreamBeats
(plugin `ytmusic` + `ytvideo` dari bloom-factory). API pihak ketiga `app.kyzznekoo.my.id` (kyzz) dan jalur
cadangan `/api/spotify` tidak lagi dipakai untuk audio.

- Urutan sumber: `ytmusic` (cari di YouTube Music) -> `ytvideo` (cari video YouTube; baru) -> galat yang jelas.
- Plugin baru `src/plugins/ytvideo.ts`: pencarian filter "Videos" (`EgIQAQ%3D%3D`, klien WEB) seperti plugin `ytvideo`
  StreamBeats; pengambil stream memakai kode yang sama dengan ytmusic (klien ANDROID lalu IOS).
- `avoid` (sumber yang baru memberi berkas salah / URL ditolak 2x) kini berisi `plugin:<id>`: yang dilewati hanya plugin
  itu, plugin berikutnya yang dicoba. Sebelumnya `plugin` dilewati seluruhnya lalu jatuh ke API pihak ketiga.
- Galat resolve dibedakan: waktu habis (`timeout`), sumber tak terjangkau (`network`), ada kandidat tetapi tidak
  cocok (`clip_only`), tidak ditemukan (`no_audio`). `timeout`/`network` diulang oleh pemutar/pengunduh seperti biasa.
- Dihapus: pemutus sirkuit plugin 5 menit (tanpa fallback API, berhenti 5 menit = tidak ada suara sama sekali),
  hand-off hasil pencarian (membawa URL audio pihak ketiga), `requestDownload`/`requestByLink`, konfigurasi kyzz di
  `spotifyApi.ts`, `vite.config.ts`, `vercel.json`, `api/proxy.js`, `vite-env.d.ts`.
- Daftar plugin dibangun saat dipakai (bukan saat modul dimuat) agar impor melingkar registry <-> plugin <-> jaringan aman.

## Yang MASIH memakai pihak ketiga (bukan audio)
- Impor playlist Spotify, pencarian judul, dan info lagu dari tautan Spotify: `api.nexadev.my.id` (hanya judul, artis,
  durasi, sampul; `mp3_url`/`data.url` diabaikan). StreamBeats memakai plugin `spotify-importer`; belum dipasang di sini.
- Lirik: NetEase (+ lrclib bila ada), tidak berubah.

## Batas
- Audio hanya bisa diputar di APK (plugin butuh HTTP native bebas CORS). Di browser biasa tidak ada fallback ke API.
- Lagu yang tidak ada di YouTube Music maupun YouTube sekarang gagal dengan `no_audio` (tidak ada lagi jalur ketiga).
- Diuji dengan Node memakai respons YouTube tiruan: parser `ytvideo` (live tanpa durasi dibuang, " - Topic"/"VEVO"
  dibersihkan, durasi jam:menit:detik), serta alur ytmusic -> ytvideo, `avoid`, `nomatch` dan `failed`. `tsc` tidak
  menambah galat baru (paket React/Capacitor tidak terpasang di lingkungan ini). BELUM diuji ke server YouTube asli
  atau di perangkat; kunci API dan versi klien `ytvideo` disalin dari sumber bloom-factory.

## Perlu build ulang APK (bundel web berubah; tidak ada perubahan Java).



---

<!-- sumber: CHANGES-0.4.4.md -->

# MusicVerse 0.4.4 — antrean unduhan native (tahap 1)

## Apa
Sebelumnya seluruh antrean unduhan hidup di JavaScript. Begitu aplikasi digeser dari recent apps, WebView mati dan lagu
yang sedang diunduh berhenti. Sekarang lagu yang URL-nya sudah di-resolve diserahkan ke **antrean native**
(`DownloadQueue.java`, padanan manajer Rust StreamBeats) yang bekerja tanpa WebView:

- unduh (NativeDownloader, bisa disambung) -> cek isi -> verifikasi ukuran/durasi -> sampul -> tag -> ganti nama atomik ->
  metadata -> salin ke Music/MusicVerse, semuanya di thread native;
- lagu yang sedang berjalan **dan 2 lagu di depannya** (`NATIVE_LOOKAHEAD`) tetap selesai walau app digeser; notifikasi
  progres dipegang native selama JS mati dan service tidak lagi mati saat app digeser selagi antrean bekerja;
- antrean + hasil dicatat di `files/dlqueue.json`; saat app dibuka lagi `queueSync` memasukkan lagu yang selesai, dan
  mengembalikan yang gagal/perlu di-resolve ulang ke antrean.

## Pembagian JS / native
- JS: urutan, jeda, tahan per lagu, resolve link (plugin), me-resolve ulang saat URL ditolak / sumber tidak cocok.
- Native: semua langkah setelah URL siap. Syarat Wi-Fi/cas juga dihormati native (`queueConfigure`).
- Hasil per lagu: `done`, `handback` (JS resolve ulang: URL ditolak/kedaluwarsa, bukan audio, terpotong, jaringan putus),
  `verify` (berkas utuh tetapi durasi tak bisa dipastikan di native: `.part` dipertahankan dan JS memakai pemeriksaan ketat
  lamanya), `failed`.
- Jeda: lagu yang sudah diserahkan tetapi belum mulai dicabut (`queueRelease`); yang sudah berjalan diselesaikan seperti dulu.
  Batal / tahan satu lagu memakai `queueCancel`.

## Berkas
- Baru: `DownloadQueue.java`.
- `MusicVerseNativePlugin.java`: `queueAdd`, `queueCancel`, `queueRelease`, `queueSync`, `queueAck`, `queueConfigure`, event
  `queueResult`; pendengar antrean dilepas saat WebView hancur.
- `DownloadService.java`: `onTaskRemoved` tidak lagi menghentikan service bila antrean native masih bekerja.
- `musicVerseNative.ts`, `downloads.ts` (`submitToNative`, `prefetchAhead`, `releasePrefetched`, `syncNative`, dst.).
- Perbaikan build: `MediaExporter.java` baris 67 (`catch (RuntimeException e)`).

## Batas
- Resolve link masih di JS (tahap 2): lagu di luar lookahead, atau yang perlu di-resolve ulang, menunggu app dibuka lagi.
- Syarat Wi-Fi/cas yang belum terpenuhi saat JS mati: native menunggu maks. 20 menit lalu berhenti; sisanya lanjut saat app dibuka.
- Tombol Jeda di notifikasi tidak berfungsi selama JS mati (notifikasi native tanpa tombol).
- Lirik lagu yang selesai saat JS mati diambil begitu app dibuka (`queueSync`).
- Belum dijalankan di perangkat dan Java belum dikompilasi di lingkungan ini; `tsc` hanya diperiksa tanpa tipe Capacitor
  (hanya TS7006 pada callback yang tipenya berasal dari paket yang tidak terpasang).

## Perlu build ulang APK (ada perubahan Java). APK lama tetap jalan memakai jalur JS.



---

<!-- sumber: CHANGES-0.4.3.md -->

# MusicVerse 0.4.3 — merapikan unduhan lama

## Apa
Unduhan sebelum 0.4.1 selalu bernama `.mp3` walau isinya M4A/WebM, dan tidak punya tag. Sekarang dirapikan sekali, di
perangkat, tanpa internet:

- **Tag + sampul** disematkan (judul, artis, album, gambar sampul) memakai `AudioFinalizer` yang sama dengan unduhan baru.
- **Ekstensi sesuai isi** (`.m4a`, `.mp3`, `.webm`, dst.); indeks, metadata cadangan, dan pemutaran ikut menunjuk nama baru.
- **Otomatis**: 20 dtk setelah aplikasi dibuka, satu lagu sekali jalan (jeda 150 ms antar lagu), di latar belakang. Juga ada
  baris **Rapikan unduhan lama** di Pengaturan > Unduhan: jumlah yang tersisa, kemajuan, dan tombol **Rapikan**.
- Penanda baru `tagged` di indeks. Unduhan baru (0.4.1+) bertanda `tagged` sejak selesai, jadi tidak diproses ulang;
  lagu lama ditandai setelah dirapikan, jadi tiap lagu hanya diproses sekali.

## Aman bila terhenti di tengah jalan (`AudioFinalizer.upgradeInPlace`)
1. Tag ditulis lewat berkas sementara lalu diganti atomik: berkas asli selalu sah.
2. Metadata (dengan nama berkas BARU) ditulis sebelum ganti nama.
3. Ganti nama (atomik).
Bila aplikasi mati antara 3 dan penyimpanan indeks, `initOffline` menemukan berkas dengan ekstensi lain untuk kunci yang sama
dan memakainya (entri tidak hilang). Bila lagu dihapus pengguna selagi diproses, hasilnya dibersihkan (tidak jadi yatim).

## Yang dilewati (tidak diubah, tidak dihapus)
- Isi bukan audio (mis. halaman error yang dulu tersimpan sebagai lagu): `NOT_AUDIO`.
- Ruang penyimpanan kurang (butuh salinan sementara seukuran lagu + 8 MB): `NO_SPACE`.
- Wadah yang tidak bisa ditag (OGG, FLAC, WebM, WAV) tetap diberi ekstensi benar tetapi tanpa tag.
Yang dilewati tidak dicoba lagi di sesi yang sama; dicoba lagi pada sesi berikutnya. Jumlahnya tampil di pengaturan.

## Berkas
- `AudioFinalizer.java`: `upgradeInPlace`, `NotAudioException`, `NoSpaceException`, `Upgrade`.
- `MusicVerseNativePlugin.java`: metode `upgradeDownload`.
- `musicVerseNative.ts`, `offline.ts` (`tagged`, `replaceItem`, `UpgradeProgress`, adopsi ekstensi lain saat pemulihan),
  `downloads.ts` (`upgradeOldDownloads`, `countUpgradable`, jadwal di `initDownloads`), `DownloadSettingsPage.tsx`.

## Pengujian
- `upgradeInPlace` diuji dengan berkas asli buatan ffmpeg dan diperiksa dengan ffprobe/ffmpeg: M4A moov-di-akhir, faststart,
  fragmented; MP3 dengan ID3; OGG; HTML; tujuan sisa crash. Hasil: judul/artis/album + sampul terbaca, checksum audio hasil
  dekode identik, durasi sama, diulang aman (tag tidak menumpuk), tanpa sisa `.tagging`.
- Alur TypeScript dijalankan di Node dengan Capacitor palsu yang meniru semantik Java: sapuan campuran, diulang, panggilan
  bersamaan, NO_SPACE, dihapus saat diproses (dua variasi), APK 0.4.1 tanpa `upgradeDownload`, dan pemulihan indeks.
- Metode plugin hanya diuji kompilasi terhadap stub; belum dijalankan di perangkat. `tsc`: hanya TS7026 pada JSX baru
  (tipe React tidak terpasang di lingkungan uji).

## Batas
- Lagu yang sedang diputar saat dirapikan: pemutar yang sudah membuka berkasnya tetap lancar, tetapi lagu berikutnya yang
  sudah dimuat-di-muka dengan nama lama akan error sekali lalu diambil ulang lewat indeks (nama baru).
- Salinan di Music/MusicVerse (bila pernah diekspor) tidak ditulis ulang.
- Antrean unduhan masih di JS.

## Perlu build ulang APK (ada perubahan Java). APK 0.4.1 tetap jalan; perapian baru aktif setelah APK 0.4.3 terpasang.



---

<!-- sumber: CHANGES-0.4.2.md -->

# MusicVerse 0.4.2 — pilihan kualitas unduhan

## Apa
Pengaturan > Unduhan > **Kualitas unduhan**: Tinggi (default) / Sedang (±128 kbps) / Hemat (±64 kbps). Padanan
`AudioStreamQualityPreference` di StreamBeats.

- **Tinggi** = perilaku 0.4.1 persis (urutan stream dari plugin: M4A dulu, bitrate tertinggi).
- **Sedang / Hemat**: stream plugin diurutkan menurut kedekatan bitrate ke 128 / 64 kbps (skala log). M4A/AAC diberi
  keunggulan ±35% atas WebM/Opus pada selisih sebanding, karena hanya M4A yang bisa diberi tag + sampul oleh
  `AudioFinalizer`. Stream lain tetap jadi cadangan bila yang terpilih gagal.
- Berlaku untuk unduhan BARU saja; lagu yang sudah diunduh tidak diubah.
- Hasil resolve unduhan non-default disimpan di kunci cache sendiri (`...|q:normal`), jadi tidak menimpa stream yang dipakai
  pemutaran (pemutaran selalu kualitas terbaik). `forgetResolved` ikut membuang kunci itu.
- Pilihan disimpan di `mv:downloads:settings` (field `downloadQuality`); nilai tak dikenal diabaikan (kembali ke Tinggi).

## Berkas
- Baru: `src/plugins/quality.ts` (tipe, label, `orderStreamsForQuality`).
- `plugins/registry.ts`, `services/spotifyApi.ts` (opsi `quality`), `native/offline.ts` (state), `native/downloads.ts`
  (simpan/muat/kirim ke resolver), `pages/DownloadSettingsPage.tsx` (kontrol radio).
- Hanya TypeScript: tidak ada perubahan Java, tetapi APK tetap perlu dibangun ulang agar aset web ikut.

## Pengujian
`orderStreamsForQuality` diuji dengan daftar stream bergaya YouTube (itag 141/140/139 M4A, 251/250/249 Opus): Tinggi
mempertahankan urutan plugin; Sedang memilih 140 (129k); Hemat memilih 139 (49k); hanya-WebM memilih yang terdekat; bitrate
tak diketahui paling belakang; input tidak dimutasi. Selisih `tsc` terhadap 0.4.1: hanya TS7026 pada tag JSX baru (tipe
React tidak terpasang di lingkungan uji), tidak ada galat tipe lain. UI belum dijalankan di perangkat.

## Batas
- Hanya untuk sumber plugin. API cadangan (kyzz / spotify) tidak punya pilihan bitrate, jadi unduhan yang jatuh ke sana
  mengikuti API itu. Keterangan ini juga tampil di halaman pengaturan.
- Bitrate yang tersedia ditentukan YouTube per lagu; "Hemat" bisa saja lebih besar dari 64 kbps bila hanya itu yang ada.



---

<!-- sumber: CHANGES-0.4.1.md -->

# MusicVerse 0.4.1 — penyelesaian unduhan ala StreamBeats

## Apa
Pengunduh native (0.3.7) sudah meniru StreamBeats dalam hal `.part`, resume lewat Range, antrean tersimpan, dan jeda setelah
restart. Yang belum: StreamBeats memeriksa ISI berkas, menyematkan tag + sampul ke dalamnya, dan memberi ekstensi yang benar.
Sekarang MusicVerse juga:

- **Cek isi berkas** (`AudioFinalizer.sniff`): wadah dikenali dari byte (M4A, MP3, AAC, OGG, FLAC, WebM, WAV). Halaman error
  HTML/JSON yang tersimpan sebagai "lagu" ditolak dan sumbernya dilewati (sama seperti ketidakcocokan durasi).
- **Ekstensi sesuai isi**: unduhan baru bernama `<kunci>.m4a` / `.mp3` / dst., tidak lagi semuanya `.mp3`. Unduhan lama tetap
  `.mp3` dan tetap terbaca (indeks, pemulihan dari folder, dan pemutaran menerima semua ekstensi di atas).
- **Tag + sampul di dalam berkas** (padanan `lofty`): judul, artis, album, dan gambar sampul (JPEG/PNG) disematkan ke M4A
  (kotak `udta/meta/ilst`, termasuk MP4 fragmented ala YouTube) dan MP3 (ID3v2.4, tag lama diganti). Offset `stco/co64`
  digeser bila `moov` ada di depan; `mfra` dibuang karena offsetnya jadi basi. Wadah lain (OGG, FLAC, WebM, WAV) dibiarkan
  apa adanya, bukan dianggap gagal.
- **Penyelesaian di native** (`finalizeDownload`): tag, ganti nama atomik `.part` -> nama akhir, lalu metadata (`download/meta`)
  ditulis native sebelum JS dipanggil kembali. Aplikasi yang mati di tengah jalan tidak meninggalkan lagu tanpa catatan.
- **Salin ke folder Musik** (Pengaturan > Unduhan, default mati): salinan `Artis - Judul.ext` ke `Music/MusicVerse` lewat
  MediaStore (Android 10+) agar tampil di pemutar musik dan pengelola berkas lain. Saat dinyalakan, lagu yang sudah diunduh ikut
  disalin di latar belakang; yang sudah pernah disalin dilewati.

## Berkas
- Baru: `AudioFinalizer.java` (murni Java), `MediaExporter.java`.
- `MusicVerseNativePlugin.java`: `inspectDownload`, `finalizeDownload`, `exportDownload`.
- `musicVerseNative.ts`, `offline.ts` (ekstensi + state `exportMusic`), `downloads.ts`, `DownloadSettingsPage.tsx`.

## Pengujian
`AudioFinalizer` diuji dengan berkas asli buatan ffmpeg: M4A moov-di-akhir, M4A faststart (moov di depan), M4A fragmented
dengan sidx+mfra, MP3 dengan dan tanpa ID3 lama, serta OGG/WebM/HTML. Hasilnya diperiksa dengan ffprobe/ffmpeg: tag + sampul
terbaca, durasi sama, checksum audio hasil dekode identik dengan aslinya, dan seek tetap jalan. Kode Java berbasis Android
(`MediaExporter`, tiga metode plugin) hanya diuji kompilasi terhadap stub API; belum dijalankan di perangkat.

## Batas
- Antrean masih di JS (bukan di layanan native seperti manajer Rust StreamBeats); lihat catatan di `downloads.ts`.
- Unduhan lama (`.mp3` berisi M4A) tidak ditulis ulang; hanya unduhan baru yang bertag.
- Tidak ada pilihan kualitas unduhan.

## Perlu build ulang APK (ada perubahan Java).



---

<!-- sumber: CHANGES-0.4.0.md -->

# MusicVerse 0.4.0 — mesin audio ExoPlayer (Media3)

## Apa
Lagu di APK sekarang diputar ExoPlayer di `PlaybackService`, bukan `<audio>` WebView. Padanan libmpv di StreamBeats:
- Buffer baca-depan sampai 3 menit (mulai putar setelah 1,5 dtk terisi).
- Coba-ulang otomatis (12x) saat sinyal putus; 4xx (URL kedaluwarsa) langsung dilaporkan agar JS mengambil link baru.
- Tetap lewat StreamProxy (header User-Agent + potongan Range), jadi sumber YouTube tetap aman.
- Wake lock + wifi lock dari ExoPlayer, audio focus & headset dicabut ditangani ExoPlayer.

## Perubahan
- PlaybackService.java: ExoPlayer, event -> JS, Equalizer Android (android.media.audiofx) dari 10 pita JS.
- MusicVerseNativePlugin.java: engineLoad/Resume/Pause/Seek/Stop/SetVolume/SetEq + event `engineEvent`.
- audioEngine.ts: jalur native (cermin posisi dari event), jatuh ke `<audio>` bila web atau APK lama.
- setup-android.mjs: menambah `androidx.media3:media3-exoplayer:1.8.0` ke app/build.gradle.

## Crossfade & pindah lagu tanpa jeda (kembali)
- Dua ExoPlayer: aktif + cadangan (lagu berikutnya dimuat senyap, satu sesi audio sehingga satu Equalizer berlaku untuk keduanya).
- `engineCrossfade`: fade-in/out daya-sama (sin/cos) dikerjakan native tiap 50 ms, tidak bergantung JS yang ditahan di latar belakang.
- Fokus audio dan "headset dicabut" dipindah ke pemutar aktif saat peralihan; jeda di tengah crossfade menyelesaikannya dulu.
- Pemicu peralihan masih dari JS (logika crossfadeStep yang sama dengan web).

## Mode langsung (ala mpv)
- ExoPlayer mengambil dari sumber LANGSUNG (satu koneksi panjang + User-Agent sumber) tanpa potongan 1 MB lewat proxy.
- Cadangan otomatis ke StreamProxy pada posisi yang sama bila: error (4xx / jaringan setelah 12 percobaan) atau macet buffering > 15 dtk.
- Domain yang pernah gagal langsung dicatat dan sisa sesi lewat proxy.
- StreamProxy.peek(): membaca sumber asli dari URL proxy. Lagu offline (file://) dan sumber plugin tidak berubah.

## Cache disk
- SimpleCache 200 MB (LRU) di cache/exo-audio. Kunci = lagu + sumber API (`diskCacheKey` di controller); berkas lokal dan sumber plugin tidak di-cache.
- Lagu yang diulang / di-seek balik tidak diunduh lagi. Jika terdengar aneh di satu lagu, hapus data cache aplikasi.

## Pindah lagu di native
- Lagu berikutnya dimuat 45 dtk sebelum selesai (pemutar cadangan hanya mengisi ~20 dtk agar tidak berebut bandwidth).
- Setelah JS memvalidasi lagu cadangan (bukan klip 30 dtk), `engineSetAutoAdvance(true)`. Bila lagu aktif selesai dan JS belum memindahkan (WebView tertahan), native pindah sendiri dan mengirim event `advanced`; controller menyamakan state.
- Batas: link tetap diambil JS, jadi native hanya bisa berantai 1 lagu sampai JS aktif lagi.

## OkHttp
- Sumber data ExoPlayer memakai OkHttp (`media3-datasource-okhttp`): HTTP/2, koneksi dipakai ulang, retry koneksi otomatis.

## Perlu build ulang APK (Java + gradle).



---

<!-- sumber: CHANGES-0.3.8.md -->

# MusicVerse 0.3.8 — lagu tidak lagi pause/play/retry di sinyal lemah

## Penyebab
StreamBeats memakai libmpv (buffer baca-depan besar + reconnect). MusicVerse memakai `<audio>` WebView lewat proxy lokal
yang mengambil 1 MB per potongan tanpa baca-depan, jadi sedikit hiccup jaringan langsung menjadi `waiting` -> pause/play
-> muat ulang lagu (resolve ulang) -> retry beruntun. Preload lagu berikutnya juga berebut bandwidth.

## Perubahan
- StreamProxy.java: pengambil (thread terpisah) membaca DEPAN ke antrean RAM 4 MB (~4 menit audio); saat sinyal drop,
  <audio> tetap dapat data dari antrean. Retry/sambung-byte/tunggu-jaringan dipindah ke pengambil.
- useAudioPlayerController.ts: `waiting` < 0,9 dtk tidak ditampilkan sebagai buffering; muat-ulang karena error jaringan
  diberi jeda (1,5 dtk x percobaan) dan error susulan tidak menghabiskan percobaan; preload lagu berikutnya ditahan
  selama buffer lagu aktif < 3 dtk (kecuali sisa lagu <= 10 dtk).
- audioEngine.ts: bufferedAhead().

## Perlu build ulang APK (ada perubahan Java).



---

<!-- sumber: CHANGES-0.3.7.md -->

# MusicVerse 0.3.7 — adopsi sistem StreamBeats

## Temuan
1. APK yang terpasang (musicverse.apk) TIDAK berisi StreamProxy -> plugin YouTube tak bisa kirim User-Agent -> gagal -> jatuh ke API pihak ketiga. Wajib build ulang dari source ini.
2. Unduhan SELALU melewati plugin (`strict` mode melewati plugin) -> selalu pihak ketiga.
3. Budget plugin tetap 9 dtk -> di sinyal lemah selalu "gagal" -> pihak ketiga.
4. Unduhan = Filesystem.downloadFile di WebView, tanpa Range; putus => .part dihapus, mulai dari 0; menyerah setelah ~40 dtk.
5. Pemutaran: putus sinyal di tengah lagu -> proxy menutup koneksi -> MEDIA_ERR_NETWORK; 3 retry cepat lalu error.

## Perubahan
- NEW NetWatch.java, NativeDownloader.java (resume Range, .part + .meta, tunggu jaringan, validasi ukuran sumber)
- StreamProxy.java: retry + sambung dari byte terakhir + tunggu jaringan
- MusicVerseNativePlugin: downloadFile / cancelDownload / event downloadProgress
- DownloadService.keepAlive()
- registry.ts: budget & timeout adaptif, plugin ikut mode strict, directUrl/UA, proxyRemoteUrl, forgetResolved
- spotifyApi.ts: plugin di unduhan; avoid 'plugin'; audio pihak ketiga ikut proxy
- downloads.ts: pengunduh native, .part dipertahankan, fallback ke cara lama di APK lama
- useAudioPlayerController.ts: offline => tunggu event `online`, tidak habiskan retry

## Belum
- Fallback TVHTML5 + cipher (3rd strategy ytmusic.bex) belum diport.
- Memuat file .bex langsung (WASM component) tidak mungkin di WebView; ytmusic.ts adalah port TS-nya.
- Antrean unduhan masih di JS (geser dari recent apps menghentikan lagu berjalan, tapi .part disambung nanti).
