# 0.4.27 — bottom nav bergaya "kaca cair" (liquid glass)

## Apa
Bottom nav (mobile) dibuat seperti referensi: pil melayang, latar kaca tembus pandang, dan tab aktif ditandai lensa kaca yang meluncur.

- **Bentuk**: pil penuh (`rounded-full`) yang melayang dengan jarak dari tepi layar (aman terhadap safe area), tinggi 4rem, lebar maks `max-w-md`.
- **Kaca**: `bg-raised/55` + `backdrop-blur-2xl` + `backdrop-saturate-150`, tepi 1px putih transparan, kilau di tepi atas, bayangan lembut.
  Warna kaca mengikuti konten yang lewat di belakangnya. Tanpa dukungan `backdrop-filter`, jatuh ke `bg-raised/90` (tetap terbaca).
- **Warna menyesuaikan tema**: tab aktif memakai `accent` (hijau), permukaan memakai token `raised`, teks tidak aktif `ink/70`. Mengganti token di
  `tailwind.config.js` mengubah nav ikut berubah; tidak ada warna biru iOS yang di-hardcode.
- **Lensa aktif**: satu elemen kaca beraksen (`accent` 22%, rim terang, kilau atas) di belakang tab aktif yang meluncur antar tab dengan pantulan
  pegas 500 ms; ikon aktif sedikit membesar; tekan = mengecil sedikit. Di halaman di luar tab (Pengaturan/Riwayat) lensa memudar. Letaknya
  dihitung dari alamat (`utils/navActive.ts`, aturan sama dengan NavLink).
- **Keyboard terbuka** (dari 0.4.26): bar turun keluar layar sambil memudar, naik lagi saat keyboard hilang.

## Perubahan tata letak (penting)
Agar kaca benar-benar menampilkan konten di belakangnya, nav tidak lagi mengambil ruang sendiri di kolom flex. Ia pembungkus setinggi 0 dengan bar
diposisikan absolut di dasar (pola yang sama dengan dock mini player), jadi `<main>` meluas sampai tepi bawah dan konten lewat di bawah kaca.
- Ruang yang dipesan bar = variabel CSS `--dock-offset` (`4.5rem + safe-area-bawah`) yang diatur di akar `AppShell`. Nilainya `0` di layar lebar
  (tidak ada nav bawah) dan saat keyboard terbuka.
- Padding bawah konten (`AppShell`) kini `rem` lama + `--dock-offset`, jadi item terakhir tidak tertutup nav.
- Mini player memakai `margin-bottom = --dock-offset + 1rem` (dengan transisi 300 ms), jadi tetap duduk tepat di atas nav dan turun halus saat
  keyboard terbuka.

## Diuji / belum
- Node (6 kasus, lulus): aturan tab aktif (`/`, tab biasa, rute turunan, awalan mirip `/libraryx`, halaman di luar tab, tanpa tab Unduhan di web, daftar kosong).
- `tsc` dibanding 0.4.25 asli: tidak ada galat nyata baru (selisih hanya pesan lingkungan karena paket React tidak terpasang).
- Pratinjau visual: CSS bar diterjemahkan manual ke HTML dan dirender di Chromium (3 keadaan: tab Beranda, tab Playlist, keyboard terbuka) untuk
  memeriksa kaca, lensa, dan geseran. Tailwind tidak terpasang di lingkungan ini, jadi class Tailwind itu sendiri BELUM dikompilasi: nilai
  arbitrer seperti `[--dock-offset:calc(4.5rem_+_env(...))]`, `data-[keyboard=open]:`, `supports-[backdrop-filter]:` perlu dipastikan lewat build asli.
- BELUM dijalankan di perangkat. Yang perlu dilihat di HP: (1) apakah blur kaca terasa mulus saat scroll (WebView lemah bisa patah-patah; bila ya,
  turunkan `backdrop-blur-2xl` ke `xl`), (2) padding bawah di semua halaman (item terakhir tidak tertutup nav), (3) posisi mini player/gelembung
  di atas nav, (4) transisi saat keyboard buka-tutup, (5) toast yang dipasang pada offset tetap (`bottom-44` di PlaylistView, `9.5rem+` di
  TrackMenuContext) masih terlihat di atas kartu mini player.

Hanya TypeScript/CSS; build ulang APK seperti biasa.
