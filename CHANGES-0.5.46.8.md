# MusicVerse 0.5.46.8 — Lirik layar penuh + notifikasi tidak ikut hilang saat gangguan sesaat

⚠️ Notifikasi: butuh **APK baru** (`PlaybackService.java` berubah). Lirik layar penuh: hanya JS.

## Lirik layar penuh (`FullPlayer.tsx`)
- Saat tampilan lirik terbuka, ada tombol **Maximize2** di baris judul. Ditekan: header, tombol transport, baris lirik/ulang/crossfade,
  dan bar "Berikutnya" disembunyikan; sisanya judul ringkas, hati, dan bilah posisi. Ikon berubah jadi **Minimize2** untuk kembali.
- Menutup lirik (tombol mikrofon / geser samping) otomatis keluar dari mode layar penuh.

## Notifikasi hilang saat gangguan sesaat (`PlaybackService.java`)
- `deleteIntent` notifikasi dulu sama dengan tombol "Tutup" (`ACTION_DISMISS`) sehingga penghapusan oleh sistem/ROM saat status jeda
  karena gangguan langsung mematikan service (notifikasi + pemutar + putar-ulang otomatis).
- Kini `deleteIntent` memakai `ACTION_SWIPED`: bila sedang terinterupsi / menunggu putar-ulang, notifikasi dipasang lagi dan service tetap hidup.
  Tombol "Tutup" dan geser saat jeda biasa tetap mematikan service.

## Belum diuji
Tidak dikompilasi/diuji di perangkat (tanpa Android SDK); hanya cek sintaks TS. Penyebab notifikasi hilang adalah dugaan dari kode:
bila masih terjadi, kirim `adb logcat -s MusicVerse` saat kejadian.
