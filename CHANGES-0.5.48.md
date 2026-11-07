# 0.5.48 — Android Auto: Lagu Disukai, Playlist saya, dan Unduhan
## Cara kerja
- Pohon telusur Android Auto sebelumnya hanya "Baru diputar" dan "Antrean". Kini:
  - **Lagu Disukai** (playlist bawaan `my-liked`), tampil bila ada isinya.
  - **Playlist saya**: tiap playlist buatan (bukan Lagu Disukai, yang berisi lagu) jadi folder; ketuk playlist untuk melihat lagunya.
  - **Unduhan**: lagu yang sudah diunduh, terbaru dulu. Bisa diputar tanpa internet.
- Ketuk lagu: lagu itu dan semua sesudahnya di daftar yang sama diputar (sama seperti Baru diputar). Id item: `liked:<id>`, `pl:<idPlaylist>:<id>`, `dl:<id>`; JS mempercayai id lagu, bukan posisi, jadi aman bila daftar berubah sejak diterbitkan.
- **Pustaka disimpan native** (`AutoBridge.setLibrary`, SharedPreferences, kunci terpisah dari `browse`), jadi mobil bisa menelusurinya walau aplikasi belum dibuka. Dipisah karena ukurannya lebih besar dan jarang berubah; JS hanya menulisnya bila isinya benar-benar berubah (dibandingkan dengan yang terakhir dikirim, ditunda 1,5 dtk).
- **Pencarian suara** ("Ok Google, putar …") kini juga mencari di Lagu Disukai, Unduhan, dan playlist buatan (sebelumnya hanya Riwayat, lalu artis lewat Deezer). Urutan: Riwayat, Disukai, Unduhan, playlist; lagu yang sama dihitung sekali.
## Batas
- Maks. 100 lagu per daftar (Disukai, Unduhan, tiap playlist) dan 30 playlist di daftar mobil. Memutar tetap memakai seluruh daftar dari lagu yang diketuk.
- Folder yang kosong tidak ditampilkan. Daftar belum punya sampul (sama seperti sebelumnya).
- Resolve audio untuk lagu non-unduhan tetap oleh JS: memutar dari mobil saat app belum berjalan masih bergantung pada app terbuka (batas lama Android 10+).
- Unduhan di mobil memakai urutan `savedAt` (terbaru dulu), bukan urutan playlist asal.
## Teknis
- Diubah: `AutoBridge.java` (`setLibrary`, `readLibrary`), `AutoBrowserService.java` (simpul `NODE_LIKED`, `NODE_PLAYLISTS`, `NODE_DOWNLOADS`, awalan `PL_PREFIX`, `songItems`, `refresh` memberi tahu semua simpul), `MusicVerseNativePlugin.java` (`setAutoLibrary`), `src/native/musicVerseNative.ts`, `src/components/player/AutoSync.tsx` (`libraryPayload`, `tracksFromMediaId`, `tracksFromQuery`, efek 1b).
- APK lama: `setAutoLibrary` melempar UNIMPLEMENTED dan diabaikan (telusur tetap Baru diputar + Antrean).
- **Perubahan native: perlu build APK baru** (naikkan `version`). Belum dibuild atau diuji di perangkat / Desktop Head Unit; TS dicek sintaksnya (transpile), Java hanya keseimbangan kurung.
