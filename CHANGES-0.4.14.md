# MusicVerse 0.4.14 — "Cari manual" dan cadangan pihak ketiga (opsional)

Untuk lagu yang tidak ketemu otomatis (mis. "Audio yang ditemukan di YouTube tidak sesuai dengan lagunya").

## 1. Cari manual (kartu unduhan gagal)
- Kartu gagal punya tombol **Cari manual**. Muncul sampai **5 hasil** YouTube Music dan YouTube (bergantian, tanpa duplikat)
  dengan **judul, artis, durasi**, dan sumbernya.
- Ketuk yang benar: unduhan jalan lewat jalur yang sama (antrean native, sampul, tag, metadata).
- Pemeriksaan audio tetap ketat, tetapi acuannya **hasil yang kamu pilih**, bukan playlist: audio harus terbaca, bukan
  cuplikan, durasinya cocok dengan hasil pilihan (toleransi sama seperti biasa), dan isi berkas harus benar-benar audio.
  Judul/artis tidak dicocokkan dengan playlist (kamu yang menentukan). Berkas tetap diberi tag judul/artis dari playlist.
- Pilihan manual yang tidak lolos **langsung gagal** dengan alasannya (tidak ada putaran ulang ke sumber lain).
- Hasil kosong / pencarian gagal ditampilkan di sheet, dengan tombol "Coba lagi".

## 2. Cadangan pihak ketiga (Pengaturan unduhan, DEFAULT MATI)
- Saklar baru **Cadangan pihak ketiga**. Bila menyala, dan YouTube Music + YouTube sama-sama tidak menemukan yang cocok,
  dicoba dua sumber pihak ketiga berurutan (`thirdParty.ts`): Cadangan 1 (`app.kyzznekoo.my.id`) lalu Cadangan 2
  (`api.nexadev.my.id`). Hanya **unduhan**; pemutaran tetap hanya lewat YouTube.
- Butuh tautan lagu Spotify (lagu dari impor Spotify punya). Lagu tanpa tautan dilewati.
- **Tetap diverifikasi**: audio terbaca di WebView, bukan cuplikan, judul + artis cocok dengan playlist, durasi file sangat
  dekat dengan playlist; lalu isi berkas diperiksa lagi setelah diunduh. Yang tidak lolos ditolak seperti sumber lain.
- Hanya dipakai bila plugin sungguh "tidak menemukan yang cocok". Bila plugin gagal karena jaringan/timeout, itu diulang
  seperti biasa dan tidak dialihkan ke pihak ketiga.
- Ini membalik keputusan 0.4.x yang membuang API pihak ketiga, tetapi hanya sebagai pilihan sadar pengguna.
- Lagu yang memang tidak ada di YouTube belum tentu ada di sumber pihak ketiga.

## Berkas
`plugins/thirdParty.ts` (baru), `plugins/registry.ts` (`searchManualCandidates`, `resolveManualPick`, langkah pihak ketiga),
`plugins/types.ts`, `services/spotifyApi.ts` (opsi `thirdParty` / `manual`), `native/offline.ts`, `native/downloads.ts`
(`findManualCandidates`, `downloadWithPick`, `setThirdPartyFallbackEnabled`), `components/library/ManualSearchSheet.tsx` (baru),
`DownloadsSection.tsx`, `DownloadSettingsPage.tsx`. Tanpa perubahan Java.

## Batas / catatan jujur
- Belum diuji ke server YouTube / pihak ketiga asli maupun di perangkat. `tsc` dibandingkan dengan 0.4.13: tidak ada galat
  baru selain galat lingkungan (tipe React/Capacitor tidak terpasang di tempat saya mengerjakan).
- Pilihan manual hanya berlaku untuk sesi itu: bila app ditutup sebelum selesai, lagunya kembali ke daftar gagal dan
  "Coba lagi" memakai pencarian otomatis.
- Bila plugin gagal karena jaringan terus-menerus sampai batas percobaan, pihak ketiga tidak ikut dicoba (sengaja).
- Format respons kedua API pihak ketiga diambil dari kode lama proyek; bila servernya berubah, langkah ini gagal diam-diam
  dan unduhan berakhir seperti sebelumnya.

## Perlu build ulang APK (`npm run android:sync`).
