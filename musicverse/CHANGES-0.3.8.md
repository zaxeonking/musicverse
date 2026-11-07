# MusicVerse 0.3.8 — lagu tidak lagi pause/play/retry di sinyal lemah

## Penyebab
StreamBeats memakai libmpv (buffer baca-depan besar + reconnect). MusicVerse memakai `<audio>` WebView lewat proxy lokal
yang mengambil 1 MB per potongan tanpa baca-depan, jadi sedikit hiccup jaringan langsung menjadi `waiting` -> pause/play
-> muat ulang lagu (resolve ulang) -> retry beruntun. Preload lagu berikutnya juga berebut bandwidth.

## Perubahan
- StreamProxy.java: pengambil (thread terpisah) membaca DEPAN ke antrean RAM 4 MB (~4 menit audio); saat sinyal drop,
  <audio> tetap dapat data dari antrean. Retry/sambung-byte/tunggu-jaringan dipindah ke pengambil.
- useAudioPlayerController.ts: `waiting` < 0,9 dtk tidak ditampilkan sebagai buffering; muat-ulang karena error jaringan
  diberi jeda (1,5 dtk x percobaan) dan error susulan tidak menghabiskan percobaan; preload lagu berikutnya ditahan
  selama buffer lagu aktif < 3 dtk (kecuali sisa lagu <= 10 dtk).
- audioEngine.ts: bufferedAhead().

## Perlu build ulang APK (ada perubahan Java).
