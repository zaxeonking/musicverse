# MusicVerse

Web music player (tahap 1: layout, tahap 2: integrasi API playlist, tahap 3: daftar track, tahap 4: playback, tahap 5: MiniPlayer + FullPlayer, tahap 6: Queue + Play All, tahap 7: tampilan Queue + navigasi lagu, tahap 8: halaman Koleksi). React + Vite + TypeScript + Tailwind CSS + Lucide React.

## Menjalankan

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + build produksi
```

## Struktur

```
src/
  components/
    layout/   AppShell, Sidebar (desktop), BottomNav (mobile), MobileHeader
    playlist/ PlaylistImportForm, PlaylistView, PlaylistHeader, TrackList, TrackRow, PlaylistSkeleton
    library/  SavedPlaylistCard, RecentlyPlayedList
    music/    PlaylistCard, QuickPickCard, ArtistCard, TrackRow, GenreTile, HorizontalRow
    player/   PlayerDock, MiniPlayer, FullPlayer, QueuePanel, SeekBar, PlayerControls (TransportControls, QueueButton, SpotifyLink, PlayerError)
    ui/       CoverArt, Chip, Logo, SectionHeader, EmptyState
  config/     navigation.ts
  context/    PlaylistContext (state memuat/berhasil/gagal), AudioPlayerContext (satu pemilik audio engine), LibraryContext (Koleksi)
  services/   spotifyApi.ts (fetchPlaylist, fetchPlaybackInfo), audioEngine.ts (satu HTMLAudioElement)
  utils/      spotifyUrl.ts (validasi URL), fallbackCover, playlistMapper, trackSearch, playerQueue (fungsi murni queue),
              safeStorage + libraryStorage (penyimpanan Koleksi), formatRelativeTime
  data/       mock.ts (data sementara, diganti API nanti)
  hooks/      greeting.ts, useAudioPlayer (konsumen), useAudioPlayerController (logika), useNowPlaying (metadata lagu aktif)
  pages/      HomePage, SearchPage, LibraryPage
  types/      index.ts, spotify.ts (tipe respons API), library.ts (tipe Koleksi)
