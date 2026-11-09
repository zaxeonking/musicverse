MusicVerse — Project Structure

Project: MusicVerse
Version: v0.5.52
Architecture: React + TypeScript + Vite + Tailwind CSS + Capacitor
Platform: Web / Android

---

1. Project Overview

MusicVerse merupakan aplikasi pemutar musik yang dibangun menggunakan React dan TypeScript, dengan Vite sebagai development dan build tool, Tailwind CSS untuk styling, serta Capacitor untuk integrasi Android native.

Dokumentasi ini berfungsi sebagai panduan utama struktur project MusicVerse. Setiap pengembangan, penambahan fitur, perbaikan bug, maupun perubahan kode harus memperhatikan struktur yang sudah ada.

Tujuan dokumentasi ini:

- Mengetahui lokasi setiap file.
- Memahami fungsi setiap folder dan file.
- Menghindari pembuatan file atau sistem yang duplikat.
- Mempertahankan konsistensi arsitektur.
- Mempermudah pengembangan fitur berikutnya.
- Menjadi referensi utama ketika melakukan perubahan project.

---

2. Main Project Structure

MusicVerse/
├── src/
├── public/
├── native/
├── api/
├── scripts/
├── docs/
├── .github/
├── package.json
├── vite.config.ts
├── capacitor.config.ts
├── tsconfig.json
├── tailwind.config.js
├── postcss.config.js
├── index.html
├── vercel.json
├── .env.example
└── README.md

---

3. SOURCE CODE — src/

Folder "src/" merupakan folder utama yang menyimpan seluruh source code aplikasi MusicVerse.

3.1. src/components/

Menyimpan seluruh komponen antarmuka (UI) yang digunakan dalam aplikasi.

components/layout/

Berisi komponen yang mengatur tata letak dan navigasi aplikasi.

File| Fungsi
AppShell.tsx| Kerangka utama aplikasi dan pengatur layout.
Sidebar.tsx| Navigasi samping untuk tampilan desktop.
BottomNav.tsx| Navigasi bawah mobile bergaya kaca cair: pil melayang, lensa aktif meluncur, turun saat keyboard terbuka (utils/navActive.ts menentukan tab aktif).
MobileHeader.tsx| Header khusus tampilan mobile.
UpdateBanner.tsx| Menampilkan pemberitahuan pembaruan aplikasi.
OfflineBanner.tsx| Menampilkan status atau pemberitahuan ketika offline.
PageTransition.tsx| Transisi antarhalaman: halaman lama memudar, halaman baru masuk geser maju/mundur.

components/ui/

Berisi komponen UI umum yang dapat digunakan kembali di berbagai halaman.

File| Fungsi
CoverArt.tsx| Menampilkan gambar cover musik.
Logo.tsx| Komponen logo MusicVerse.
EmptyState.tsx| Tampilan ketika belum ada data atau konten.
MarqueeText.tsx| Menampilkan teks berjalan.
PauseLines.tsx| Komponen animasi indikator jeda.
SettingSwitch.tsx| Komponen tombol pengaturan ON/OFF.
Chip.tsx| Komponen label atau kategori kecil.
SectionHeader.tsx| Komponen judul bagian atau section.
OverlayPortal.tsx| Akar semua menu bawah (sheet), dirender di <body> pada lapisan paling atas.
PlayingBars.tsx| Indikator equalizer tiga batang untuk lagu yang sedang diputar.
Presence.tsx| Menahan komponen tetap terpasang selama animasi keluar berjalan.
Reveal.tsx| Isi memudar masuk saat pertama tergulir ke layar.
RoundAction.tsx| Tombol aksi bulat berikon (label hanya untuk pembaca layar).

components/search/

Berisi komponen tab Cari saat kosong (jelajah).

File| Fungsi
BrowseTile.tsx| Kotak jelajah berwarna dengan hiasan miring di pojok (Link atau tombol).
SearchBrowse.tsx| Isi tab Cari kosong: Kejutkan aku, Di perangkatmu, Suasana, Genre.
BrowseDetail.tsx| Isi satu suasana, genre, playlist, atau album: Putar semua, Acak, artis teratas, daftar lagu.
AllSongsView.tsx| Kotak "Semua lagu": semua lagu di perangkat dengan kolom saring sendiri (dulu isi halaman Cari).

components/home/

Berisi komponen Beranda ala StreamBeats (kepala, banner bergulir, Recently, deretan kurasi dan rekomendasi).

File| Fungsi
HomeHeader.tsx| Kepala Beranda: menu, sapaan, sleep timer, notifikasi, kolom cari dan filter.
HomeMenuDrawer.tsx| Laci menu dari kiri (navigasi, Pengaturan, Tutorial).
HomeBanner.tsx| Banner besar bergulir otomatis: playlist pilihan, artis, dan lagu rekomendasi; tanpa data jadi ajakan membuka tab Cari.
HomeRecently.tsx| Recently: lagu baru diputar dalam tiga baris menyamping.
HomeShelf.tsx| Satu deretan kurasi (playlist, album, atau lagu) yang dimuat saat mendekati layar.
HomeSections.tsx| Susunan deretan Beranda: Recently, favorit, kurasi, rekomendasi, dan Dengar lagi.
HomeCards.tsx| Kartu dan pembungkus deretan: HomeRow, MediaCard, TrackCard, PlaylistTile, ArtistBubble.
homeNav.ts| Membuka halaman artis dari Beranda/jelajah dan mengingat asalnya agar jelajah tampil lagi saat kembali.

components/music/

Berisi komponen yang berkaitan dengan tampilan musik, artis, album, dan rekomendasi.

