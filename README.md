# MusicVerse (situs web)

Situs informasi MusicVerse: landing untuk mengunduh aplikasi Android native, Kebijakan Privasi (`/privacy`), dan Ketentuan Layanan (`/terms`).
React + Vite + TypeScript + Tailwind CSS. Tidak ada Capacitor, pemutar, atau kode APK di repo ini.

## Menjalankan

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck + build produksi (dist/)
```

## Struktur

```
src/
  site/      landing, layout, pengumuman
  legal/     isi Kebijakan Privasi dan Ketentuan Layanan
  config/    apk.ts (repo rilis, tombol unduh), site.ts (nama, email kontak)
```

## Env (opsional, lihat `.env.example`)
`VITE_GITHUB_REPO`, `VITE_CONTACT_EMAIL`, `VITE_DISTRIBUTION_PAUSED`.
Server (Vercel, tanpa awalan VITE_), untuk halaman tautan bagikan `/p/<kode>` (`api/p.mjs`):
- `SUPABASE_SHARE_URL`, `SUPABASE_SHARE_KEY`: tautan tanpa akun (kode `a...`).
- `FIREBASE_API_KEY` (wajib untuk kode `u...`), `FIREBASE_PROJECT_ID` (bawaan `musicverse-app`): tautan akun di Firestore.

## Letak di repo
Folder ini = `web/` di repo utama (app Android native ada di luarnya). Vercel: Settings > General > **Root Directory = `web`**.
Aturan Firestore untuk tautan akun ada di `../firestore.rules` (deploy: `firebase deploy --only firestore:rules`).
