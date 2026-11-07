# 0.4.21 — Fix lagu berulang terus (mode ulang mati)

Akar masalah ada di Java (rantai lagu native, `PlaybackService.java`), bukan di JS:

1. **Dua pengendali sekaligus.** Saat lagu selesai, native memindah lagu sendiri lewat `chainAdvance` walau JS masih hidup
   (layar menyala), padahal JS juga memproses `ended`. Dua-duanya berebut urutan lagu -> daftar usang -> lagu sama dimuat lagi.
   Sekarang native hanya mengambil alih bila JS beku (`!jsAlive()`); JS hidup = JS yang mengatur.
2. **Daftar rantai usang setelah pindah via lagu cadangan (crossfade/gapless).** Isinya lagu cadangan yang barusan diputar,
   jadi saat lagu itu selesai native memutarnya LAGI. Daftar kini dibuang saat pindah lewat cadangan.
3. **Pengaman loop di native.** Bila "lagu berikutnya" sama dengan lagu yang sedang diputar (`knownIndex`), daftar dibuang
   dan native tidak memutarnya lagi (jatuh ke `ended` -> JS lanjut).
4. **Pemulih gangguan** tidak lagi memutar ulang lagu dari awal bila lagu sudah selesai (`STATE_ENDED`).

Catatan: Java belum pernah dikompilasi/diuji di perangkat dari sisi saya. Bila masih berulang, kirim log
`[MusicVerse] lagu selesai #...` dari logcat.
