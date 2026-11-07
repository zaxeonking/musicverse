# MusicVerse 0.4.10 — pemulihan buffering macet + saklar mode langsung

## Masalah
Di tengah lagu kadang "Buffering…", lalu digeser dan spinner tidak pernah selesai.

## Perubahan
- **Mode langsung jadi opsi, default MATI** (Pengaturan > Pemutaran). Default kembali lewat StreamProxy (potongan 1 MB) yang
  sudah teruji; mode langsung (satu koneksi panjang ke sumber) bisa dinyalakan untuk dibandingkan. Dugaan: sumber YouTube
  membatasi kecepatan satu koneksi panjang / menahan Range tak terbatas.
- **Tangga pemulihan macet di native** (tiap 10 dtk buffering terus-menerus): 1) buka ulang sumber di posisi sekarang,
  2) pindah ke proxy (atau buka ulang lagi), 3) laporkan galat jaringan ke JS -> link diambil ulang, lagu dimuat ulang dari
  posisi terakhir. Sebelumnya hanya ada satu langkah, dan hanya untuk mode langsung.
- **Seek**: pemutar yang berhenti karena galat dibangunkan lagi (`prepare`), hitungan macet diulang dari nol, dan
  `SeekParameters.CLOSEST_SYNC` (loncat ke titik sinkron terdekat).
- **Pemulihan status**: bila event `playing` hilang tapi ExoPlayer sudah berbunyi, `timeupdate` mengembalikan status dari
  "Buffering" ke "Playing".

## Catatan
- Cache disk hanya berlaku untuk sumber API yang punya kunci; setelah 0.4.5 audio hanya dari plugin (tanpa kunci), jadi cache
  praktis tidak aktif.
- BELUM diuji di perangkat. Perlu build ulang APK (Java berubah).
