# MusicVerse 0.5.46.9 — Animasi mini player ke pemutar penuh lebih mulus

Hanya JS/CSS (tanpa APK baru).

## Penyebab dugaan (dari kode, belum diukur di perangkat)
1. Latar pemutar penuh: gambar layar penuh diperbesar 1,5x lalu `blur(36px)`. Memburamkan ~1,5 layar saat komponen baru dipasang
   adalah pekerjaan GPU terberat di awal gerakan.
2. `border-radius` sampul dan lapisan penuh (`overflow-hidden`) diubah tiap frame: memaksa sampul + bayangan besar dan topeng
   lapisan digambar ulang terus, bukan hanya digeser compositor.
3. Pegas berbasis waktu: bila frame awal lama (pemasangan komponen, dekode gambar), gerakan "melompat" melewati bagian awalnya.

## Perubahan
- `FullPlayer.tsx`: latar diburamkan pada 1/4 ukuran lalu `scale(6)` (hasil visual setara, ~16x lebih sedikit piksel diburamkan).
- `FullPlayer.tsx`: radius sampul tetap (tanpa interpolasi per frame); radius lapisan tetap 28px dan baru mengecil di 3% terakhir.
- `playerSheet.ts`: bila salah satu dari 4 frame pertama berselang >40 ms, jam pegas dimulai ulang.

## Catatan
- Sudut sampul yang terbang kini sedikit lebih persegi di awal (radius tampak = 28px × skala), bukan menyamai radius sampul mini.
- Belum diuji di perangkat. Bila masih patah-patah, kemungkinan berikutnya: render ulang rute saat `navigate` membuka pemutar
  (`PlayerUiContext.push`) dan `document.body.style.overflow` yang diset saat pemasangan.
