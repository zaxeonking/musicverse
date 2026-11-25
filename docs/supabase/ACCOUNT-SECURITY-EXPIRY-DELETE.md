# MusicVerse — masa berlaku verifikasi dan penghapusan akun

Project target: Account/Auth `iybqvgdpstbumbxyobnw` saja. Jangan terapkan di project Guest/Share.

## 1. Link verifikasi 3 menit

Supabase hosted Auth mengatur masa berlaku email OTP/magic link dari Dashboard, bukan dari React client.

1. Buka Supabase Dashboard → project Account → Authentication → Settings (Email/SMTP atau Auth settings, label dapat berubah).
2. Cari **Email OTP Expiry** / **OTP expiry**.
3. Set nilainya menjadi `180` detik.
4. Simpan perubahan.
5. Kirim ulang email verifikasi baru untuk pengujian. Link lama tidak otomatis berubah menjadi link baru.

Supabase Auth menggunakan token verifikasi sekali pakai. Setelah verifikasi sukses, token tersebut dikonsumsi dan tidak dapat digunakan ulang. Link yang sudah melewati 180 detik harus ditolak oleh Auth; pengguna meminta email verifikasi baru melalui halaman Account.

Catatan: pengaturan OTP expiry dapat berlaku untuk alur email OTP lain yang memakai expiry Auth yang sama, termasuk reset password. Jika ingin expiry berbeda untuk signup dan reset password, perlu alur token khusus yang dikelola server; jangan mengklaim dashboard setting ini hanya memengaruhi signup.

## 2. Deploy Edge Function hapus akun

Function sumber ada di `supabase/functions/delete-account/index.ts`.

Deploy ke project Account:

```bash
supabase link --project-ref iybqvgdpstbumbxyobnw
supabase functions deploy delete-account
```

Function memakai environment secrets bawaan Supabase (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) di sisi server. Jangan menaruh service role key di Vercel `VITE_`, web bundle, Android, atau source code.

Alurnya:
- Memvalidasi bearer access token dan mengambil user dari Auth.
- Mencabut seluruh sesi Auth (`global`).
- Menghapus user dari `auth.users` melalui Admin API.
- Foreign key `ON DELETE CASCADE` pada tabel `mv_*` menghapus baris cloud milik user.

Web Account page menampilkan tombol penghapusan dan meminta pengguna mengetik `HAPUS`. Setelah function berhasil, web membersihkan sesi lokal.

## 3. Verifikasi foreign key cascade

Jalankan di SQL Editor project Account:

```sql
select
  n.nspname as schema_name,
  c.relname as table_name,
  a.attname as column_name,
  confdeltype
from pg_constraint fk
join pg_class c on c.oid = fk.conrelid
join pg_namespace n on n.oid = c.relnamespace
join unnest(fk.conkey) with ordinality k(attnum, ord) on true
join pg_attribute a on a.attrelid = c.oid and a.attnum = k.attnum
where fk.contype = 'f'
  and fk.confrelid = 'auth.users'::regclass
order by 1, 2;
```

Untuk foreign key `user_id` yang menunjuk ke `auth.users`, `confdeltype` harus `c` (CASCADE). Tabel account sync bawaan `mv_playlists`, `mv_playlist_tracks`, `mv_liked_tracks`, `mv_followed_artists`, `mv_user_settings`, dan `mv_sync_state` sudah dibuat dengan `ON DELETE CASCADE` pada SQL V1/V2.

Jika ada tabel user-owned tambahan di luar daftar tersebut, pastikan relasi user-nya juga memakai cascade atau hapus datanya dalam transaksi server sebelum menghapus Auth user.

## 4. Batasan penting untuk Android

Function ini dapat dipanggil Android juga dengan access token user, tetapi UI Android saat ini belum dihubungkan ke endpoint penghapusan. Saat fitur Android ditambahkan, setelah sukses hapus akun, aplikasi wajib:
- sign out dan menghapus session lokal;
- menghapus cache/snapshot cloud lokal milik akun itu dari database lokal;
- membatalkan WorkManager sync untuk akun tersebut;
- memastikan worker lama tidak mengunggah ulang data setelah akun dihapus.

Penghapusan cloud tidak dapat menghapus file musik yang sudah diunduh atau data lokal aplikasi di perangkat lain yang sedang offline. Saat perangkat kembali online, aplikasi harus mendeteksi akun sudah tidak ada dan membersihkan data akun lokal sesuai kebijakan produk.

## 5. Tes sebelum rilis

- Link verifikasi baru berhasil sebelum 180 detik.
- Link yang sama gagal saat dibuka ulang setelah berhasil dipakai.
- Link gagal setelah melewati 180 detik.
- Minta email baru dan pastikan link baru dapat digunakan.
- Buat akun uji, isi playlist/settings cloud, hapus akun dari halaman web.
- Pastikan sesi di web dan perangkat lain tidak dapat refresh/login dengan sesi lama.
- Pastikan baris user tersebut hilang dari seluruh tabel `mv_*`.
- Jangan menguji penghapusan pada akun/data produksi.
