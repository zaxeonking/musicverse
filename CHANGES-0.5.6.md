# 0.5.6 — Pemutaran latar belakang lebih stabil

- Minta izin mematikan "Jeda aktivitas aplikasi jika tidak digunakan" (Android 11+), setelah izin penghemat baterai. Ditanya saat app dibuka, maksimal 3 kali per jenis.
- Notifikasi: setelah native pindah lagu sendiri, bilah progres dan tombol Sebelumnya/Berikutnya tidak lagi nyangkut di status "memuat" (dilepas dari keadaan pemutar, bukan hanya dari satu event).
- Tombol notifikasi Berikutnya/Sebelumnya dikerjakan native bila JS tidak merespons.
- Lagu yang gagal diputar saat JS beku dilompati, bukan membuat musik mati.
- Antrean yang diserahkan ke native diperpanjang dari 5 menjadi 12 lagu.
- Perubahan native: butuh APK baru (OTA tidak cukup).
- Animasi navbar bawah dioptimalkan: lensa tab aktif kini bergeser lewat `transform` (GPU) bukan `left`, cahaya `blur` diganti gradien statis, blur kaca dikurangi 24px → 16px, dan lapisan bar diberi `will-change`.
- Sumber audio lebih akurat: klien stream `ANDROID_VR` ditambahkan sebagai cadangan YouTube Music (urutan: VISIONOS → ANDROID_VR → ANDROID → IOS). Pencocokan lagu kini mengurutkan versi yang sama dengan playlist di atas versi live/remix/cover; versi lain tetap diterima bila hanya itu yang ada. Perubahan ini hanya JS (bisa lewat OTA).
- Lagu beda aksara (judul/artis Spotify berhuruf Latin/romaji, di YouTube Music berhuruf Jepang/Korea/Mandarin/dst., atau sebaliknya) tidak lagi ditolak hanya karena kata-katanya tak cocok. Skor judul/artis dianggap "tidak bisa dibandingkan" dan durasi file yang menentukan; durasi harus pas (selisih sedang tetap ditolak). Hanya JS (OTA).
- Pengaturan > Pembaruan (baru): tombol "Cek pembaruan" manual (tanpa menunggu jeda 30 menit), menampilkan versi terpasang, catatan rilis, lalu Perbarui/Pasang langsung dari halaman itu. Hanya JS (OTA); butuh `VITE_GITHUB_REPO` terisi seperti banner pembaruan.
- Mini player: glow berwarna sampul lagu di belakang kartu (warna dominan dibaca dari gambar, cadangan: warna gradien sampul bawaan lalu warna aksen). Berdenyut tiap ganti lagu lalu redup menetap, lebih redup saat jeda. Hanya di belakang kartu mini player, condong ke atas/samping sehingga tidak menyentuh navbar atau layar lain. Ikut bergerak saat kartu diseret. Hanya JS (OTA).
