# 0.5.13 — Lagu dengan judul beda aksara ditemukan lewat artis, bukan cuma durasi
- Akar masalah: judul Spotify berhuruf Latin ("Pure Pure Heart") vs YouTube Music berhuruf Jepang ("ぴゅあぴゅあはーと") tidak bisa dibandingkan, jadi hanya durasi yang menentukan, dengan toleransi 1,5 dtk. Master Spotify dan YouTube Music sering beda beberapa detik, sehingga lagu yang benar ditolak sementara lagu lain berdurasi pas (kebetulan) lolos.
- `scoreCandidate`: judul beda aksara + artis cocok -> toleransi durasi dilonggarkan sampai 6 dtk (`gapDurationFit`). Artis tidak cocok tetap kena gerbang artis dari 0.5.12.
- `registry`: pada kasus itu pemeriksaan durasi file audio juga memakai toleransi 6 dtk (hanya pemutaran; unduhan tetap ketat). Hanya 2 hasil teratas pencarian yang dipercaya.
- Pencarian: varian artis tanpa tanda hubung ("HO - KAGO TEA TIME" -> "HOKAGO TEA TIME") dicoba lebih dulu.
- Hanya JS (OTA).
