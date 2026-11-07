# MusicVerse 0.4.1 — penyelesaian unduhan ala StreamBeats

## Apa
Pengunduh native (0.3.7) sudah meniru StreamBeats dalam hal `.part`, resume lewat Range, antrean tersimpan, dan jeda setelah
restart. Yang belum: StreamBeats memeriksa ISI berkas, menyematkan tag + sampul ke dalamnya, dan memberi ekstensi yang benar.
Sekarang MusicVerse juga:

- **Cek isi berkas** (`AudioFinalizer.sniff`): wadah dikenali dari byte (M4A, MP3, AAC, OGG, FLAC, WebM, WAV). Halaman error
  HTML/JSON yang tersimpan sebagai "lagu" ditolak dan sumbernya dilewati (sama seperti ketidakcocokan durasi).
- **Ekstensi sesuai isi**: unduhan baru bernama `<kunci>.m4a` / `.mp3` / dst., tidak lagi semuanya `.mp3`. Unduhan lama tetap
  `.mp3` dan tetap terbaca (indeks, pemulihan dari folder, dan pemutaran menerima semua ekstensi di atas).
- **Tag + sampul di dalam berkas** (padanan `lofty`): judul, artis, album, dan gambar sampul (JPEG/PNG) disematkan ke M4A
  (kotak `udta/meta/ilst`, termasuk MP4 fragmented ala YouTube) dan MP3 (ID3v2.4, tag lama diganti). Offset `stco/co64`
  digeser bila `moov` ada di depan; `mfra` dibuang karena offsetnya jadi basi. Wadah lain (OGG, FLAC, WebM, WAV) dibiarkan
  apa adanya, bukan dianggap gagal.
- **Penyelesaian di native** (`finalizeDownload`): tag, ganti nama atomik `.part` -> nama akhir, lalu metadata (`download/meta`)
  ditulis native sebelum JS dipanggil kembali. Aplikasi yang mati di tengah jalan tidak meninggalkan lagu tanpa catatan.
- **Salin ke folder Musik** (Pengaturan > Unduhan, default mati): salinan `Artis - Judul.ext` ke `Music/MusicVerse` lewat
  MediaStore (Android 10+) agar tampil di pemutar musik dan pengelola berkas lain. Saat dinyalakan, lagu yang sudah diunduh ikut
  disalin di latar belakang; yang sudah pernah disalin dilewati.

## Berkas
- Baru: `AudioFinalizer.java` (murni Java), `MediaExporter.java`.
- `MusicVerseNativePlugin.java`: `inspectDownload`, `finalizeDownload`, `exportDownload`.
- `musicVerseNative.ts`, `offline.ts` (ekstensi + state `exportMusic`), `downloads.ts`, `DownloadSettingsPage.tsx`.

## Pengujian
`AudioFinalizer` diuji dengan berkas asli buatan ffmpeg: M4A moov-di-akhir, M4A faststart (moov di depan), M4A fragmented
dengan sidx+mfra, MP3 dengan dan tanpa ID3 lama, serta OGG/WebM/HTML. Hasilnya diperiksa dengan ffprobe/ffmpeg: tag + sampul
terbaca, durasi sama, checksum audio hasil dekode identik dengan aslinya, dan seek tetap jalan. Kode Java berbasis Android
(`MediaExporter`, tiga metode plugin) hanya diuji kompilasi terhadap stub API; belum dijalankan di perangkat.

## Batas
- Antrean masih di JS (bukan di layanan native seperti manajer Rust StreamBeats); lihat catatan di `downloads.ts`.
- Unduhan lama (`.mp3` berisi M4A) tidak ditulis ulang; hanya unduhan baru yang bertag.
- Tidak ada pilihan kualitas unduhan.

## Perlu build ulang APK (ada perubahan Java).
