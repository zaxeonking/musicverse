# 0.5.54.3 (Kepala Beranda lebih polos)

Files: src/components/home/HomeHeader.tsx, src/components/player/SeekBar.tsx, src/components/player/MiniPlayer.tsx, package.json (appVersion 0.5.54.3), CHANGES.md (0.5.54 diarsipkan), CHANGES-0.5.54.3.md, PROJECT_STRUCTURE.md

1. Kepala Beranda lebih polos (`HomeHeader`)
   - Dibuang: cincin gradien di avatar, ikon logo + nama dua warna, sudut tidak simetris pada kolom cari dan tombol filter, kotak ikon cari berwarna aksen, dan gelombang di kolom cari.
   - Kini: avatar bulat polos, nama aplikasi satu warna, kolom cari dan tombol filter berbentuk kapsul/bulat. Fungsi, penanda tutorial, laci menu, sleep timer, notifikasi, dan menu filter tidak berubah.


2. Bar progres tanpa layout ulang (`SeekBar`)
   - Isi bar dan pegangan sebelumnya menganimasikan `width` dan `left` terus-menerus selama lagu diputar (layout ulang tiap frame di mini dan full player). Kini isi bar berupa batang penuh yang digeser dengan `transform`, dan pegangan ada di pembungkus yang digeser dengan `transform`. Tampilan, durasi (300 ms linear), dan perilaku seret/seek sama seperti sebelumnya.

3. Disc -> kartu saat keyboard menutup (`MiniPlayer`)
   - Sebelumnya disc ikut turun bersama layar yang melebar (ke posisi di atas nav) lebih dulu, baru terbang ke sampul di kartu. Kini begitu layar mulai melebar, dock berikut disc ditahan di posisi di atas keyboard (hanya transform); saat keyboard dinyatakan tertutup, disc disalin dari posisi itu dan terbang langsung ke sampul. Animasi saat keyboard naik tidak diubah.
