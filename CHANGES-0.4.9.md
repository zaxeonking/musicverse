# MusicVerse 0.4.9 — pencarian judul hybrid (Spotify langsung + pihak ketiga berbarengan)

## Apa
- `searchTrackByTitle`: Spotify langsung dan nexadev dijalankan BERSAMAAN; hasil pertama yang berhasil dipakai, yang lain
  dibatalkan. Salah satu gagal = yang lain tetap ditunggu; galat hanya bila keduanya gagal.
- Token Spotify di-cache (dipakai ulang oleh pencarian, info lagu, impor); dibuang bila API menjawab 401/403.
- Sumber token (embed seed 1-3 + endpoint anonim) kini dibalapkan, bukan berurutan.

## Batas
- Belum diuji ke server asli / perangkat. `tsc` tidak menambah galat baru pada file yang disentuh.
- Info satu lagu via tautan (`searchTrackByLink`) masih Spotify dulu lalu cadangan (belum hybrid).

## Perlu build ulang APK (bundel web berubah; tidak ada perubahan Java).
