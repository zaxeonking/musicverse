# 0.5.42 — Bagikan kartu lagu
- Menu lagu (titik tiga di pemutar penuh, tahan lama di mini player/antrean) punya **Bagikan kartu lagu**: gambar PNG 1080×1920 (ukuran story) berisi sampul, judul, artis, dan latar gradien warna aksen dari sampul. Lalu membuka lembar bagikan.
- Web: Web Share dengan berkas bila didukung; selain itu PNG diunduh.
- APK: PNG ditulis ke `share/sedang-diputar.png` (folder files app) lalu dibagikan lewat `shareFile` native. `shareFile` kini menerima `mimeType` (default tetap `application/json`, jadi cadangan data tidak berubah). `update_file_paths.xml` menambah folder `share/`. **Butuh APK baru.**
- Bila sampul tidak bisa dibaca (host tanpa CORS), kartu memakai gradien bawaan dengan not musik, bukan sampul asli. Warna aksen tetap dari gradien bawaan.
- `useCoverGlow.ts`: ditambah `resolveCoverGlow()` (versi non-hook, cache sama).
- File baru: `utils/shareCard.ts`. Belum dibuild atau diuji di perangkat; hanya sintaks yang dicek.