File| Fungsi
ArtistCard.tsx| Menampilkan informasi artis dalam bentuk kartu.
HorizontalRow.tsx| Menampilkan daftar konten secara horizontal.
TrackRow.tsx| Menampilkan informasi lagu dalam bentuk baris.
QuickPickCard.tsx| Kartu pilihan musik cepat.
PlaylistCard.tsx| Kartu informasi playlist.
GenreTile.tsx| Menampilkan kategori atau genre musik.

components/playlist/

Berisi komponen yang mengatur tampilan dan pengelolaan playlist.

File| Fungsi
PlaylistHeader.tsx| Menampilkan header dan informasi playlist.
TrackList.tsx| Menampilkan daftar lagu dalam playlist.
PlaylistSkeleton.tsx| Tampilan loading playlist.
AddToPlaylistSheet.tsx| Panel untuk menambahkan lagu ke playlist.
TrackRow.tsx| Menampilkan satu lagu dalam daftar playlist.
PlaylistView.tsx| Tampilan utama playlist.
PlaylistImportForm.tsx| Form untuk mengimpor playlist.
ArtistList.tsx| Daftar hasil pencarian artis (foto bulat, jumlah penggemar).
ArtistMatches.tsx| Blok "Artis" di atas hasil lagu pada tab Cari.
ArtistPlaylistSheet.tsx| Menu bawah untuk menyimpan lagu artis atau album ke playlist.
ArtistSearchPanel.tsx| Panel pencarian artis: daftar artis, halaman artis, lagu, dan diskografi album.
AvailabilityPanel.tsx| Panel status ketersediaan sumber audio tiap lagu playlist dan jalan ke Cari manual.

components/library/

Berisi komponen untuk mengelola koleksi musik pengguna.

File| Fungsi
PlaylistsSection.tsx| Menampilkan bagian daftar playlist.
NewPlaylistForm.tsx| Form pembuatan playlist baru.
SavedPlaylistCard.tsx| Kartu playlist yang sudah disimpan.
PlaylistMenuSheet.tsx| Panel menu tindakan playlist.
PlaylistSelection.tsx| Mode pilih banyak di Koleksi: kartu yang bisa dicentang (SelectableCard) dan bilah aksi hapus sekaligus (SelectionBar).
ManualSearchSheet.tsx| Panel pencarian manual.
MoveDownloadSheet.tsx| Panel untuk memindahkan unduhan.
DownloadsSection.tsx| Menampilkan bagian daftar unduhan. Folder Lokal (LocalFolder) selalu tampil paling atas.
LocalFolder.tsx| Folder "Lokal" di tab Unduhan: semua audio di HP kecuali unduhan MusicVerse; tidak bisa dihapus (hanya pindai ulang), tanpa aksi hapus/unduh per lagu.
PlaylistTransferPanel.tsx| Panel pemindahan atau transfer playlist.
RecentlyPlayedList.tsx| Menampilkan daftar musik yang baru diputar.
MyPlaylistsSection.tsx| Menampilkan playlist milik pengguna.
RefreshChoiceSheet.tsx| Pilihan cara menyegarkan playlist Spotify yang tersimpan.
SavedPlaylistMenuSheet.tsx| Menu aksi untuk playlist Spotify yang tersimpan.
TrackSelectionBar.tsx| Bilah mode pilih banyak lagu (pilih semua, salin, pindah, hapus).
TrackTransferSheet.tsx| Menu bawah untuk menyalin atau memindahkan lagu terpilih antarplaylist.

components/player/

Berisi seluruh komponen yang berkaitan dengan sistem pemutar musik.

File| Fungsi
FullPlayer.tsx| Tampilan pemutar musik penuh.
NativeMediaSync.tsx| Sinkronisasi media dengan sistem native.
SheetAction.tsx| Komponen aksi pada bottom sheet.
UpcomingList.tsx| Menampilkan daftar lagu berikutnya.
TrackMenuSheet.tsx| Panel menu tindakan lagu.
AddToPlaylistPicker.tsx| Pemilih playlist untuk menambahkan lagu.
MiniPlayer.tsx| Tampilan pemutar musik mini.
TrackActionSheet.tsx| Panel tindakan untuk lagu.
LyricLine.tsx| Menampilkan satu baris lirik.
AutoResumeSync.tsx| Sinkronisasi fitur melanjutkan pemutaran otomatis.
MiniBubble.tsx| Tampilan pemutar berbentuk gelembung mini.
PlayerControls.tsx| Kontrol pemutaran musik.
CrossfadeSheet.tsx| Panel pengaturan crossfade.
MediaSessionSync.tsx| Sinkronisasi dengan Media Session API.
LyricsPanel.tsx| Panel tampilan lirik musik.
PlayerDock.tsx| Pengatur posisi atau area pemutar.
SeekBar.tsx| Pengatur posisi waktu pemutaran lagu.
SleepTimerSheet.tsx| Panel pengaturan sleep timer.
QueuePanel.tsx| Panel daftar antrean pemutaran.
AutoRadioSync.tsx| Mengisi ulang antrean (radio) saat lagu tersisa tinggal sedikit, juga untuk rantai native.
AutoSync.tsx| Menerbitkan daftar telusur (Baru diputar, Antrean, pustaka) ke Android Auto lewat native.
KaraokeWords.tsx| Tampilan lirik per kata dengan sapuan warna mengikuti waktu lagu.
SpeedSheet.tsx| Menu bawah pilihan kecepatan putar (nada tetap).
ThemeAccentSync.tsx| Menyelaraskan aksen aplikasi dengan sampul lagu yang diputar (aksen dinamis).
VolumeNormSync.tsx| Meneruskan kekerasan lagu ke mesin audio untuk penyeragaman volume.
WidgetLyricsSync.tsx| Mengirim baris lirik berwaktu ke widget layar utama.

