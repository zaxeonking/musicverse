# 0.5.49 — Posisi & lagu aktif disimpan native saat activity dihancurkan
## Masalah
- Penyimpanan JS (antrean, lagu aktif, posisi) hanya diperbarui selama JS hidup. Saat Android menghancurkan activity (WebView mati) pemutar native bisa terus jalan dan pindah lagu sendiri; saat app dibuka lagi JS memulihkan lagu / posisi LAMA, dan tombol Play memuat ulang lagu itu.
## Cara kerja
- **Native** (`NativeSession.java`, baru): `PlaybackService` mencatat lagu aktif + posisi (id lagu bila lagu rantai, judul, artis, indeks, durasi, status putar, sumber). Memori tiap ~1 dtk; ke penyimpanan (SharedPreferences) saat lagu pindah, dijeda, service berhenti / app digeser, dan tiap ~10 dtk saat native memegang kendali (JS tidak mengirim detak).
- **JS** (`native/nativeSession.ts`, `useAudioPlayerController`): saat app dibuka dan sesi baru dipulihkan dari penyimpanan, catatan native dibaca (`nativeSessionRead`) lalu dicocokkan ke antrean tersimpan (id lagu, lalu judul + artis; indeks native hanya petunjuk). Lagu aktif dan posisi disamakan, lalu catatan dihapus (`nativeSessionClear`).
  - Catatan **hidup** (pemutar native masih ada) selalu dipakai. Catatan **tersimpan** hanya dipakai bila lebih baru dari posisi simpanan JS (`savePlayerPosition` kini menyimpan `at`).
  - Bila native **masih memutar**, JS mengadopsi audionya (`audioEngine.adoptNative`): tanpa memuat ulang, status jadi "memutar", event native diteruskan lagi, jeda / seek bekerja pada suara yang sedang berbunyi.
  - Bila native dijeda / sudah berhenti: tampil dijeda di lagu + posisi yang benar; Play mengambil tautan baru dan lanjut dari posisi itu (alur lama).
## Batasan
- Lagu yang tidak ditemukan di antrean tersimpan tidak diadopsi (tidak menebak).
- Proses dimatikan sistem tanpa callback: posisi bisa tertinggal sampai ~10 dtk.
- Setelah adopsi, `playbackInfo` kosong sampai lagu berikutnya (info kualitas / sumber tidak tampil untuk lagu itu).
- Posisi yang disimpan sesaat setelah adopsi bisa 0 sampai detak `timeupdate` pertama.
## Teknis
- Baru: `native/android/java/NativeSession.java`, `src/native/nativeSession.ts`.
- Diubah: `PlaybackService.java` (`recordSession`), `MusicVerseNativePlugin.java` (`nativeSessionRead`, `nativeSessionClear`), `src/native/musicVerseNative.ts`, `src/services/audioEngine.ts` (`adoptNative`), `src/utils/playerSession.ts`, `src/hooks/useAudioPlayerController.ts`.
- APK lama: `nativeSessionRead` melempar UNIMPLEMENTED, ditangkap dan diabaikan (perilaku lama).
- **Perubahan native: perlu build APK baru.** Belum dibuild atau diuji di perangkat; TS dicek sintaksnya (transpile), Java hanya keseimbangan kurung (javac tidak tersedia).
