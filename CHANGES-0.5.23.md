# 0.5.23 — Audio pilihan manual (Cari manual) bebas dari pemeriksaan playlist, di pemutar dan di unduhan
## Masalah
- Lagu yang dipilih manual (mis. "DJ Clbk - Cinta Lama Bersemi kembali") tetap ditolak pemutar: "Audio dari server tidak sama dengan lagu di playlist (cuplikan atau versi lain dengan durasi berbeda)". Penyebabnya, pemeriksa klip di pemutar (`createClipGuard`) dan pemeriksaan preload/crossfade membandingkan durasi file dengan durasi lagu di playlist, padahal pilihan manual memang beda versi. `resolveManualPick` juga masih menolak lewat `isLikelyClip` / `strictDurationProblem`, lalu pencarian otomatis diam-diam menggantikan pilihan pengguna.
## Perubahan
- `PlaybackInfo.manualPick` (baru): menandai audio yang dipilih pengguna.
- `registry.ts` `resolveManualPick`: tidak ada lagi pemeriksaan judul/artis/durasi (terhadap playlist maupun hasil pencarian). Syaratnya hanya ada stream; stream yang metadatanya terbaca didahulukan, bila tidak ada yang terbaca stream pertama tetap dipakai. Tanpa stream = gangguan sesaat ('failed', diulang), bukan "lagu tidak ada".
- `registry.ts` `resolveViaPluginsDetailed`: bila lagu punya pilihan manual, hasilnya dikembalikan apa adanya dan TIDAK jatuh ke pencarian otomatis. Hanya yang dipilih pengguna yang diputar.
- `useAudioPlayerController.ts`: pemeriksa klip dimatikan untuk `manualPick`; pemeriksaan klip pada preload dan crossfade lagu berikutnya juga dilewati.
- `FullPlayer.tsx`: catatan di bawah pemutar untuk pilihan manual berbunyi "Memutar pilihan manualmu: …", bukan "Audio yang ditemukan server berbeda…".
- `downloads.ts`: `isManualJob` = unduhan dari "Cari manual" ATAU lagu yang punya pilihan manual tersimpan. Untuk itu tidak ada durasi acuan, tidak ada cek klip/durasi/laju bit, tidak ada putaran coba-ulang ke sumber lain. Yang tetap dijaga: berkas tidak terpotong, isinya audio sungguhan, dan durasinya sama dengan sumber yang dibaca sebelum diunduh.
- `DownloadQueue.java` + `NativeQueueJob.free`: jalur native ikut melewati pemeriksaan durasi/laju bit untuk pekerjaan `free`.
## Pengecekan audio playlist (kenapa U&I dkk lolos padahal audionya tidak ada)
- Penyebab: mode cek (`searchOnly`) hanya menilai METADATA hasil pencarian (judul/artis/durasi yang tertulis di YouTube) lalu berhenti; stream tidak diambil dan file audio tidak dibaca. Lagu yang muncul di pencarian tetapi streamnya tidak bisa diambil/dibaca (itulah yang menggantung di "Mencari audio…") tetap dinyatakan "ada", dan hasil "ada" disimpan 12 jam.
- `registry.ts`: cek sekarang memakai jalur yang sama dengan pemutaran: cari, ambil stream, baca durasi file (batas baca 4 dtk), tolak klip/versi lain. Batas waktu SATU lagu = 6 dtk (`CHECK_BUDGET_MS`); lewat batas = tidak ditemukan. Stream yang lolos masuk cache sehingga memutar lagunya nanti lebih cepat.
- `useTrackAvailability.ts`: hasil cek selain "ok" (tidak ketemu, ditolak, stream tak terbaca, lewat 6 dtk) = "tidak ditemukan" (muncul di daftar Cari manual). Cache hasil "ada" dinaikkan ke `mv:availability:v2` sehingga hasil palsu lama terbuang dan semua lagu dicek ulang sekali.
## Lagu dikunci selama pengecekan
- Lagu yang BELUM selesai dicek tidak bisa diketuk/diputar (baris redup, tombol putar dan menu tekan-lama nonaktif); terbuka satu per satu begitu hasilnya keluar, jadi lagu yang sudah dicek (atau ada di cache 12 jam) langsung bisa dipakai. Tombol "Putar semua" nonaktif sampai pengecekan selesai. Panel pengecekan menampilkan keterangannya. (`TrackRow`, `TrackList`, `PlaylistHeader`, `PlaylistView`, `AvailabilityPanel`.)
## Lirik: YouTube Music lebih dulu
- `plugins/ytLyrics.ts` + `utils/ytLyricsParse.ts` (baru): lirik diambil dari YouTube Music lebih dulu (video = pilihan manual bila ada, kalau tidak hasil pencarian YouTube Music yang judul+artis+durasinya cocok; lalu tab lirik; bertanda waktu lewat klien ANDROID_MUSIC, cadangan lirik biasa lewat klien web). Batas 7 dtk.
- `lyricsApi.ts` `fetchLyrics`: bila YouTube Music punya lirik, itu yang dipakai; bila tidak ada / gagal, LRCLIB + NetEase + lyrics.ovh seperti sebelumnya.
- Parser sudah dites dengan data contoh buatan sendiri; panggilan jaringan ke YouTube Music BELUM diuji (tidak ada akses dari lingkungan pengerjaan).
## Catatan
- Bagian unduhan native butuh APK baru; bagian pemutar dan jalur unduhan JS cukup OTA.
- Belum diuji di perangkat (tidak ada akses ke YouTube dari lingkungan pengerjaan): tolong coba putar dan unduh lagu CLBK yang sudah dipilih manual.
- Konsekuensi: kalau video pilihan manual dihapus dari YouTube, lagunya tidak akan pindah ke sumber lain otomatis. Belum ada tombol "lepas pilihan manual" di UI (`forgetManualPin` sudah ada di kode, hanya belum dipanggil dari mana pun).
