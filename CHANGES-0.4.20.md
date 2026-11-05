# Patch untuk 0.4.19 — pengaman bila lagu tidak lanjut dan berulang terus (rantai native)

## Gejala
Lagu tidak pindah ke lagu berikutnya dan terus berulang, padahal mode ulang mati.

## Yang BISA dipastikan dari kode
- Alur `ended` (lagu selesai -> lagu berikutnya) di `useAudioPlayerController.ts` **identik** dengan 0.4.17: tidak ada perubahan di sana.
- Perubahan sejak 0.4.17 hanya penambahan rantai lagu native (0.4.18): daftar `setUpcoming` + event `advanced` berindeks.
- Di kode itu ada celah: event `advanced` dengan indeks yang SAMA dengan lagu aktif jatuh ke cabang "tak dikenal" (daftar yang
  diserahkan sudah diganti setelah lagu itu aktif) dan **diabaikan diam-diam**. Kalau native memutar ulang lagu yang sama lewat
  rantai, JS tidak pernah tahu, state tidak berubah, daftar tidak dikirim ulang, dan loop berlanjut selamanya.

## Yang TIDAK bisa dipastikan
Kenapa native mengulang lagu yang sama ada di sisi Java (`PlaybackService.java`, `MusicVerseNativePlugin.java`), dan folder `native/`
tidak ikut terbaca (zip 0.4.19 yang sampai terpotong di tengah). Jadi akar masalahnya belum terkonfirmasi; patch ini adalah pengaman,
bukan perbaikan akar.

## Perubahan (hanya TypeScript)
- Baru `src/utils/nativeAdvance.ts`: `judgeNativeAdvance` memutuskan `accept` / `ignore` / `loop` untuk event `advanced` berindeks.
  Indeks sama dengan lagu aktif yang datang lagi (beruntun, `LOOP_STREAK = 2`) = `loop`.
- `useAudioPlayerController.ts`: pada `loop`, rantai native dimatikan selama sesi (`setUpcoming(..., [])` + penanda), lalu JS melanjutkan
  persis seperti alur `ended` (lagu berikutnya; bila antrean habis: putar ulang antrean atau berhenti). Efek `setUpcoming` tidak
  mengirim daftar lagi sesudah itu, jadi perilaku kembali seperti 0.4.17 sampai app dibuka ulang.
- Log diagnostik ringan: `[MusicVerse] lagu selesai #i dari n: ulang=..., berikutnya=..., rantaiNative=...` dan
  `[MusicVerse] rantai native pindah ke lagu #i`; plus peringatan `Rantai native mengulang lagu #i ...` saat pengaman bekerja.

## Diuji / belum
- Node (7 kasus) untuk `judgeNativeAdvance` + simulasi reducer: rantai normal 1,2,3 diterima; 1,1,... terdeteksi loop pada pengulangan
  pertama; indeks tak dikenal tidak mereset deteksi; 1,2,1,2 bukan loop; indeks = lagu aktif tanpa riwayat hanya diabaikan; `currentIndex` null aman.
- `tsc` (di pohon gabungan 0.4.17 + file 0.4.19 yang terbaca) tidak menambah galat dibanding tanpa patch.
- BELUM dijalankan di perangkat dan Java belum dibaca. Kalau lagu masih berulang setelah patch ini, loop-nya bukan lewat rantai native.

## Cara pasang
Salin dua file ke proyek 0.4.19 (timpa `useAudioPlayerController.ts`), lalu naikkan versi di `package.json` ke 0.4.20 sendiri.
Hanya TypeScript; build ulang APK seperti biasa.
