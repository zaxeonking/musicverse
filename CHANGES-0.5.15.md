# 0.5.15 — Tombol tempel (clipboard) berfungsi di APK
- Akar masalah: `navigator.clipboard.readText()` ditolak WebView Android tanpa dialog izin, jadi tombol tempel selalu menampilkan "Tidak bisa membaca clipboard".
- Baru: `src/native/clipboard.ts` memakai plugin native `@capacitor/clipboard` di APK (API web tetap dipakai di peramban). Dipakai tombol tempel di Beranda dan "Salin tautan" di menu lagu (yang punya masalah sama).
- Pesan galat diganti: bila tetap gagal, kolom difokuskan dan pengguna diarahkan menekan lama lalu memilih Tempel.
- PERLU APK BARU: menambah plugin native (`@capacitor/clipboard`). Jalankan `npm install` lalu `npm run android:sync`; paket OTA saja tidak cukup.
