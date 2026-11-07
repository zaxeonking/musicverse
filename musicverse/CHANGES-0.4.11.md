# MusicVerse 0.4.11 — putar otomatis setelah gangguan, di native (ala StreamBeats)

## Masalah
Musik berhenti karena panggilan / app lain, lalu **tidak lanjut sendiri bila gangguannya lama**. Penyebabnya: putar-ulang
otomatis dijalankan di JavaScript (`AutoResumeSync`, polling tiap 1,5 dtk), jadi bergantung pada WebView yang hidup dan
CPU yang terjaga. CPU hanya dijaga 20 menit (`INTERRUPT_WAKE_MS`), JS menyerah di 60 menit, dan service ikut berhenti saat
dijeda 60 menit (`IDLE_LIMIT_MS`).

## Yang ditemukan di StreamBeats (dari APK; kode Dart-nya terkompilasi, jadi ini hasil membaca nama fungsi/string)
- `audio_service` (`AudioService` foreground `mediaPlayback`, `MediaButtonReceiver`, `MediaBrowserService`) + `audio_session`.
- Pemutar mendengarkan gangguan lewat event, bukan polling: `_setupInterruptionListeners`, `_handleInterruptionSync`,
  `_resumePlaybackAfterInterruption`; sesi audio diaktifkan sebelum memutar (`_activateAudioSession`, pesan "Audio focus
  denied. Cannot start playback.") dan dilepas saat berhenti.
- Headset dicabut = jeda biasa (`_onHeadphonesUnplugged`), tidak diputar ulang.
- Saat app dibuka lagi: `_ensurePlayerHealthyOnResume`; sesi/antrean disimpan dan dipulihkan (`_saveSession`, `_restoreLastSession`).
- Tidak ada layanan foreground terpisah untuk unduhan; unduhan hidup di proses yang sama.

## Perubahan
- **`InterruptionResumer.java` (baru)**: penantian + putar-ulang sepenuhnya di native, tanpa JS. Pemicunya hanya ExoPlayer
  berhenti karena kehilangan fokus audio. Jeda pengguna / notifikasi / headset dicabut / lagu habis membatalkan penantian.
  - Deteksi app lain berhenti lewat `AudioPlaybackCallback` (Android 8+, berbasis event) + pengecekan berkala 3 dtk sebagai
    jaring pengaman; panggilan terdeteksi dari `AudioManager.getMode()`.
  - Harus sepi 2 dtk berturut-turut sebelum memutar (jeda antar lagu app lain tidak memicu). Bila app lain tak pernah
    terlihat memutar, lanjut setelah 8 dtk (suara navigasi, dsb.).
  - CPU ditahan sebentar (wake lock berbatas) hanya saat sudah sepi tetapi belum cukup lama, jadi layar mati tidak menunda.
  - Tanpa batas waktu pendek: menunggu sampai 24 jam (batas pengaman), lalu service dibereskan.
- **`PlaybackService`**: service tidak berhenti karena `IDLE_LIMIT_MS` selama menunggu; hook di `onPlayWhenReadyChanged`
  (fokus hilang = mulai menunggu; lainnya/`play` = selesai); dibersihkan di `shutdown`, `doStopEngine`, `onDestroy`.
- **Pengaturan > Pemutaran > "Putar otomatis setelah gangguan"** (default menyala). Mematikannya membatalkan penantian
  yang sedang berjalan. `AutoResumeSync` (JS) tetap ada sebagai cadangan untuk APK lama dan ikut mengikuti pengaturan ini.

## Tidak diubah (sudah ada)
- Unduhan di latar belakang: antrean native (0.4.4), `DownloadService` dengan wake lock + Wi-Fi lock + `onTimeout`.
- Pemulihan sesi antrean/posisi (`playerSession.ts`), pemeriksaan mesin saat lanjut (`engineResume` mengembalikan false
  bila service sudah mati sehingga lagu dimuat ulang).
- Belum ada: Android Auto (`MediaBrowserService`) seperti di StreamBeats.

## Pengujian
`InterruptionResumer` dikompilasi dan dijalankan terhadap stub API Android dengan jam virtual: app lain berbunyi 1 jam
lalu berhenti -> lanjut 2 dtk kemudian; tanpa sinyal -> 8 dtk; jeda antar lagu app lain tidak memicu; panggilan 10 menit;
jeda pengguna membatalkan; masih menunggu di jam ke-23 dan menyerah di jam ke-24; pengaturan dimatikan; pendaftaran
callback tidak ganda. TypeScript lolos `tsc` untuk file yang disentuh. **BELUM diuji di perangkat / Media3 asli**; kode di
`PlaybackService` hanya diperiksa sintaksnya (struktur kurung) karena Media3 tidak tersedia di sini.

## Perlu build ulang APK (Java berubah): `npm run android:sync`.
