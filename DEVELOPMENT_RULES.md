# MusicVerse — Development Rules

Aturan pengembangan lanjutan MusicVerse. Berkas ini melengkapi bagian "13. Development Rules" di `PROJECT_STRUCTURE.md` (struktur dan penempatan file) dan sengaja dipisah dari dokumen struktur.

Setiap pengembangan harus mengikuti kedua dokumen ini.

1. Aturan Fitur Baru (Tutorial dan "Yang baru")

Setiap fitur baru yang terlihat atau dipakai pengguna WAJIB disertai pembaruan berikut dalam rilis yang sama:

1. "Yang baru": tambahkan satu entri di akhir `WHATS_NEW` pada `src/tour/steps.ts`.
   - `id` entri = nomor versi rilis (mis. '0.5.51'), unik, dan tidak diubah setelah dirilis.
   - 1 sampai 2 langkah per rilis; judul diawali "Baru:", isi satu atau dua kalimat yang menjelaskan manfaat dan letak fitur.
   - Isi `route` (halaman tujuan) dan `target` (atribut `data-tour` elemen yang disorot) bila ada; beri `data-tour` pada elemennya.
   - Fitur yang hanya ada di APK diberi `nativeOnly: true`. Langkah yang butuh lagu diputar diberi `missing` sebagai cadangan teks.
   - Bila perlu peragaan: `animate`, `demo`, atau `practice` (lihat tipe di berkas yang sama). Jangan menambah mesin animasi baru.
   - Jangan mengubah `id` entri lama dan jangan menghapusnya: pengguna yang sudah melihatnya ditandai lewat id itu.
2. Tutorial utama: perbarui `TOUR_STEPS` atau `PAGE_TOURS` HANYA bila fitur mengubah alur dasar yang diajarkan tutorial (mis. gestur utama, letak menu). Fitur tambahan cukup lewat "Yang baru".
3. `VERSION` di `src/tour/tourStore.ts`: naikkan HANYA bila tutorial utama memang harus tampil ulang untuk semua pengguna. Jangan dinaikkan untuk fitur biasa.
4. Pengaturan baru: letakkan di halaman Pengaturan yang sesuai, beri bawaan yang aman (fitur berisiko atau mengubah perilaku lama bawaannya MATI), dan simpan lewat sistem penyimpanan yang sudah ada.
5. Animasi dan gerakan: pakai sistem yang sudah ada (`index.css`, `Presence`, `useExitGhost`, `services/playerSheet.ts`, `utils/spring.ts`) dan ikuti pengaturan Kurangi gerakan.
6. Teks yang tampil ke pengguna memakai bahasa Indonesia yang sama gayanya dengan teks yang sudah ada.

2. Aturan Versi dan Catatan Perubahan

1. Nomor versi ada di `package.json`: `appVersion` (boleh 4 angka, mis. 0.5.50.7) dipakai untuk versionName APK dan tag rilis; `version` tetap 3 angka (semver) agar npm tidak menolak. Naikkan keduanya yang sesuai saat rilis baru.
2. Naikkan `appVersion` untuk rilis/tag baru; biarkan sama bila hanya ingin memperbarui APK di tag yang sudah ada.
3. Catatan perubahan versi terbaru ditulis di `CHANGES-<versi>.md` (hanya satu berkas terbaru di akar project). Isi: daftar file yang berubah, penjelasan perubahan, dan bagian Catatan (apakah butuh APK baru, dampak ke pengguna lama).
4. Saat rilis berikutnya dibuat, pindahkan isi `CHANGES-<versi lama>.md` ke bagian atas `CHANGES.md` (arsip, terbaru di atas), lalu hapus berkas lamanya. Perbarui rujukan ke berkas itu bila ada.
5. Deskripsi rilis GitHub sengaja dikosongkan oleh workflow; catatan perubahan tidak dibaca dari `CHANGES-<versi>.md`.

3. Aturan APK Baru dan Pembaruan Tampilan (OTA)

1. Perubahan di bagian native (Java, `AndroidManifest`, resource Android, izin, plugin, `capacitor.config.ts`) butuh APK baru: jalankan `npm run android:sync`, lalu build. Perubahan hanya di tampilan (TS/TSX/CSS) bisa lewat pembaruan OTA (`scripts/make-ota.mjs`, `scripts/native-hash.mjs`).
2. Fungsi native baru di `MusicVerseNativePlugin.java` didaftarkan di `src/native/musicVerseNative.ts` dengan komentar "Butuh APK vX.Y.Z+". Kode JS harus tetap aman di APK lama (UNIMPLEMENTED diabaikan, bukan galat).
3. Logika yang punya padanan TS dan Java (`TrackMatch`, `RadioFinder`, `YtMatcher`, `YtResolver` dengan `matchTrack.ts`, `radio.ts`, plugin `ytmusic`/`ytvideo`) harus diubah keduanya, dengan angka dan urutan langkah yang sama.
4. Ikon aplikasi ikut tema: ubah `native/android/icon-presets.json`, jalankan `python3 scripts/gen-icon-variants.py`, dan samakan `ICON_IDS` di `MusicVerseNativePlugin.java`.
5. Dokumen hukum: ubah isi di `src/legal/content.ts` SAJA, lalu perbarui `LEGAL_UPDATED` di `src/config/site.ts`.

4. Aturan Pemeriksaan Sebelum Selesai

1. Jalankan `npm run typecheck` (dan `npm run build` bila menyentuh konfigurasi); tidak boleh ada galat tipe.
2. Jalankan `npm run test:lyrics` bila menyentuh lirik. Tes JVM native ada di `native/android/test/` (lihat README di sana).
3. Periksa tampilan mobile dan, bila relevan, mode terang dan gelap.
4. Perbarui `PROJECT_STRUCTURE.md` (file baru, dihapus, dipindah), "Yang baru", `CHANGES-<versi>.md`, dan nomor versi sebelum menyerahkan hasil.
