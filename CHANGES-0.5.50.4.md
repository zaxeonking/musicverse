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

## Tema: gaya lebih lengkap (JS/CSS, bisa lewat OTA)

Pengaturan > Tema:
- **Gaya permukaan** baru: Solid (bawaan), **Kaca** (kartu tembus pandang + tepi bercahaya, paling cantik bersama Cahaya latar), **Garis** (kartu berupa kerangka tipis). Lewat CSS `html[data-surface]` memakai `:where()` sehingga hover/aktif bawaan tetap berlaku; pemutar penuh (`.mv-dark-scope`) tidak ikut berubah.
- **Ukuran teks**: Kecil / Normal / Besar (skala rem di `<html>`, 93,75% / 100% / 112,5%).
- **Kekuatan cahaya latar**: Lembut / Sedang / Kuat (muncul saat Cahaya latar aktif; variabel `--mv-glow-a`).
- **7 tema siap pakai baru**: Hutan, Sakura, Kopi, Neon, Emas, Malam, Batu (total 15 + Kustom). Semua lolos batas latar gelap/terang.
- Pengaturan baru ikut di kode bagikan `MVT1.…` dan tema tersimpan; kode lama tetap valid (nilai baru memakai bawaan).
- "Kembali ke tema bawaan" juga mereset gaya, ukuran teks, dan kekuatan cahaya.
- Diuji lewat Node (logika, kode bagikan, kode lama, nilai sampah) dan Chromium (selector CSS). Halaman React belum dicoba di perangkat.
