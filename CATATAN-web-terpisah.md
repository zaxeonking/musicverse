# Web MusicVerse dipisah dari app native (23 Nov 2026)

Web ini (React + Vite, dideploy ke Vercel) berdiri sendiri; app Android native (Kotlin, repo `MusicVerse-metrolist`) TIDAK memuatnya.
Tidak ada perubahan kode di zip ini; hanya catatan. Isinya belum dibangun/dites ulang.

## Yang dipakai bersama dengan app native (kesepakatan, bukan kode)
- Skema aplikasi: `musicverse://`
- Tautan bagikan playlist (rencana): `https://<domain>/p/<kode>` (jangan `/my/:id`, itu sudah dialihkan di `vercel.json`)
- Supabase (rencana): URL proyek + kunci publik (anon). Kunci service JANGAN di web maupun app.

## Rencana isi web (lihat `CATATAN-rencana-akun-supabase-bagikan.md` di repo native)
1. `/p/:kode`: ambil playlist dari Supabase, tampilkan judul + jumlah lagu, tombol "Buka di MusicVerse" (`musicverse://p/<kode>`), cadangan unduh APK.
2. Halaman akun: "Email terverifikasi", "Atur password baru" (tujuan tautan email Supabase), "Hapus akun".
3. `/privacy` dan `/terms` sudah ada; sesuaikan isinya dengan fitur akun/sinkron (`src/legal/content.ts`).
4. Android App Links: `public/.well-known/assetlinks.json` (butuh SHA-256 sertifikat app) + intent-filter di app native.

## Perlu diperhatikan
- `VITE_DISTRIBUTION_PAUSED` masih bawaan `true` (pengumuman jeda); halaman bagikan tidak boleh ikut terkena.
- Sebagian besar `src/` (pemutar, pustaka, dll.) peninggalan APK Capacitor lama dan tidak tampil di web sejak 0.5.14.
  Bisa dipangkas menjadi situs kecil nanti; belum dilakukan.
- Di Vercel: bila satu repo dengan app native, taruh di folder `web/` dan atur Root Directory ke `web/`.

## Pembaruan: web dibuka dengan pengumuman "sekarang 100% native" (23 Nov 2026, belum dibangun/dites penuh)
- `src/config/apk.ts`: `DISTRIBUTION_PAUSED` bawaan kini **false** (sebelumnya true); `NATIVE_VERSION = '6.0'` (hanya untuk teks; samakan dengan `VERSION` repo native).
  Jeda masih bisa dinyalakan lagi lewat `VITE_DISTRIBUTION_PAUSED=true`.
- Baru `src/site/NativeLaunch.tsx`: lencana di atas judul hero ("Versi 6.0: sekarang 100% Android native") dan bagian pengumuman `#native`
  (tujuan peningkatan, kartu "Tersedia sekarang" + tombol Unduh APK, "Sebelumnya: web -> Sekarang: 100% Android native").
- `LandingPage.tsx`: bagian pengumuman menyesuaikan (jeda = migrasi, buka = native); catatan Android "Tersedia (Versi 6.0)"; FAQ baru
  "Apa yang baru di versi 6.0?" dan "Bagaimana memperbarui dari versi lama?" (saran: ekspor cadangan dulu); teks "Selalu terbaru" tidak lagi
  menyebut pembaruan tampilan tanpa APK (itu fitur OTA Capacitor lama, tidak ada di native); teks "Aman dipasang?" tidak lagi menyebut jeda.
- Pemeriksaan: hanya tipe sederhana (tsc tanpa node_modules). Jalankan `npm install && npm run build` sebelum deploy.
- Tombol Unduh mengarah ke `https://github.com/zaxeonking/musicverse/releases/latest`; pastikan rilis v6.0.0 sudah ada (workflow native).
- Teks klaim ("lebih responsif/mulus/stabil/hemat") adalah tujuan dari copy lama; ganti bila belum terbukti setelah app native dites.

## Pembaruan: unduh langsung versi terbaru (23 Nov 2026, belum dites)
- Tombol Unduh APK (hero, bagian cara pasang, header, kartu pengumuman) kini memakai `APK_DOWNLOAD_URL` =
  `https://github.com/<repo rilis>/releases/latest/download/musicverse.apk`: langsung mengunduh APK rilis terbaru, tanpa membuka halaman GitHub.
- Syarat: nama aset rilis HARUS `musicverse.apk` (sudah begitu di workflow native) dan repo rilis harus public. "latest" tidak menghitung pra-rilis/draf.
- Web tidak bisa memasang APK otomatis: setelah terunduh, pengguna membuka berkasnya dan mengizinkan "pasang dari sumber ini" (sekali). Itu aturan Android.
- Tautan "Rilis di GitHub" di footer tetap ada (`REPO_URL`).

## Pembersihan Capacitor (23 Nov 2026)
Semua kode APK Capacitor (native/, src/native, pemutar, halaman app, OTA, workflow APK, api/proxy) sudah dihapus. Repo ini hanya situs: landing, /privacy, /terms.

## Redesain landing (24 Nov 2026, belum dibangun/dites penuh)
- Tema situs jadi gelap: token `site.*` di `tailwind.config.js` dipetakan ulang (fog #111111, paper/raise sebagai permukaan, hijau #1DB954). Halaman /privacy dan /terms ikut gelap tanpa mengubah isinya.
- Baru `src/site/ui.tsx`: `DownloadButton`, `Reveal` (animasi masuk, hormati prefers-reduced-motion), `useLatestRelease` (tag, ukuran `musicverse.apk`, tanggal dari GitHub API; bila gagal, angka tidak ditampilkan).
- `LandingPage.tsx` ditulis ulang (hero, info produk, fitur, pusat unduhan, platform, FAQ accordion). `SiteLayout.tsx`: header sticky + menu mobile + footer 4 kolom. `NativeLaunch.tsx` / `MigrationNotice.tsx` digayakan ulang; `VITE_DISTRIBUTION_PAUSED` tetap menyembunyikan semua tombol/tautan unduh.
- Pemeriksaan: tipe diperiksa dengan stub (tanpa node_modules). Jalankan `npm install && npm run build` sebelum deploy.