components/settings/

Berisi komponen khusus halaman pengaturan.

File| Fungsi
ColorField.tsx| Kolom pemilih warna (hex) untuk pengaturan tema.
LyricProviderSettings.tsx| Pengaturan sumber lirik dan tampilan terjemahan/romanisasi.

---

3.2. src/pages/

Folder yang menyimpan halaman utama aplikasi.

File| Fungsi
HomePage.tsx| Halaman utama MusicVerse: sapaan, banner, tombol cari (mengantar ke tab Cari), lalu deretan rekomendasi.
SearchPage.tsx| Halaman Cari: kolom cari (judul, artis, tautan Spotify) + hasilnya; saat kosong jelajah (Kejutkan aku, pintasan perangkat, suasana, genre) atau satu kotak jelajah lewat ?view=all|mood|genre.
BrowsePage.tsx| Halaman penjelajahan artis dan album.
LibraryPage.tsx| Halaman koleksi musik pengguna.
MyPlaylistPage.tsx| Halaman playlist pribadi.
DownloadsPage.tsx| Halaman daftar musik yang diunduh.
HistoryPage.tsx| Halaman riwayat pemutaran musik.
SettingsPage.tsx| Halaman pengaturan utama.
PlaybackSettingsPage.tsx| Halaman pengaturan pemutaran musik.
DownloadSettingsPage.tsx| Halaman pengaturan unduhan.
PlaylistSettingsPage.tsx| Halaman pengaturan playlist.
EqualizerPage.tsx| Halaman equalizer audio.
BackupPage.tsx| Halaman pencadangan dan pemulihan data.
LegalPage.tsx| Pengaturan > Kebijakan Privasi / Ketentuan Layanan di APK.
RecapPage.tsx| Rekap dengar (7 hari, 30 hari, semua) dan kartu bagikan.
ThemeSettingsPage.tsx| Pengaturan > Tema: mode, aksen, gaya permukaan, tema siap pakai, layar pembuka & ikon.
UpdateSettingsPage.tsx| Pengaturan > Pembaruan: cek, unduh, dan pasang APK terbaru.

---

3.3. src/context/

Menyimpan React Context untuk pengelolaan state global aplikasi.

File| Fungsi
AudioPlayerContext.tsx| Mengelola state global pemutar musik.
LibraryContext.tsx| Mengelola state koleksi musik.
PlaylistContext.tsx| Mengelola state playlist.
MyPlaylistsContext.tsx| Mengelola state playlist pribadi.
PlayerUiContext.tsx| Mengelola state tampilan UI pemutar musik.
SleepTimerContext.tsx| Mengelola state sleep timer.
TrackMenuContext.tsx| Mengelola state menu tindakan lagu.

---

3.4. src/hooks/

Menyimpan custom React Hooks untuk memisahkan logika aplikasi dari komponen UI.

File| Fungsi
useAudioPlayer.ts| Mengakses fungsi dan state pemutar musik.
useAudioPlayerController.ts| Mengatur logika kontrol pemutaran audio.
useLongPress.ts| Mendeteksi interaksi tekan lama.
greeting.ts| Menghasilkan sapaan berdasarkan waktu.
useHomeFeed.ts| Data Beranda: playlist/artis favorit, rekomendasi, Dengar lagi, dan item banner (riwayat di perangkat + playlist chart).
useHomeShelf.ts| Memuat satu deretan kurasi hanya saat sudah dekat layar.
useInView.ts| True sekali saat elemen mendekati layar (IntersectionObserver).
useMountTransition.ts| Menahan elemen terpasang selama animasi keluar (laci, popover).
usePlaylistPrefs.ts| Mengelola preferensi playlist.
useLyrics.ts| Mengambil dan mengelola data lirik.
useMiniPlayerMode.ts| Mengatur mode mini player.
useKeyboardOpen.ts| Mendeteksi keyboard layar terbuka (bersama utils/keyboardState.ts); dipakai BottomNav, MiniPlayer, AppShell.
useAppUpdate.ts| Mengelola pengecekan pembaruan aplikasi.
useOnlineStatus.ts| Memantau status koneksi internet.
useLyricTiming.ts| Mengatur sinkronisasi waktu lirik.
useNowPlaying.ts| Mengakses informasi lagu yang sedang diputar.
useOverlayHistory.ts| Mengelola riwayat tampilan overlay.
useCoverGlow.ts| Mengambil warna dominan sampul untuk cahaya latar.
useEnterClosesKeyboard.ts| Tombol Enter menutup keyboard layar pada kolom teks.
useExitGhost.ts| Animasi keluar sheet/panel lewat salinan bayangan di <body>.
useListFlip.ts| Animasi FLIP: baris yang berpindah tempat meluncur ke slot baru.
useLyricDisplayPrefs.ts| Preferensi tampilan terjemahan/romanisasi lirik (reaktif).
useOfflineBlock.ts| Menolak memutar lagu yang belum diunduh saat offline.
usePlaylistPlayback.ts| Status tombol utama Putar semua / Jeda mengikuti pemutar.
usePulse.ts| Membal kecil sebagai umpan balik (suka, antrean, playlist, unduhan).
useSheetDrag.ts| Seret menu bawah untuk menutup.
useSwipeSelect.ts| Geser baris untuk memilih (dasar geser lagu).
useTheme.ts| Membaca dan mengubah tema aplikasi.
useTrackAvailability.ts| Memeriksa ketersediaan sumber audio tiap lagu (ok / missing / unknown).
useTrackSwipe.ts| Aksi geser pada baris lagu (antre, suka, pilih).

