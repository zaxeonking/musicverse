# 0.5.43 (UI)


- Splash (index.html + main.tsx): logo muncul di tengah, memudar keluar, Beranda memudar masuk (hanya APK).
- Perpindahan halaman (layout/PageTransition.tsx): halaman lama memudar (130 ms), halaman baru masuk geser horizontal (260 ms). Arah mengikuti urutan tab / dalam-luar.
- Mini player -> pemutar penuh (player/FullPlayer.tsx, PlayerDock.tsx): sampul "terbang" dari mini player (FLIP), latar artwork blur + gradient gelap memudar masuk, judul/artis/kontrol masuk bertahap. Penutupan berjalan terbalik (juga untuk tombol Kembali Android); Beranda tidak dilepas, jadi scroll tetap.
- Tombol: efek tekan (scale), ikon putar/jeda berganti halus, hati berganti + membal, progres bar mengalir.
- Easing seragam di index.css (--ease, --ease-hero).


Baris lagu (Album, Artis, Cari, hasil cari lagu di Beranda) yang sudah ada di playlist buatanmu kini tampil beda:
judul abu-abu terang (tetap terbaca, kontras >7:1), sampul sedikit redup, ikon centang, dan keterangan "Sudah ada di ...".
Lagu yang sedang diputar/dipilih tetap berwarna aksen.

File: src/components/playlist/TrackRow.tsx

## Splash native (butuh APK baru, tidak bisa lewat OTA)
- Splash bawaan Android (ikon launcher besar di tengah) diganti layar polos #121212 layar penuh; logo beranimasi hanya tampil sekali, di splash web.
- Dipasang oleh scripts/setup-android.mjs (patch styles.xml) + native/android/res/values/mv_splash.xml, drawable/mv_splash_empty.xml.
