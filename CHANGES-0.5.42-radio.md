# 0.5.42 (radio native, bagian 2b) — Radio native menambah lagu sendiri saat JS beku (langkah 2b; 2c belum)
## Masalah
- Saat WebView dibekukan di latar belakang dan antrean native habis, radio tidak bisa mengisi lagi (pengisi ada di JS).
## Cara kerja
- JS (`useAudioPlayerController`) menambahkan field opsional `radio: { tailIndex, exclude }` ke `engineSetUpcoming`. Dikirim HANYA bila: antrean JS benar-benar berakhir di daftar yang diserahkan (bukan sekadar jendela 20 lagu penuh), semua lagunya ikut diserahkan (tanpa pilihan manual yang memotong daftar), radio menyala (`getRadioAuto()` / `isRadioActive()`), dan shuffle mati. `tailIndex` = panjang antrean JS; `exclude` = `trackKey` (<= 500 lagu terakhir antrean JS).
- `PlaybackService.maybeFillRadio` (dicek ~1 dtk sekali dari ticker): JS beku, sedang memutar, lagu tersisa di antrean native <= 2 -> `RadioFinder.findSimilar` untuk lagu aktif di thread sendiri (`exclude` = antrean JS + antrean native + riwayat native + tambahan sebelumnya).
- Hasilnya masuk antrean native sebagai item TANPA URL, indeks `tailIndex`, `tailIndex+1`, ...; `resolveLazy` mencocokkannya ke YouTube lewat `YtMatcher` seperti item lazy lainnya. Id lagu = `dz-<id>` (sama dengan JS).
- Daftar tambahan disimpan di native: `RadioExtras` (`files/radioextras.json`, maks. 200). Belum ada yang membacanya (itu tugas 2c).
- Pencarian dibatalkan / hasilnya dibuang bila: service berhenti, JS mengirim daftar baru, JS lagu dimuat ulang, atau JS bangun lagi (JS mengisi radio sendiri lewat `AutoRadioSync`).
- Gagal / kosong tidak diulang untuk lagu aktif yang sama; lagu berikutnya mencoba lagi.
## Belum / batasan (penting)
- **2c belum ada.** Saat app bangun, antrean JS belum memuat tambahan itu. Event `advanced` untuk indeks di luar antrean JS diabaikan JS (`judgeNativeAdvance`: tidak `mappable`), jadi tidak merusak, tetapi JS belum tahu lagu yang sedang diputar native itu, dan `AutoRadioSync` bisa menambah radio sendiri (duplikat / indeks bentrok) sampai 2c selesai. Rilis 2b dan 2c sebaiknya bersamaan.
- Tidak aktif saat shuffle menyala atau antrean JS lebih panjang dari jendela yang diserahkan (native belum tahu ujung antrean).
- Pencarian dimulai saat sisa <= 2 lagu; bila antrean native sudah kosong dan lagu terakhir selesai sebelum hasil datang, pemutaran berhenti seperti sebelumnya.
- Cadangan dari Riwayat (`historySimilar`) tetap tidak ada di native.
## Teknis
- Baru: `native/android/java/RadioExtras.java`. Diubah: `PlaybackService.java` (`setUpcoming` + info radio, `maybeFillRadio`, `onRadioFound`, `resetRadio`; `stopped` / `lastJsUpdateAt` jadi `volatile`), `MusicVerseNativePlugin.java` (`engineSetUpcoming` membaca `radio`), `useAudioPlayerController.ts`, `audioEngine.ts`, `musicVerseNative.ts` (`NativeRadioTail`), `package.json` (0.5.54).
- APK lama dengan JS baru: field `radio` diabaikan. APK baru dengan JS lama: tanpa `radio`, native tidak menambah apa pun.
- **Perubahan native: perlu build APK baru.** Belum dibuild / diuji di perangkat; javac + Android tidak tersedia di sini. Sintaks TS dicek (transpile, tanpa error), Java hanya keseimbangan kurung (sama dengan berkas asli). Tidak ada tes baru untuk `PlaybackService` / `RadioExtras` (butuh Android).

