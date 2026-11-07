# 0.5.8 — Lagu salah ambil (Pure Pure Heart memutar U&I)

Akar masalah (bug lama, bukan dari 0.5.7): saat menilai hasil pencarian YouTube Music, `resolveViaPluginsDetailed` mengisi
`spotifyUrl` tiap kandidat dengan tautan lagu yang diminta. `scoreCandidate` lalu menganggapnya "ID Spotify sama" dan memberi
bonus +0,25 ke SEMUA kandidat. Lagu lain berdurasi mirip (U&I 4:35 vs Pure Pure Heart 4:35): skor 0,5 + 0,25 = 0,75 >= 0,7 -> lolos.

- `spotifyUrl` kandidat pencarian kini kosong saat penilaian (bonus ID hanya berlaku bila sumbernya benar-benar membawa ID).
  Lagu yang judulnya tidak cocok DAN artisnya tidak cocok sekarang ditolak walau durasinya sama.
- Ejaan Latin yang mirip kini dikenali (judul/artis): "Ho - Kago Tea Time" ~ "Houkago Teatime" (spasi/tanda baca dibuang, ou/oo->o, uu->u,
  kemiripan >= 85%). Tanpa ini kandidat yang benar bisa ikut ditolak setelah bonus liar dicabut.
- Hanya JS (bisa OTA). Termasuk 0.5.7 (judul+artis beda aksara).
- Hasil lama di cache (yang sudah salah) kini dinilai ulang saat dipakai dan dibuang bila tidak cocok, jadi lagu itu dicari ulang otomatis.
