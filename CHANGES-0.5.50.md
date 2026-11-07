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
