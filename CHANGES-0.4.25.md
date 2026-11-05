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
