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

**Catatan versi**: catatan per versi 0.5.39 sampai 0.5.45 masih ada sebagai `CHANGES-0.5.39.md` sampai `CHANGES-0.5.45.md`; berkas ini menggabungkannya bersama 0.5.46.

**Catatan build**
- 📦 **Butuh APK baru** (Java + manifest + resource). Sidik jari native berubah, jadi paket OTA tidak akan terpasang di APK lama. Di APK lama, `setAutoBrowse` / `consumeAutoRequest` melempar UNIMPLEMENTED dan diabaikan, `AutoSync` tidak berbuat apa pun.
- 🧪 Belum dibuild dan belum diuji di perangkat atau Desktop Head Unit. Fitur 0.5.39 sampai 0.5.45 hanya dicek sintaksnya. Java belum dikompilasi, TypeScript baru dicek sintaksnya, XML lolos `xmllint`.
