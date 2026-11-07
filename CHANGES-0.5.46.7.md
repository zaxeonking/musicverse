# MusicVerse 0.5.46.7 — Klik notifikasi saat lagu jalan tidak lagi "mundur" ke keadaan app lama

## Masalah
Lagu diputar (mis. menit 5), notifikasi diklik: lagu benar tapi app berperilaku seperti baru dibuka setelah lama
(status jeda + posisi lama, harus Play lagi). Terjadi saat WebView/JS dimatikan Android sementara pemutar native
masih berbunyi.

## Penyebab
1. `NativeMediaSync` langsung mengirim `updateNowPlaying` (`playing:false`, posisi simpanan lama) begitu JS boot dari sesi
   tersimpan, menimpa notifikasi/widget sebelum sesi native sempat diadopsi.
2. Pembandingan `session.at <= savedPositionAt()` dibaca SETELAH efek persist di mount menulis `at = Date.now()`, sehingga
   catatan native (bukan live) hampir selalu dianggap lebih lama dan dibuang.

## Perubahan
- `src/native/nativeSession.ts`: gerbang rekonsiliasi (`isNativeSessionReconciled`, `markNativeSessionReconciled`, `onNativeSessionReconciled`).
- `useAudioPlayerController.ts`: `bootSavedAt` diambil sekali sebelum efek persist; gerbang dibuka di semua jalur keluar efek sinkron native.
- `NativeMediaSync.tsx`: tidak mengirim pembaruan notifikasi selagi keadaan hasil pemulihan belum disamakan (batas tunggu 4 dtk;
  pemutaran yang dimulai pengguna tetap lolos). Hanya kode JS, **tidak perlu APK baru** bila APK sudah 0.5.49+ (ada `nativeSessionRead`).

## Belum diuji
Belum dijalankan di perangkat/emulator; hanya cek sintaks. Uji: putar lagu, tutup app dari recent (service tetap hidup),
tunggu menit 5, klik notifikasi — posisi harus lanjut dan tombol jeda langsung bekerja.
