# 0.4.22 — Lagu berulang terus saat habis (ronde 2)

Kandidat penyebab baru: galat/macet di UJUNG lagu memicu "muat ulang lagu yang sama".
- JS `fail()`: galat network/timeout saat posisi >= durasi-5 dtk = lagu selesai -> lanjut ke lagu berikutnya (bukan muat ulang).
- Penghitung percobaan ulang tidak lagi direset oleh event `playing`; ada batas total per lagu (6x) sehingga tidak bisa berputar selamanya.
- Java `handleStall`: macet <4 dtk dari ujung = lagu selesai (rantai/`ended`), tidak membuka ulang sumber.
- Termasuk semua perbaikan 0.4.21. Java belum dikompilasi/diuji di perangkat.
Bila masih berulang: kirim logcat/console yang memuat `[MusicVerse]` (mis. "lagu selesai #..", "Audio putus", "Galat ... di ujung lagu").
