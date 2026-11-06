# 0.5.22 — Audio pilihan manual (Cari manual) bebas dari pemeriksaan playlist, di pemutar dan di unduhan
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
## Pengecekan audio playlist tidak lagi menghalangi ketukan lagu
- Di kode tidak ada baris lagu yang di-`disabled` saat pengecekan; yang terasa macet adalah pemutaran lagu yang diketuk antre di belakang pengecekan latar belakang (2 pekerja, tiap lagu bisa beberapa pencarian + nama lain) pada jaringan dan proses yang sama.
- `useTrackAvailability(tracks, enabled, hold)`: parameter `hold` baru. Selama pemutar berstatus `resolving`/`loading`, pekerja tidak mengambil lagu baru (yang sudah berjalan diselesaikan); lanjut otomatis setelah lagu mulai. `PlaylistView.tsx` mengisinya dari status pemutar.
## Catatan
- Bagian unduhan native butuh APK baru; bagian pemutar dan jalur unduhan JS cukup OTA.
- Belum diuji di perangkat (tidak ada akses ke YouTube dari lingkungan pengerjaan): tolong coba putar dan unduh lagu CLBK yang sudah dipilih manual.
- Konsekuensi: kalau video pilihan manual dihapus dari YouTube, lagunya tidak akan pindah ke sumber lain otomatis. Belum ada tombol "lepas pilihan manual" di UI (`forgetManualPin` sudah ada di kode, hanya belum dipanggil dari mana pun).