---

3.5. src/services/

Menyimpan layanan utama yang digunakan aplikasi.

File| Fungsi
audioEngine.ts| Mesin utama untuk pemutaran audio.
lyricsApi.ts| Mengelola komunikasi dengan API lirik.
spotifyApi.ts| Mengelola integrasi API Spotify.
equalizer.ts| Mengatur pemrosesan dan pengaturan equalizer audio.
artistApi.ts| Pencarian artis dari luar (Deezer + iTunes): profil, lagu, diskografi, chart dunia, artis dari kata kunci.
homeFeed.ts| Pemuat data Beranda (chart, radio artis, foto artis) dengan cache berumur di perangkat; galat jaringan tidak dilempar.
coverOrigin.ts| Asal thumbnail sampul untuk transisi sampul terbang ke pemutar penuh.
playbackSpeed.ts| Kecepatan putar tersimpan (nada tetap).
playerSheet.ts| Mesin gerak tunggal mini player <-> pemutar penuh.
radio.ts| Radio: mencari lagu mirip saat antrean hampir habis.
titleAliases.ts| Nama lain judul lagu di aksara/bahasa lain (katalog iTunes) untuk pencocokan.
volumeNorm.ts| Pengaturan penyeragaman volume antarlagu.

---

3.6. src/plugins/

Menyimpan sistem plugin dan integrasi berbagai sumber musik.

File| Fungsi
suggestions.ts| Mengelola rekomendasi sumber musik.
spotifyImporter.ts| Mengimpor data dari Spotify.
http.ts| Mengelola permintaan HTTP.
quality.ts| Mengatur kualitas sumber atau streaming.
registry.ts| Mengelola registrasi plugin.
ytmusic.ts| Integrasi sumber YouTube Music.
ytvideo.ts| Integrasi sumber video YouTube.
thirdParty.ts| Mengelola integrasi pihak ketiga.
types.ts| Definisi tipe data untuk sistem plugin.
manualPins.ts| Pilihan Cari manual pengguna per lagu, dipakai lagi saat diputar/diunduh.
ytLyrics.ts| Lirik dari YouTube Music (sumber pertama lirik).

---

3.7. src/native/

Berisi penghubung antara aplikasi React dan fitur native Android.

File| Fungsi
offline.ts| Mengelola fitur dan status offline.
localMusic.ts| Daftar audio lokal di HP (folder Lokal): izin, pemindaian MediaStore via native, sampul, dan pemutaran lagu lokal.
appUpdate.ts| Mengelola pembaruan aplikasi native.
musicVerseNative.ts| Penghubung aplikasi dengan fitur MusicVerse native.
platform.ts| Mendeteksi platform yang sedang digunakan.
offlineLyrics.ts| Mengelola lirik yang tersedia secara offline.
engineSettings.ts| Mengatur konfigurasi mesin audio native.
backButton.ts| Mengelola tombol kembali Android.
downloads.ts| Mengelola proses unduhan native.
connection.ts| Mengelola koneksi jaringan.
nativeStorage.ts| Mengelola penyimpanan data native.
appearance.ts| Tema ke luar layar aplikasi: splash web, latar jendela native, dan ikon aplikasi ikut tema.
backgroundGuard.ts| Izin agar pemutaran latar tidak dibekukan sistem (penghemat baterai, jeda aktivitas).
clipboard.ts| Clipboard lewat plugin native di APK, API web di peramban.
liveUpdate.ts| Pembaruan tampilan tanpa APK baru (OTA).
nativeSession.ts| Membaca sesi pemutaran native (lagu dan posisi) saat app dibuka lagi.
playJournal.ts| Membaca jurnal lagu yang diputar native saat JS beku.
radioExtras.ts| Membaca tambahan radio yang dicari native saat JS beku.

---

3.8. src/utils/

Berisi fungsi utilitas yang digunakan untuk mendukung berbagai fitur aplikasi.

