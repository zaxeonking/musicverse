# 0.5.14 — Web jadi halaman unduh APK; Kebijakan Privasi dan Ketentuan Layanan
- Web tidak lagi punya pemutar. `/` kini landing untuk memasang APK (hero, fitur, platform Android/Windows/iOS, cara pasang, tanya jawab). Windows dan iOS ditandai "Menyusul".
- Alamat app lama di web (`/search`, `/library`, `/settings`, `/my/:id`, dst.) dialihkan ke `/` (client: `SiteApp`, server: `vercel.json` redirects). Kode pemutar tidak ikut dimuat di web (`main.tsx` memakai import dinamis: APK -> `App`, peramban -> `site/SiteApp`).
- Baru: Kebijakan Privasi dan Ketentuan Layanan. Satu sumber isi (`src/legal/content.ts`), tampil di web (`/privacy`, `/terms`) dan di APK (Pengaturan > Tentang > Kebijakan Privasi / Ketentuan Layanan, rute `/settings/privacy` dan `/settings/terms`).
- Dihapus: banner `ApkPromo` (web tidak lagi memuat AppShell) dan `APK_ONLY_FEATURES`.
- `config/apk.ts`: bila `VITE_GITHUB_REPO` kosong, memakai repo rilis bawaan yang sama dengan workflow (`zaxeonking/musicverse-releases`), jadi tombol unduh tidak pernah mati.
- Baru (opsional): `VITE_CONTACT_EMAIL` untuk email kontak di dokumen hukum; kosong = tautan Issues GitHub.
- Hanya JS (OTA). Tidak ada perubahan native.
- Saat isi dokumen hukum berubah, perbarui `LEGAL_UPDATED` di `src/config/site.ts`.
