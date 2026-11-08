# 0.5.50.3

## Gestur mini player: geser bawah = tutup musik, geser samping = jadi disc (bergulir)
Hanya JS (`MiniPlayer.tsx`), tidak butuh APK baru.

- **Geser ke bawah** pada kartu mini player kini **menutup musik**: kartu ikut jari, makin pudar mendekati titik lepas (getar kecil saat lewat), lalu tenggelam ke belakang nav dan pemutar dikosongkan (`cleanup()`: audio berhenti, state kosong). Titik lepas 96 px, atau lemparan cepat (> 0,7 px/ms setelah 40 px). Sebelumnya geser bawah = jadi disc.
- **Geser ke kiri/kanan** pada kartu = kartu **bergulir jadi disc** mengikuti jari:
  - bentuk kartu mengerut (clip-path) ke pojok sisi arah geser, kartu memudar di paruh akhir;
  - disc pratinjau berguling dari tengah kartu turun ke pojok sambil membesar dan berputar satu putaran penuh (mendarat di sudut 0, sama dengan disc asli);
  - melewati 42% jarak (atau dilempar searah) lalu dilepas = jadi disc dan **menempel di sisi arah geser** (geser kiri -> disc di kiri, kanan -> kanan; sisi tersimpan seperti biasa). Kurang dari itu = gulungan berbalik pelan ke kartu.
  - jarak penuh = 40% lebar dock, dibatasi 90-170 px.
- Geser ke atas (buka pemutar penuh) tidak berubah. Seek bar tetap tidak dibajak.
- Pegangan di atas kartu: ketukan tetap jadi disc (cadangan untuk keyboard/pembaca layar), teks bantuan diperbarui.
- `prefers-reduced-motion`: tanpa animasi, langsung jadi disc / tertutup.
- Belum diuji di perangkat dan belum dikompilasi penuh (tidak ada node_modules di lingkungan kerja; hanya cek sintaks). Angka jarak/durasi (`CLOSE_DISTANCE`, `ROLL_*` di atas berkas) tebakan, perlu disetel di HP.

## Glow tombol putar tidak lagi terpotong persegi
- `Collapse` di `FullPlayer.tsx` selalu `overflow-hidden`, jadi `box-shadow` tombol putar (xl) terpotong selebar barisnya dan terlihat seperti kotak. Kini pemotongan hanya aktif saat animasi buka/tutup; setelah terbuka penuh (520 ms) isi dibiarkan terlihat.

## Lirik tanpa waktu: sorotan perkiraan lebih adil
- `estimateActive` (`useLyricTiming.ts`, dipakai pemutar penuh dan mini player) tidak lagi membagi baris sama rata. Waktu tiap baris kini sebanding dengan panjangnya (kana/kanji/Hangul dihitung lebih berat per huruf, baris pendek mendapat minimal bobot 6). Intro ~6% dan outro ~8% tetap dilewati.
- Tetap hanya perkiraan: lirik polos memang tidak punya waktu asli. Diuji lewat Node pada contoh kecil, belum dicoba di perangkat.

## Tema terang: lebih nyaman di mata dan lebih rapi
Hanya JS/CSS (`utils/theme.ts`, `index.css`), tidak butuh APK baru.
- **Latar tidak lagi hampir putih**: `bgLight` semua preset diturunkan ke kecerahan ~0,92 (mis. hijau `#F5F7F5` -> `#ECEFEA`, Mono `#FFFFFF` -> `#EEEEEE`). Batas latar terang kustom jadi 0,86-0,95 (dulu 0,90-1,00), jadi putih murni pun otomatis dilembutkan.
- **Permukaan lebih terang dari latar** (sebelumnya lebih gelap -> abu-abu kusam): kartu, kolom, sheet, dan mini player kini campuran latar + putih (40% / 62%); hover sedikit lebih redup. Ditambah garis tipis 5% hitam supaya batasnya terbaca.
- **Teks bukan hitam pekat**: `#121212` -> `#1E2321`. Kontras tetap tinggi (ink/latar ~13,7:1; teks sekunder 6,2:1; teks samar 5,0:1, semua >= AA). Aksen di mode terang diminta kontras >= 3,8 (sebelumnya 3), jadi aksen pucat (oranye) dipekatkan.
- **Lapisan redup di belakang sheet** (`bg-black/60`) di layar terang jadi 40% abu kehijauan, bukan hitam 60% yang menyilaukan saat muncul.
- **Bayangan**: `shadow-black/xx` di mode terang diganti bayangan lembut; mini player dan disc dapat bayangan + garis tipis khusus terang.
- Pemutar penuh tetap gelap (`mv-dark-scope`), tidak terpengaruh.
- Dihitung lewat Node (kontras per preset). Belum dilihat di perangkat dan belum dikompilasi penuh; angka kecerahan/bayangan perlu dinilai langsung di HP.
