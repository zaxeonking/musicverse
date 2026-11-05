# 0.5.0 — Rilis APK otomatis dari versi package.json

- `apk.yml`: tiap push ke `main`/`master` membaca `version` di `package.json`. Bila release `v<versi>` belum ada di repo rilis, APK dibuild, ditandatangani, dan dirilis dengan tag itu. Bila sudah ada, build dilewati. Tidak perlu lagi `git tag` manual.
- `apk.yml` dan `ota.yml` memakai secret `RELEASES_TOKEN` (wajib) untuk menulis ke repo rilis.
- Run manual `apk.yml` punya opsi `force` untuk membuild ulang dan menimpa APK versi yang sama.
- Catatan rilis diambil dari file `CHANGES-<versi>.md`.

Rilis baru: naikkan `version` di `package.json`, buat `CHANGES-<versi>.md`, lalu push.
