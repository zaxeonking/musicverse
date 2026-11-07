# MusicVerse 0.5.46.4 — Gestur mini player <-> pemutar penuh dibuat halus

## Masalah
- Seret mini player ke atas: kartu hanya bergeser sedikit, pemutar penuh baru muncul (animasi berbasis waktu) SETELAH jari dilepas, jadi terasa patah-patah.
- Seret pemutar penuh ke bawah lalu lepas: animasi tutup memakai keyframe (radius sudut dianimasikan di CPU, pengukuran ulang layout, latar blur full-layar ikut digambar ulang), jadi tersendat.

## Perubahan
- `services/playerSheet.ts` (BARU): satu angka `progress` (0 = mini, 1 = penuh) + pegas teredam kritis yang mewarisi kecepatan jari. Dipakai untuk buka, tutup, dan batal, jadi semuanya terasa sama.
- `MiniPlayer.tsx`: seret ke atas memasang pemutar penuh sejak awal seretan dan menggerakkannya 1:1 mengikuti jari. Entri riwayat baru dibuat hanya saat dilepas dan memang membuka (seretan yang dibatalkan tidak meninggalkan jejak di tombol Kembali). Keputusan buka/tutup memakai proyeksi posisi + momentum, jadi lemparan cepat pendek tetap membuka. Kecepatan jari dihaluskan, dan jari yang diam sebelum dilepas = tanpa momentum.
- `FullPlayer.tsx`: seluruh tampilan ditulis dari progress (hanya transform + opacity, langsung ke DOM tanpa render ulang React): lapisan naik/turun, latar memudar, sampul terbang dari sampul mini ke ukuran penuh (posisi, skala, radius), elemen lain muncul bergantian. Seret ke bawah memakai mesin yang sama; seretan bisa menangkap lapisan di tengah animasi buka.
- `PlayerDock.tsx`: pemutar penuh dipasang juga selama seretan dari mini player; tidak ada lagi `key` untuk memulai ulang animasi (dibuka ulang di tengah animasi tutup kini melanjutkan dari posisi sekarang).
- `index.css`: keyframe `fp-rise`, `fp-out`, `fp-bg-in` dihapus (digantikan progress).
- Bar "Berikutnya": `backdrop-blur-xl` dibuang (latarnya sudah buram; blur backdrop dihitung ulang tiap frame saat bergerak).
- `services/flyOrigin.ts` dihapus (tidak diperlukan lagi).

## Belum / batas
- Belum diuji di perangkat. Angka yang mungkin perlu disetel rasa: `OMEGA` (kecepatan pegas) di `playerSheet.ts`, `OPEN_PROJECTION` (MiniPlayer), `CLOSE_PROJECTION`, `ITEM_START/STEP/SPAN` dan `BG_FADE` (FullPlayer).
- Seret kartu mini ke BAWAH (jadi gelembung) tidak diubah.
