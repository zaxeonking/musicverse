# MusicVerse Account Cloud Sync V2 — panduan pemasangan

## Pembagian project

- Account/Auth: `https://iybqvgdpstbumbxyobnw.supabase.co`
- Guest/Share: project Supabase yang berbeda. Jangan jalankan SQL Account di project Guest/Share.
- Android dan web memakai Account project dan identitas Supabase Auth yang sama.

## Langkah pemasangan

1. Buka Supabase Dashboard untuk project Account.
2. Buka SQL Editor.
3. Jika belum pernah memasang V1, jalankan `docs/supabase/account-sync-v1.sql` (sudah berisi baseline V1 + upgrade V2).
4. Jika V1 sudah pernah dijalankan, jalankan hanya `docs/supabase/account-sync-v2-upgrade.sql`.
5. Sebelum upgrade V1, cek duplikasi dengan query: `select user_id, playlist_id, track_id, count(*) from public.mv_playlist_tracks group by 1,2,3 having count(*) > 1;`. Jika ada hasil, rapikan duplikasi dulu; migrasi sengaja berhenti agar tidak membuang data.
6. Jalankan `docs/supabase/verify-account-sync-v1.sql` untuk memeriksa RLS dan fungsi reorder.
7. Pastikan Authentication → URL Configuration menggunakan `https://musicverseid.vercel.app` dan allowlist `https://musicverseid.vercel.app/**`.
8. Isi environment Vercel `VITE_SUPABASE_ACCOUNT_URL` dan `VITE_SUPABASE_ACCOUNT_KEY` dengan URL dan publishable key Account project, lalu redeploy.

## Apa yang diperbaiki di V2

- Revision dan `server_updated_at` dikendalikan database pada INSERT maupun UPDATE; client tidak bisa menentukan atau melompatkan nomor revision.
- Index untuk query playlist dan sinkronisasi berdasarkan waktu server.
- Primary key track playlist memakai identitas stabil `(user_id, playlist_id, track_id)`, bukan posisi. Perangkat berbeda dapat menambahkan lagu pada posisi yang sama tanpa konflik identitas.
- Reorder playlist dilakukan melalui RPC transaksional `mv_reorder_playlist_tracks`; fungsi hanya mengurutkan track yang sudah ada, tidak menambah atau menghapus track.
- Web helper mendukung pagination 500 baris, upload batch 250 baris, UID otomatis dari session, pull/push snapshot, merge union berdasarkan identitas stabil (`synchronizeAccountSnapshot()`), dan reorder RPC (`reorderCloudPlaylistTracks()`). Saat ada duplikasi, `updated_at_ms` yang lebih baru diprioritaskan; jika timestamp tidak tersedia, salinan cloud dipertahankan. Helper belum dipanggil otomatis oleh halaman web.
- Email verifikasi dan reset password menggunakan callback HTTPS tetap. Halaman verifikasi menyediakan kirim ulang email.

## Batasan yang sengaja dipertahankan

- Android sudah memiliki `AccountCloudSyncEngine` dan WorkManager scheduler: sync segera setelah login, periodik 12 jam, dan dipicu perubahan data yang dipantau. Web helper tidak otomatis berjalan karena website saat ini hanya landing + halaman Account, bukan web music player dengan local playlist DB.
- Android worker sudah terjadwal; transactional outbox belum tersedia. Push bersifat upsert-only. Tidak ada penghapusan cloud otomatis agar data tidak hilang akibat bug merge. Penghapusan lintas perangkat memerlukan tombstone dan aturan retensi pada migrasi berikutnya.
- `mv_liked_tracks` tetap tersedia di skema untuk kompatibilitas, tetapi aplikasi Android saat ini merepresentasikan Liked Songs sebagai playlist khusus `my-liked`. Jangan mengirim entitas yang sama ke kedua tempat.
- `mv_playlist_tracks` memakai `track_id` sebagai identitas unik per playlist. Gunakan `reorderCloudPlaylistTracks()` untuk mengubah urutan; jangan mengirim banyak operasi reorder paralel.
- Jangan sinkronkan token provider, cookie, auth token, file unduhan, playback session, atau rahasia lain. `mv_user_settings` hanya untuk preference yang sudah di-allowlist.

## Keamanan

- Password ditangani Supabase Auth (hashing server-side). Jangan membuat tabel password atau bcrypt client-side.
- Hanya publishable key yang boleh ada di web/Android. `service_role` dan `sb_secret_` tidak boleh masuk source, APK, atau environment `VITE_`.
- RLS harus tetap aktif. Semua operasi harus memakai session pengguna; jangan menerima `user_id` dari form/UI sebagai otoritas.

## Pengujian manual minimum

1. Buat akun baru; periksa link email berisi `redirect_to=https://musicverseid.vercel.app/account?mode=verify`.
2. Klik link; halaman `/account` menampilkan status berhasil dan email pengguna.
3. Keluar, login lagi, lalu coba reset password dan pastikan callback `/account?mode=reset`.
4. Buat dua akun uji. Pastikan akun A tidak dapat membaca data akun B (RLS).
5. Tambahkan beberapa track ke playlist, reorder dua track yang saling bertukar posisi melalui RPC, lalu baca ulang urutannya.
6. Uji data lebih dari 1.000 baris untuk memastikan pagination tidak memotong hasil.
7. Jangan uji dengan data produksi sebelum backup tersedia.
