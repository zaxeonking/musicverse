# 0.5.46.8 — Perbaikan pratinjau widget

- Pratinjau widget kosong di daftar widget peluncur (hanya tampil ikon aplikasi di kotak abu-abu). Penyebab: `previewImage` berupa
  vector drawable XML yang tidak dimuat oleh banyak peluncur bawaan pabrikan (ColorOS/OriginOS/MIUI dsb.), dan peluncur tersebut
  juga mengabaikan `previewLayout`.
- `drawable/widget_preview_*.xml` (vektor) diganti PNG bitmap `drawable-nodpi/widget_preview_*.png` (nama sama, jadi
  `widget_*_info.xml` tidak berubah). `previewLayout` tetap ada untuk peluncur Android 12+ yang mendukungnya.
- Setelah memasang APK baru, buka ulang daftar widget (jika masih lama, hapus data/cache peluncur atau mulai ulang ponsel — peluncur menyimpan cache pratinjau).
