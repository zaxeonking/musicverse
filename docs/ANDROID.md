# MusicVerse di Android (Capacitor)

> **Status: DISIAPKAN, BELUM DIBUILD.** Konfigurasi, kode web, dan kode native (Java) ditulis tanpa
> menjalankan `npm install`, `npx cap add android`, maupun Gradle (lingkungan penyusun tidak
> punya jaringan dan Android SDK). Tidak ada APK yang pernah dihasilkan, dikompilasi, atau diuji.
> Semua langkah di bawah harus Anda jalankan sendiri; centang daftar uji di bagian 7 dan 9.
> Fitur APK (notifikasi native, latar belakang, unduhan offline, data di Android/data, tautan
> disembunyikan) dijelaskan di **bagian 9**.

## 1. Hasil pemeriksaan kompatibilitas (dari membaca kode)

| Area | Temuan | Risiko |
|---|---|---|
| Bundler | Vite 5 + React 18, output statis ke `dist/`, `base` default `/` | Rendah, cocok dengan `webDir: dist` |
| Routing | `createBrowserRouter`, tidak ada deep link; app selalu mulai dari `/` | Rendah. Jika ada masalah saat reload di rute dalam, ganti ke `createHashRouter` |
| Storage | `localStorage` lewat `safeStorage` (try/catch) | Rendah. Data tersimpan di WebView; hilang jika data aplikasi dihapus |
| API | `fetch` ke `https://api.nexadev.my.id` (`VITE_API_BASE_URL`) | **Sedang**: origin app menjadi `https://localhost`, jadi butuh CORS dari server atau `CapacitorHttp` (sudah diaktifkan di config, belum teruji) |
| API download (`app.kyzznekoo.my.id`) | API utama (`/api/spotify` jadi cadangannya) untuk memutar lagu lewat tautan Spotify-nya. Di APK diakses langsung (`CapacitorHttp`); CORS-nya belum diuji. Nama parameter (`url`) adalah asumsi, lihat `DOWNLOAD_URL_PARAM` di `spotifyApi.ts` | **Sedang** |
| Proxy Vite `/nexa` | Hanya ada di dev server | **Jangan** set `VITE_API_BASE_URL=/nexa` (atau `/kyzz`) untuk build Android; tidak ada proxy di APK |
| Audio | Satu `HTMLAudioElement`, tanpa `crossOrigin`, trik `prime()` untuk autoplay | Sedang: URL audio `http://` butuh `allowMixedContent` (sudah diaktifkan) |
| Audio di latar belakang | Tidak ada MediaSession, foreground service, atau notifikasi kontrol | **Tinggi**: musik bisa berhenti saat layar mati / app di latar belakang. Perlu dites; solusi andal butuh plugin native |
| Tombol Back | `FullPlayer` dan `QueuePanel` adalah state React lokal, tidak terhubung ke riwayat | Sedang: Back dapat menutup app alih-alih menutup panel |
| Font | Google Fonts dimuat dari internet | Rendah: offline jatuh ke font sistem (sudah ada fallback di Tailwind) |
| Safe area | Sudah memakai `env(safe-area-inset-*)` dan `viewport-fit=cover` | Rendah; cek tampilan status bar/gesture bar di perangkat |

## 2. Prasyarat

