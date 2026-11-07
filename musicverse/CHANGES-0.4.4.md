# MusicVerse 0.4.4 — antrean unduhan native (tahap 1)

## Apa
Sebelumnya seluruh antrean unduhan hidup di JavaScript. Begitu aplikasi digeser dari recent apps, WebView mati dan lagu
yang sedang diunduh berhenti. Sekarang lagu yang URL-nya sudah di-resolve diserahkan ke **antrean native**
(`DownloadQueue.java`, padanan manajer Rust StreamBeats) yang bekerja tanpa WebView:

- unduh (NativeDownloader, bisa disambung) -> cek isi -> verifikasi ukuran/durasi -> sampul -> tag -> ganti nama atomik ->
  metadata -> salin ke Music/MusicVerse, semuanya di thread native;
- lagu yang sedang berjalan **dan 2 lagu di depannya** (`NATIVE_LOOKAHEAD`) tetap selesai walau app digeser; notifikasi
  progres dipegang native selama JS mati dan service tidak lagi mati saat app digeser selagi antrean bekerja;
- antrean + hasil dicatat di `files/dlqueue.json`; saat app dibuka lagi `queueSync` memasukkan lagu yang selesai, dan
  mengembalikan yang gagal/perlu di-resolve ulang ke antrean.

## Pembagian JS / native
- JS: urutan, jeda, tahan per lagu, resolve link (plugin), me-resolve ulang saat URL ditolak / sumber tidak cocok.
- Native: semua langkah setelah URL siap. Syarat Wi-Fi/cas juga dihormati native (`queueConfigure`).
- Hasil per lagu: `done`, `handback` (JS resolve ulang: URL ditolak/kedaluwarsa, bukan audio, terpotong, jaringan putus),
  `verify` (berkas utuh tetapi durasi tak bisa dipastikan di native: `.part` dipertahankan dan JS memakai pemeriksaan ketat
  lamanya), `failed`.
- Jeda: lagu yang sudah diserahkan tetapi belum mulai dicabut (`queueRelease`); yang sudah berjalan diselesaikan seperti dulu.
  Batal / tahan satu lagu memakai `queueCancel`.

## Berkas
- Baru: `DownloadQueue.java`.
- `MusicVerseNativePlugin.java`: `queueAdd`, `queueCancel`, `queueRelease`, `queueSync`, `queueAck`, `queueConfigure`, event
  `queueResult`; pendengar antrean dilepas saat WebView hancur.
- `DownloadService.java`: `onTaskRemoved` tidak lagi menghentikan service bila antrean native masih bekerja.
- `musicVerseNative.ts`, `downloads.ts` (`submitToNative`, `prefetchAhead`, `releasePrefetched`, `syncNative`, dst.).
- Perbaikan build: `MediaExporter.java` baris 67 (`catch (RuntimeException e)`).

## Batas
- Resolve link masih di JS (tahap 2): lagu di luar lookahead, atau yang perlu di-resolve ulang, menunggu app dibuka lagi.
- Syarat Wi-Fi/cas yang belum terpenuhi saat JS mati: native menunggu maks. 20 menit lalu berhenti; sisanya lanjut saat app dibuka.
- Tombol Jeda di notifikasi tidak berfungsi selama JS mati (notifikasi native tanpa tombol).
- Lirik lagu yang selesai saat JS mati diambil begitu app dibuka (`queueSync`).
- Belum dijalankan di perangkat dan Java belum dikompilasi di lingkungan ini; `tsc` hanya diperiksa tanpa tipe Capacitor
  (hanya TS7006 pada callback yang tipenya berasal dari paket yang tidak terpasang).

## Perlu build ulang APK (ada perubahan Java). APK lama tetap jalan memakai jalur JS.
