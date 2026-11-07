# MusicVerse 0.4.3 — merapikan unduhan lama

## Apa
Unduhan sebelum 0.4.1 selalu bernama `.mp3` walau isinya M4A/WebM, dan tidak punya tag. Sekarang dirapikan sekali, di
perangkat, tanpa internet:

- **Tag + sampul** disematkan (judul, artis, album, gambar sampul) memakai `AudioFinalizer` yang sama dengan unduhan baru.
- **Ekstensi sesuai isi** (`.m4a`, `.mp3`, `.webm`, dst.); indeks, metadata cadangan, dan pemutaran ikut menunjuk nama baru.
- **Otomatis**: 20 dtk setelah aplikasi dibuka, satu lagu sekali jalan (jeda 150 ms antar lagu), di latar belakang. Juga ada
  baris **Rapikan unduhan lama** di Pengaturan > Unduhan: jumlah yang tersisa, kemajuan, dan tombol **Rapikan**.
- Penanda baru `tagged` di indeks. Unduhan baru (0.4.1+) bertanda `tagged` sejak selesai, jadi tidak diproses ulang;
  lagu lama ditandai setelah dirapikan, jadi tiap lagu hanya diproses sekali.

## Aman bila terhenti di tengah jalan (`AudioFinalizer.upgradeInPlace`)
1. Tag ditulis lewat berkas sementara lalu diganti atomik: berkas asli selalu sah.
2. Metadata (dengan nama berkas BARU) ditulis sebelum ganti nama.
3. Ganti nama (atomik).
Bila aplikasi mati antara 3 dan penyimpanan indeks, `initOffline` menemukan berkas dengan ekstensi lain untuk kunci yang sama
dan memakainya (entri tidak hilang). Bila lagu dihapus pengguna selagi diproses, hasilnya dibersihkan (tidak jadi yatim).

## Yang dilewati (tidak diubah, tidak dihapus)
- Isi bukan audio (mis. halaman error yang dulu tersimpan sebagai lagu): `NOT_AUDIO`.
- Ruang penyimpanan kurang (butuh salinan sementara seukuran lagu + 8 MB): `NO_SPACE`.
- Wadah yang tidak bisa ditag (OGG, FLAC, WebM, WAV) tetap diberi ekstensi benar tetapi tanpa tag.
Yang dilewati tidak dicoba lagi di sesi yang sama; dicoba lagi pada sesi berikutnya. Jumlahnya tampil di pengaturan.

## Berkas
- `AudioFinalizer.java`: `upgradeInPlace`, `NotAudioException`, `NoSpaceException`, `Upgrade`.
- `MusicVerseNativePlugin.java`: metode `upgradeDownload`.
- `musicVerseNative.ts`, `offline.ts` (`tagged`, `replaceItem`, `UpgradeProgress`, adopsi ekstensi lain saat pemulihan),
  `downloads.ts` (`upgradeOldDownloads`, `countUpgradable`, jadwal di `initDownloads`), `DownloadSettingsPage.tsx`.

## Pengujian
- `upgradeInPlace` diuji dengan berkas asli buatan ffmpeg dan diperiksa dengan ffprobe/ffmpeg: M4A moov-di-akhir, faststart,
  fragmented; MP3 dengan ID3; OGG; HTML; tujuan sisa crash. Hasil: judul/artis/album + sampul terbaca, checksum audio hasil
  dekode identik, durasi sama, diulang aman (tag tidak menumpuk), tanpa sisa `.tagging`.
- Alur TypeScript dijalankan di Node dengan Capacitor palsu yang meniru semantik Java: sapuan campuran, diulang, panggilan
  bersamaan, NO_SPACE, dihapus saat diproses (dua variasi), APK 0.4.1 tanpa `upgradeDownload`, dan pemulihan indeks.
- Metode plugin hanya diuji kompilasi terhadap stub; belum dijalankan di perangkat. `tsc`: hanya TS7026 pada JSX baru
  (tipe React tidak terpasang di lingkungan uji).

## Batas
- Lagu yang sedang diputar saat dirapikan: pemutar yang sudah membuka berkasnya tetap lancar, tetapi lagu berikutnya yang
  sudah dimuat-di-muka dengan nama lama akan error sekali lalu diambil ulang lewat indeks (nama baru).
- Salinan di Music/MusicVerse (bila pernah diekspor) tidak ditulis ulang.
- Antrean unduhan masih di JS.

## Perlu build ulang APK (ada perubahan Java). APK 0.4.1 tetap jalan; perapian baru aktif setelah APK 0.4.3 terpasang.
