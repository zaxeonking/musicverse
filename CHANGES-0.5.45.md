# 0.5.45 — Normalisasi volume
## Cara kerja (keterangan)
- YouTube menyertakan **kekerasan tiap lagu** (`playerConfig.audioConfig.loudnessDb`, dB relatif acuan YouTube; positif = lebih keras) di respons stream. Nilai itu kini dibaca plugin `ytmusic` (dan `ytvideo`, yang memakai pengambil yang sama), dibawa lewat `StreamSource.loudnessDb` -> `PlaybackInfo.loudnessDb`.
- `VolumeNormSync` meneruskannya ke `audioEngine.setNormalizationDb()`. Lagu yang lebih keras dari acuan **diredam sebesar selisihnya** (maksimal 12 dB). Redaman ikut dikalikan ke volume akhir (master x akhir-lagu x normalisasi), jadi fade, crossfade, dan sleep timer tetap bekerja. Di APK lewat `ExoPlayer.setVolume`, di web lewat `audio.volume`.
- Tidak perlu mengukur audio sendiri, tidak ada perubahan native, tidak perlu APK baru.
## Batasan
- **Hanya meredam, tidak menaikkan.** Lagu yang lebih pelan dari acuan tetap pelan (volume tidak bisa dinaikkan di atas 100% lewat `audio.volume`/`setVolume`). Akibatnya volume rata-rata sedikit turun; naikkan volume perangkat bila perlu.
- Hanya lagu yang datang dari YouTube dan **punya data `loudnessDb`**. Bergantung klien yang dipakai plugin (VISIONOS / ANDROID / IOS); bila klien tidak menyertakannya, lagu itu diputar tanpa perubahan. Unduhan, lagu lokal, dan sumber lain tidak berubah.
- Belum diketahui seberapa sering nilainya tersedia di klien yang dipakai; perlu dicek di perangkat (catat `loudnessDb` di log atau lihat hasil dengar).
- iOS Safari mengabaikan `audio.volume`, jadi tidak berpengaruh di sana.
- Saat pindah lagu dengan crossfade, redaman lagu baru berlaku begitu info lagu itu terpasang (bisa ada selisih beberapa dB yang terdengar sebagai lompatan kecil di tengah crossfade).
## Pengaturan
- Pengaturan > Pemutaran > **Normalisasi volume** (APK). **Menyala secara bawaan**, tersimpan di `musicverse:volnorm:v1`. Di web (tanpa halaman Pemutaran) selalu menyala.
## Teknis
- File baru: `services/volumeNorm.ts`, `components/player/VolumeNormSync.tsx` (dipasang di `App.tsx`).
- Diubah: `plugins/types.ts`, `plugins/ytmusic.ts`, `plugins/registry.ts`, `types/spotify.ts`, `services/audioEngine.ts`, `pages/PlaybackSettingsPage.tsx`.
- Hanya JS (OTA). Belum dibuild atau diuji di perangkat; hanya sintaks yang dicek.
