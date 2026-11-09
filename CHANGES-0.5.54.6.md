# 0.5.54.6 (Jeda distribusi sementara dan pengumuman migrasi ke Android native)

Files: src/config/apk.ts, src/vite-env.d.ts, .env.example, src/site/MigrationNotice.tsx (baru), src/site/LandingPage.tsx, src/site/SiteLayout.tsx, src/utils/migrationNotice.ts (baru), src/components/layout/MigrationNotice.tsx (baru), src/components/layout/AppShell.tsx, package.json (appVersion 0.5.54.6), PROJECT_STRUCTURE.md, CHANGES-0.5.54.6.md

1. Situs web: unduhan baru dijeda
   - `DISTRIBUTION_PAUSED` (`config/apk.ts`, bawaan true; `VITE_DISTRIBUTION_PAUSED=false` saat build membukanya lagi). Selama true: tombol "Unduh APK" (hero, header, bagian Cara pasang) dan tautan "Rilis di GitHub" di footer tidak dirender; bagian "Cara pasang" disembunyikan; hero menampilkan panel pengumuman (`site/MigrationNotice.tsx`); tombol header menjadi "Kabar upgrade"; status Android di Platform menjadi "Dibangun ulang"; FAQ "Kenapa unduhan dijeda?" ditambahkan.
   - Situs tetap online. Tidak ada berkas APK, kode, atau halaman rilis yang dihapus atau diubah. Fitur, Kebijakan Privasi, Ketentuan Layanan, dan form Masukan tetap ada.

2. Di dalam app: pengumuman satu kali
   - `components/layout/MigrationNotice.tsx`: lembar bawah (OverlayPortal + `useOverlayHistory`, animasi sheet yang sudah ada) berisi "Upgrade Besar MusicVerse 🚀" dan tombol "Mengerti". Tidak mematikan fitur apa pun; pemutaran, unduhan, dan pustaka tetap jalan. Ditutup lewat tombol, ketuk latar, geser turun, Back, atau Esc.
   - Muncul ±3,9 dtk setelah app dibuka (sesudah splash), dan menunggu bila tutorial atau "Yang baru" sedang/akan tampil.
   - Penutupan disimpan di `mv:migration-notice:v1` (`utils/migrationNotice.ts`). Kunci ini ikut dicerminkan ke Android/data oleh `native/nativeStorage.ts`. Ganti `v1` untuk menampilkan pengumuman baru.

3. Versi
   - `appVersion` diset ke 0.5.54.6 sesuai permintaan (sebelumnya 0.5.54.7).

Catatan
- Tidak butuh APK baru (JS saja; bisa lewat OTA). Tidak ada perubahan native, mesin audio, layanan pemutaran, atau logika unduhan.
- Tidak ada entri "Yang baru": pengumuman ini bukan fitur, dan entri akan memicu tur yang bertabrakan dengannya.
- Jeda di situs hanya mengatur tampilan. Halaman rilis GitHub (`zaxeonking/musicverse-releases`) tetap publik sampai diatur manual di GitHub; repo itu juga dipakai pembaruan di dalam app, jadi jangan dijadikan privat tanpa memikirkan dampaknya.
- Peringatan versi: 0.5.54.6 sudah tercatat dirilis (lihat arsip di CHANGES.md) dan kode ini sudah berisi perubahan 0.5.54.7. Menurunkan `appVersion` bisa menimpa APK di tag v0.5.54.6 (apk.yml) dan membuat pengguna 0.5.54.7 tidak ditawari pembaruan ini. `CHANGES-0.5.54.7.md` dibiarkan; rapikan sesuai Aturan Versi bila perlu.
- Belum diuji: `npm run typecheck`, `npm run build`, dan tampilan di layar belum dijalankan (tidak ada node_modules/jaringan di lingkungan ini).
