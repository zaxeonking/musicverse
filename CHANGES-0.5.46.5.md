# MusicVerse 0.5.46.5 — Widget dirapikan: warna bisa digeser, tanpa ukuran kembar, teks lebih besar, ada pratinjau

⚠️ Butuh **APK baru** (kode native, layout, dan manifest berubah).

## Masalah (dari pemakaian)
- Warna aksen tidak bisa digeser (hanya 8 titik warna + ketik hex).
- Layar atur widget jelek.
- Widget tidak punya gambar pratinjau di daftar widget peluncur.
- Ada dua widget berukuran sama: **Standar 4×1** dan **Strip 4×1**.
- Teks widget terlalu kecil (Strip 12/10 sp, Kotak 13/11 sp, sampul 32 dp).
- Daftar widget tidak diurutkan dari yang terkecil.

## Perubahan
**Warna bisa digeser** (`MusicVerseWidgetConfigActivity.java`)
- Tiga penggeser berlintasan gradien: **Rona**, **Saturasi**, **Kecerahan**, plus kolom hex dua arah dan 8 warna siap pakai. Pratinjau berubah langsung saat digeser.
- Penggeser memanggil `requestDisallowInterceptTouchEvent`, jadi seretan tidak dicuri ScrollView. Baris chip tidak lagi `HorizontalScrollView` (dibungkus ke baris berikutnya).

**Layar atur ditata ulang** (gaya gelap bersudut bulat ala Auralys: kartu per kelompok — Tema, Warna aksen, Bentuk, Teks dan latar, Tampilkan)
- Bilah **Batal / Simpan** tetap di bawah, tombol & chip tinggi 40–52 dp, teks 14–17 sp, saklar untuk "Tampilkan".

**Tanpa ukuran kembar**
- Widget **Standar 4×1** dihapus dari daftar widget (kembar dengan Strip 4×1). Kelas `MusicVerseWidget` tetap terdaftar di manifest **hanya** sebagai penerima tombol (tanpa `intent-filter`/`meta-data`). `setup-android.mjs` membuang entri Standar lama dari manifest yang sudah ada (idempoten, sudah diuji di manifest tiruan).
- Sisa lima bentuk: Mini 1×1, Strip 4×1, Kotak 2×2, Tinggi 2×3, Besar 4×2 (Auralys: 1×1, 4×1, 2×2, 2×4, 4×2).

**Urut dari terkecil**
- Label diberi awalan angka: `1 · Mini 1×1`, `2 · Strip 4×1`, `3 · Kotak 2×2`, `4 · Tinggi 2×3`, `5 · Besar 4×2`, dan receiver dideklarasikan dalam urutan itu. Peluncur yang mengurutkan menurut abjad pun tetap menampilkan urutan ini.

**Pratinjau di daftar widget**
- Tiap `widget_*_info.xml` kini punya `previewLayout` (Android 12+, memakai layout widget asli) dan `previewImage` (`drawable/widget_preview_*.xml`, vektor, untuk Android lama).
- Latar bawaan `widget_bg_*` diganti dari putih ke gelap dan sampul bawaan dipasang di layout, supaya `previewLayout` tidak tampak kosong (warna asli tetap diatur lewat `setColorFilter`).

**Teks dan tombol lebih besar**
| Bentuk | Judul/artis sebelumnya | Sekarang |
|---|---|---|
| Strip | 12 / 10 sp, sampul 32 dp | 15 / 12 sp, sampul 44 dp, tombol 38–42 dp |
| Kotak | 13 / 11 sp | 15 / 12 sp, sampul 64 dp |
| Tinggi | 14 / 12 sp | 16 / 13 sp |
| Besar | 16 / 13 sp | 18 / 14 sp |
Skala "Kecil" 0,88 → 0,93; "Besar" 1,18 → 1,2.

## Belum / batas
- **Belum dikompilasi dan diuji di perangkat/emulator** (tidak ada Android SDK di sini). Sintaks Java dicek dengan javac (hanya error simbol Android yang wajar), XML divalidasi, dan tes `WidgetColors` lulus.
- Widget Standar 4×1 yang sudah terpasang di layar utama akan hilang setelah pembaruan; pasang ulang sebagai Strip 4×1.
- Layar atur tidak meniru Auralys piksel-per-piksel (Auralys memakai Compose; yang diambil: kartu, chip, penggeser, bilah bawah).
- "Visual" di sini ditafsirkan sebagai pratinjau di daftar widget. Visualizer audio hidup (batang naik-turun) di widget belum ada: RemoteViews tidak bisa menganimasikan, dan datanya perlu jembatan dari `PlaybackService`.
