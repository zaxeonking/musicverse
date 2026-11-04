# MusicVerse 0.4.5 — sumber audio sama seperti StreamBeats (tanpa API pihak ketiga)

## Apa
Audio untuk memutar dan mengunduh sekarang HANYA berasal dari plugin yang langsung ke YouTube, seperti StreamBeats
(plugin `ytmusic` + `ytvideo` dari bloom-factory). API pihak ketiga `app.kyzznekoo.my.id` (kyzz) dan jalur
cadangan `/api/spotify` tidak lagi dipakai untuk audio.

- Urutan sumber: `ytmusic` (cari di YouTube Music) -> `ytvideo` (cari video YouTube; baru) -> galat yang jelas.
- Plugin baru `src/plugins/ytvideo.ts`: pencarian filter "Videos" (`EgIQAQ%3D%3D`, klien WEB) seperti plugin `ytvideo`
  StreamBeats; pengambil stream memakai kode yang sama dengan ytmusic (klien ANDROID lalu IOS).
- `avoid` (sumber yang baru memberi berkas salah / URL ditolak 2x) kini berisi `plugin:<id>`: yang dilewati hanya plugin
  itu, plugin berikutnya yang dicoba. Sebelumnya `plugin` dilewati seluruhnya lalu jatuh ke API pihak ketiga.
- Galat resolve dibedakan: waktu habis (`timeout`), sumber tak terjangkau (`network`), ada kandidat tetapi tidak
  cocok (`clip_only`), tidak ditemukan (`no_audio`). `timeout`/`network` diulang oleh pemutar/pengunduh seperti biasa.
- Dihapus: pemutus sirkuit plugin 5 menit (tanpa fallback API, berhenti 5 menit = tidak ada suara sama sekali),
  hand-off hasil pencarian (membawa URL audio pihak ketiga), `requestDownload`/`requestByLink`, konfigurasi kyzz di
  `spotifyApi.ts`, `vite.config.ts`, `vercel.json`, `api/proxy.js`, `vite-env.d.ts`.
- Daftar plugin dibangun saat dipakai (bukan saat modul dimuat) agar impor melingkar registry <-> plugin <-> jaringan aman.

## Yang MASIH memakai pihak ketiga (bukan audio)
- Impor playlist Spotify, pencarian judul, dan info lagu dari tautan Spotify: `api.nexadev.my.id` (hanya judul, artis,
  durasi, sampul; `mp3_url`/`data.url` diabaikan). StreamBeats memakai plugin `spotify-importer`; belum dipasang di sini.
- Lirik: NetEase (+ lrclib bila ada), tidak berubah.

## Batas
- Audio hanya bisa diputar di APK (plugin butuh HTTP native bebas CORS). Di browser biasa tidak ada fallback ke API.
- Lagu yang tidak ada di YouTube Music maupun YouTube sekarang gagal dengan `no_audio` (tidak ada lagi jalur ketiga).
- Diuji dengan Node memakai respons YouTube tiruan: parser `ytvideo` (live tanpa durasi dibuang, " - Topic"/"VEVO"
  dibersihkan, durasi jam:menit:detik), serta alur ytmusic -> ytvideo, `avoid`, `nomatch` dan `failed`. `tsc` tidak
  menambah galat baru (paket React/Capacitor tidak terpasang di lingkungan ini). BELUM diuji ke server YouTube asli
  atau di perangkat; kunci API dan versi klien `ytvideo` disalin dari sumber bloom-factory.

## Perlu build ulang APK (bundel web berubah; tidak ada perubahan Java).