File| Fungsi
libraryNotice.ts| Mengelola pemberitahuan koleksi.
playerStatus.ts| Mengelola informasi status pemutar.
playLog.ts| Mencatat aktivitas pemutaran musik.
backGuard.ts| Mengelola pengamanan navigasi kembali.
playlistStorage.ts| Mengelola penyimpanan data playlist.
fallbackCover.ts| Menyediakan cover pengganti ketika gambar tidak tersedia.
trackTitle.ts| Mengolah dan memformat judul lagu.
allSongs.ts| Mengelola data seluruh lagu.
config/navigation.ts| Konfigurasi navigasi aplikasi.
libraryStorage.ts| Mengelola penyimpanan data koleksi.
playlistPrefs.ts| Mengelola preferensi playlist.
searchPlaylist.ts| Mengelola pencarian playlist.
swallowNextClick.ts| Mengendalikan klik berikutnya.
spotifyUrl.ts| Mengolah dan memvalidasi URL Spotify.
formatTime.ts| Memformat informasi waktu.
notificationCover.ts| Mengelola gambar cover pada notifikasi.
lrc.ts| Mengolah file lirik berformat LRC.
queueResultText.ts| Menghasilkan teks hasil antrean.
probeAudio.ts| Memeriksa informasi file audio.
networkQuality.ts| Memeriksa kualitas jaringan.
playerSession.ts| Mengelola sesi pemutar musik.
myPlaylistStorage.ts| Mengelola penyimpanan playlist pribadi.
formatRelativeTime.ts| Memformat waktu relatif.
playlistMapper.ts| Memetakan struktur data playlist.
matchTrack.ts| Mencocokkan data lagu.
trackSearch.ts| Mengelola pencarian lagu.
backup.ts| Mengelola sistem backup dan pemulihan.
clipDetect.ts| Mendeteksi klip atau bagian audio.
playerQueue.ts| Mengelola antrean pemutaran.
safeStorage.ts| Mengelola penyimpanan data secara aman.
lyricsTrack.ts| Mencocokkan data lirik dengan lagu.
localTrack.ts| Identitas lagu lokal (`local:<id>`, kunci `lc-<id>`, URI MediaStore); murni, dipakai offline.ts dan localMusic.ts.
artistSearchStore.ts| State pencarian artis di Beranda (mode, fase, urutan lagu).
searchHistory.ts| Riwayat kata kunci yang dicari di tab Cari (maks. 20), bahan rekomendasi Beranda.
searchResultsFlag.ts| Penanda (di memori) bahwa hasil di tab Cari sedang dibuka pengguna, supaya playlist hasil pemulihan tidak menutup jelajah.
deezerMatch.ts| Pencocokan lagu dengan hasil pencarian Deezer.
lyricDisplayPrefs.ts| Penyimpanan pengaturan tampilan terjemahan/romanisasi lirik.
lyricSubtext.ts| Teks tambahan di bawah baris lirik setelah pengaturan diterapkan.
nativeAdvance.ts| Penjaga rantai lagu native agar tidak memutar ulang lagu yang sama.
playbackLog.ts| Log pemutaran ringan di aplikasi (200 baris terakhir).
playlistMembership.ts| Menghitung keanggotaan lagu di playlist-playlist pengguna.
recap.ts| Perhitungan rekap dengar per periode.
romanize.ts| Romanisasi lokal lirik (kana, Hangul, Devanagari, Sirilik).
sameSong.ts| Mengenali lagu yang sama antarsumber (playlist, unduhan, lokal, riwayat).
shareCard.ts| Membuat kartu bagikan bergaya story 9:16.
spring.ts| Easing pegas untuk animasi sheet dan umpan balik.
theme.ts| Mesin tema: warna, mode gelap/terang/otomatis, sudut, aksen dari sampul.
viewportSettle.ts| Menunggu ukuran layar tenang setelah keyboard naik.
ytLyricsParse.ts| Pengurai respons lirik YouTube Music.

---

3.9. src/data/

Menyimpan data yang digunakan oleh aplikasi.

File| Fungsi
mock.ts| Menyimpan data contoh atau mock untuk kebutuhan aplikasi.

---

3.10. src/config/

Menyimpan konfigurasi internal aplikasi.

File| Fungsi
navigation.ts| Mengatur konfigurasi navigasi.
moods.ts| Daftar suasana tab Cari (judul, kata kunci playlist Deezer, warna dan bentuk kotak).
homeShelves.ts| Deretan kurasi Beranda (judul, emoji, sumber Deezer).
apk.ts| Menyimpan konfigurasi terkait APK.
site.ts| Info situs dan tanggal terakhir dokumen hukum diubah.

---

3.11. src/types/

Menyimpan definisi tipe data TypeScript.

File| Fungsi
index.ts| Definisi tipe data umum aplikasi.
spotify.ts| Definisi tipe data integrasi Spotify.
player.ts| Definisi tipe data pemutar musik.
library.ts| Definisi tipe data koleksi musik.

---

3.12. Root files dalam src/

File| Fungsi
App.tsx| Komponen utama dan pengatur struktur aplikasi React.
main.tsx| Entry point utama aplikasi React.
index.css| Style global aplikasi.
vite-env.d.ts| Deklarasi tipe lingkungan Vite.

---

3.13. src/legal/

Menyimpan dokumen hukum (Kebijakan Privasi dan Ketentuan Layanan) yang dipakai bersama oleh situs web dan APK.

File| Fungsi
content.ts| Isi dokumen hukum. Satu-satunya sumber; ubah di sini lalu perbarui LEGAL_UPDATED di config/site.ts.
LegalDocument.tsx| Tampilan dokumen hukum (nada gelap di APK, terang di situs).

3.14. src/site/

Menyimpan situs web untuk peramban biasa. MusicVerse tidak punya versi web: satu-satunya halaman adalah landing untuk memasang APK, ditambah Kebijakan Privasi dan Ketentuan Layanan. Versi lengkap hanya dimuat di APK lewat src/App.tsx.

File| Fungsi
SiteApp.tsx| Aplikasi untuk peramban biasa; alamat lain dialihkan ke "/".
SiteLayout.tsx| Kerangka situs: header, konten, footer.
LandingPage.tsx| Halaman landing pemasangan APK.
PhoneMock.tsx| Ilustrasi ponsel di landing (lirik karangan sendiri).
EqBars.tsx| Batang equalizer animasi seperti logo.
FeedbackSection.tsx| Formulir saran, ulasan, dan laporan bug.
SiteLegalPage.tsx| Halaman /privacy dan /terms di situs web.
SiteLogo.tsx| Logo untuk latar terang.

3.15. src/tour/

Menyimpan tutorial interaktif dan tur "Yang baru" di APK.

File| Fungsi
steps.ts| Definisi langkah tutorial utama, tur per halaman, dan daftar WHATS_NEW per rilis.
tourStore.ts| State tur dan penanda sudah dilihat/selesai (disimpan di perangkat).
TourHost.tsx| Penampil tur: sorotan, kartu langkah, dan navigasi antarlangkah.
DemoStage.tsx| Peragaan animasi kecil di dalam kartu.
PracticeStage.tsx| Latihan langsung di dalam kartu (geser, tahan, suka, pilih lagu, seret disc, kuis).

---

