# 0.5.17 — Judul dengan angka 2 (kata ulang) tidak lagi ditolak
- Akar masalah: lagu \"GUB3RNUR - Mati Matian\" ketemu di pencarian sebagai \"Mati2an\", tetapi `scoreCandidate` menilai kedua judul tidak punya kata yang sama (skor judul 0), sehingga gerbang judul membatasi skor ke 0,45 dan unduhan ditolak. Di StreamBeats lagu yang sama ketemu.
- Perbaikan: `expandReduplication` di `src/utils/matchTrack.ts` membaca angka 2 yang diapit huruf sebagai pengulangan kata (\"Mati2an\" = \"Matimatian\"). Dipakai di `tokens` dan `compact`, jadi `sameSpelling` dan skor judul ikut benar. \"U2\", \"2Pac\", \"Blink 182\" tidak berubah.
- Hanya JS (OTA).
- Belum diuji di perangkat: hanya skor pencocokan yang dicek terpisah di Node. Lagu lain di tangkapan layar (Suzume, Yumetourou, CLBK, U&I) sudah lolos skor dengan data perkiraan; jika masih ditolak, kirim pesan galat di daftar Unduhan.
