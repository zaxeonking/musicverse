# MusicVerse 0.4.18 — pemutaran latar belakang tidak putus setelah 2-3 lagu

## Gejala
Layar mati / app di latar belakang: lagu jalan 2-3 lagu lalu berhenti, dan Putar di notifikasi tidak bisa menghidupkannya lagi.

## Penyebab (dari membaca kode; belum direproduksi di perangkat)
1. **Pindah lagu bergantung pada JS.** Link lagu berikutnya di-resolve JS (kode plugin ada di JS). 0.4.0 sudah mencatat batasnya:
   "native hanya bisa berantai 1 lagu sampai JS aktif lagi". Saat WebView di latar belakang dibatasi/dibekukan, JS tidak sempat
   me-resolve lagu berikutnya, jadi setelah 1-3 lagu tidak ada yang bisa diputar lagi.
2. **Tombol notifikasi (Putar/Jeda/Berikutnya/Sebelumnya) semuanya diteruskan ke JS.** JS beku = tombol tidak bereaksi. Itu
   sebabnya "Putar dari notifikasi" pun tidak berhasil.
3. **Watchdog `PlaybackService` mematikan service bila JS diam 90 dtk saat `playing`**, walau ExoPlayer masih berbunyi.

## Perubahan
- **Rantai lagu native.** Selama JS masih jalan, 5 lagu di depan di-resolve lebih awal dan diserahkan ke native
  (`audioEngine.setUpcoming` -> `engineSetUpcoming`). Saat lagu aktif selesai, native memutar yang berikutnya sendiri (memakai pemutar
  cadangan bila sudah dimuat, tanpa jeda), memperbarui notifikasi (judul, artis, durasi, sampul diunduh native), dan mengirim
  event `advanced` dengan `reason: "idx:<indeks antrean>"`. JS menyamakan state saat hidup lagi (bisa beberapa event sekaligus).
  Daftar dikosongkan saat ulang lagu (`one`/`once`) atau sleep timer "akhir lagu" menyala, supaya aturan itu tidak dilewati.
  Daftar usang (JS belum tahu native sudah pindah) diabaikan lewat `currentIndex`.
- **Tombol notifikasi jalan tanpa JS.** Bila JS tidak mengirim detak > 6 dtk saat memutar, atau native sudah pindah lagu sendiri,
  Berikutnya / Sebelumnya (ulang dari awal) / Putar / Jeda dikerjakan native. Saat jeda biasa, tombol tetap diteruskan ke JS,
  dengan jaring pengaman: bila 1,2 dtk kemudian Putar/Jeda belum berefek (JS beku), native mengerjakannya.
- **Watchdog**: service tidak lagi dimatikan karena JS diam selama ExoPlayer masih berbunyi.
- Pembaruan notifikasi dari native tidak dihitung sebagai detak JS (supaya deteksi JS beku tidak keliru).

## Berkas
`PlaybackService.java` (rantai, tombol, watchdog), `MusicVerseNativePlugin.java` (`engineSetUpcoming`), `audioEngine.ts`
(`setUpcoming`, event `advanced` berindeks), `useAudioPlayerController.ts` (resolve lagu di depan, penanganan `advanced`),
`musicVerseNative.ts`.

## Batas / belum diuji
- **Java belum dikompilasi dan belum diuji di perangkat** (Media3 / `javac` tidak ada di lingkungan ini); kurung/kawat diperiksa dan
  semua metode yang dipanggil ada. `tsc` identik dengan 0.4.17 asli (tanpa galat baru). Mohon dicoba: putar playlist 10+ lagu,
  matikan layar 20-30 menit.
- Daftar berisi maksimum 5 lagu. Bila JS beku lebih lama dari itu, pemutaran berhenti di ujung daftar (tombol Putar di notifikasi
  mengulang lagu terakhir). Link lagu yang diserahkan dibuang bila > 90 menit.
- Akhir antrean (antrean habis lalu diacak ulang) tetap keputusan JS; native berhenti di akhir.
- **Sleep timer berdurasi (menit) masih timer JS.** Bila JS beku, timer bisa telat; sekarang pemutaran tidak lagi putus sendiri,
  jadi ini lebih terasa. Memindahkannya ke native adalah pekerjaan terpisah.
- Crossfade berbasis JS tidak jalan saat JS beku; pindah lagu native memakai peralihan 150 ms.
- Bila lagu yang diserahkan gagal diputar (link kedaluwarsa), galatnya baru ditangani JS ketika hidup lagi.

## Perlu build ulang APK (Java berubah): `npm run android:sync`.
