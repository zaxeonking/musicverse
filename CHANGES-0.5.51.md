# 0.5.51 (tema -> layar pembuka & ikon)

Files: index.html, src/native/appearance.ts (baru), src/native/musicVerseNative.ts, src/main.tsx, src/pages/ThemeSettingsPage.tsx, src/tour/steps.ts (entri Yang baru), package.json (version 0.5.51),
native/android/java/{MainActivity,MusicVerseNativePlugin}.java, native/android/icon-presets.json (baru),
native/android/res/{drawable,mipmap-*,mipmap-anydpi-v26,values} (varian ikon), scripts/setup-android.mjs, scripts/gen-icon-variants.py (baru)

Warna tema kini ikut ke:
1. Animasi boot (splash web): latar, 4 batang logo, dan nama "MusicVerse" memakai warna tema (mode gelap/terang ikut). Warna dibaca dari cache
   `musicverse:splash:v1` di localStorage yang ditulis aplikasi tiap tema berubah, jadi sudah benar sejak frame pertama splash.
   Tema berubah -> dipakai pada pembukaan berikutnya. Aksen "ikut sampul lagu" tidak dipakai (splash tidak boleh berubah tiap lagu).
2. Latar jendela native: MainActivity memasang warna latar tema (jendela + WebView) sehingga tema terang tidak diawali kedipan gelap.
   Splash sistem Android 12+ sendiri tetap #121212 (tidak bisa diubah per-pengguna); latar splash web memudar dari #121212 ke warna tema.
3. Ikon aplikasi (opsional, Pengaturan > Tema > Layar pembuka & ikon > "Ikon aplikasi ikut tema", bawaan MATI):
   satu `<activity-alias>` per tema siap pakai (15). Pintu LAUNCHER dipindah dari MainActivity ke alias; hanya "hijau" (ikon asli) yang menyala awalnya.
   Tema Kustom memakai tema siap pakai dengan aksen terdekat. Ikon diganti setelah tema tenang ±1,5 dtk, tanpa menutup aplikasi.
   Mematikan pilihan mengembalikan ikon hijau asli.

Catatan
- Butuh APK baru (ada perubahan Java + manifest): `npm run android:sync` lalu build. Pembaruan OTA ke APK lama tidak cukup untuk bagian ikon/latar native
  (splash web tetap ikut tema lewat OTA; APK lama menolak setAppearance dengan UNIMPLEMENTED dan diabaikan).
- Sebagian peluncur melepas pintasan ikon yang sudah ditempel di layar utama saat alias berganti (termasuk sekali saat update pertama,
  karena pintu LAUNCHER pindah ke alias). Pengguna perlu menempel ulang dari laci aplikasi.
- Mengubah preset tema atau ikon dasar: jalankan `python3 scripts/gen-icon-variants.py` (butuh Pillow), dan samakan ICON_IDS di MusicVerseNativePlugin.java
  (setup-android.mjs memeriksa kecocokannya dan berhenti dengan pesan jelas bila ada yang kurang).
