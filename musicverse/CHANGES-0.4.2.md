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
