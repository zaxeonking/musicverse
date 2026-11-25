# Akun web (Firebase) — langkah pasang & uji

1. Vercel > Environment Variables: `VITE_FIREBASE_API_KEY` (nilai ada di `.env.example`; kunci web Firebase bersifat publik).
2. Firebase Console (project `musicverse-app`) > Authentication > Settings > Authorized domains: tambahkan `musicverseid.vercel.app` (dan `localhost` untuk dev).
3. Pastikan provider Google aktif dan `firestore.rules` (proyek Android) sudah dipublikasikan: pengguna hanya boleh membaca/menulis/menghapus `users/{uid}` miliknya.
4. `npm install && npm run test:account && npm run build`.
5. Uji manual: masuk Google -> profil muncul -> ubah nama -> muat ulang (nama bertahan) -> keluar/masuk lagi (nama bertahan) -> hapus akun (pilih akun sama; akun berbeda harus ditolak).
6. Uji tautan lama: `/account?mode=verify` dan `?mode=reset` harus membuka halaman akun Supabase lama; `/account/legacy` untuk login email.

Batas: hapus akun belum menghapus data Supabase lama maupun backup R2 (`DELETE /v1/backup` belum dipasang di klien).
