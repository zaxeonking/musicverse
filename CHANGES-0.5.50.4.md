# 0.5.50.4

- ⚠️ Butuh **APK baru** (resource native).
- Pratinjau widget meniru Auralys: hanya `previewImage` (PNG), `previewLayout` dihapus lagi dari semua `widget_*_info.xml`, dan `layout/widget_pv_*.xml` dibuang. Peluncur pabrikan yang gagal memuat `previewLayout` jatuh ke kotak abu-abu.
- PNG pratinjau dikecilkan (sisi terpanjang ≤640 px, 6–25 KB) dan hanya di `drawable-nodpi`; salinan `hdpi`/`xhdpi`/`xxhdpi` dibuang.
- `widget_*_info.xml` dipisah: `xml/` (tanpa `targetCellWidth/Height`) dan `xml-v31/` (dengan atribut itu, Android 12+).
- `setup-android.mjs` mengisi `__APP_ID__` di kedua folder dan membuang sisa pratinjau/layout lama dari proyek android hasil build sebelumnya.
