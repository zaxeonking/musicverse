# 🎵 MusicVerse 0.5.46.3

> Dibangun di atas 0.5.46 (rilis gabungan 0.5.44 → 0.5.62, lihat `CHANGES-0.5.46.md`). Isi: **widget layar utama lebih banyak + bisa diatur** dan **animasi tarik mini player ↔ pemutar penuh lebih halus**. Nomor versi aplikasi (`appVersion` di `package.json` dan APK): **0.5.46.3** (versionCode 54603).

⚠️ Butuh **APK baru** (kode native + manifest berubah, sidik jari native berubah, jadi pembaruan tampilan OTA lama tidak cocok).

---


## 🧩 Widget lebih banyak + bisa diatur
Terinspirasi widget Auralys (5 bentuk + layar atur). Sebelumnya MusicVerse hanya punya 1 widget (4×1) tanpa pengaturan.

## ✨ 6 bentuk widget
| Bentuk | Ukuran | Isi |
|---|---|---|
| Standar | 4×1 | sampul, judul, artis, ◀ ▶❚❚ ▶▶ (sama seperti sebelumnya) |
| Kotak | 2×2 | sampul + judul/artis di atas, tombol di bawah |
| Tinggi | 2×3 | sampul besar, judul/artis, tombol |
| Besar | 4×2 | sampul besar di kiri, judul/artis + tombol di kanan |
| Strip | 4×1 tipis | satu baris ringkas |
| Mini | 1×1 | hanya sampul + tombol putar/jeda |

Semua bentuk memakai satu aliran data dari `PlaybackService` (tidak ada polling) dan satu receiver perintah, jadi perilaku tombol sama di semua bentuk (termasuk "Putar" saat aplikasi tertutup).

## 🎛️ Bisa diatur per widget
Dibuka saat widget ditambahkan, dan lewat **tekan lama widget > Atur ulang** (Android 9+). Pratinjau langsung memakai RemoteViews yang sama dengan widget asli.
- **Tema**: Gelap, Terang, Kaca (transparan), Warna sampul, Warna aksen
- **Warna aksen**: 8 warna siap pakai, **warna sendiri (hex)**, atau **dari sampul** lagu yang sedang diputar
- **Sudut**: Kotak / Bulat / Pil
- **Bentuk sampul**: Bulat sudut / Lingkaran / Kotak
- **Tombol putar**: Terisi / Polos
- **Ukuran teks**: Kecil / Sedang / Besar
- **Keburaman latar**: 20–100%
- **Tampilkan**: sampul, nama artis, tombol Sebelumnya/Berikutnya
Pengaturan terakhir yang disimpan jadi bawaan untuk widget baru berikutnya. Pengaturan dihapus otomatis saat widget dihapus.

## 🔧 Berkas
- Baru: `MusicVerseWidget{Square,Tall,Large,Strip,Tiny}.java`, `MusicVerseWidgetConfig.java`, `MusicVerseWidgetConfigActivity.java`, `WidgetColors.java` (hitungan warna murni, ada tesnya), layout `widget_{square,tall,large,strip,tiny}.xml`, `res/xml/widget_*_info.xml`, `res/drawable/widget_bg_{square,round,pill}.xml`
- Diubah: `MusicVerseWidget.java` (kini mengurus semua bentuk), `widget_player.xml`, `widget_player_info.xml`, `scripts/setup-android.mjs` (receiver + layar atur; manifest lama otomatis ditambah, XML provider diisi appId), `AndroidManifest.additions.xml`
- Tes warna: lihat `native/android/test/README.md`

## ⚠️ Belum / batas
- ⚠️ Butuh **APK baru** (kode native + manifest berubah; sidik jari native ikut berubah).
- **Belum dikompilasi dan diuji di perangkat/emulator** (tidak ada Android SDK di lingkungan penyusunan). Yang sudah dicek: sintaks Java, XML valid, ID layout cocok dengan kode, `setup-android.mjs` idempoten di proyek tiruan, dan tes logika warna.
- Tema "Kaca" hanya transparan berwarna (RemoteViews tidak bisa blur).
- Tombol Suka (seperti Auralys) belum ada: perlu jembatan ke JS.
- Widget Mini tanpa teks; ukuran teks tidak berlaku di sana.

---


## 🎞️ Animasi tarik lebih halus
Dari rekaman layar: tarik full player ke bawah terasa patah di akhir, dan tarik mini player ke atas kurang mulus.

## Penyebab dan perbaikan
**Full player ditarik ke bawah lalu dilepas** (`FullPlayer.tsx`)
- Dulu: saat animasi tutup mulai, sisa seretan (turun + mengecil) dikembalikan ke posisi penuh lewat transisi, jadi seluruh kartu "membalik" naik sambil sampul terbang ke mini player, lalu latar menghilang. Itu yang tampak sebagai lompatan/kabur.
- Kini: kartu dibiarkan di posisi seretannya dan hanya memudar. Sampul terbang dari posisi TAMPAKNYA sekarang ke sampul mini (target dikonversi ke koordinat lokal kartu: kebalikan dari `translate + scale` seretan).
- Easing setelah seretan `EASE_DRAG_CLOSE` (cepat di awal, mengendap di akhir) supaya terasa melanjutkan gerak jari; latar mulai memudar lebih awal.

**Mini player ditarik ke atas lalu dilepas** (`MiniPlayer.tsx`, `services/flyOrigin.ts`)
- Dulu: kartu langsung memantul balik (spring) tepat saat pemutar penuh membaca posisi sampul, jadi titik awal terbang sampul tidak tentu dan terlihat melompat.
- Kini: posisi sampul dicatat tepat saat dilepas dan dipakai sebagai asal terbang; kartu kembali meluncur halus tanpa membal.

**Beban gambar per frame**
- `box-shadow` besar tidak lagi dianimasikan di keyframe terbang (digambar ulang tiap frame); bayangan statis di kelas sampul tetap. `will-change: transform` dipasang selama terbang.

## Belum / batas
- Belum diuji di perangkat (tidak ada emulator di lingkungan penyusunan); hanya typecheck bagian yang diubah.
- Gerak sampul saat seret masih lompat-sekali saat dilepas, belum "interaktif" mengikuti jari (sampul mengecil sebanding jarak seret). Itu perubahan lebih besar bila masih kurang.
- Penyetelan: `EASE_DRAG_CLOSE`, `CLOSE_MS` di `FullPlayer.tsx`; durasi `settleAfterOpen` di `MiniPlayer.tsx`.
