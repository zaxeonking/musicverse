# MusicVerse Account Sync V1 — implementasi dan merge contract

## Keamanan password
Supabase Auth menyimpan password menggunakan bcrypt + salt di server. Web dan Android mengirim password melalui HTTPS ke Supabase Auth; jangan hash bcrypt di client, jangan simpan password/hash di SQLDelight, SharedPreferences, localStorage, log, atau tabel aplikasi. Jangan membaca/menulis `auth.users` secara langsung. Aktifkan email verification, minimum password length minimal 8 (disarankan lebih panjang), dan leaked-password protection bila paket Supabase mendukungnya.

## Satu identitas untuk web + Android
Kedua klien menggunakan Account Project yang sama. Web menggunakan `@supabase/supabase-js`; Android perlu implementasi Auth client yang memanggil Auth REST API atau SDK Kotlin yang kompatibel. Access/refresh token Android harus disimpan terenkripsi memakai Android Keystore; web memakai mekanisme session storage yang dikelola Supabase SDK. Logout harus menghapus session lokal. Share project tetap terpisah.

## Ruang lingkup sync V1
- Playlist milik pengguna + track dan urutannya.
- Lagu disukai.
- Artis diikuti.
- Profil dasar.

Tidak disinkronkan pada V1: download/offline files, playback session, history, provider tokens (Spotify/YouTube/Apple), cookie provider, auth token, cache, player state, dan arbitrary `kv` settings.

## Pemetaan Android SQLDelight → cloud
- `user_playlist` → `mv_playlists`
- `user_playlist_track` → `mv_playlist_tracks`
- liked tracks → `mv_liked_tracks` (sumber repository liked yang dipakai aplikasi harus dipetakan eksplisit sebelum adapter final)
- followed artists → `mv_followed_artists` (sumber repository artis yang diikuti harus dipetakan eksplisit)

Jangan mengirim URL file lokal/download. `cover_url` hanya metadata remote yang memang dapat diakses publik, bukan path lokal.

## Merge pertama (non-destructive)
1. Tunggu Auth selesai dan dapatkan `auth.uid()` dari session tervalidasi.
2. Ambil snapshot lokal dalam transaksi baca yang konsisten; ambil cloud snapshot dengan user JWT.
3. Gabungkan berdasarkan ID stabil: playlist `playlist_id`; track dalam playlist berdasarkan posisi + identitas track (`track_id`, lalu `isrc`/`external_url` sebagai fallback); liked berdasarkan `track_id`; artist berdasarkan `artist_id`.
4. Jika item hanya ada lokal atau hanya cloud, pertahankan. Jangan hapus salah satu sisi pada merge pertama.
5. Jika ID playlist sama tetapi metadata berbeda, pilih versi dengan `updated_at_ms` terbaru. Jika timestamp sama, jangan overwrite diam-diam: tandai conflict dan pilih versi lokal sebagai default sementara.
6. Untuk playlist yang sama, union track unik sambil mempertahankan urutan yang ada; track yang hanya ada di satu sisi tetap dimasukkan. Jika posisi bentrok, susun item lokal dulu lalu tambahkan item cloud yang belum ada, kemudian normalisasi posisi 0..N-1.
7. Upload hasil gabungan ke cloud dengan upsert, lalu commit hasil gabungan ke DB lokal hanya setelah respons cloud sukses. Jika jaringan gagal, simpan status merge pending dan ulangi; jangan mengosongkan data lokal.
8. Setelah merge awal sukses, aktifkan sync incremental lewat outbox. Mutasi lokal + enqueue outbox harus satu transaksi DB.

## Konflik dan penghapusan
V1 memakai revision server + `updated_at_ms` untuk resolusi update biasa. Jangan melakukan hard-delete saat sync. Penghapusan lintas perangkat baru diaktifkan setelah tombstone diuji; untuk V1, penghapusan lokal belum dipropagasikan sebagai delete cloud. Konflik playlist yang sama dicatat untuk resolusi deterministik, tidak menghapus data.

## Eksekusi otomatis
- Android: WorkManager unique work, constraints network connected, exponential backoff, batch kecil, retry idempotent.
- Web: sync ketika session aktif dan tab kembali online/visible; gunakan debounce dan jangan menjalankan upload paralel untuk user yang sama.
- Cloud tetap sumber data lintas perangkat; local DB tetap sumber respons UI/offline.
- Realtime bukan transport utama untuk seluruh data; gunakan sebagai sinyal refresh kemudian.

## Migration
Jalankan `docs/supabase/account-sync-v1.sql` HANYA pada Account project. Script ini membuat tabel sync dan RLS owner-only. Tidak mengubah schema guest/share. Sesudah migration, verifikasi `rowsecurity=true` untuk semua tabel `mv_*` dan uji dua akun: akun A tidak boleh membaca/mengubah baris akun B.

## Status implementasi
Migration SQL dan kontrak merge sudah disiapkan. Ini belum berarti worker Android, adapter repository, atau sync web sudah selesai; semuanya memerlukan implementasi dan build/test terpisah. Jangan mengklaim cloud sync aktif sebelum kedua klien mengirim/menerima data dengan JWT user dan tes RLS lulus.