- Node.js 22+ (cek persyaratan versi Capacitor terbaru di <https://capacitorjs.com/docs/getting-started/environment-setup>)
- JDK 21
- Android Studio (termasuk Android SDK + platform-tools), lalu set `ANDROID_HOME`
  dan tambahkan `$ANDROID_HOME/platform-tools` ke `PATH`
- Perangkat Android dengan Opsi Pengembang dan USB debugging aktif

Cek otomatis: `npm run android:check`

## 3. Instalasi (sekali saja)

```bash
npm install                 # @capacitor/* sudah ada di package.json
npx cap add android
npm run android:setup       # memasang kode native MusicVerse (lihat bagian 9)
```

`capacitor.config.ts` sudah tersedia (appId `com.musicverse.app`, webDir `dist`).
Ubah `appId` sebelum `cap add android` jika ingin ID paket sendiri; mengubahnya sesudahnya
perlu penyesuaian manual di folder `android/`.

## 4. Konfigurasi Android

Setelah `cap add android`, periksa di `android/`:

1. `app/src/main/AndroidManifest.xml` harus memuat izin internet (biasanya sudah ada):
   `<uses-permission android:name="android.permission.INTERNET" />`
2. `app/build.gradle`: `minSdkVersion`/`targetSdkVersion` mengikuti template Capacitor; jangan diturunkan.
3. Ikon dan splash: ganti ikon di `app/src/main/res/mipmap-*`
   (atau gunakan `@capacitor/assets`; belum disiapkan di project ini).
4. Jika API terbukti selalu `https`, set `allowMixedContent: false` di `capacitor.config.ts`.

## 5. Build

```bash
npm run android:sync     # vite build + cap sync android
npm run android:open     # buka Android Studio, lalu Run / Build APK
# atau lewat terminal:
npm run android:apk      # hasil: android/app/build/outputs/apk/debug/app-debug.apk
```

Setiap kali kode web berubah, jalankan ulang `npm run android:sync`.

APK **debug** cukup untuk uji di perangkat. Untuk rilis, buat keystore
(`keytool -genkey -v -keystore musicverse.jks -alias musicverse -keyalg RSA -keysize 2048 -validity 10000`),
simpan di luar repo, lalu gunakan Build → Generate Signed Bundle / APK di Android Studio.

## 6. Menjalankan di perangkat nyata

```bash
adb devices                 # perangkat harus berstatus "device"
npm run android:run         # build, sync, install, dan jalankan
# atau pasang APK manual:
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

Debug WebView: buka `chrome://inspect` di Chrome desktop saat perangkat terhubung.

## 7. Daftar uji di perangkat (belum ada yang dijalankan)

- [ ] App terbuka, tema gelap dan font tampil; status bar/gesture bar tidak menutupi header, BottomNav, atau MiniPlayer
- [ ] Impor playlist Spotify publik berhasil (menguji API/CORS/`CapacitorHttp`)
- [ ] Putar lagu: audio keluar, seek bar bergerak, next/prev/shuffle/repeat bekerja
- [ ] Audio tetap jalan saat layar dikunci dan saat pindah app (**kemungkinan gagal**, lihat bagian 8)
- [ ] Tombol Back saat FullPlayer/QueuePanel terbuka
- [ ] Library, riwayat putar, dan playlist tersimpan setelah app ditutup paksa lalu dibuka lagi
- [ ] Mode pesawat: pesan error tampil jelas, app tidak crash
- [ ] Rotasi layar dan layar kecil

## 8. Masalah yang diperkirakan

1. **Pemutaran di latar belakang**: butuh plugin media-session/foreground service native; tidak disertakan.
2. **Tombol Back**: perlu `@capacitor/app` (`App.addListener('backButton', …)`) dan penutupan panel; belum diimplementasikan.
3. **CORS/API**: jika `CapacitorHttp` tidak cukup, minta server mengizinkan origin `https://localhost`.
4. **Ketergantungan layanan pihak ketiga**: app bergantung pada `api.nexadev.my.id`; jika layanan itu mati, impor dan pemutaran gagal.


## 9. Fitur khusus APK (disiapkan di v58)

Semua fitur di bawah hanya aktif di dalam APK (`isNativeApp()`); versi web/Vercel tidak berubah.

### 9.1 Notifikasi: aset di dalam APK
`native/android/res/` berisi ikon status bar (`ic_stat_musicverse`), ikon tombol (play/pause/next/prev),
dan sampul bawaan (`notif_default_cover.png`, dari `public/icons/icon-512.png`). `npm run android:setup`
menyalinnya ke `android/app/src/main/res/`, jadi notifikasi tidak bergantung pada internet untuk ikonnya.
Sampul lagu tetap diambil dari internet (atau dari berkas lokal untuk lagu yang diunduh), diberi badge logo,
lalu dikirim ke native; selama belum siap atau gagal dimuat dipakai sampul bawaan APK.

### 9.2 Jalan di latar belakang
- `PlaybackService` = foreground service bertipe `mediaPlayback` + `PARTIAL_WAKE_LOCK` + `MediaSession`.
- Audio **tetap diputar oleh WebView** (engine crossfade/fade yang ada tidak ditulis ulang); service menjaga
  proses tetap hidup dan menampilkan kontrol. Tombol notifikasi/layar kunci/headset diteruskan ke pemutar JS.
- Tombol Back di halaman awal **meminimalkan** app (tidak menutupnya).
- Izin yang ditambahkan ke manifest: `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK`, `POST_NOTIFICATIONS`, `WAKE_LOCK`.
- `MusicVerseNative.requestNotificationPermission()` (Android 13+) dan `openBatterySettings()` tersedia di
  `src/native/musicVerseNative.ts`, **belum dipanggil dari UI**. Sebagian pabrikan (Xiaomi, Oppo, Vivo, Samsung)
  tetap bisa mematikan app; pengguna mungkin perlu mengecualikan MusicVerse dari penghemat baterai.

### 9.3 Tautan disembunyikan
Di APK tombol/tautan "Buka di Spotify", "Salin tautan Spotify", dan judul-sebagai-tautan tidak dirender;
tekan-lama dan seleksi teks dimatikan (kecuali kolom input); log WebView dimatikan dan `chrome://inspect`
nonaktif di build normal (`MV_DEBUG=1 npx cap sync android` untuk build debug). **Ini bukan keamanan**:
alamat API tetap ada di dalam bundle JS APK dan bisa dibaca dengan membongkar APK.

### 9.4 Data di Android/data/<paket>/
Seluruh isi `localStorage` (koleksi, riwayat, playlist saya, sesi pemutar, daftar unduhan) dicerminkan ke
`Android/data/com.musicverse.app/files/data/musicverse-data.json` (tulis atomik lewat berkas sementara).
Saat start, berkas ini dimuat dulu ke `localStorage` sebelum React dirender; jika belum ada, isi `localStorage`
yang ada disalin ke sana. Folder ini terhapus saat aplikasi di-uninstall dan tidak butuh izin penyimpanan.

### 9.5 Unduhan offline
Menu lagu (tahan lama) -> **Unduh untuk offline**. Berkas: `Android/data/<paket>/files/download/<id>.mp3`
(+ `download/covers/<id>.jpg`). Bagian **Unduhan** di Koleksi menampilkan progres, daftar, dan hapus.
`fetchPlaybackInfo` memeriksa unduhan lebih dulu, jadi lagu yang sudah diunduh diputar dari berkas lokal
tanpa internet (tanpa pemeriksaan klip/durasi lewat API). Unduhan memakai URL audio yang sama dengan pemutaran,
jadi lagu yang hanya tersedia sebagai klip 30 detik ditolak.
Batas: unduhan berjalan di proses app dan tidak bisa dibatalkan setelah dimulai; jika app dimatikan sistem
saat mengunduh, ulangi unduhannya. Ekstensi selalu `.mp3` walau format sumber berbeda (WebView membaca isi berkasnya).

### 9.6 Daftar uji tambahan (belum ada yang dijalankan)
- [ ] `npm run android:sync` selesai tanpa error; `android/app/src/main/AndroidManifest.xml` memuat service + izin
- [ ] Gradle mengompilasi `PlaybackService`, `MusicVerseNativePlugin`, `MainActivity` (belum pernah dikompilasi)
- [ ] Notifikasi tampil saat lagu diputar: judul, artis, sampul, tombol, bilah posisi; tombol bekerja
- [ ] Layar dikunci 10+ menit: musik tetap jalan dan lanjut ke lagu berikutnya
- [ ] Geser app dari recent apps: notifikasi hilang (service berhenti)
- [ ] Tombol Back di halaman awal meminimalkan app, musik jalan
- [ ] Android 13+: notifikasi muncul setelah izin diberikan (panggil `requestNotificationPermission` jika belum ada prompt)
- [ ] Tidak ada tombol/tautan Spotify di menu lagu, pemutar penuh, dan antrean
- [ ] Setelah memuat playlist lalu menutup paksa app: data kembali; berkas `files/data/musicverse-data.json` ada
- [ ] Unduh lagu: berkas `files/download/*.mp3` > 100 KB; mode pesawat: lagu itu tetap bisa diputar, seek jalan
- [ ] Audio dari `https://localhost/_capacitor_file_/...` bisa di-seek (butuh dukungan Range dari server lokal Capacitor)
- [ ] Hapus unduhan menghapus berkasnya; hapus berkas lewat pengelola berkas -> entri hilang saat app dibuka lagi

### 9.6 Banner web -> GitHub Releases, dan pembaruan di dalam APK
**Web:** isi `VITE_GITHUB_REPO=USER/REPO`. Tombol "Unduh" di banner membuka
`https://github.com/USER/REPO/releases/latest` (bukan link langsung ke `.apk`), jadi tidak perlu ganti link tiap rilis.

**APK:** `src/hooks/useAppUpdate.ts` memeriksa `api.github.com/repos/USER/REPO/releases/latest` (4 detik setelah start
dan tiap app dibuka lagi, maksimal tiap 30 menit). Jika tag rilis > versi terpasang, muncul banner **opsional**
(Perbarui / X "nanti"; X menyembunyikan sampai ada versi yang lebih baru lagi).
- Perbarui -> `MusicVerseNative.downloadUpdate` memakai `DownloadManager`: progres tampil di notifikasi sistem
  (juga bar di banner) dan tetap jalan walau app ditinggal. App tetap bisa dipakai selama mengunduh.
- Selesai -> installer paket dibuka otomatis. Pertama kali Android meminta izin "pasang dari sumber ini"
  (pengaturan dibuka otomatis; kembali ke app lalu ketuk **Pasang**). Jika installer tidak terbuka karena
  app di latar belakang, ketuk notifikasi unduhan atau tombol **Pasang** di banner.

Syarat rilis:
1. Tag rilis berformat versi, mis. `v0.2.0`, dan **versi di `package.json` sama dengan tag** saat membuild APK
   (`npm run android:setup` mengisi `versionName`/`versionCode` di `build.gradle` dari `package.json`).
2. Lampirkan berkas `.apk` (nama bebas) pada release. Tanpa lampiran APK, tombol Perbarui membuka halaman release.
3. APK harus **ditandatangani dengan keystore yang sama** dengan versi terpasang, kalau tidak Android menolak pembaruan.
   (APK debug dari komputer lain memakai keystore debug berbeda.)
4. Manifest (otomatis lewat `android:setup`): izin `REQUEST_INSTALL_PACKAGES`, `UpdateFileProvider`
   (`@xml/update_file_paths`). **Belum pernah dikompilasi atau diuji di perangkat.**

### 9.7 Build otomatis di GitHub Actions
`.github/workflows/apk.yml`: push tag `v*` (mis. `git tag v0.2.0 && git push origin v0.2.0`) -> build, tanda tangan,
dan buat Release berisi `musicverse.apk`. Versi aplikasi diambil dari nama tag. Run manual (Actions > Run workflow)
hanya menghasilkan artifact.

Satu kali saja, buat keystore (SIMPAN, jangan hilang; pembaruan harus ditandatangani kunci yang sama):
```bash
keytool -genkeypair -v -keystore musicverse.jks -alias musicverse -keyalg RSA -keysize 2048 -validity 36500
base64 -w0 musicverse.jks   # isi untuk secret pertama
```
Secret di Settings > Secrets and variables > Actions: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`,
`ANDROID_KEY_ALIAS` (= `musicverse`), dan opsional `ANDROID_KEY_PASSWORD` (jika beda dari password keystore).
Folder `android/` di-commit atau tidak, keduanya jalan (jika belum ada, workflow menjalankan `cap add android`).

**Repo kode private?** Cek update di APK dan link banner web membaca Release tanpa login, jadi repo rilis harus
**public** (jangan menaruh token di APK). Pisahkan: repo private untuk kode, repo public kosong (mis.
`USER/musicverse-releases`, buat dengan README awal) hanya untuk Release. Isi variabel repo `RELEASE_REPO`
= `USER/musicverse-releases` dan secret `RELEASES_TOKEN` = fine-grained PAT dengan izin *Contents: Read and write*
khusus repo rilis itu. Workflow mem-build dengan `VITE_GITHUB_REPO` = repo rilis dan mengunggah APK ke sana.

