# 0.5.50

## Tema (Pengaturan > Tema)
- **Pratinjau menempel** (`sticky top-0`) di atas area scroll dan dibuat lebih ringkas (±40% lebih pendek: 2 baris lagu, mini player, nav), jadi perubahan terlihat langsung saat menggulir pengaturan.
- **Acak tema**: satu ketukan membuat tema Kustom serasi (satu rona untuk aksen dan latar, kecerahan latar tetap di rentang aman per mode). `randomThemePatch()` di `utils/theme.ts`.
- **Tema tersimpan**: simpan tema aktif (maks. 6), ketuk untuk memakai, tombol × untuk menghapus. Disimpan sebagai kode `MVT1.…` di `musicverse:theme:saved:v1`; tema yang sama tidak digandakan.
- **Cahaya latar**: semburat aksen di atas layar aplikasi (`.mv-glow`, dipasang di `AppShell`), ikut tampil di pratinjau. Ikut terkirim di kode bagikan tema (kode lama tetap valid, glow mati).
- Tombol "Kembali ke tema bawaan" juga mematikan cahaya latar.
- Cek tipe `utils/theme.ts` lulus dan logika acak/simpan/kode sudah diuji lewat Node. Halaman React belum dikompilasi penuh dan belum dicoba di perangkat.

## Pratinjau widget: cadangan untuk XOS (Infinix)
- ⚠️ Butuh **APK baru** (resource native). Pratinjau yang sama kini juga ada di `drawable-xxhdpi`, `drawable-xhdpi`, dan `drawable-hdpi` (selain `drawable-nodpi`), karena peluncur XOS tampaknya tidak memuat `previewImage` dari folder `nodpi`.
- `widget_*_info.xml` tidak berubah. Belum diuji di perangkat XOS.

## Pratinjau widget (lanjutan): previewLayout statis + versi APK
- ⚠️ Butuh **APK baru**. `appVersion` naik ke 0.5.50 supaya versionCode (55000) lebih besar dari APK sebelumnya (pasang-timpa pasti dianggap pembaruan).
- Tiap `widget_*_info.xml` kini memakai `previewImage` **dan** `previewLayout` (`layout/widget_pv_*.xml`: satu `ImageView` ke PNG pratinjau yang sama, tanpa tampilan yang butuh data). Peluncur Android 12+ memakai layout; yang lain jatuh ke gambar.
- Beda dengan `previewLayout` lama (yang memakai layout widget asli dan gagal di peluncur pabrikan), ini hanya gambar statis.
- Belum diuji di perangkat XOS.

## Widget: jaring pengaman saat gagal digambar (APK 0.5.50.1)
- Laporan: widget Besar menampilkan "Problem loading widget" di layar utama.
- `MusicVerseWidget.update()` kini bertahap: gambar penuh, lalu tanpa sampul, lalu `safeViews()` (judul + nama galat singkat di baris artis, ketukan tetap membuka aplikasi). Juga menangkap `OutOfMemoryError`, dan `load`/`sizeDp` ikut dilindungi.
- Bila widget kini menampilkan "Gagal menggambar: …", nama galatnya menunjuk penyebab sebenarnya.
- Penyebab asli belum dipastikan (tidak ada logcat). `appVersion` 0.5.50.1 (versionCode 55001).

## Animasi mini player -> disc: lebih mulus (0.5.50.2)
Penyebab terasa kaku (dibaca dari kode, belum diuji di perangkat):
- Klip awal morph `inset(-48px)` memotong bagian kartu yang sudah ditarik lebih dari 48px ke bawah, jadi saat jari dilepas kartu **terpotong mendadak** (patah).
- Easing `cubic-bezier(0.65,0,0.35,1)` (ease-in-out) membuat awal gerakan nyaris diam sebelum melesat; kartu juga melompat balik ke atas dalam 208 ms, berlawanan dengan arah jari.
- Kecerahan (opacity) dan bentuk (clip-path) dipaksa satu animasi dengan satu easing.

Perubahan (`MiniPlayer.tsx`, `tailwind.config.js`):
- Klip awal ikut melebar ke bawah sebesar jarak seretan (`dragY` dari matriks transform kartu), jadi tidak ada potongan mendadak.
- Satu easing menurun `cubic-bezier(0.32,0.72,0,1)` untuk kartu dan bentuk; opacity animasi terpisah (penuh sampai 55%, lalu memudar linear). `LEAVE_MS` 520 -> 440.
- Disc dipasang lebih awal (30% gerakan, sebelumnya 50%) dan muncul dari skala 0,72 dengan sedikit membal (340 ms).
- Seretan ke bawah diberi efek karet setelah melewati titik lepas (setengah gerak), plus `will-change` selama seretan dan morph. Pegas kembali (batal) memakai easing menurun.
- Batas: clip-path tetap animasi main-thread (tidak bisa dipercepat compositor), jadi di HP lemah masih bisa terasa kurang mulus. Angka durasi/easing tebakan, perlu dicoba di perangkat.
