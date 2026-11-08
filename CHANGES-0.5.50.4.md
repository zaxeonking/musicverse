# 0.5.50.4

- ⚠️ Butuh **APK baru** (resource native).
- Pratinjau widget meniru Auralys: hanya `previewImage` (PNG), `previewLayout` dihapus lagi dari semua `widget_*_info.xml`, dan `layout/widget_pv_*.xml` dibuang. Peluncur pabrikan yang gagal memuat `previewLayout` jatuh ke kotak abu-abu.
- PNG pratinjau dikecilkan (sisi terpanjang ≤640 px, 6–25 KB) dan hanya di `drawable-nodpi`; salinan `hdpi`/`xhdpi`/`xxhdpi` dibuang.
- `widget_*_info.xml` dipisah: `xml/` (tanpa `targetCellWidth/Height`) dan `xml-v31/` (dengan atribut itu, Android 12+).
- `setup-android.mjs` mengisi `__APP_ID__` di kedua folder dan membuang sisa pratinjau/layout lama dari proyek android hasil build sebelumnya.

## Animasi mini player -> disc lebih halus (JS, bisa lewat OTA)

- Kedip "kartu muncul utuh dulu baru jadi disc" dihilangkan. Penyebab: di akhir gerakan, kartu hantu dibersihkan (animasi dibatalkan / gaya direset) SEBELUM React melepasnya, jadi kartu sempat tampil penuh satu frame. Sekarang kartu disembunyikan dulu lalu dilepas (`stopLeave`).
- Geser samping (tahan lalu geser kiri/kanan) lebih panjang dan mengalir: jarak gulungan 130-240 px (dulu 90-170), tampilan mengejar jari dengan penghalusan berbasis waktu (`followRoll`) dan bukan 1:1, kurva klip/pudar kartu pakai smoothstep, disc pratinjau memudar masuk bertahap.
- Lepas jari: penyelesaian 380 ms (dulu 280 ms), dimulai dari posisi yang sedang tampil sehingga tidak melompat.
- Serah-terima ke disc asli: disc asli dipasang tanpa animasi masuk tepat di bawah disc pratinjau, lalu pratinjau memudar. Sebelumnya disc asli muncul dari skala 0.72 dan silang-pudar dengan pratinjau sehingga terlihat masuk-keluar.
- Perbaikan kedip kartu setelah jadi disc (geser samping): `setSide`/`setCollapsed` (store eksternal, render sinkron) dan `setHandoff`/`setLeaving` (state biasa) dulu masuk dua commit React, jadi kartu hantu sempat dilepas lalu dipasang ulang dalam keadaan terlihat. Kini dibungkus `flushSync` di `commitRoll` supaya satu commit.

## Tema: gaya lebih lengkap (JS/CSS, bisa lewat OTA)

Pengaturan > Tema:
- **Gaya permukaan** baru: Solid (bawaan), **Kaca** (kartu tembus pandang + tepi bercahaya, paling cantik bersama Cahaya latar), **Garis** (kartu berupa kerangka tipis). Lewat CSS `html[data-surface]` memakai `:where()` sehingga hover/aktif bawaan tetap berlaku; pemutar penuh (`.mv-dark-scope`) tidak ikut berubah.
- **Ukuran teks**: Kecil / Normal / Besar (skala rem di `<html>`, 93,75% / 100% / 112,5%).
- **Kekuatan cahaya latar**: Lembut / Sedang / Kuat (muncul saat Cahaya latar aktif; variabel `--mv-glow-a`).
- **7 tema siap pakai baru**: Hutan, Sakura, Kopi, Neon, Emas, Malam, Batu (total 15 + Kustom). Semua lolos batas latar gelap/terang.
- Pengaturan baru ikut di kode bagikan `MVT1.…` dan tema tersimpan; kode lama tetap valid (nilai baru memakai bawaan).
- "Kembali ke tema bawaan" juga mereset gaya, ukuran teks, dan kekuatan cahaya.
- Diuji lewat Node (logika, kode bagikan, kode lama, nilai sampah) dan Chromium (selector CSS). Halaman React belum dicoba di perangkat.

## Full player: baris kontrol utama tepat di tengah

- Baris timer · sebelumnya · putar · berikutnya · acak melebar melewati kolom (5 tombol + jarak > lebar layar HP), jadi tombol putar bergeser ke kanan dan tombol acak terpotong. Kini grid 5 kolom (`minmax(0,1fr)` x2, 5rem, `minmax(0,1fr)` x2): tombol putar tepat di tengah layar, timer rata kiri dan acak rata kanan sejajar tombol ulang/crossfade di baris bawah. Hanya `FullPlayer.tsx` (JS/CSS, bisa lewat OTA).

## Tutorial diperbarui + peragaan animasi (JS, bisa lewat OTA)

- **Peragaan animasi di dalam kartu** (`tour/DemoStage.tsx`, baru): gerakan baru diperagakan berulang di kartu tutorial tanpa perlu ada lagu yang diputar. Empat peragaan: `mini-roll` (kartu bergulir mengerut jadi disc lalu diketuk membesar lagi), `mini-close` (kartu tenggelam ke belakang nav), `disc-side` (disc diseret ke sisi lain dan menempel membal), `theme` (gaya Solid / Kaca / Garis, warna aksen, dan cahaya latar bergantian). Memakai Web Animations API; `prefers-reduced-motion` = diam.
- **Peragaan jari baru** di atas sorotan mini player: `animate: 'roll'` (geser kanan lalu kiri) dan `animate: 'down'` (geser ke bawah). Field baru `demo` di `TourStep`.
- **Tutorial utama**: tiga langkah baru setelah "Pemutar" (Geser jadi disc, Main-main dengan disc, Tutup musik) dan satu langkah "Tema sesukamu" (APK) setelah Pengaturan. Kuis jadi 4 pertanyaan (tambah: cara mengecilkan pemutar mini jadi disc).
- **"Yang baru"** rilis `0.5.50.4`: geser jadi disc, geser bawah = tutup musik, gaya tema lebih lengkap. Pengguna yang sudah menamatkan tutorial melihatnya sekali di Beranda.
- Hanya cek sintaks TypeScript yang dijalankan (tidak ada node_modules); tampilan dan gerakan belum dicoba di perangkat.

