# 0.5.50 — Link unduhan YouTube diambil ulang oleh native
## Masalah
- Antrean unduhan native (`DownloadQueue`) hanya menerima link yang sudah di-resolve JS. Bila link kedaluwarsa (>90 menit di antrean) atau ditolak server video (HTTP 401/403/404/410) saat JS mati / beku, lagu dikembalikan ke JS (`handback`) dan menunggu app dibuka lagi.
## Cara kerja
- **`YtResolver.java` (baru)**: port native `getStreams` plugin `ytmusic` / `ytvideo` (id video -> stream audio). Urutan klien sama dengan JS (VISIONOS, ANDROID_VR, ANDROID tanpa `androidSdkVersion`, IOS), visitorData di-cache (memori + SharedPreferences), klien yang URL-nya baru ditolak dilewati 10 menit, MP4/AAC dulu lalu bitrate tertinggi.
- **JS** membawa id video ke native: `PlaybackInfo.ytVideoId` (diisi `registry.ts` untuk plugin `ytmusic` / `ytvideo`, termasuk pilihan manual) -> `NativeQueueJob.ytId` (`native/downloads.ts`; hanya bila link yang diserahkan memang stream YouTube langsung itu).
- **`DownloadQueue.process`**: bila job punya `ytId` dan link kedaluwarsa, atau unduhan ditolak 401/403/404/410, native mengambil link baru lewat `YtResolver` dan melanjutkan (maks. 2 kali per lagu per giliran; `.part` disambung, dan pengunduh memulai ulang sendiri bila ukuran sumber baru berbeda). Gagal resolve / bukan lagu YouTube: `handback` ke JS seperti sebelumnya.
## Batasan
- Hanya mengambil ulang link untuk video yang SUDAH dipilih JS. Pencarian judul + artis -> id video, pencocokan kandidat, dan sumber pihak ketiga tetap di JS (item #1/#2).
- Pilihan kualitas unduhan pengguna tidak dibawa ke native: link baru memakai urutan bawaan (MP4/AAC, bitrate tertinggi).
- Link baru tidak diperiksa durasinya oleh WebView seperti hasil resolve JS; native hanya memakai pemeriksaan ukuran / durasi yang sudah ada.
- Respons YouTube bisa berubah; klien yang gagal dilewati, tetapi bila semuanya gagal lagu kembali ke JS.
## Teknis
- Baru: `native/android/java/YtResolver.java`.
- Diubah: `DownloadQueue.java` (`refreshLink`, `MAX_LINK_REFRESHES`, loop unduh), `src/types/spotify.ts`, `src/plugins/registry.ts`, `src/native/downloads.ts`, `src/native/musicVerseNative.ts`.
- APK lama: field `ytId` diabaikan (perilaku lama).
- **Perubahan native: perlu build APK baru.** Belum dibuild atau diuji di perangkat; TS dicek sintaksnya (transpile), Java hanya keseimbangan kurung (javac tidak tersedia).