4. PUBLIC/

Folder "public/" menyimpan aset statis yang digunakan aplikasi.

File / Folder| Fungsi
favicon.svg| Ikon aplikasi untuk browser.
icons/icon-192.png| Ikon aplikasi berukuran 192 × 192 piksel.
icons/icon-512.png| Ikon aplikasi berukuran 512 × 512 piksel.

---

5. NATIVE ANDROID/

Folder "native/android/" menyimpan implementasi fitur native Android yang berhubungan dengan aplikasi MusicVerse.

5.1. Java Source Files

File| Fungsi
MusicVerseNativePlugin.java| Plugin penghubung antara JavaScript dan Android native.
RelaunchActivity.java| Activity layar penuh berlatar tema + ikon (proses :relaunch) yang menutupi layar dan membuka aplikasi lagi sesudah ikon diganti (tampak seperti mulai ulang).
MainActivity.java| Activity utama aplikasi Android.
NetWatch.java| Memantau kondisi dan perubahan jaringan.
PlaybackService.java| Layanan pemutaran musik di background.
DownloadQueue.java| Mengelola antrean unduhan.
NativeDownloader.java| Menangani proses pengunduhan native.
MediaExporter.java| Mengelola ekspor file media.
InterruptionResumer.java| Mengelola pemulihan pemutaran setelah gangguan.
AudioFinalizer.java| Menangani proses akhir audio.
LocalAudioScanner.java| Memindai audio di HP lewat MediaStore (tanpa milik MusicVerse) dan menyiapkan sampulnya untuk folder Lokal.
UpdateFileProvider.java| Menyediakan akses file untuk proses pembaruan.
DownloadService.java| Layanan unduhan Android.
StreamProxy.java| Mengelola proxy streaming audio.
AutoBridge.java| Penghubung Android Auto <-> JavaScript (daftar telusur dari JS).
AutoBrowserService.java| Pintu masuk Android Auto, Asisten Google, dan kontrol media sistem.
MediaSessionHolder.java| Memegang satu MediaSession untuk seluruh proses (dipakai PlaybackService dan Auto).
MusicVerseWidget.java| Kelas dasar widget layar utama (logika semua bentuk widget).
MusicVerseWidgetConfig.java| Pengaturan per widget (tema, aksen, sampul, sudut) di SharedPreferences.
MusicVerseWidgetConfigActivity.java| Layar pengaturan widget dengan pratinjau langsung.
MusicVerseWidgetTiny.java| Widget bentuk Mini 1×1.
MusicVerseWidgetStrip.java| Widget bentuk Strip 4×1.
MusicVerseWidgetSquare.java| Widget bentuk Kotak 2×2.
MusicVerseWidgetTall.java| Widget bentuk Tinggi 2×3.
MusicVerseWidgetLarge.java| Widget bentuk Besar 4×2.
NativeSession.java| Mencatat lagu aktif dan posisi menurut pemutar native.
PlayJournal.java| Jurnal lagu yang diputar native saat JS beku atau activity dihancurkan.
RadioExtras.java| Daftar tambahan radio yang dicari native saat JS beku.
RadioFinder.java| Pencarian lagu mirip untuk radio secara native (padanan radio.ts).
TrackMatch.java| Pencocokan lagu native (padanan matchTrack.ts, clipDetect.ts, trackTitle.ts).
WidgetColors.java| Hitungan warna widget yang murni (bisa diuji di JVM).
WidgetGlass.java| Menggambar latar widget (frost, kilau kaca, sudut) sebagai satu bitmap.
YtMatcher.java| Pencarian lagu native: judul + artis -> video YouTube dan stream, tanpa JS.
YtResolver.java| Pengambil stream YouTube native untuk link baru saat JS beku.

5.2. Android Resources

res/drawable-nodpi/

Menyimpan aset gambar yang tidak mengikuti skala density layar Android.

Fungsi:

- Menyimpan gambar yang digunakan pada tampilan native.
- Menyediakan aset gambar untuk kebutuhan notifikasi dan media.

res/xml/

File| Fungsi
update_file_paths.xml| Mengatur konfigurasi jalur file untuk proses pembaruan aplikasi.
automotive_app_desc.xml| Deskripsi aplikasi untuk Android Auto (aplikasi media).
widget_tiny_info.xml / widget_strip_info.xml / widget_square_info.xml / widget_tall_info.xml / widget_large_info.xml| Info penyedia widget layar utama per bentuk.

res/values/

File| Fungsi
mv_colors.xml| Menyimpan definisi warna untuk tampilan native MusicVerse.
mv_icon_variants.xml| Warna latar tiap varian ikon launcher per tema (hasil gen-icon-variants.py).
mv_splash.xml| Warna dan pengaturan splash sistem Android.

res/drawable/

Menyimpan gambar dan ikon yang digunakan pada tampilan Android native.

res/mipmap-mdpi/

Menyimpan ikon launcher untuk perangkat dengan density MDPI.

res/mipmap-hdpi/

Menyimpan ikon launcher untuk perangkat dengan density HDPI.

res/mipmap-xhdpi/

Menyimpan ikon launcher untuk perangkat dengan density XHDPI.

res/mipmap-xxhdpi/

Menyimpan ikon launcher untuk perangkat dengan density XXHDPI.

res/mipmap-xxxhdpi/

Menyimpan ikon launcher untuk perangkat dengan density XXXHDPI.

res/mipmap-anydpi-v26/

Menyimpan ikon launcher adaptif untuk Android versi yang mendukung adaptive icon.

---

5.3. File lain di native/android/