```

## Halaman Home

Home berisi sapaan sesuai jam lokal, input tautan playlist Spotify, tombol **Load Playlist**,
skeleton saat memuat, header playlist (cover, nama, jumlah lagu), pesan error dengan tombol **Retry**,
dan empty state saat belum ada playlist. Playlist terakhir yang berhasil dimuat disimpan di
`localStorage` (kunci `musicverse:last-playlist:v1`) dan ditampilkan lagi saat aplikasi dibuka.
Semua pemanggilan API lewat `fetchPlaylist` di `src/services/spotifyApi.ts`.

## Integrasi playlist

Endpoint: `GET {BASE}/api/spotifypl?url={ENCODED_URL}` (lihat `.env.example` untuk `VITE_API_BASE_URL`).
Selama ada playlist yang dimuat, data mock disembunyikan di Beranda, Cari, dan sidebar.
Tombol X di form menghapus playlist (termasuk cache).

## Daftar track (tahap 3)

- `PlaylistHeader`: cover, nama, jumlah lagu, tombol **Play All** (`onPlayAll(tracks)`), dan **Muat ulang**.
- `TrackList`: pencarian (judul, artis, album; tanpa pengaruh huruf besar/aksen; semua kata harus cocok),
  highlight lagu terpilih, dan state kosong/tanpa hasil.
- `TrackRow`: nomor, cover, judul (tautan ke Spotify), artis, album (mulai lebar `md`), durasi, tombol Play.
  Di mobile durasi dipindah ke baris artis agar kolom judul tidak sempit.
- Nomor urut dan `index` yang dikirim ke `onPlay(track, index)` adalah posisi asli di `playlist.tracks`,
  tidak berubah oleh filter. `track.id` berformat `{indeks}-{idLaguSpotify}`, unik walau lagu muncul dua kali.
- Hubungkan pemutar nanti lewat `<PlaylistView onPlay={...} onPlayAll={...} />`.
  Gunakan `playlist.tracks` sebagai queue dan `index` sebagai posisi awal.

## Playback (tahap 4)

Urutan sumber audio saat memutar lagu:
1. API download `app.kyzznekoo.my.id` (`/api/download/spotify?url=`) → `data.url` (audio).
2. Cadangan: `GET {BASE}/api/spotify?url={ENCODED_URL_LAGU}` → `data.url` (audio penuh; `data.preview` = cuplikan 30 dtk, TIDAK PERNAH dipakai; `url` kosong = error "tidak ada audio").
3. Tanpa tautan lagu: `GET {BASE}/api/spotifyplay?q=...` hanya untuk MENEMUKAN tautan lagu; `data.mp3_url` (cuplikan ±30 dtk) TIDAK dipakai sebagai audio.

**Deteksi klip.** `data.url` dari API kadang tetap klip ±30 dtk. Setelah `loadedmetadata`, durasi file audio yang sebenarnya dibandingkan dengan durasi lagu di playlist (`utils/clipDetect.ts`: ≤35 dtk dan selisih ≥20 dtk = klip). Klip dibuang, API itu dilewati, lalu sumber lain dicoba; jika semua hanya klip, status `error` dengan kode `clip_only`. Pengecekan yang sama berlaku untuk preload crossfade.

- **Satu engine.** `services/audioEngine.ts` memegang satu `HTMLAudioElement`. `AudioPlayerProvider`
  (di dalam `PlaylistProvider`) memanggil `useAudioPlayerController` sekali. Komponen cukup memakai
  `useAudioPlayer()` (status + aksi), `usePlayerActions()`, atau `usePlaybackTime()`; jangan membuat `new Audio()` lain.
- **Aksi:** `playTrack(track, index)`, `selectTrack` (untuk tombol UI: lagu aktif di-jeda/lanjut, selain itu play),
  `togglePlayPause()`, `cleanup()`.
- **Status** hanya berubah lewat event audio: `idle → resolving → loading → playing ⇄ buffering / paused → ended`, atau `error`.
  `playing` baru diisi saat event `playing` diterima; respons `status: true` atau `play()` yang diterima belum cukup.
- **URL selalu baru.** Setiap `playTrack` meminta URL audio baru ke API; tidak ada cache. Dari `ended`/`error`,
  `togglePlayPause()` juga mengambil URL baru.
- **Error:** respons gagal / `mp3_url` kosong / bukan http(s), pemutaran diblokir browser, `MediaError` jaringan,
  dekode, atau format/URL tidak didukung (termasuk tautan kedaluwarsa dan halaman unduhan), serta batas 30 detik
  menunggu event `playing` pertama.
- **CORS:** elemen audio sengaja tanpa `crossOrigin`, jadi host audio mana pun bisa diputar tanpa header CORS.
  Permintaan ke API tetap butuh CORS (atau proxy `/nexa`, lihat `.env.example`).
- Playlist dihapus atau diganti → audio otomatis dihentikan.

Lagu berikutnya diputar otomatis saat lagu selesai (lihat tahap 6).

## MiniPlayer & FullPlayer (tahap 5)

`PlayerDock` (di `AppShell`) menampilkan `MiniPlayer` selama ada lagu aktif, dan `FullPlayer` saat mini player diklik.
Keduanya hanya membaca `useAudioPlayer()` / `usePlaybackTime()`; tidak ada state playback kedua, dan endpoint tidak berubah.
State UI satu-satunya yang baru adalah "full player terbuka" di `PlayerDock`.

- **Posisi.** Mobile: tepat di atas `BottomNav` (`bottom: 4rem + 1px + safe-area-inset-bottom`). Desktop: menempel di bawah,
  di kanan sidebar. Tinggi mini diekspos sebagai `--mini-player-h` agar `<main>` memberi padding bawah yang pas.
  Full player memakai `safe-area-inset-top/bottom` (index.html sudah `viewport-fit=cover`).
- **Aksi baru di audio engine:** `seekTo`, `playNext`, `playPrevious`, `retry`. Queue = `state.queue`, posisi = `currentIndex` (lihat tahap 6);
  `hasPrevious` / `hasNext` diturunkan dari keduanya. Previous mengulang dari 0:00 jika lagu sudah > 3 detik dan bisa di-seek.
- **Seek** hanya aktif bila `audio.duration` terhingga, `audio.seekable` tidak kosong, dan status playing/buffering/paused
  (`PlaybackTime.seekable`). Jika tidak, SeekBar hanya menampilkan progres (tanpa slider). Slider bisa dipakai dengan pointer dan keyboard;
  seek dikirim saat pointer dilepas / tombol panah dilepas / fokus hilang, bukan di setiap gerakan.
- **Tombol utama jujur.** Ikon Pause hanya setelah event `playing`. Saat `resolving`/`loading`/`buffering` tampil spinner;
  saat `error`/`ended` tampil ikon ulang (Retry / Putar ulang). Retry selalu meminta `mp3_url` baru.
- **Error:** pesan dari controller + tombol **Retry** di mini dan full player.
- **Tombol Spotify** memakai URL lagu dari playlist, lalu `spotify_url` dari endpoint play; hanya URL `open.spotify.com/track/…`
  yang valid. Jika tidak ada, tombol tidak dirender.
- **Listener:** SeekBar/Dock tidak memasang listener DOM sendiri; listener audio hanya di `AudioEngine` (dilepas di `dispose`),
  `ResizeObserver` MiniPlayer dan kunci scroll FullPlayer dibersihkan di cleanup effect.

## Queue & Play All (tahap 6)

Tidak ada library state baru: queue hidup di state yang sama dengan playback (`AudioPlayerState` di
`useAudioPlayerController`, dibagikan lewat `AudioPlayerContext`). Logika hitung ada di `utils/playerQueue.ts`
(fungsi murni: `getNextIndex`, `getPreviousIndex`, `hasNext`, `hasPrevious`, `resolveQueueForTrack`, `resolveQueueForPlayAll`).

- **State.** `state.queue: readonly PlaylistTrack[]` dan `state.currentIndex` (posisi di dalam `queue`) selalu diubah
  bersama dalam satu `commit` (`startPlayback`), jadi posisi playback tidak bisa lepas dari antreannya.
- **Pilih lagu** (`playTrack` / `selectTrack`): lagu langsung diputar dan queue = seluruh `playlist.tracks` aktif.
  Indeks dari UI dipercaya hanya jika id lagunya cocok; jika tidak dicari lewat id (lagu di luar playlist diputar sendirian).
  Filter pencarian di `TrackList` tidak memengaruhi queue.
- **Play All** (`playAll(tracks)`): queue = semua lagu yang diberikan, mulai dari lagu pertama.
- **Berurutan.** Saat event `ended`, lagu berikutnya otomatis diputar (URL audio diminta ulang seperti biasa).
  Di lagu terakhir pemutar berhenti di status `ended` (tidak mengulang dari awal).
- **Next/Previous/Retry** memakai queue yang sedang berjalan, bukan playlist saat ini, sehingga tetap konsisten
  walau playlist dimuat ulang dengan id yang sama. Playlist diganti/dicari ulang/dihapus → lagu yang sedang diputar tetap berjalan bersama antreannya (tidak ada `cleanup()` otomatis).
- Tidak ada perubahan tampilan; hanya tombol **Play All** yang kini memakai `playAll`.

## Tampilan Queue & navigasi (tahap 7)

- **QueuePanel** (`components/player/QueuePanel.tsx`): "Sedang diputar" + daftar "Berikutnya". Mobile berupa bottom sheet
  (maks. 85% tinggi layar), desktop (`lg`) panel di sisi kanan. Dialog modal: fokus masuk, Tab terkunci di dalam, Esc/backdrop/tombol X menutup.
  `PlayerDock` memegang state "queue terbuka" (di samping state "full player terbuka"); isi queue tidak punya state sendiri,
  hanya membaca `queue` + `currentIndex` dari `useAudioPlayer()`, jadi sinkron dengan MiniPlayer, FullPlayer, dan baris playlist.
- **Membuka queue:** tombol di header FullPlayer (semua ukuran), dan di MiniPlayer mulai lebar `sm` (di bawahnya ruang terlalu sempit;
  buka lewat full player).
- **Memilih lagu dari queue:** `playQueueItem(index)` melompat ke posisi itu di queue yang sedang berjalan (queue tidak diganti,
  tidak mencari ulang di playlist). Baris "Sedang diputar" berfungsi sebagai tombol jeda/lanjut/ulang. Setelah memilih,
  fokus dikembalikan ke dialog karena baris yang diklik pindah bagian.
- **Previous:** lagu berjalan > 3 detik → diputar ulang dari awal (seek bila bisa di-seek; bila tidak, dimuat ulang dengan URL baru).
  Selain itu → lagu sebelumnya.
- **Next / auto-next:** lagu berikutnya di queue; di lagu terakhir pemutar berhenti di status `ended` (tanpa error, tanpa request baru).
- **Lagu gagal:** pesan + Retry tampil seperti sebelumnya, dan Next, Previous, serta baris queue tetap aktif sehingga pengguna bisa pindah lagu.
  Tidak ada auto-skip otomatis saat gagal (disengaja, agar kegagalan tidak terlewat).

## Koleksi / Library (tahap 8)

Halaman `/library` berisi **Playlist tersimpan** dan **Recently Played**. Semuanya disimpan di `localStorage` perangkat
ini lewat `LibraryProvider` (di dalam `PlaylistProvider` dan `AudioPlayerProvider`); tidak ada state playback baru.

**Kunci penyimpanan** (semua berversi; `musicverse:last-playlist:v1` milik Beranda tidak berubah):

| Kunci | Isi |
| --- | --- |
| `musicverse:library:v1` | `{ version, playlists: SavedPlaylist[] }`, maks. 30 playlist |
| `musicverse:recent:v1` | `{ version, items: RecentPlay[] }`, maks. 20 lagu |
| `musicverse:library-prefs:v1` | `{ version, view: 'grid' \| 'list', sort: 'recent' \| 'name' }` |

- **Kompatibel dengan struktur track.** `SavedPlaylist` = `PlaylistDetail` + `savedAt`, dan lagunya `PlaylistTrack`
  apa adanya (`id, title, artists, album, duration, cover, url`), jadi bisa langsung jadi playlist aktif atau masuk queue.
- **Simpan otomatis.** Playlist yang berhasil dimuat dari API (termasuk Muat ulang) disimpan/diperbarui. Playlist yang hanya
  dipulihkan dari penyimpanan (`fromCache`) tidak disimpan ulang, jadi playlist yang sudah dihapus tidak muncul lagi setelah
  halaman dibuka ulang. Playlist aktif yang belum ada di Koleksi menampilkan tombol **Simpan ke Koleksi**.
- **Buka.** `restorePlaylist` (di `PlaylistContext`) menampilkan salinan tersimpan tanpa memanggil API, lalu pindah ke Beranda.
  Salinan itu bisa lebih lama dari playlist di Spotify (header menyebutnya; tombol **Muat ulang** memperbarui). Membuka playlist
  yang sudah aktif tidak mengubah apa pun. Membuka atau memuat playlist lain tidak menghentikan lagu yang sedang diputar; audio baru berganti hanya saat pengguna memilih lagu.
- **Hapus** meminta konfirmasi di kartu dan hanya menghapus salinan di Koleksi: playlist aktif dan pemutaran tidak ikut berhenti.
  Tombol X di form impor tetap menghapus playlist aktif, bukan isi Koleksi.
- **Recently Played.** Lagu dicatat saat status benar-benar `playing` (bukan saat tombol ditekan atau URL audio didapat); jeda/lanjut
  tidak mencatat dua kali. Lagu yang sama dipindah ke atas, bukan digandakan. Memutar dari riwayat memakai playlist aktif sebagai queue
  bila lagunya ada di sana; jika tidak, lagu diputar sendirian.
- **`mp3_url` tidak pernah disimpan.** Lagu disalin lewat daftar field `PlaylistTrack` (whitelist) saat menulis dan membaca, dan
  `PlaybackInfo` (tempat `audioUrl` berada) hanya hidup di state pemutar. Setiap pemutaran tetap meminta URL baru ke endpoint play.
- **Validasi saat dibaca.** JSON rusak, versi/struktur salah, ID playlist yang tidak cocok dengan URL-nya, judul/ID/url lagu
  kosong, dan ID lagu ganda dibuang per entri; entri valid tetap tampil dan pengguna diberi tahu bila ada yang dibuang.
- **Kegagalan penyimpanan.** `localStorage` diblokir → Koleksi tetap jalan di memori dan halaman memberi tahu bahwa data hanya
  bertahan selama tab terbuka. Penyimpanan penuh atau Koleksi sudah 30 playlist → playlist baru **tidak** ditampilkan seolah tersimpan
  dan tidak ada playlist lama yang dibuang diam-diam; pengguna diberi alasannya. Setiap perubahan membaca ulang penyimpanan dulu
  dan mengikuti event `storage`, jadi beberapa tab tidak saling menimpa.
- **Batasan yang jujur.** Aplikasi ini bukan PWA dan memutar lagu selalu butuh internet, jadi Koleksi tidak menjanjikan playlist
  bisa dimuat atau diputar tanpa internet. Data juga bisa hilang jika pengguna menghapus data browser (halaman menyebutnya).

## Konvensi UI

Semua nilai visual berasal dari `tailwind.config.js` dan `src/index.css`; hindari nilai hex langsung di komponen.

- **Warna**: `bg`, `card`, `raised` (+ `raised-hover`), `accent`, `danger`, `ink` / `ink-muted` / `ink-faint`. Teks sekunder minimal `ink-faint` (#8a8a8a, ≥4.5:1).
- **Radius**: kontrol `rounded-full`, kartu/banner/panel `rounded-lg`, thumbnail & baris `rounded-md`, bottom sheet `rounded-t-2xl`.
- **Tipografi**: `font-display` untuk judul (h1 `text-3xl sm:text-4xl`, section `text-xl sm:text-2xl`, kartu `text-base`), `font-sans` untuk isi. Hindari `font-bold` pada teks DM Sans (bobot 700 tidak dimuat).
- **Komponen CSS**: `btn-primary`, `btn-secondary`, `btn-danger` (tinggi 44px), `icon-btn` (44×44), `focus-ring` / `focus-ring-light`, `skeleton`.
- **Target sentuh**: minimal 44px di mobile; di desktop kontrol mini player boleh 36–40px.
- **Safe area**: header, BottomNav, MiniPlayer, FullPlayer, QueuePanel, dan `<main>` memakai `env(safe-area-inset-*)`. Tinggi BottomNav (4rem + 1px + inset bawah) dan posisi MiniPlayer harus tetap sinkron.
- **Gerakan**: animasi hanya untuk respons aksi (buka player/antrean, pindah halaman, skeleton). `prefers-reduced-motion` mematikannya secara global.

## Android (Capacitor)

Panduan instalasi, konfigurasi, build, dan uji perangkat: [docs/ANDROID.md](docs/ANDROID.md). Status: disiapkan, belum pernah dibuild.

## Menu lagu (tahan lama)

Tahan lama (±0,5 detik) atau klik kanan pada baris lagu mana pun (playlist, Cari, riwayat di Koleksi)
membuka menu opsi: **Putar sekarang**, **Putar berikutnya**, **Tambah ke antrean** (berubah jadi
**Hapus dari antrean** jika lagu sudah ada di sana), **Salin tautan Spotify**, dan **Buka di Spotify**.

- Antrean tidak dicampur. Lagu di luar antrean yang sedang berjalan hanya bisa ditambahkan ke antrean
  jika menunya dibuka dari **hasil pencarian** (halaman Cari dengan kata kunci terisi). Dari baris
  playlist atau riwayat, opsi antrean untuk lagu asing disembunyikan (aksi `addToQueue` /
  `playNextInQueue` juga menolak dengan hasil `blocked`). Lagu yang sudah ada di antrean tetap bisa
  diatur (dipindah ke depan / dihapus).
- Antrean habis: jika berisi lebih dari satu lagu, antrean yang sama diputar ulang secara acak (mode acak
  ikut menyala), dimulai dari lagu yang bukan lagu terakhir tadi. Tidak ada lagu dari playlist lain yang
  masuk. Antrean satu lagu berhenti seperti biasa. Kode: `restartQueue` di `hooks/useAudioPlayerController.ts`,
  `pickRestartIndex` di `utils/playerQueue.ts`.
- Jika belum ada antrean, opsi antrean memutar lagu itu langsung dan antreannya dimulai dari situ
  (menu menampilkan catatan soal ini).
- Lagu yang sama tidak digandakan di daftar "Berikutnya": "Putar berikutnya" memindahkannya ke depan.
- Kode: `hooks/useLongPress.ts`, `context/TrackMenuContext.tsx`, `components/player/TrackMenuSheet.tsx`;
  aksi pemutar `addToQueue` / `playNextInQueue`; logika murni `insertUpcomingTrack` di `utils/playerQueue.ts`.

## Sleep timer dan lirik (pemutar penuh)

- **Sleep timer** (tombol bulan di pemutar penuh): jeda otomatis setelah 15/30/45/60 menit, atau berhenti
  saat lagu yang sedang diputar selesai. Tetap jalan walau pemutar ditutup; sisa waktu tampil di tombolnya.
  Saat waktunya habis musik **dijeda** (bisa dilanjutkan). Kode: `context/SleepTimerContext.tsx`,
  `components/player/SleepTimerSheet.tsx`; aksi pemutar `pause` dan `setStopAfterTrack`.
- **Lirik** (tombol Lirik): diambil dari [LRCLIB](https://lrclib.net) lewat `services/lyricsApi.ts`
  (cocok persis dulu, lalu pencarian longgar; lagu dengan selisih durasi > 8 detik ditolak). Lirik
  bertanda waktu disorot per baris dan bisa diketuk untuk loncat ke bagian itu (jika audio bisa di-seek);
  lirik tanpa waktu tampil biasa. Jika tidak ada, jaringan gagal, atau browser memblokir (CORS), yang tampil
  pesan yang jelas. Hasil disimpan sementara selama sesi. Parser: `utils/lrc.ts`.

## Ketuk baris lagu

Ketuk biasa pada baris lagu (playlist, Cari, riwayat) memutar lagu itu dan membuka **pemutar penuh**;
judul tidak lagi menjadi tautan ke Spotify. Jika lagunya sudah aktif, ketukan hanya membuka pemutar penuh
(tidak menjeda). Tombol Play/Jeda di kanan baris tetap memutar/menjeda tanpa membuka pemutar penuh.
Tautan ke Spotify masih ada di menu tahan lama ("Buka di Spotify") dan di pemutar.
State "pemutar penuh terbuka" ada di `context/PlayerUiContext.tsx` (lihat bagian Tombol Back).

### Tombol Kembali

Pemutar penuh dan antrean adalah entri riwayat di halaman yang sama (URL tidak berubah). Tombol Kembali
(hardware Android, gesture, atau browser) dan tombol turun di layar sama-sama hanya menutup lapisannya;
halaman di bawahnya tetap. Antrean yang dibuka dari pemutar penuh menutup lebih dulu, baru pemutar penuh.

## Tombol Back dan overlay

Pemutar penuh dan panel antrean disimpan sebagai entri riwayat React Router (`context/PlayerUiContext.tsx`):
membuka = menambah satu entri di halaman yang sama (URL tidak berubah, ada penanda di `location.state`),
Back = membuang entri itu. Jadi Back hanya menutup lapisan paling atas, lagu lanjut di mini player, dan
halaman di bawahnya tidak ikut mundur. Tombol tutup di layar memakai `navigate(-1)`, hasilnya sama dengan Back.
Antrean yang dibuka dari pemutar penuh menumpuk di atasnya: Back menutup antrean dulu, lalu pemutar.

Menu tahan-lama (menu lagu dan menu di panel antrean) bukan bagian dari state router; keduanya memakai
`hooks/useOverlayHistory.ts` agar Back juga hanya menutup menu itu.

## Sesi pemutar tersimpan & sleep timer custom

- **Sesi tersimpan** (`utils/playerSession.ts`): antrean, lagu aktif, urutan acak, dan posisi detik disimpan di perangkat
  (antrean saat berubah; posisi tiap ±5 dtk, saat dijeda, app ke background, dan lagu selesai). Saat app dibuka lagi,
  pemutar muncul dalam keadaan **dijeda** (tanpa suara sendiri). Tekan Play: URL audio diminta ulang (tautan lama
  kedaluwarsa), lalu loncat ke posisi tersimpan. Jika server tidak mendukung seek, lagu mulai dari awal. Posisi dalam
  3 detik terakhir lagu diabaikan. Data rusak/tidak konsisten = sesi dibuang. `cleanup()` menghapus sesi.
- **Sleep timer custom**: selain 15/30/45/60 menit, ada isian menit bulat 1–720 di Sleep timer.

## Catatan rilis v0.3.6

Menyamakan fitur dengan StreamBeats.

- **Equalizer 10-band** (Pengaturan > Equalizer, hanya APK): preset (Bass Boost, Vokal, Rock, dll.) dan slider ±12 dB. Berbasis Web Audio; elemen audio hanya disambungkan untuk sumber yang lolos CORS (lagu unduhan dan stream lewat proxy lokal, yang kini mengirim header CORS). Mati secara bawaan; saat mati perilaku pemutar tidak berubah. Berlaku mulai lagu berikutnya (`services/equalizer.ts`, `prepareSource` di `audioEngine.ts`).
- **Cadangan & pulihkan** (Pengaturan > Cadangan): ekspor semua data `musicverse:*`/`mv:*` ke satu JSON (di APK lewat lembar bagikan sistem, `shareFile` native), pulihkan dari berkas dengan konfirmasi. Indeks dan antrean unduhan tidak ikut.
- **Riwayat** (Playlist > Riwayat): log 500 putaran terakhir per hari, lagu dan artis terbanyak (`utils/playLog.ts`).
- **Artis & Album** (Playlist > Artis & Album): telusuri lagu di perangkat (Koleksi, Playlist saya, riwayat) per artis atau album, putar semua/acak.
- **Build lebih cepat**: cache Gradle dan npm di `apk.yml`. Commit folder `android/` agar `cap add android` tidak diulang tiap build.

> Menyentuh kode native (`StreamProxy`, `MusicVerseNativePlugin`, `update_file_paths.xml`), jadi butuh **APK baru**.

## Catatan rilis v0.3.5

Perbaikan playlist, unduhan, dan bilah progres notifikasi.

**Playlist**
- **Unduh semua** kini memasukkan lagu ke satu playlist di *Playlist saya* dengan nama yang sama. Unduh ulang memakai playlist itu dan hanya menambah lagu baru.
- Tab **Playlist** hanya menampilkan satu kartu per playlist (tidak lagi dobel antara *Tersimpan* dan *Buatanmu*). Menghapus playlist juga melepas kartu tersimpannya.
- Menghapus kartu playlist tidak menghentikan lagu yang sedang diputar.
- Lagu yang sama tidak ditambahkan dua kali ke satu playlist; penambahan banyak lagu dilakukan satu kali baca-tulis.
- Tombol **Pindahkan** di tab Unduhan memindahkan lagu ke playlist lain atau mengeluarkannya jadi *Lagu satuan*, tanpa menyentuh berkas.

**Unduhan**
- Verifikasi ketat: ID Spotify, artis, penanda versi (live, remix, dll.), durasi dua arah, ukuran berkas, dan laju bit. **Judul boleh beda** dari playlist (tidak lagi membuat unduhan ditolak, mis. "Fuyu No Hi" vs "Ho - Kago Tea Time - Fuyu No Hi"). Berkas yang tidak lolos dibuang, lalu sumber lain dicoba.
- Sinyal jelek: gagal ambil sumber, terputus, atau terpotong dicoba ulang sampai 6x (menunggu online bila offline), baru ditandai gagal.
- Unduhan aman saat update APK: indeks dicocokkan dengan isi folder dan dipulihkan dari `meta`; berkas update APK dipindah ke folder `app-update/`.
- Satu notifikasi progres untuk seluruh antrean ("Lagu 2 dari 12"), dengan izin notifikasi diminta otomatis di Android 13+.

**Bilah progres notifikasi**
- Bilah tidak lagi macet di 0 dan tanpa waktu: durasi/posisi dari JS dibaca dengan `readLong()` di plugin native (sebelumnya `getLong()` selalu terbaca 0).
- Durasi tidak pernah kembali ke 0 untuk lagu yang sama, sehingga bilah tidak rata di kiri.
- Posisi dibaca langsung dari elemen audio tiap 2 dtk; native memperbarui sesi dan notifikasi tiap detik, termasuk untuk ROM yang tidak menggerakkan bilah sendiri.
- Saat memuat lagu atau buffering, notifikasi menampilkan bilah berjalan terus dan teks "Memuat lagu…".
- Metadata sesi dipasang ulang hanya bila berubah, jadi kartu media tidak berkedip atau bilah kembali ke awal.

**Tampilan pemutar**
- **Judul panjang menggulir:** judul/artis yang terpotong di mini player, artis/album di pemutar penuh, dan lagu aktif di antrean menggulir ke samping sampai ujung terlihat, berhenti sebentar (±1,6 dtk), kembali ke awal, berhenti lagi, lalu menggulir lagi (`components/ui/MarqueeText.tsx`). Teks yang muat tetap diam; mode "kurangi gerakan" memakai elipsis biasa.
- **Lirik mini player per kata:** kata yang sudah/sedang dinyanyikan terang, sisanya redup. LRC hanya punya waktu per baris, jadi waktu tiap kata diperkirakan dari panjang kata dalam baris itu (`LyricLine.tsx`). Baris yang lebih lebar dari strip bergeser agar kata aktif tetap di tengah. Lirik tanpa waktu per baris (mode perkiraan / lirik biasa) tidak disorot per kata; baris panjangnya menggulir seperti judul.

**Unduhan: coba lagi & jeda**
- **Coba lagi:** unduhan yang gagal punya tombol putar-ulang di barisnya, plus tombol **Coba ulang yang gagal (N)** di atas daftar. Data lagunya disimpan di memori selama aplikasi terbuka (`failedJobs` di `native/downloads.ts`), jadi tidak perlu membuka playlist asalnya. Setelah aplikasi ditutup, daftar gagal hilang; unduh lagi dari playlistnya.
- **Jeda/Lanjutkan:** tombol **Jeda unduhan** menahan lagu berikutnya. Lagu yang masih **menyiapkan** (mencari sumber / menunggu ulang) ikut berhenti di titik aman dan kembali ke depan antrean, bukan ditandai gagal. Lagu yang sudah **mengunduh berkas** diselesaikan dulu karena plugin Filesystem tidak bisa menghentikan unduhan di tengah (labelnya "dijeda setelah lagu ini").
- **Unduh lagu pilihan:** tombol putar di tiap lagu yang menunggu mengunduh lagu itu saja sekarang, walau antrean dijeda atau syarat Wi-Fi/cas belum terpenuhi (pilihan manual mengabaikan keduanya). Lagu lain tetap menunggu. Lagu yang menunggu ditandai "Dijeda", notifikasi berubah jadi "Unduhan dijeda", dan status jeda otomatis dilepas saat antrean habis atau dikosongkan.
- Judul bergulir hanya dipakai untuk **lagu yang sedang diputar** (mini player, pemutar penuh, baris lagu aktif di antrean), bukan di daftar lagu.

**Unduhan: hanya Wi-Fi & antrean tahan ditutup**
- **Unduh hanya lewat Wi-Fi** (Pengaturan > Unduhan, disimpan di perangkat). Saat menyala dan koneksi seluler, lagu berikutnya tidak dimulai (label "Menunggu Wi-Fi", notifikasi "Menunggu Wi-Fi"), dan antrean lanjut sendiri begitu Wi-Fi tersambung (koneksi dicek tiap 4 dtk selama ada antrean, plus saat online/offline berubah). Lagu yang sudah berjalan diselesaikan dulu. Jenis koneksi dibaca native lewat `getNetworkType` (ConnectivityManager, izin `ACCESS_NETWORK_STATE` ditambahkan `setup-android.mjs`). Koneksi yang tidak bisa ditentukan dianggap bukan seluler, jadi unduhan tidak diblokir.
- **Antrean tersimpan** di `localStorage` kunci `musicverse:download-queue:v1` (ikut tercermin ke `Android/data`): lagu yang menunggu, yang sedang berjalan, dan yang gagal (dengan pesannya). Saat aplikasi dibuka lagi, antrean dipulihkan dalam keadaan **dijeda** supaya tidak langsung memakai data; tekan **Lanjutkan unduhan**. Lagu yang sudah selesai terunduh dilewati. Berkas `.part` sisa dibersihkan saat unduhan berikutnya.

**Unduhan: hanya saat dicas, unduh yang baru, hapus per playlist**
- **Unduh hanya saat dicas** (Pengaturan > Unduhan, disimpan di perangkat): antrean berhenti saat HP tidak dicas dan lanjut sendiri saat dicolok. Bisa digabung dengan "hanya Wi-Fi"; label dan notifikasi menyebut syarat yang belum terpenuhi ("Menunggu Wi-Fi", "Menunggu cas", atau "Menunggu Wi-Fi dan cas"). Status cas dibaca native lewat `getPowerState` (BatteryManager, tanpa izin tambahan; cadangan `navigator.getBattery()`). Status yang tidak terbaca tidak memblokir unduhan.
- **Unduh yang baru** (halaman playlist hasil "Unduh semua", hanya APK): mengambil ulang playlist Spotify-nya dari `sourceId`, menambahkan lagu baru ke playlist itu, lalu mengunduh semua yang belum terunduh (lagu lama yang dulu gagal ikut dicoba lagi). Lagu yang dihapus dari Spotify tidak dihapus dari perangkat. Lagu yang sengaja kamu keluarkan dari playlist ini akan muncul lagi bila masih ada di Spotify.
- **Hapus unduhan per playlist**: tiap kelompok di tab Unduhan (dan *Lagu satuan*) menampilkan jumlah lagu + ukuran, dan tombol tempat sampah untuk menghapus semua berkas lagunya sekaligus (`removeDownloads` di `native/offline.ts`). Playlist-nya tetap ada. Berkas lagu dipakai bersama, jadi lagu yang juga ada di playlist lain ikut hilang dari sana; konfirmasi menyebut jumlahnya.

**Unduhan di latar belakang**
- **Perbaikan:** unduhan sebelumnya hanya berjalan mulus selama app terbuka di depan, karena prosesnya tidak dilindungi. Sekarang `DownloadService` (foreground service `dataSync` + wake lock) menjaga unduhan tetap jalan saat pindah halaman/app, layar mati, atau app di latar belakang. Notifikasi progres menjadi notifikasi foreground-nya.
- Saat antrean menunggu Wi-Fi/cas, service tetap hidup **tanpa** wake lock supaya bisa lanjut sendiri tanpa menguras baterai. Saat dijeda manual atau selesai, service berhenti.
- **Batas yang perlu diketahui:** unduhan masih dijalankan oleh JS di WebView, jadi kalau aplikasi **disapu dari recent apps** unduhan berhenti (antrean tersimpan dan dipulihkan dalam keadaan dijeda saat dibuka lagi). Di Android 15+, foreground service `dataSync` dibatasi sekitar 6 jam per 24 jam oleh sistem.

**Pengaturan, jeda per lagu, tombol notifikasi**
- **Halaman Pengaturan** (ikon roda gigi di header, hanya APK): `/settings` berisi daftar kategori, tiap kategori punya halaman sendiri (`/settings/downloads` untuk Unduhan). Pengaturan baru cukup menambah satu entri di `CATEGORIES` (`pages/SettingsPage.tsx`) + satu halaman + satu rute. Tombol "hanya Wi-Fi" dan "hanya saat dicas" pindah ke sana; halaman Unduhan hanya menampilkan ringkasan syaratnya dengan tautan ke pengaturan.
- **Tahan satu lagu** (tombol jeda di barisnya): lagu yang menunggu dilewati antrean sementara yang lain jalan terus; lagu yang masih menyiapkan berhenti di titik aman. Lagu yang sudah mengunduh berkas tidak bisa ditahan (plugin Filesystem tidak punya pembatalan). Tombol putar pada lagu yang ditahan melanjutkannya ke antrean biasa. Tombol "Jeda unduhan" di atas daftar tetap menjeda semuanya sekaligus.
- **Tombol di notifikasi unduhan:** **Jeda** saat berjalan, **Lanjutkan** saat dijeda (`DownloadService` meneruskan ke JS lewat event `downloadAction`). Tombol hanya bekerja selama aplikasi (JS) masih hidup.

**Pemutar: lanjut otomatis setelah diinterupsi & notifikasi bertahan**
- **Putar lagi otomatis:** bila musik berhenti karena app lain (mis. TikTok) atau panggilan, lalu gangguannya selesai, musik diputar lagi sendiri. `audioEngine` membedakan jeda pengguna (tombol, notifikasi, headset, `pause()`/`stop()`) dari jeda sistem (event `pause` tanpa dipanggil aplikasi); hanya yang kedua yang diputar ulang (`components/player/AutoResumeSync.tsx`). Selesainya gangguan dideteksi native lewat `isOtherAudioActive` (`AudioManager.isMusicActive()` + mode panggilan), dicek tiap 2 dtk setelah jeda tunggu 3 dtk; bila app lain tidak pernah terdeteksi memutar audio, putar lagi setelah 8 dtk. Juga dicoba saat kamu kembali ke aplikasi. Berhenti menunggu setelah 1 jam. Hanya APK.
- **Notifikasi bertahan 1 jam:** saat dijeda, `PlaybackService` tetap foreground (wake lock dilepas, hemat baterai) dan notifikasinya tidak bisa digeser; hilang sendiri setelah 1 jam sejak mulai dijeda, atau lewat tombol **Tutup** di notifikasi. Begitu diputar lagi, batas 1 jam dihitung ulang dari jeda berikutnya. Bila Android sendiri mematikan proses aplikasi (kehabisan memori, penghemat baterai ketat), notifikasi ikut hilang; itu di luar kendali aplikasi.

> Perubahan ini menyentuh kode native, jadi butuh **APK baru** (build web saja tidak cukup).

## Judul lagu apa adanya (v0.2.1)

Judul dan artis disimpan serta ditampilkan **persis seperti dari server**: tidak ada nama artis yang ditambahkan atau dibuang di daftar lagu, pemutar, notifikasi, maupun penyimpanan. `stripArtistPrefix` (`utils/trackTitle.ts`) hanya dipakai di dalam untuk membandingkan/mencari (verifikasi unduhan, pencarian audio, lirik), hasilnya tidak pernah disimpan atau ditampilkan. Hanya bagian yang jelas nama artis utuh (>= 3 huruf) yang dibuang saat membandingkan, dan tidak pernah menghasilkan judul sependek "Ho" dari "Ho-Kago Tea Time".

## Preload lagu berikutnya menurut ping (v0.2.1)

`utils/networkQuality.ts` mengukur ping ke server API (HEAD ke `getBaseUrl()`, sampel pertama dibuang, median sisanya) tiap 20 dtk, saat aplikasi kembali terlihat, dan saat online/offline berubah. Hasilnya menentukan kapan lagu berikutnya dimuat (`crossfadeStep` di `useAudioPlayerController.ts`):

| Ping | Tingkat | Lagu berikutnya dimuat |
| --- | --- | --- |
| 1–5 ms | good | setelah lagu selesai (tanpa preload dini) |
| 6–150 ms | medium | 25 dtk sebelum lagu selesai |
| > 150 ms / timeout / offline | poor | 60 dtk sebelum lagu selesai |

- Batas dan lead ada di konstanta `GOOD_PING_MAX_MS`, `MEDIUM_PING_MAX_MS`, `PRELOAD_LEAD_BY_TIER_S`.
- Crossfade menyala + ping good: tetap preload 10 dtk sebelum fade (crossfade butuh lagu cadangan).
- Crossfade mati + ping medium/poor: lagu yang sudah dimuat dipasang dengan tumpang-tindih 0,6 dtk (nyaris tanpa jeda). Gagal = alur `ended` biasa.
- Perangkat tanpa kontrol volume (iOS Safari) tidak bisa preload; selalu memakai alur `ended`.
- Sebelum ada hasil ukur, tingkat dianggap medium.
- **Coba ulang sampai berhasil:** preload yang gagal (rate limit, timeout, jaringan) dicoba lagi tanpa batas selama lagu masih berjalan (jeda 2,5 dtk naik sampai 6 dtk). `play()` lagu cadangan yang ditolak juga dicoba lagi setelah 2,5 dtk. Saat lagu dimulai (termasuk lanjut otomatis setelah lagu selesai), gagal mengambil URL dicoba lagi tiap 2–8 dtk sampai berhasil; berhenti jika pengguna memilih lagu lain. Pengecualian: `no_audio` dan `clip_only` langsung jadi error karena bukan gangguan sesaat.
- **Sinyal jelek (lagu):** mengambil URL gagal 6x berturut-turut = berhenti dengan pesan "Sinyal jelek, audio gagal dimuat". Audio putus di tengah jalan (error jaringan) atau tak kunjung mulai (30 dtk) dimuat ulang otomatis dari posisi terakhir sampai 3x sebelum menampilkan pesan yang sama. Hitungan direset saat lagu berhasil jalan atau lagu baru dipilih.
- **Sinyal jelek (unduhan):** gagal mengambil sumber, unduhan terputus, atau berkas terpotong dicoba lagi sampai 6x (jeda 2 dtk naik sampai 10 dtk; bila offline menunggu online dulu, maks. 1 menit). Setelah itu unduhan ditandai gagal dengan pesan "Sinyal jelek, unduhan gagal". Berkas yang tidak cocok (klip, durasi/judul beda) dibuang lalu sumber lain dicoba; bila semua sumber sudah ditolak, semuanya dicoba lagi dari awal sampai 5 putaran (server sering memberi berkas yang benar di percobaan berikutnya) baru unduhan ditandai gagal dengan alasan penolakan terakhir.

## Bilah progres notifikasi (v0.2.1)

- **Indikator memuat (jeda antar lagu):** saat mencari/memuat audio atau buffering, notifikasi media (APK) menampilkan bilah berjalan terus + teks "Memuat lagu… · artis", dan sesi media memakai status BUFFERING (sistem menampilkan spinner di tombol putar). Bubble mini player menampilkan busur berputar di cincin dan spinner di tengah piringan. Setelah audio mulai, kembali ke bilah/cincin posisi biasa.

- Durasi yang dikirim ke notifikasi tidak pernah kembali ke 0 untuk lagu yang sama (sumber berurutan: audio asli, hasil baca sumber, teks durasi, durasi terakhir yang diketahui). Durasi 0 membuat sistem menganggap durasi tak diketahui, bilah rata di kiri.
- Metadata sesi media dipasang ulang hanya jika berubah; perubahan keadaan dari JS dijalankan di thread utama (bukan thread plugin).
- Posisi dari elemen audio dikirim tiap 2 dtk; native memperbarui sesi dan notifikasi tiap detik.
- **Penyebab bilah macet di 0 dan tanpa waktu (diperbaiki):** plugin native membaca `durationMs`/`positionMs` dengan `call.getLong()`, padahal angka dari JS tiba sebagai `Integer`/`Double` sehingga selalu terbaca 0 (sistem menganggap durasi tak diketahui). Sekarang dibaca lewat `readLong()` di `MusicVerseNativePlugin.java` yang menerima angka apa pun. Perubahan ada di kode native, jadi butuh APK baru (build web saja tidak cukup).

## Verifikasi unduhan ketat (v0.2.1)

Berkas hanya disimpan jika SEMUA lolos (kalau tidak, sumber lain dicoba; jika semua gagal, unduhan ditandai gagal dan tidak ada berkas tersimpan):

- **Identitas:** ID lagu Spotify sama (bila server menyebutkannya), judul **tidak dipakai untuk menolak** (v0.3.5: server sering menulis judul beda dari playlist), artis cocok (hanya diperiksa jika server mengirim nama artis dan ID Spotify belum sama; urutan nama boleh beda, sebagian nama cocok sudah cukup; server tanpa nama artis tidak ditolak),
  dan **penanda versi** sama: live, remix/edit, instrumental/karaoke, akustik, cover, sped up/slowed/reverb/8D, lofi, demo.
- **Durasi (dua arah):** durasi file harus dalam +-10 dtk atau 4% dari lagu di playlist (yang lebih besar), baik terlalu pendek maupun terlalu panjang.
  Diperiksa dua kali: dari sumber sebelum diunduh, lalu dari berkas lokal sesudah diunduh (dibaca ulang sampai 3x).
- **Utuh:** ukuran sama dengan Content-Length server (terpotong = ulang sumber yang sama sekali), dan durasi berkas lokal sama dengan durasi sumber (+-3 dtk).
- **Laju bit wajar:** 88-336 kbps untuk durasinya; dipakai juga bila durasi berkas tidak terbaca. Tanpa durasi acuan sama sekali, berkas ditolak.

## Unduhan aman saat update (v0.2.1)

- Lagu, sampul, lirik, dan `download/meta/<kunci>.json` ada di `Android/data/<paket>/files/download`. Pembaruan APK (tanda tangan sama)
  tidak menyentuh folder ini; hanya uninstall yang menghapusnya.
- Berkas pembaruan APK sekarang di folder terpisah `app-update/` (bukan `Download/` yang bisa sama dengan `download/` di penyimpanan tak peka huruf).
- Saat start, indeks dicocokkan dengan isi folder. Entri hanya dibuang bila folder terbaca dan berkasnya memang tidak ada;
  berkas yang tidak ada di indeks dipulihkan dari `meta`. Error sesaat saat memutar tidak lagi menghapus berkas.
- Bilah progres notifikasi/layar kunci: posisi dibaca langsung dari elemen audio tiap 2 dtk, dan notifikasi native diperbarui tiap detik.

## Unduhan per playlist (v0.2.1)

- **Unduh semua** di sebuah playlist: lagunya langsung dimasukkan ke satu playlist di *Playlist saya* dengan nama yang sama
  (`sourceId` = ID playlist Spotify, jadi unduh ulang memakai playlist yang sama dan hanya menambah lagu baru).
- Di tab **Playlist** hanya muncul satu kartu untuk playlist itu: kartu *Buatanmu* (kartu *Tersimpan*-nya disembunyikan, jadi tidak dobel). Menghapus playlist itu juga melepas kartu tersimpannya.
- **Unduh satu lagu** (menu lagu → *Unduh untuk offline*): hanya lagu itu yang tersimpan, sebagai **Lagu satuan**, tidak masuk playlist mana pun.
- Tab **Unduhan** dikelompokkan per playlist + *Lagu satuan*. Tombol **Pindahkan** di tiap lagu memindahkannya ke playlist
  pilihan (atau playlist baru), atau mengeluarkannya kembali jadi lagu satuan. Berkas unduhan tidak disentuh, hanya keanggotaan playlist.

## Playlist saya (playlist buatan sendiri)

- Dibuat dari **Koleksi → Playlist saya → Buat playlist**, atau langsung dari menu lagu (**Simpan ke playlist saya** → *Playlist baru*).
- Menambah lagu: tahan lama baris lagu mana pun (Beranda, Cari, riwayat, halaman playlist) atau tombol **Simpan** di pemutar penuh.
  Lagu yang sama (ID Spotify/URL) tidak ditambahkan dua kali ke satu playlist.
- Halaman `/my/:id`: Putar semua, ganti nama, naik/turun urutan, hapus lagu, hapus playlist (dengan konfirmasi).
- Tersimpan di `localStorage` kunci `musicverse:my-playlists:v1` (`utils/myPlaylistStorage.ts`), terpisah dari Koleksi dan
  **tidak** kena batas 30 playlist Koleksi. Batas: 100 playlist, 1000 lagu per playlist, nama 60 karakter. Hanya metadata lagu
  yang disimpan (tanpa URL audio). Kuota penuh / penyimpanan terblokir: perubahan ditolak dengan pesan, tidak pura-pura berhasil.

## Aturan Koleksi: lagu satuan tidak masuk

Hasil cari judul dan tautan lagu (`source: 'search'`) adalah **lagu satuan**, bukan playlist, jadi **tidak bisa disimpan ke Koleksi** lewat jalur mana pun:
tombol hati di pemutar dihapus, tombol "Simpan ke Koleksi" disembunyikan untuk lagu satuan, dan `upsertSavedPlaylist` menolak (`reason: 'single'`).
Entri lagu satuan lama di penyimpanan dibuang diam-diam saat dibaca. Untuk menyimpan lagu satuan, pakai **Simpan ke playlist saya**.
Riwayat "Baru diputar" tidak terpengaruh (itu riwayat, bukan Koleksi).

## Notifikasi media (Media Session)

`components/player/MediaSessionSync.tsx` mengisi Media Session API: notifikasi media dan layar kunci di Chrome menampilkan **judul lagu** di baris atas
(artis di bawahnya) dengan **ikon app** sebagai sampul (`public/icons/icon-192.png` dan `icon-512.png`, dirender dari `favicon.svg`; sampul lagu sengaja tidak dipakai).
Tombol play/jeda, sebelumnya, berikutnya, dan bilah posisi di notifikasi mengendalikan pemutar. Catatan: ini bekerja di Chrome/PWA. Di APK Capacitor,
Android WebView tidak memunculkan notifikasi media sistem; itu butuh plugin foreground service terpisah.
