# 0.5.53 — Pencarian radio di native (langkah 2a: pencari lagu mirip, belum dipasang)
## Masalah
- Antrean radio diisi `services/radio.ts` di JS (Deezer + urutan genre/tempo). Saat WebView dibekukan di latar belakang, antrean radio tidak terisi lagi; workaround hanya mengisi lebih awal (>= 12 lagu).
## Isi langkah ini
- **`RadioFinder.java` (baru)**: port native `findSimilarTracks` / `onlineSimilar` / `rankByVibe` (`radio.ts` + `artistApi.ts`): artis utama -> "radio artis" Deezer (60 calon) -> urut genre album sama (+2) lalu tempo <= 15 BPM (+1, hanya 12 teratas), diacak dulu, maks. 15 lagu (`BATCH`), tanpa lagu yang kuncinya ada di `exclude` (`trackKey` = judul + artis pertama, sama dengan JS). Id / URL lagu berbentuk sama dengan `mapDeezerRows` (`dz-<id>`), supaya nanti JS menganggapnya lagu yang sama.
- Sumber data lewat antarmuka `Source` (`DeezerSource` = HTTP sungguhan; cache genre / tempo selama proses). Gangguan pada genre / tempo hanya melewati penilaian itu; gangguan pada pencarian utama dilempar sebagai `IOException`; pembatalan dicek di sela langkah.
- **Tes lokal** `native/android/test/` (lihat README di sana): 11 pemeriksaan (ukuran batch, seed dikecualikan, tanpa duplikat, urutan genre lalu tempo, `exclude`, genre gagal, seed gagal -> cari artis, batal, artis kosong, kesamaan `trackKey` dengan TS). Semua lolos dengan JDK 21 + stub org.json.
## Belum / batasan
- **`RadioFinder` belum dipanggil `PlaybackService`**: perilaku aplikasi tidak berubah di versi ini.
- Cadangan dari Riwayat (`historySimilar`) tidak ada di native (Riwayat milik JS); hasil kosong = tidak ada tambahan.
- Langkah berikutnya (2b): saat JS beku dan sisa antrean native menipis, panggil `RadioFinder` untuk lagu aktif, tambahkan hasilnya sebagai item tanpa URL (di-resolve `YtMatcher` seperti sekarang), dan simpan daftar tambahan itu di native.
- Langkah 2c: saat JS hidup lagi, tambahan itu dimasukkan ke antrean JS (urut, sebelum sesi native disamakan dan sebelum JS menerbitkan daftar berikutnya), supaya indeks / id lagu cocok.
## Teknis
- Baru: `native/android/java/RadioFinder.java`, `native/android/test/**`. Diubah: `package.json` (0.5.53).
- Belum dibuild di Android. `javac` tidak ada; kompilasi dicek lewat `jdk.compiler` JDK 21 dengan stub `org.json` (API yang dipakai ada di org.json Android). `RadioFinder` belum pernah dijalankan terhadap Deezer sungguhan (jaringan dimatikan di sini).
