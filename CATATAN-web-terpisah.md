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

## Halaman tautan bagikan `/p/<kode>` dipasang (24 Nov 2026, belum dibangun penuh)
- Baru `api/p.mjs` (fungsi Vercel; membaca RPC publik `get_shared_playlist`, HTML kecil + Open Graph, semua teks di-escape). Diuji di Node dengan Supabase tiruan:
  sukses, not_found (404), rate_limited (503), kode tak sah (404), XSS ter-escape.
- `vercel.json`: rewrite `/p/:code` -> `/api/p?code=:code` SEBELUM catch-all; catch-all kini mengecualikan `api/`, `.well-known/`, `assets/`; header JSON untuk `assetlinks.json`.
- Baru `public/.well-known/assetlinks.json` (CETAKAN: ganti `sha256_cert_fingerprints` dengan SHA-256 sertifikat penanda tangan APK rilis).
- Env Vercel yang harus diisi (kunci PUBLIK saja, jangan `sb_secret_`/service_role): `SUPABASE_SHARE_URL`, `SUPABASE_SHARE_KEY`. Lalu redeploy.
- Halaman ini dibuat server-side, jadi tidak terkena `VITE_DISTRIBUTION_PAUSED`.
- Batas: semua kunjungan web berbagi satu jatah baca per IP di Supabase (600/jam); respons di-cache CDN 60 dtk.
- Belum dijalankan: `npm install && npm run build` (sandbox tanpa jaringan).

## Dipasang di repo utama + tautan akun (26 Nov 2026, belum dibangun/dites penuh)
- Folder ini sekarang `web/` di repo utama (zip `musicverse-6.1.0` dipindah apa adanya). Vercel Root Directory = `web`. `web-share/` lama diganti
  petunjuk singkat (isinya sudah di sini).
- `api/p.mjs`: kode berawalan `u` (tautan akun permanen) dibaca dari Firestore lewat REST (`sharedPlaylists/<kode>`); `a` tetap Supabase.
  Diuji di Node dengan Firestore tiruan (200, 404, 502, tanpa kunci, kode tak sah, XSS ter-escape).
- Env Vercel baru: `FIREBASE_API_KEY` (WAJIB untuk `u...`; Google menolak REST tanpa kunci), `FIREBASE_PROJECT_ID` (bawaan `musicverse-app`).
  Kunci web publik; batasi ke Cloud Firestore API. Kunci Android otomatis dari `google-services.json` bisa ditolak bila dibatasi ke app Android.
- Tanpa kunci, halaman `/p/u...` menjawab 502 "Tidak bisa dibuka"; tautan `a...` tidak terpengaruh.
- Halaman `/account` masih memakai Supabase akun lama (`cloudSync.ts`, `AccountPage.tsx`), belum disesuaikan dengan akun Firebase.
- Perlu: `npm install && npm run build`.

## Poster pratinjau dari `web-share/` digabung ke sini (27 Nov 2026, belum dibangun/dites di Vercel)
- Isi `web-share/` di repo app (poster `/api/og` + halaman `/p` versi edge) disatukan ke web ini; folder itu kini hanya petunjuk.
- Baru `api/_share.mjs`: satu pustaka data untuk `p.mjs` dan `og.mjs` (batas waktu 8 dtk, tolak `sb_secret_`, status ok/not_found/busy/
  unconfigured/error). IP pengunjung kini diteruskan ke Supabase (`x-forwarded-for`), jadi jatah 600/jam dihitung per pengunjung,
  bukan per IP Vercel. Lagu tanpa judul dilewati (tidak membuat seluruh playlist gagal).
- `api/p.mjs`: tampilan halaman TIDAK berubah; tag Open Graph ditambah (`og:url`, `og:type`, `og:image` = `/api/og?code=<kode>`
  1200x630, `twitter:image`). Domain diambil dari permintaan (domain kustom/preview ikut benar), cadangan `musicverseid.vercel.app`.
  Satu lagu: deskripsi = artis · Dengarkan di MusicVerse.
- Baru `api/og.mjs` (edge, `@vercel/og` 0.6.8): desain poster dari web-share, warna merek disesuaikan dengan situs (hijau #1DB954).
  Sampul diunduh dulu (4 dtk, maks 3 MB, harus gambar); bila gagal poster tetap jadi dengan ikon ♪, tidak error 500.
  Cache: 1 jam di edge bila ketemu; 60 dtk bila tautan mati/gagal.
- Env tidak bertambah (sama: `SUPABASE_SHARE_*`, `FIREBASE_*`). Tanpa `FIREBASE_API_KEY`, poster `u...` = poster umum MusicVerse.
- Tes: `npm test` lolos (data, halaman, escape XSS, host aneh). `og.mjs` dites dengan `@vercel/og` tiruan (sampul jadi data URL,
  sampul rusak -> ♪, kode salah -> poster umum). Penggambaran asli belum diuji.
- Perlu: `npm install && npm run build`, deploy, lalu buka `/api/og?code=<kode asli>`. WhatsApp/Telegram menyimpan pratinjau
  di cache; uji dengan tautan yang baru dibagikan.
