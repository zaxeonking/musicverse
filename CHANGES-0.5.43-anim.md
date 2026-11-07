# 0.5.43 (animasi muncul / bergerak)

Prinsip: semua animasi masuk memakai `fill-mode: backwards`, jadi tidak menahan `transform`/`opacity` setelah selesai (gestur geser baris tetap normal). "Kurangi gerakan" tetap dihormati (aturan global di index.css + cek di useExitGhost).

## Baru
- index.css: kelas `mv-in`, `mv-pop`, `mv-drop`(+`-out`), `mv-rise`(+`-out`), `mv-slide-x`, `mv-list` (anak daftar masuk bergantian, 12 pertama), `tap-card` / `tap-row` (mengecil sedikit saat ditekan, kembali membal).
- hooks/useExitGhost.ts: animasi KELUAR sheet. Sheet dilepas React saat ditutup, jadi isinya digandakan ke <body> sebentar: latar memudar, panel turun. Dipakai di OverlayPortal (semua sheet menu/playlist) dan CrossfadeSheet, SleepTimerSheet, QueuePanel, ManualSearchSheet, TrackActionSheet.
- ui/Presence.tsx: tahan elemen sebentar supaya animasi keluarnya sempat jalan (mode `collapse` untuk banner, `float` untuk toast).

## Dipasang di
- Sheet: buka lebih halus (340 ms), tutup turun + latar memudar; daftar pilihan di dalamnya masuk bergantian.
- Banner Offline & Pembaruan, toast: masuk/keluar dengan tinggi menyusut mulus (konten di bawah tidak melompat).
- Bilah mode pilih (playlist & lagu): turun dari atas. Kotak centang muncul geser + membal saat masuk mode pilih.
- Semua daftar (lagu, playlist, unduhan, riwayat, hasil artis/album, pengaturan, dst.) masuk bergantian.
- Saran judul, form playlist baru, pesan error/sukses, panel pemulihan, tombol hapus teks pencarian, lencana, EmptyState: muncul dengan drop/pop.
- Sampul: memudar masuk saat gambar selesai dimuat.
- Kartu & baris: efek tekan (tap-card / tap-row), termasuk item di dalam sheet.