File| Fungsi
AndroidManifest.additions.xml| Contoh entri yang ditambahkan ke AndroidManifest.xml (bukan bagian build).
icon-presets.json| Daftar tema siap pakai (id, aksen, latar) untuk ikon aplikasi ikut tema.

res/layout/

File| Fungsi
widget_tiny.xml / widget_strip.xml / widget_square.xml / widget_tall.xml / widget_large.xml / widget_player.xml| Tata letak widget layar utama per bentuk.

res/xml-v31/

File| Fungsi
widget_*_info.xml| Info penyedia widget untuk Android 12+ (ukuran dan perilaku ubah ukuran).

test/

Tes JVM murni (tanpa Android) untuk logika native; lihat test/README.md.

File| Fungsi
mv/RadioTest.java| Tes logika RadioFinder.
mv/WidgetColorsTest.java| Tes hitungan warna widget.
org/json/| Pengganti ringan org.json agar tes jalan di JVM biasa.

---

6. API/

Folder "api/" menyimpan kode yang digunakan untuk mendukung layanan backend atau API.

File| Fungsi
proxy.js| Menangani permintaan proxy API.

---

7. SCRIPTS/

Folder "scripts/" menyimpan skrip pendukung untuk proses konfigurasi dan pengembangan.

File| Fungsi
setup-android.mjs| Membantu menyiapkan konfigurasi Android.
check-android-env.sh| Memeriksa konfigurasi dan lingkungan pengembangan Android.
gen-icon-variants.py| Membuat ikon launcher per tema dari native/android/icon-presets.json.
make-ota.mjs| Membuat paket pembaruan tampilan (OTA) dari folder dist.
native-hash.mjs| Sidik jari bagian native; pemasangan OTA hanya bila sama dengan APK.
ts-resolve.mjs| Resolver tes Node agar import tanpa ekstensi menjadi .ts.

---

8. DOCS/

Folder "docs/" menyimpan dokumentasi teknis project.

File| Fungsi
ANDROID.md| Dokumentasi mengenai konfigurasi dan pengembangan Android MusicVerse.
ANIMASI-BELUM-DIKERJAKAN.md| Catatan pekerjaan animasi premium yang belum selesai dan yang perlu diuji.
HANDOFF-lyrics-wordsync.md| Catatan serah terima fitur lirik per kata.

---

9. GITHUB WORKFLOWS/

Folder ".github/workflows/" berisi konfigurasi otomatisasi GitHub Actions.

File| Fungsi
apk.yml| Mengatur workflow otomatis untuk proses build APK.
ota.yml| Workflow pembaruan tampilan (OTA) otomatis tiap push.

---

10. ROOT CONFIGURATION FILES

File konfigurasi utama yang terletak di root project.

File| Fungsi
package.json| Menyimpan informasi project, dependencies, dan scripts npm.
vite.config.ts| Mengatur konfigurasi Vite.
capacitor.config.ts| Mengatur konfigurasi Capacitor.
tsconfig.json| Konfigurasi utama TypeScript.
tsconfig.app.json| Konfigurasi TypeScript untuk aplikasi.
tsconfig.node.json| Konfigurasi TypeScript untuk lingkungan Node.js.
tailwind.config.js| Konfigurasi Tailwind CSS.
postcss.config.js| Konfigurasi PostCSS.
index.html| HTML utama sebagai entry point aplikasi web.
vercel.json| Konfigurasi deployment Vercel.
.env.example| Contoh konfigurasi environment variables.
.gitignore| Menentukan file dan folder yang diabaikan oleh Git.
README.md| Dokumentasi pengenalan project.
DEVELOPMENT_RULES.md| Aturan pengembangan lanjutan: fitur baru, tutorial dan "Yang baru", versi, catatan perubahan, APK/OTA.

---

11. CHANGELOG / VERSION HISTORY

File changelog menyimpan riwayat perubahan dari berbagai versi MusicVerse.

File| Fungsi
CHANGES.md| Arsip gabungan riwayat perubahan semua versi lama (sampai 0.5.51.7), terbaru di atas.
CHANGES-0.5.54.md| Riwayat perubahan versi 0.5.54 (terbaru).

---

12. APPLICATION ARCHITECTURE

Berikut gambaran sederhana hubungan antara bagian-bagian utama MusicVerse.

                    main.tsx
                       |
                       v
                     App.tsx
                       |
                       v
                  AppShell.tsx
                       |
          +------------+------------+------------+
          |            |            |
          v            v            v
        Pages      Components    Context
          |            |            |
          |            |            |
          +------------+------------+------------+
                       |
                       v
                     Hooks
                       |
                       v
                    Services
                       |
          +------------+------------+------------+
          |            |            |
          v            v            v
       Plugins       Utils      Native Bridge
          |                         |
          v                         v
    Music Sources              Android Native

12.1. Main Application Flow

- "main.tsx" menjadi titik awal aplikasi React.
- "App.tsx" mengatur komponen utama aplikasi.
- "AppShell.tsx" menyediakan kerangka tampilan aplikasi.
- "Pages/" menyimpan halaman yang dapat diakses pengguna.
- "Components/" menyediakan komponen UI.
- "Context/" mengelola state global.
- "Hooks/" menyediakan logika yang dapat digunakan kembali.
- "Services/" mengelola layanan utama aplikasi.
- "Plugins/" menghubungkan berbagai sumber musik.
- "Utils/" menyediakan fungsi pendukung.
- "Native/" menghubungkan aplikasi dengan fitur Android native.

---

13. DEVELOPMENT RULES

Bagian ini merupakan aturan penting yang harus diikuti setiap kali melakukan pengembangan MusicVerse.

13.1. Sebelum Mengubah Kode