# 0.5.42 (radio native, bagian 2c) — JS memasukkan tambahan radio native ke antrean saat bangun (langkah 2c)
## Masalah
- bagian 2b: native menambah lagu radio sendiri saat JS beku, tetapi antrean JS tidak tahu. Saat app bangun, indeks / id lagu yang dipakai native tidak ada di antrean JS, dan pemulihan sesi bisa salah.
## Cara kerja
- Plugin: `radioExtrasRead` / `radioExtrasClear` (membaca / mengosongkan `RadioExtras`). Modul baru `src/native/radioExtras.ts`.
- `mergeRadioExtras` (`useAudioPlayerController`): membaca daftar, memastikan lagu pertama bernomor tepat `queue.length` dan indeksnya berurutan (`extrasToAppend`), menandainya lagu radio, menambahkannya ke ujung antrean berurutan (`addToQueue`, `fromSearch`), lalu mengosongkan daftar di native. Lagu yang idnya sudah ada dilewati. Daftar yang tidak cocok dengan antrean (panjang berubah) dibuang, tidak ditempelkan ke antrean lain.
- Dipanggil LEBIH DULU dari semua jalur yang bergantung pada antrean:
  1. pemulihan sesi native (saat app dibuka): `await merge` sebelum `readNativeSession` / `matchSessionIndex`;
  2. app kembali ke depan (`visibilitychange` -> visible);
  3. event `advanced` dengan indeks di luar antrean JS: merge, lalu event diproses ulang satu kali (indeks dan id lagu sudah cocok);
  4. `AutoRadioSync`: menunggu merge sebelum mencari radio sendiri; bila ada yang ditambahkan, putaran itu dilewati (tidak ada radio ganda).
- Penerbitan daftar berikutnya ke native tidak perlu ditahan: native mengabaikan daftar JS yang `currentIndex`-nya belum sama dengan lagu yang diputar native, dan efek penerbitan berjalan lagi saat antrean berubah.
## Batasan
- Daftar yang tidak cocok dibuang (mis. pengguna sempat memuat playlist lain); lagu yang sedang diputar native dari daftar itu tidak bisa dipetakan JS sampai lagu berikutnya.
- Bila ada lagu duplikat (id sudah di antrean), lagu sesudahnya bergeser satu indeks dari angka native; pemetaan memakai id, bukan indeks.
- Tidak ada tes otomatis untuk jalur TS (proyek belum punya kerangka tes); `extrasToAppend` diuji manual (cocok, indeks salah, loncat, duplikat, kosong) lewat transpile + stub.
## Teknis
- Baru: `src/native/radioExtras.ts`. Diubah: `useAudioPlayerController.ts`, `AutoRadioSync.tsx`, `musicVerseNative.ts` (`NativeRadioExtra`, 2 metode), `MusicVerseNativePlugin.java` (2 metode), `package.json` (0.5.55).
- **Perlu build APK baru** (metode plugin baru). APK lama dengan JS baru: `radioExtrasRead` UNIMPLEMENTED -> daftar kosong, perilaku lama. Belum dibuild / diuji di perangkat; sintaks TS dicek (transpile), Java hanya keseimbangan kurung.

# 0.5.42 (UI) — Tombol utama playlist ikut keadaan pemutar
- Tombol hijau besar (Putar semua) kini ikut keadaan pemutar: bila lagu yang sedang aktif ada di daftar itu, ikonnya menjadi **Jeda** saat memutar (ketuk = jeda) dan kembali **Putar** saat dijeda (ketuk = lanjut dari posisi terakhir, bukan mengulang dari awal). Daftar lain / pemutar berhenti / selesai / galat: Putar semua seperti biasa.
- Berlaku di: halaman Playlist saya (`MyPlaylistPage`), hasil pencarian / playlist di Beranda (`PlaylistHeader` lewat `PlaylistView`), dan halaman artis / album (`ArtistSearchPanel`).
- Baru: `src/hooks/usePlaylistPlayback.ts`. Label tombol (pembaca layar) ikut berubah: Jeda / Lanjutkan / Putar semua.
- Catatan: penentuan "daftar ini sedang diputar" memakai id lagu aktif; lagu yang sama di dua playlist membuat kedua tombol ikut menjadi Jeda. Hanya sintaks TS yang dicek; belum dicoba di perangkat.
