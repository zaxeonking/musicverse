# 0.5.2 — Sampah APK pembaruan dibersihkan otomatis

- Tiap aplikasi dibuka, berkas `musicverse-update.apk` beserta entri unduhan sistem dihapus bila versinya sudah terpasang (atau berkas rusak/sisa). Unduhan yang sedang berjalan dan pembaruan yang belum dipasang tidak disentuh.
- Perubahan native: butuh APK baru (OTA tidak cukup).
- `apk.yml`: push ke `main`/`master` selalu membuild APK. Bila release `v<versi>` sudah ada, APK lama di tag yang sama diganti dengan APK baru (tag/rilis tidak dibuat ulang). Opsi `force` dihapus. Naikkan `version` hanya bila ingin tag baru.
