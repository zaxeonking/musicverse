# 0.5.40 — Kecepatan putar
- Menu lagu yang sedang diputar (mini player, pemutar penuh, antrean) punya **Kecepatan putar**: 0,75x, 0,9x, normal, 1,1x, 1,25x, 1,5x, 2x. Nada suara tetap (pitch dipertahankan). Pilihan tersimpan (`musicverse:speed:v1`) dan berlaku untuk semua lagu.
- Web: `playbackRate` + `defaultPlaybackRate` + `preservesPitch` di setiap elemen audio (default ikut diisi karena `load()` mengembalikan rate).
- APK: bridge baru `engineSetSpeed` -> `PlaybackService.engineSetSpeed` memakai `PlaybackParameters(speed, 1f)` pada pemutar aktif, cadangan, dan yang baru dibuat. Jam tiruan JS (`getLiveTime`) ikut dikali kecepatan agar sorotan lirik tidak meleset.
- File baru: `services/playbackSpeed.ts`, `components/player/SpeedSheet.tsx`.
- **Butuh APK baru** (ada perubahan Java). Di APK lama, panggilan diabaikan: kecepatan hanya berubah di web.
- Belum dibuild atau diuji di perangkat; hanya sintaks yang dicek.

## Radio, tombol prev, dan seek notifikasi
- **Radio tanpa akhir**: radio terus mengisi antrean tanpa batas. Bila lagu mirip dari lagu aktif habis, dicoba dari 5 lagu terakhir di antrean, lalu Riwayat didaur ulang (20 lagu terakhir di antrean dilewati). `services/radio.ts` (`findEndlessTracks`), `components/player/AutoRadioSync.tsx`. Hanya JS.
- **Tombol prev memakai audio tersimpan**: data audio tiap lagu yang berhasil dimuat disimpan 20 menit per lagu (maks 50 lagu); prev memutarnya langsung tanpa mencari ulang. Bila gagal dimuat atau lewat 20 menit, otomatis ambil URL baru. Lagu lokal/unduhan dan pilihan manual tidak disimpan. `hooks/useAudioPlayerController.ts` (`playedCacheRef`, opsi `useSaved`). Hanya JS.
- **Seek di notifikasi langsung berlaku**: sebelumnya geseran bilah progres hanya diteruskan ke JS sehingga bilah mental balik sampai aplikasi dibuka. Sekarang `PlaybackService.handleSeek` langsung seek pemutar native dan memperbarui sesi + notifikasi; JS tetap diberi tahu. Digeser sampai ujung: JS pindah ke lagu berikutnya. **Perubahan native: perlu build APK baru.**
- Belum dibuild atau diuji di perangkat.
