# 0.5.43 (splash)

Files: index.html, src/index.css (bagian Splash), src/main.tsx

Urutan animasi masuk aplikasi (hanya APK):
1. Logo (4 batang) naik, seperti sebelumnya, tapi lebih besar (104 px).
2. Nama "MusicVerse" muncul di bawah logo, huruf per huruf (naik + membesar sedikit, membal tipis).
3. Logo + nama sebagai satu kesatuan membesar pelan (zoom 0.9 -> 1.32, ±2,6 dtk, melambat di akhir).
4. Setelah aplikasi siap (minimal ±2,2 dtk sejak dibuka): splash zoom menembus ke depan sambil memudar, dan aplikasi masuk dari sedikit mengecil + transparan ke ukuran normal.

Catatan
- Preferensi "kurangi gerakan": splash cukup ±0,5 dtk, tanpa zoom.
- transitionend dari anak splash tidak lagi menghapus splash lebih awal (hanya opacity splash itu sendiri).
- Splash native Android (layar polos #121212) tidak berubah.
