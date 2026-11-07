# 0.5.52 — JS membawa id video YouTube ke native (link baru untuk video yang sama, pilihan manual terjaga)
## Masalah
- 0.5.51: saat stream aktif gagal dan JS beku, native mengambil link baru. Untuk lagu yang dimuat / diserahkan JS, native tidak tahu id videonya, jadi mencari ulang lewat judul + artis. Pilihan manual pengguna (`manualPins`) ikut hilang: link baru bisa dari video lain.
## Cara kerja
- `info.ytVideoId` (diisi `registry.ts` untuk plugin `ytmusic` / `ytvideo`, termasuk pilihan manual) kini ikut dikirim ke native:
  - lagu yang dimuat JS: `audioEngine.load(url, cacheKey, ytId)` -> `engineLoad({ ytId })` -> `PlaybackService.doLoad` -> `resetRelink(ytId)`;
  - lagu antrean yang sudah di-resolve JS: `items[].ytId` di `engineSetUpcoming` -> `UpcomingItem.ytId` (hanya bila item punya URL); `chainAdvance` memakainya saat lagu itu mulai diputar.
- `relinkActive` (0.5.51) memakai id itu lewat `YtResolver.getStreams` (video yang sama); pencarian judul + artis hanya cadangan bila id kosong atau resolve id gagal.
## Batasan
- Lagu dari Sebelumnya (`chainPrevious`) dan lagu yang dikembalikan ke antrean belum membawa id (riwayat native belum menyimpannya): memakai pencarian judul + artis.
- Lagu dari sumber pihak ketiga / berkas lokal / unduhan tidak punya id: perilaku 0.5.51.
- Pencarian radio (Deezer + cocokkan ke YouTube) belum dipindah (langkah berikutnya).
## Teknis
- Diubah: `src/hooks/useAudioPlayerController.ts` (`load`, item upcoming), `src/services/audioEngine.ts` (`load`, `nativeLoad`, tipe `setUpcoming`), `src/native/musicVerseNative.ts`, `MusicVerseNativePlugin.java` (`engineLoad`, `engineSetUpcoming`), `PlaybackService.java` (`LoadRequest`, `engineLoad` + overload, `doLoad`).
- APK lama menerima field `ytId` tetapi mengabaikannya; APK baru dengan JS lama: id kosong, pencarian judul + artis seperti 0.5.51.
- **Perubahan native: perlu build APK baru.** Belum dibuild atau diuji di perangkat; TS dicek sintaksnya (transpile, tanpa error), Java hanya keseimbangan kurung (javac tidak tersedia).
