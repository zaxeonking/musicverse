# 0.5.21 — Kartu "Sedang dibuka" dihapus, mini player menunggu di belakang keyboard
## Halaman Playlist
- Kartu "<judul> · N lagu · Sedang dibuka, belum ada di Koleksi" + tombol "Simpan ke Koleksi" dihapus dari `LibraryPage.tsx` (beserta variabel dan impor yang tidak terpakai lagi). Menyimpan playlist ke Koleksi tetap bisa lewat menu playlist.
## Mini player saat keyboard naik
- Sebelumnya kartu langsung menghilang saat keyboard naik. Sekarang kartu TIDAK ikut naik bersama keyboard: ditahan di posisi layar semula, jadi tertutup keyboard (`MiniPlayer.tsx`: `startPin`/`applyPin`, dock diberi `translateY` sebesar penyusutan layar, dihitung ulang tiap perubahan ukuran).
- Setelah ukuran layar tenang (`viewportSettle.ts`, tetap 140 ms / 800 ms), kartu berganti disc, lalu disc naik dari belakang keyboard ke atas keyboard (`bubble-rise`, 380 ms). Jarak awalnya mengikuti seberapa jauh kartu ditahan (`--rise-from`, prop `riseFrom` di `MiniBubble`), bukan lagi 28 px tetap.
- Posisi dock dicatat tepat sebelum keyboard naik (saat kolom isian difokus, layar masih penuh).
- Bila keyboard menutup sebelum kartu berganti disc: penahan dilepas dan kartu kembali bersama layar yang melebar. Animasi saat keyboard menutup (disc membesar jadi kartu) dan animasi disc pilihan pengguna tidak berubah.
## Catatan
- Hanya JS (OTA); kodenya sudah termasuk folder Lokal dari 0.5.20 (yang itu butuh APK baru).
- Belum diuji di perangkat: nilai penahan dihitung dari posisi layar, jadi tolong cek di HP-mu apakah kartu benar-benar tersembunyi di belakang keyboard dan disc naik mulus. Bila masih terlihat meloncat satu frame, kabari model HP dan jenis keyboard-nya.
