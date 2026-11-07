# 0.5.19 — Disc muncul setelah keyboard naik, Enter menutup keyboard
## Mini player ke disc saat keyboard naik
- Sebelumnya: begitu keyboard terdeteksi, kartu mini player "terbang" mengecil (220 ms) selagi keyboard masih naik, lalu diganti disc. Dua gerakan itu bertabrakan dan terasa patah.
- Sekarang: kartu langsung hilang tanpa animasi, lalu disc baru muncul setelah ukuran layar berhenti berubah (keyboard selesai naik; `src/utils/viewportSettle.ts`: tenang 140 ms, batas tunggu 800 ms). Disc masuk dengan animasi naik pelan (`bubble-rise`, 320 ms) lewat prop `rise` di `MiniBubble`.
- Tidak berubah: animasi saat keyboard menutup (disc membesar jadi kartu), animasi disc karena pilihan pengguna (seret/ketuk pegangan), dan animasi lainnya.
- Bila keyboard menutup sebelum disc sempat muncul, penantian dibatalkan dan kartu kembali dengan animasi masuk bawaan.
## Enter menutup keyboard
- `src/hooks/useEnterClosesKeyboard.ts` (dipasang di `AppShell`): Enter di kolom isian satu baris (cari, tempel tautan, ganti nama, dst.) menutup keyboard setelah penangan Enter kolom itu selesai. `<textarea>` dikecualikan.
## Catatan
- Hanya JS (OTA). Belum diuji di perangkat; penunggu ukuran layar sudah diuji terpisah di Node (4 skenario). Waktu tunggu 140 ms / 800 ms bisa disetel di `viewportSettle.ts` bila disc masih terasa terlalu cepat atau lambat di HP-mu.
