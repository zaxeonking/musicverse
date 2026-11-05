# MusicVerse 0.4.18 — geser ke ujung lagu tidak lagi mengulang lagu yang sama

Dibangun di atas 0.4.17 (SEMUA berkas 0.4.17 dipertahankan; hanya 2 berkas kode diubah + catatan ini + versi).

**Gejala:** lagu digeser (seek) sampai dekat akhir; saat seharusnya pindah ke lagu berikutnya, lagu yang sama diputar lagi.

**Penyebab yang paling masuk akal (belum bisa direproduksi di perangkat):** setelah geser ke ujung, ExoPlayer bisa tertahan di
BUFFERING di akhir (durasi di wadah lebih panjang dari data yang ada, atau permintaan Range di ekor ditolak). Tangga pemulihan
macet (`handleStall`) menganggapnya stream putus -> buka ulang -> laporkan galat jaringan ke JS -> JS memuat ulang LAGU YANG
SAMA (`fail` -> percobaan ulang) = terdengar mengulang dari awal.

**Perbaikan (dua lapis):**
- Native `PlaybackService.java`: macet di dalam 12 dtk terakhir (`nearEnd`) = lagu selesai -> `finishTrack()` (pindah ke lagu
  cadangan bila sudah siap, kalau tidak kirim `ended` ke JS). `STATE_ENDED` memakai metode yang sama (dirapikan).
- JS `useAudioPlayerController.ts`: event `error` di dalam 12 dtk terakhir (`NEAR_END_SECONDS`) dikirim ulang sebagai `ended`, jadi
  mode ulang / lanjut / acak / berhenti-setelah-lagu berjalan seperti biasa.
- Konsekuensi: galat jaringan sungguhan di 12 dtk terakhir melewati sisa lagu (bukan memuat ulang dari awal).

Kalau masih terjadi: cek pengaturan ulang (Ulang 1x / Ulang lagu) dan kirim log `[MusicVerse] Galat ... di ujung lagu`.

**Build:** ada perubahan Java -> butuh APK baru.
