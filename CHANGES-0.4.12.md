# MusicVerse 0.4.12 — lagu tidak lagi berhenti di tengah, geser lancar, unduhan tidak macet di "Menyiapkan"

## Masalah
1. Lagu jalan beberapa detik lalu berhenti di "memuat"; digeser maju/mundur spinner tidak selesai (StreamBeats mulus).
2. Unduhan berputar di "Menyiapkan…" tanpa pernah mulai (StreamBeats langsung jalan).

## Penyebab (satu akar untuk keduanya)
`plugins/ytmusic.ts` mengambil stream dengan klien `ANDROID` yang membawa `androidSdkVersion` (21.26.364). Ini memicu syarat
**PO token** di server video YouTube: playerResponse-nya OK dan beberapa detik/MB pertama terbaca (jadi lolos pemeriksaan
durasi di `resolveViaPlugins`), tetapi permintaan Range berikutnya (lanjut lagu, geser/seek) ditolak 403.
- Pemutar: stream terpotong -> buffering -> tangga pemulihan -> link di-resolve ulang, tetapi hasilnya diambil dari cache
  resolve (±30 menit) = URL sama yang sudah ditolak -> spinner tidak pernah selesai.
- Unduhan: URL ditolak 403 -> di-resolve ulang -> klien sama -> ditolak lagi. Plugin `ytvideo` memakai pengambil stream yang
  SAMA, jadi "lewati plugin" tidak menolong. Status kembali ke "Menyiapkan…" tiap putaran, sampai 12 percobaan.
Rujukan yang dibaca (2026): yt-dlp 2026.08.19 menghapus `android_vr` dari klien bawaan (PO token selektif sejak Juli 2026,
format 1.65.10 403 sejak 17 Agustus) dan memakai `visionos` yang tanpa JS runtime dan tanpa PO token; wiki unduhan
YouTube/ytdl-material menjelaskan gejala "beberapa chunk pertama berhasil lalu ditolak" untuk klien yang butuh PO token.

## Perubahan
- **`ytmusic.ts`**: urutan klien sekarang `VISIONOS` (konteks yt-dlp: versi 1.02, Apple RealityDevice17,1, visionOS,
  X-YouTube-Client-Name 101) -> `ANDROID` TANPA `androidSdkVersion` (20.10.38) -> `IOS`. `ANDROID` 21.26.364 dibuang.
  User-Agent tiap klien ikut ke StreamProxy / ExoPlayer / pengunduh seperti sebelumnya (`stream.headers`).
- **`markClientRejected(userAgent)`** (baru, `ytmusic.ts`): stream suatu klien yang ditolak server video (HTTP 401/403/410)
  membuat klien itu dilewati 10 menit; resolve berikutnya memakai klien lain. Dipanggil dari alur unduhan (JS dan antrean
  native yang mengembalikan "rejected").
- **Pemutar** (`useAudioPlayerController`): muat-ulang karena jaringan putus sekarang membuang cache resolve lagu itu
  (`forgetResolved`) supaya link benar-benar baru, dan putus ke-2 saat internet ada = ganti klien (`markClientRejected`).
- **Unduhan**: percobaan ke-2 dst. menampilkan "Menyiapkan… Mencoba lagi (n/12)" (tidak lagi tampak macet tanpa keterangan).

## Pengujian
`getStreams` diuji dengan fetch tiruan: VISIONOS dipakai lebih dulu dengan konteks/header yang benar (tanpa
`androidSdkVersion`, X-YouTube-Client-Name 101); jatuh ke ANDROID sdkless bila VISIONOS gagal; klien yang ditandai ditolak
dipindah ke belakang; semua gagal -> galat jelas. TypeScript hanya diperiksa sintaksnya.
**BELUM diuji ke server YouTube asli maupun di perangkat.** Klien YouTube berubah-ubah; bila `visionos` berhenti jalan,
perbarui konstanta `VISIONOS` (cocokkan dengan `visionos` di yt-dlp `_base.py`).

## Batas
- TVHTML5 + dekode cipher (cadangan di plugin Bloomee) belum dibawa.
- Hasil resolve non-strict tetap di-cache; hanya jalur muat-ulang karena putus yang membuangnya.

## Tidak perlu Java baru; bundel web berubah. Build ulang APK seperti biasa (`npm run android:sync`).
