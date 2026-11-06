# 0.5.20 — Folder "Lokal" di Unduhan: semua audio di HP, terpisah dari unduhan MusicVerse
## Folder Lokal
- Tab Unduhan sekarang punya folder **Lokal** yang selalu paling atas (di atas semua playlist dan "Lagu satuan"). Isinya semua audio di HP, KECUALI milik MusicVerse sendiri supaya tidak tercampur: unduhan di `Android/data/<paket>/files/download`, salinan di `Music/MusicVerse/`, dan berkas yang pemiliknya aplikasi ini.
- Folder ini tidak bisa dihapus: tidak ada tombol hapus, hanya tombol pindai ulang. Lagu di dalamnya juga tidak punya aksi hapus/unduh (berkasnya bukan milik MusicVerse; aplikasi hanya MEMBACA, tidak mengubah atau menghapus apa pun).
- Nada dering, nada notifikasi, dan alarm tidak dihitung. Audio lain (termasuk rekaman dan pesan suara) ikut tampil.
- Diurutkan A-Z menurut judul. Default tertutup; dibuka bertahap 100 lagu sekali tampil (daftar bisa ribuan). Sampul diambil dari tag lagu / thumbnail sistem, disimpan di cache aplikasi.
- Ketuk memutar langsung dari berkasnya (tanpa internet, tanpa proxy, tanpa pencarian YouTube); tahan lama membuka menu lagu (antrean, tambah ke playlist). Seluruh daftar Lokal menjadi antrean saat satu lagu diputar.
## Izin
- Android 13+: `READ_MEDIA_AUDIO`; Android 12 ke bawah: `READ_EXTERNAL_STORAGE` (maxSdkVersion 32). Ditambahkan otomatis oleh `scripts/setup-android.mjs`.
- Dialog izin muncul otomatis SEKALI saat Unduhan pertama kali dibuka. Bila ditolak, folder Lokal menampilkan tombol "Izinkan akses"; bila ditolak permanen, tombolnya menjadi "Buka pengaturan".
- Dipindai saat Unduhan dibuka dan saat aplikasi kembali aktif (paling cepat tiap 5 dtk), jadi lagu baru dan perubahan izin langsung terbaca.
## Detail teknis
- Native: `LocalAudioScanner.java` (kueri MediaStore + sampul), metode baru di `MusicVerseNativePlugin.java`: `localAudioPermission`, `requestLocalAudioPermission`, `scanLocalAudio`, `localAudioCover`, `openAppSettings`.
- JS: `src/native/localMusic.ts` (penyimpanan di memori + hook + pemutaran), `src/utils/localTrack.ts`, `src/components/library/LocalFolder.tsx`.
- Lagu lokal memakai `url` = `local:<id MediaStore>` dan kunci `lc-<id>` (`trackKey`), sehingga tidak pernah tertukar dengan unduhan yang judulnya sama. `fetchPlaybackInfo` memutarnya lewat `content://media/external/audio/media/<id>` (sumber `local`), melewati pemeriksaan klip. `downloadTrack(s)` dan `useTrackAvailability` menganggapnya sudah ada.
- Sampul: `cache/localcovers/<id>.jpg`; folder cache bisa dibersihkan sistem kapan saja dan dibuat ulang saat dibutuhkan.
## Catatan
- Ada perubahan native + manifest: **butuh APK baru** (bukan OTA). APK lama yang menerima pembaruan JS menampilkan "Butuh APK terbaru" di folder Lokal (metode native tidak ada).
- Belum dijalankan: `npm run typecheck`/`build` (tanpa node_modules di sini; tsc parsial hanya mengeluh soal tipe React/Capacitor yang belum terpasang), kompilasi Java, dan uji di perangkat.
