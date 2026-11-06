# 0.5.12 — Lagu dengan artis yang jelas beda tidak lagi lolos
- Gerbang artis di `scoreCandidate`: bila artis hasil sama sekali tidak cocok (skor 0, aksara sama sehingga bisa dibandingkan), skor dibatasi 0,45 (di bawah `ACCEPT_SCORE`). Judul dan durasi yang mirip tidak lagi menutupi artis yang salah (mis. "Pure Heart — Nymith" tidak lagi diterima untuk "Ho - Kago Tea Time - Pure Pure Heart").
- Pengecualian: judul persis sama (ejaan hampir identik) tetap lolos, karena channel label/uploader sering mengisi field artis dengan nama lain.
- `artistScore`: nama artis yang muncul di judul hasil ("Artis - Judul") kini dihitung cocok.
- `titleScore`: kata berulang dihitung per kemunculan ("Pure Pure Heart" vs "Pure Heart" = 2 dari 3 kata, bukan 3 dari 3).
- Hasil cache lama yang salah dinilai ulang dan dibuang otomatis.
- Hanya JS (OTA).