1. Periksa file yang berkaitan dengan fitur yang akan diubah.
2. Baca implementasi yang sudah ada.
3. Periksa hubungan antarcomponent, context, hooks, services, dan utils.
4. Pastikan tidak ada fungsi serupa yang sudah tersedia.
5. Pertahankan arsitektur project yang sudah digunakan.

13.2. Penempatan File

Gunakan lokasi sesuai tanggung jawab masing-masing.

Jenis kode| Lokasi
Komponen UI| "src/components/"
Halaman aplikasi| "src/pages/"
State global| "src/context/"
Custom hooks| "src/hooks/"
Layanan aplikasi| "src/services/"
Integrasi sumber musik| "src/plugins/"
Android native bridge| "src/native/"
Fungsi utilitas| "src/utils/"
Data aplikasi| "src/data/"
Konfigurasi internal| "src/config/"
Definisi tipe| "src/types/"
Aset statis| "public/"
Kode Android| "native/android/"
Backend/API| "api/"
Skrip pengembangan| "scripts/"
Dokumentasi| "docs/"

13.3. Hindari Duplikasi

- Jangan membuat fungsi baru apabila fungsi yang sama sudah tersedia.
- Jangan membuat Context baru tanpa memeriksa Context yang sudah ada.
- Jangan membuat custom hook baru apabila logikanya sudah ditangani hook yang tersedia.
- Jangan membuat komponen player yang menduplikasi fungsi komponen player lama.
- Gunakan kembali sistem penyimpanan yang sudah tersedia.
- Pertahankan integrasi dengan sistem audio yang sudah digunakan.

13.4. Konsistensi Aplikasi

Setiap perubahan harus mempertahankan:

- Konsistensi tampilan UI.
- Konsistensi sistem navigasi.
- Konsistensi state aplikasi.
- Konsistensi pemutaran musik.
- Konsistensi antrean lagu.
- Konsistensi penyimpanan playlist.
- Kompatibilitas Android.
- Kompatibilitas tampilan mobile dan desktop.

13.5. Aturan Perubahan Android Native

Jika perubahan berhubungan dengan Android native:

1. Periksa implementasi Java yang sudah tersedia.
2. Periksa native bridge di "src/native/".
3. Periksa konfigurasi Capacitor.
4. Pertahankan komunikasi antara JavaScript dan Android.
5. Jangan menghapus layanan background yang masih digunakan.
6. Pastikan perubahan tidak mengganggu playback dan download service.

Aturan lanjutan (fitur baru, tutorial dan "Yang baru", versi, catatan perubahan, APK/OTA, pemeriksaan) ada di berkas terpisah: `DEVELOPMENT_RULES.md`.

---

14. PROJECT STRUCTURE MAINTENANCE
Dokumentasi ini harus selalu diperbarui ketika struktur project mengalami perubahan.

 Ketika Menambahkan File Baru
  • Tambahkan informasi berikut:
  • Nama file.
  • Lokasi folder.
  • Fungsi file.
  • Hubungannya dengan fitur lain jika diperlukan.

 Ketika Menghapus File
  • Hapus file tersebut dari dokumentasi.
  • Pastikan tidak ada referensi yang tertinggal.
  • Periksa apakah fungsi file sudah tidak digunakan.
 
 Ketika Memindahkan File
  • Perbarui lokasi file.
  • Perbarui hubungan antarbagian jika berubah.
  • Pastikan dokumentasi sesuai dengan struktur      terbaru.
  
 Ketika Menambahkan Folder Baru
  • Tambahkan folder ke struktur utama.
  • Jelaskan tanggung jawab folder.
  • Dokumentasikan file penting di dalamnya.
  
15. IMPORTANT NOTES FOR FUTURE DEVELOPMENT
 PROJECT_STRUCTURE.md merupakan dokumentasi referensi struktur project MusicVerse.
 
 Setiap kali melakukan perubahan project:
  • Gunakan dokumentasi ini untuk menemukan       lokasi file.
  • Periksa source code asli sebelum mengubahnya.
  • Jangan mengandalkan dokumentasi saja apabila   implementasi aktual berbeda.
  • Jangan membuat struktur baru tanpa alasan       yang jelas.
  • Jangan menghapus fitur lama yang tidak          berhubungan dengan perubahan.
  • Pertahankan kompatibilitas dengan sistem yang     sudah ada.
  • Perbarui dokumentasi setelah perubahan selesai.
  • Pastikan seluruh informasi dokumentasi sesuai    dengan kondisi source code terbaru.
  • Prioritas utama: menjaga stabilitas, konsistensi, dan struktur MusicVerse agar pengembangan berikutnya tidak merusak fitur yang sudah berjalan.
  
End of Project Structure Documentation
Project: MusicVerse
Reference Version: v0.5.52
Document: PROJECT_STRUCTURE.md
## Lirik per kata (0.5.54 – 0.5.56)
- `src/utils/`: `lrc.ts` (model + eLRC), `ttml.ts`, `lyricsPlus.ts`, `wordSync.ts`, `lyricProviderPrefs.ts`
- `src/services/`: `wordLyrics.ts` (provider LyricsPlus / BetterLyrics), `lyricsApi.ts` (`fetchLyrics`)
- `src/native/lyricsCache.ts`: cache lirik persisten (IndexedDB, LRU 500, TTL 30 hari)
- `src/components/player/LyricsPanel.tsx`, `LyricLine.tsx`: tampilan; `src/components/settings/LyricProviderSettings.tsx`: pengaturan provider
- `api/proxy.js`: upstream `lyricsplus` dan `boidu` untuk web; `scripts/test-lyrics.mjs`: `npm run test:lyrics`
