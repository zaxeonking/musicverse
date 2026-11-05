# 0.4.23 — Lagu berulang terus saat habis (mode ulang mati), ronde 3

Dua penyebab NYATA ditemukan dengan membaca kode (belum dijalankan di perangkat):

1. **Antrean habis diputar ulang otomatis.** `canRestartQueue` selalu true untuk antrean > 1 lagu: saat lagu terakhir selesai,
   `restartQueue` memutar antrean yang sama lagi secara acak dan menyalakan mode acak — terus-menerus, walau ulang = mati.
   Ini perilaku yang sengaja ditulis (README) tetapi tidak bisa dimatikan dan terasa seperti lagu mengulang.
   Sekarang mati: `AUTO_RESTART_QUEUE = false` di `utils/playerQueue.ts`. Antrean habis = berhenti (`ended`).
2. **Native masih punya jalur pindah-lagu sendiri saat JS hidup.** Di `PlaybackService.java`, saat lagu selesai dan lagu cadangan
   siap (`autoAdvance`), native crossfade ke cadangan walau JS juga memproses `ended`. Hasilnya lagu berikutnya diputar dua kali.
   0.4.21 hanya menutup jalur `chainAdvance`; jalur ini terlewat. Sekarang ditambah `!jsAlive()`: JS hidup = JS yang memindah lagu
   (pindah mulus tetap lewat crossfade JS di detik-detik terakhir).

Termasuk semua perbaikan 0.4.21 dan 0.4.22. Perlu build ulang APK (ada perubahan Java). Java belum dikompilasi di sini.

Bila MASIH berulang: kirim log yang memuat `[MusicVerse] lagu selesai #...` (menunjukkan ulang=..., berikutnya=...).
