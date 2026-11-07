# 0.5.40 — Kecepatan putar
- Menu lagu yang sedang diputar (mini player, pemutar penuh, antrean) punya **Kecepatan putar**: 0,75x, 0,9x, normal, 1,1x, 1,25x, 1,5x, 2x. Nada suara tetap (pitch dipertahankan). Pilihan tersimpan (`musicverse:speed:v1`) dan berlaku untuk semua lagu.
- Web: `playbackRate` + `defaultPlaybackRate` + `preservesPitch` di setiap elemen audio (default ikut diisi karena `load()` mengembalikan rate).
- APK: bridge baru `engineSetSpeed` -> `PlaybackService.engineSetSpeed` memakai `PlaybackParameters(speed, 1f)` pada pemutar aktif, cadangan, dan yang baru dibuat. Jam tiruan JS (`getLiveTime`) ikut dikali kecepatan agar sorotan lirik tidak meleset.
- File baru: `services/playbackSpeed.ts`, `components/player/SpeedSheet.tsx`.
- **Butuh APK baru** (ada perubahan Java). Di APK lama, panggilan diabaikan: kecepatan hanya berubah di web.
- Belum dibuild atau diuji di perangkat; hanya sintaks yang dicek.
