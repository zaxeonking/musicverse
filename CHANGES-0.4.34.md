# 0.4.34 — Pembaruan tampilan otomatis (OTA), tanpa install APK baru

Cukup push source ke GitHub. Perubahan tampilan sampai ke HP sendiri.

## Alur
1. Push ke `main`/`master` -> workflow `Publish OTA` build web, zip `dist`, unggah `bundle.zip` + `ota.json` ke Release `ota`.
2. Aplikasi (`src/native/liveUpdate.ts`) cek `ota.json`; bila lebih baru dan cocok dengan APK-nya, unduh lalu pakai saat dibuka ulang.

## Pengaman
- Tidak pernah mundur: bandingkan `builtAt` paket dengan `__BUILD_TIME__` JS yang sedang berjalan.
- Hanya bila sidik jari native sama (`scripts/native-hash.mjs`, ditanam APK lewat `res/values/mv_native.xml`, dibaca plugin `nativeHash`).
  Ada perubahan native = lewati OTA; APK baru tetap lewat tag `v*`.
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
