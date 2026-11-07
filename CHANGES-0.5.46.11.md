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
