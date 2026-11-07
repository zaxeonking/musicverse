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
