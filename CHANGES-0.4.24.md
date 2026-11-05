# 0.4.24 — lagu mengulang setelah digeser (seek) ke dekat akhir

## Laporan
Menggeser posisi (menit) beberapa kali sampai dekat akhir lagu, lalu saat waktunya ganti lagu, lagu yang SAMA diputar lagi.

## Yang jujur
Penyebab pastinya **belum terkonfirmasi** (tidak bisa dijalankan di perangkat dari sini; empat ronde "lagu berulang" sebelumnya
menutup jalur lain). Dari membaca kode ada beberapa jalur yang bisa memutar ulang lagu yang sama setelah seek di dekat ujung,
semuanya ditutup di sini, dan **log pemutaran baru** ditambahkan supaya kalau masih terjadi, sebabnya terbaca.

## Jalur yang ditutup
1. **Muat ulang dari posisi di ujung lagu = mulai dari awal (JS).** Bila jaringan putus saat menggeser ke dekat akhir, JS memuat
   ulang lagu dengan `resumeAt`; posisi yang < 3 dtk dari ujung dibuang sehingga lagu mulai dari 0:00. Sekarang muat ulang dengan
   posisi <= 12 dtk dari ujung dianggap lagu SELESAI -> lanjut ke lagu berikutnya (`startPlayback`, dan ambang `fail()` 5 -> 12 dtk).
2. **ExoPlayer berstatus ENDED hidup lagi karena `seekTo` (Java).** `engineSeek` yang datang terlambat (sesudah `ended`, saat JS
   memuat lagu berikutnya) membangunkan lagu lama dan memutarnya dari posisi itu. `engineSeek` kini diabaikan bila ENDED.
3. **Buka ulang di posisi 0 (Java).** Setelah galat saat seek / di ujung stream, ExoPlayer bisa melapor posisi 0; `reopenActive`
   dan `fallbackActive` membuka ulang di 0 = lagu mulai dari awal. Kini memakai posisi valid terakhir (`lastPosMs`, dari detak
   pemutar dan seek) bila yang dilaporkan jelas keliru (<= 0,5 dtk padahal sebelumnya > 5 dtk).
4. **Event `ended` ganda (JS).** Macet di ujung lagu bisa menghasilkan `ended` dari `handleStall` DAN dari ExoPlayer; yang kedua
   memindah lagu sekali lagi (lagu berikutnya dimuat dua kali / terlewati). `ended` kedua untuk lagu yang sama dalam 2,5 dtk dibuang.
5. **Menggeser ke ujung = ganti lagu (JS).** Menggeser sampai < 0,75 dtk dari akhir (mode ulang mati) langsung ke lagu berikutnya,
   tanpa menunggu ExoPlayer "selesai".

## Log pemutaran (Pengaturan > Pemutaran > Log pemutaran)
Mencatat 200 baris terakhir: `mulai #i`, `seek x / durasi`, `ended #i/n pos dur berikutnya`, `error mesin`, `fail`, `advanced`.
Cara pakai bila masih berulang: ulangi masalahnya, buka Pengaturan > Pemutaran, **Salin log**, tempel ke chat.

## Diuji / belum
`tsc` identik dengan 0.4.23 (satu-satunya selisih: lebih banyak elemen JSX yang dihitung karena tipe React tidak terpasang di sini).
Java belum dikompilasi (kurung kawat seimbang) dan belum diuji di perangkat. Perlu build ulang APK.
