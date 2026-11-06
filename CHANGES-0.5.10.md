# 0.5.10 — Judul dicek lintas bahasa (arti sama)

Judul lagu yang sama sering berbeda per bahasa: Spotify "Yuzutsu", YouTube Music "夕星-ゆうづつ-". Kini aplikasi mencari NAMA LAIN lagu itu
dan memakainya untuk pencarian DAN penilaian.
- Baru `src/services/titleAliases.ts`: mencari di katalog iTunes (negara us, jp, kr) dengan judul+artis. Nama lain hanya diterima bila
  durasinya sama (<= 2,5 dtk) dan artisnya cocok (atau beda aksara), supaya lagu lain tidak ikut. Dicari paralel dengan pencarian pertama
  (ditunggu maks. 1,5 dtk); gagal / lambat = diabaikan. Hasil di-cache selama sesi.
- Penilaian (`scoreWithAliases`): judul hasil cukup cocok dengan judul asli ATAU salah satu nama lain; artis ikut sesuai nama lain itu.
  Gerbang judul 0.5.9 tetap berlaku untuk semuanya.
- Pencarian: bila kata kunci biasa (judul+artis / judul / artis) tidak menghasilkan yang lolos, dicoba kata kunci dengan nama lain
  ("<judul Jepang> <artis>" dan "<judul Jepang>").
- Cache lagu lama dinilai ulang dengan nama lain yang sama.
- Hanya JS (OTA). Butuh internet ke itunes.apple.com; bila tidak terjangkau, perilaku sama seperti 0.5.9.
