# 0.5.46 — Tombol Jeda/Lanjutkan notifikasi unduhan jalan tanpa JS
## Cara kerja
- Saat app digeser / WebView mati, antrean native (`DownloadQueue`) memegang notifikasinya sendiri. Sekarang notifikasi itu punya tombol **Jeda**; sebelumnya tidak ada tombol sama sekali dan tombol hanya diteruskan ke JS.
- **Jeda** (native): lagu yang sedang berjalan diselesaikan dulu (notifikasi: "Unduhan dijeda — Berhenti setelah lagu ini"), lalu antrean berhenti dan notifikasi berubah jadi "Unduhan dijeda" + tombol **Lanjutkan**. Pekerja tidak lagi menyala ulang sendiri selama dijeda.
- **Lanjutkan** (native): pekerja dinyalakan lagi dan service kembali jadi foreground.
- Bila JS hidup, perilaku lama tidak berubah: tombol diteruskan ke JS (`downloadAction`).
- Jeda native dilepas bila JS mengambil alih: `queueAdd` (JS menyerahkan lagu) atau `queueSync` (app dibuka). Jadi tidak ada keadaan macet "dijeda di native, jalan di JS".
## Batasan
- Jeda tidak memutus lagu yang sedang diunduh; menunggu lagu itu selesai.
- Saat JS hidup tapi **beku** (bukan mati), notifikasi masih dimiliki JS sehingga tombolnya tetap diteruskan ke JS beku. Belum ditangani.
- Android 12+: service dinyalakan dari tombol notifikasi; bila sistem menolak jadi foreground, unduhan tetap jalan tanpa perlindungan service.
## Teknis
- Diubah: `native/android/java/DownloadQueue.java` (`paused`, `setPaused`, `isPaused`, `nextLocked`, guard restart pekerja, `notifyText`, `finishNotification`, `isBusy`), `native/android/java/DownloadService.java` (`onStartCommand`).
- **Perubahan native: perlu build APK baru** (naikkan `version` di package.json). Belum dibuild atau diuji di perangkat; javac tidak tersedia saat mengubah, hanya keseimbangan kurung dicek.
