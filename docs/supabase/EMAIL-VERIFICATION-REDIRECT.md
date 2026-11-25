# MusicVerse — Email verification & password recovery

## URL yang harus dipakai

- Site URL: `https://musicverseid.vercel.app`
- Redirect URL allowlist: `https://musicverseid.vercel.app/**`
- Local development (optional): `http://localhost:5173/**`
- Email confirmation callback: `https://musicverseid.vercel.app/account?mode=verify`
- Password recovery callback: `https://musicverseid.vercel.app/account?mode=reset`

Di Supabase Dashboard → **Account project** → Authentication → URL Configuration, atur Site URL dan Redirect URLs seperti di atas. Jangan memasukkan domain Guest/Share project.

Email template Confirmation URL harus tetap menggunakan `{{ .ConfirmationURL }}`. Jangan hardcode homepage, HTTP, atau URL callback di template. Source web menetapkan callback HTTPS secara eksplisit sehingga `window.location.origin` tidak dapat mengubahnya menjadi HTTP atau domain preview.

## Deploy web

Pastikan environment Vercel Production berisi:

- `VITE_SUPABASE_ACCOUNT_URL=https://iybqvgdpstbumbxyobnw.supabase.co`
- `VITE_SUPABASE_ACCOUNT_KEY=sb_publishable_...`

Gunakan publishable key Account project. Jangan pernah memasukkan `sb_secret_` atau `service_role` ke variabel `VITE_`. Setelah mengubah source/environment, lakukan redeploy. APK tidak perlu dibangun ulang untuk perubahan redirect web.

## Alur yang didukung

1. Daftar mengirim callback verifikasi HTTPS ke `/account?mode=verify`.
2. Supabase JS memproses PKCE callback melalui `detectSessionInUrl`.
3. Halaman menampilkan status dan menyediakan tombol kirim ulang verifikasi jika belum memiliki session.
4. Reset password diarahkan ke `/account?mode=reset`, lalu pengguna menetapkan password baru.

Jika email lama masih memuat `redirect_to=http://...` atau menuju `/`, email tersebut dibuat oleh deployment/configuration lama. Deploy ulang web, periksa URL Configuration dan template, lalu minta email verifikasi baru. Jangan bagikan tautan verifikasi karena mengandung token sekali pakai.
