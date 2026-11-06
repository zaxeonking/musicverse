# 0.5.16 — Saran dan ulasan di situs web
- Baru: bagian "Saran dan ulasan" di landing page (`src/site/FeedbackSection.tsx`, anchor `#masukan`, tautan "Masukan" di header). Pilih jenis (Saran / Ulasan / Laporan bug), bintang 1–5 untuk ulasan, pesan (maks. 1000 karakter), nama dan versi/perangkat opsional. Ada validasi dan pesan galat.
- Cara kirim: tanpa server sendiri. Jika `VITE_CONTACT_EMAIL` diisi, tombol membuka email yang sudah terisi; jika kosong, membuka GitHub Issue baru yang sudah terisi (label enhancement/review/bug) di `REPO_URL`. Pengguna menekan kirim sendiri di tujuan itu.
- Teks Kebijakan Privasi bagian 7 (Situs web) diperbarui agar cocok dengan perilaku formulir.
- Hanya situs web; APK tidak berubah (tidak perlu APK baru atau OTA).
- Belum dijalankan: `npm run typecheck` / `npm run build` (node_modules tidak ada di lingkungan ini). Jalankan sebelum deploy.
