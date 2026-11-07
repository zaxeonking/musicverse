# 0.5.47

- Pratinjau widget di daftar widget peluncur sebelumnya kosong (hanya ikon aplikasi di kotak abu-abu). Penyebab: `previewImage` berupa
  vector drawable XML yang tidak dimuat banyak peluncur bawaan pabrikan, yang juga mengabaikan `previewLayout`.
- `drawable/widget_preview_*.xml` (vektor) diganti PNG `drawable-nodpi/widget_preview_*.png` (nama sama, `widget_*_info.xml` tidak berubah).
- Deskripsi rilis GitHub kini selalu dikosongkan (apk.yml tidak lagi membaca CHANGES-<versi>.md).
