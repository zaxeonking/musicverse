# 0.5.51 — Link audio diambil ulang native saat stream aktif gagal (langkah 1 dari resolve YouTube)
## Masalah
- Saat link lagu yang SEDANG diputar kedaluwarsa / ditolak server video / macet dan JS beku di latar belakang, pemutar native hanya bisa melompat ke lagu berikutnya. Link baru tetap butuh JS.
## Cara kerja
- `PlaybackService.relinkActive`: pada `onPlayerError` (setelah cadangan proxy `fallbackActive` gagal) dan pada macet tahap 3 (`handleStall`), bila JS beku, native mengambil link BARU untuk lagu yang SAMA di thread sendiri:
  - id video diketahui (`activeYtId`, lagu rantai hasil resolve native) -> `YtResolver.getStreams`;
  - id tidak diketahui (lagu dimuat JS, lagu dari Sebelumnya) -> `YtMatcher.resolve` (judul + artis + durasi, mode pemutaran).
  - Link baru didaftarkan ke `StreamProxy`, lalu `loadMedia` dari posisi terakhir (kunci cache sama, jadi bagian yang sudah ter-cache terpakai). Status putar/jeda dipertahankan; indikator memuat dipasang selama menunggu.
- Penolakan server (HTTP 401/403/404/410) menandai klien YouTube penghasil link itu dilewati 10 menit (`YtResolver.markRejected`) supaya link baru memakai klien lain. Galat jaringan biasa tidak menandai klien.
- Maks. 2 kali per lagu (`MAX_RELINKS`). Gagal / habis jatah: lompat ke lagu berikutnya seperti sebelumnya; bila tidak ada lagu berikutnya, galat dilaporkan dan indikator memuat dilepas.
- Hasil resolve yang datang setelah lagu berganti / berhenti dibuang (`relinkSeq`). Bila JS terbangun selagi native mengambil link, galat diserahkan ke JS (alur lama).
## Batasan
- Lagu yang dimuat JS tidak membawa id video ke native, jadi dicari ulang lewat judul + artis. Pilihan manual pengguna (`manualPins`) tidak ikut: link baru bisa berasal dari video lain. (Langkah berikutnya: JS membawa `ytId` ke native untuk lagu aktif dan antrean.)
- Hanya saat JS beku. Saat JS hidup, JS yang mengambil link baru seperti biasa.
- Sumber pihak ketiga dan cache hasil / nama lain lagu tetap di JS.
- Pencarian radio (Deezer + cocokkan ke YouTube, `services/radio.ts`) belum dipindah (langkah berikutnya).
## Teknis
- Diubah: `native/android/java/PlaybackService.java` (`relinkActive`, `onRelinked`, `resetRelink`, `isRejectedByServer`, titik reset di `doLoad`, `doStopEngine`, `doCrossfade`, `chainAdvance`, `chainPrevious`), `package.json` (0.5.51).
- Tidak ada perubahan JS/TS. APK lama: tidak relevan (perilaku lama).
- **Perubahan native: perlu build APK baru.** Belum dibuild atau diuji di perangkat; javac tidak tersedia, Java hanya dicek keseimbangan kurung (tambahan seimbang).
