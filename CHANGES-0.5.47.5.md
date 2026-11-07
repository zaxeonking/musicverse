# 0.5.47.5

- Pratinjau widget di daftar widget peluncur sebelumnya kosong (hanya ikon aplikasi di kotak abu-abu). Penyebab: `previewImage` berupa
  vector drawable XML yang tidak dimuat banyak peluncur bawaan pabrikan, yang juga mengabaikan `previewLayout`.
- `drawable/widget_preview_*.xml` (vektor) diganti PNG `drawable-nodpi/widget_preview_*.png` (nama sama, `widget_*_info.xml` tidak berubah).
- Deskripsi rilis GitHub kini selalu dikosongkan (apk.yml tidak lagi membaca CHANGES-<versi>.md).

## Lirik layar penuh (mengikuti rekaman referensi)
- `FullPlayer.tsx`: mode layar penuh kini memakai baris ringkas: sampul kecil 48px + judul + artis (warna aksen) + tombol keluar layar penuh + menu "⋮".
  Daftar lirik naik sampai ke bawah status bar (tanpa padding atas), lalu memudar ke latar di bawah; bilah posisi tetap ada.
- `LyricsPanel.tsx`: prop `fullscreen` menambah padding status bar pada keterangan sumber lirik di atas daftar.
- Tombol hati disembunyikan di mode ini (ada di menu lagu). Slider volume pada video tidak dibuat: aplikasi tidak punya kontrol volume sistem.
- Belum dikompilasi/diuji di perangkat (hanya cek sintaks).

## Animasi lirik layar penuh
- Header, tombol transport, baris lirik/ulang/crossfade, dan bar "Berikutnya" kini menutup/membuka dengan halus (tinggi + pudar + geser, 500 ms) lewat komponen `Collapse` di `FullPlayer.tsx`, bukan hilang mendadak. Bagian yang tertutup diberi `inert` + `aria-hidden`.
- Baris judul ringkas masuk dengan animasi `fs-in` (pudar + naik + skala); kembali ke judul besar juga beranimasi. Padding atas ikut bertransisi.
- `LyricsPanel.tsx`: `ResizeObserver` menjaga baris aktif tetap di tengah selama tinggi daftar berubah.
- Semua animasi mati bila "kurangi gerakan" aktif (`motion-reduce`).

## Pratinjau widget (lanjutan) + layar atur widget
- ⚠️ Butuh **APK baru** (Java + resource native berubah). Pratinjau di daftar widget hanya muncul setelah APK 0.5.47 terpasang.
- `previewLayout` dihapus dari semua `widget_*_info.xml`: peluncur pabrikan memakainya lebih dulu lalu gagal dan jatuh ke kotak abu-abu + ikon app. Kini hanya `previewImage` (PNG) yang dipakai.
- `setup-android.mjs` membuang sisa `drawable/widget_preview_*.xml` (vektor lama) dari proyek android hasil build sebelumnya.
- Layar atur widget (`MusicVerseWidgetConfigActivity.java`): tema **hijau** (latar gelap kehijauan, aksen #1DB954, wallpaper pratinjau hijau),
  dan UI dikecilkan (judul/chip/saklar/penggeser lebih kecil, penggeser persen sebaris dengan namanya, tombol Selesai lebih tipis) supaya hampir semua terlihat tanpa menggulir.
- Warna aksen bawaan widget baru: hijau #1DB954 (widget yang sudah dipasang tetap memakai pilihannya).
- Belum dikompilasi/diuji di perangkat.

## Tombol kembali kaca gelap yang menempel
- Kelas baru `.back-glass` (`index.css`): tombol kembali kini **sticky** di atas area gulir (`<main>`), berbentuk pil kaca gelap + blur (`backdrop-filter`), bayangan, dan efek tekan.
  Saat halaman digulir, tombol ikut menempel di atas dan tetap terbaca di atas konten.
- Dipasang di 14 tombol kembali: halaman Cadangan, Unduhan, Equalizer, Pemutaran, Playlist, Pembaruan, Hukum, Riwayat, Rekap, Jelajah (Artis/Album), Playlist saya, dan panel pencarian artis.
- Belum dikompilasi/diuji di perangkat.

## Cari judul di Beranda: banyak hasil + "Terkait"
- Mencari judul lagu di Beranda tidak lagi hanya menampilkan 1 lagu. Hasil teratas (yang paling cocok) tetap di paling atas dengan judul bagian "Hasil teratas";
  di bawahnya ada pemisah dan bagian **"Terkait"** berisi sampai 9 kemungkinan lain dari pencarian Spotify (urut relevansi, tanpa duplikat).
- `plugins/spotifyImporter.ts`: `searchSpotifyTracks` (banyak hasil). `services/spotifyApi.ts`: `searchRelatedTracks` (gagal / web = daftar kosong, bukan galat).
- `PlaylistContext.tsx`: hasil teratas ditampilkan secepatnya; Terkait dicari bersamaan lalu menyusul (bagian muncul dengan animasi fade-in) tanpa menahan hasil teratas.
- `searchPlaylist.ts` + `types/spotify.ts`: `PlaylistDetail.related`. `PlaylistView.tsx`: bagian Terkait memakai `TrackList` (putar, swipe ke antrean, menu lagu seperti biasa).
- Terkait hanya ada di APK (pencarian Spotify langsung hanya tersedia di APK); di web hanya hasil teratas. Belum diuji di perangkat.

## Notifikasi pembaruan: kartu melayang di bawah
- `UpdateBanner.tsx` dibuat ulang: bukan lagi banner di bawah header, melainkan **kartu kaca gelap melayang di bawah** (di atas mini player bila ada, bila tidak di atas bilah navigasi), dengan ikon hijau-aksen, "Versi X tersedia", pesan status, tombol Perbarui/Pasang/Coba lagi, dan tombol tutup.
- Masuk dengan animasi naik + memudar, keluar dengan animasi turun; posisinya ikut bergeser halus saat mini player muncul/hilang/berubah ukuran.
- Saat mengunduh: ikon berputar, persen di pesan, dan bilah progres tipis di dasar kartu. Animasi mati bila "kurangi gerakan" aktif.
- Belum diuji di perangkat.

## Pengingat pembaruan muncul lagi saat aplikasi dibuka
- Menutup kartu pembaruan (X) kini hanya menyembunyikannya selama aplikasi itu hidup (variabel modul `dismissedThisRun` di `useAppUpdate.ts`), tidak lagi disimpan permanen.
  Saat aplikasi dibuka lagi (proses baru), kartunya muncul kembali selama versi baru belum dipasang. Pindah ke aplikasi lain lalu kembali tidak memunculkannya lagi.
