# MusicVerse email verification redirect

The registration flow sends `emailRedirectTo` to:

`https://YOUR-DOMAIN/account?mode=verify`

In Supabase Dashboard → Authentication → URL Configuration:

- Keep Site URL set to the website root (for example `https://musicverse.example`).
- Add `https://YOUR-DOMAIN/**` to Redirect URLs; the app requests the specific callback URL above.
- For local development, add `http://localhost:5173/**`.
- Keep the email confirmation template using Supabase's `{{ .ConfirmationURL }}` variable; do not hardcode the homepage URL.

The web client has `detectSessionInUrl: true`, so Supabase JS exchanges the returned PKCE code and restores the session on `/account?mode=verify`. The page then shows an explicit success/failure state instead of relying on the landing page.
