# 0.5.44 — Radio otomatis + "Mulai radio dari lagu ini"
## Cara kerja (keterangan)
- **Radio otomatis** (Pengaturan > Pemutaran, APK, **mati secara bawaan**): saat lagu yang tersisa di antrean setelah lagu aktif tinggal 1 atau kurang, app mencari lagu mirip dan **menambahkannya di akhir antrean** (15 lagu per isi ulang). Antrean yang sudah ada tidak diubah.
- **Mulai radio dari lagu ini** (menu lagu, di mana saja, termasuk web): memutar lagu itu, **mengganti antrean**, lalu mengisinya dengan lagu mirip. Radio ini terus diisi ulang sampai pengguna memutar lagu di luar radio.
- **Sumber "lagu mirip":**
  1. Online (hanya APK, sama seperti pencarian artis): artis utama lagu dicari di Deezer, lalu diambil *radio artis* Deezer (`/artist/{id}/radio`): campuran lagu artis itu dan artis serupa pilihan Deezer. Diacak, lagu yang sudah ada di antrean dibuang.
  2. Cadangan (web, tanpa internet, atau Deezer gagal): lagu dari **Riwayat**, artis yang sama didahulukan. Bila Riwayat kosong, tidak ada yang ditambahkan (tampil pemberitahuan pada radio yang dimulai manual).
- Lagu radio diputar lewat jalur yang sama dengan lagu lain (judul + artis dicocokkan ke sumber audio), jadi sesekali bisa gagal atau salah cocok seperti lagu hasil pencarian.
## Batasan
- Radio tidak aktif saat mode ulang "satu lagu" atau saat "berhenti setelah lagu ini" (sleep timer).
- Isi ulang berjalan di latar saat lagu masih diputar. Bila pencarian lebih lama dari sisa lagu terakhir (internet sangat lambat), lagu terakhir bisa selesai dulu dan lagu tambahan baru masuk daftar "Berikutnya" tanpa langsung diputar.
- Saklar otomatis hanya ada di APK (halaman Pemutaran hanya di APK). Di web radio hanya lewat menu lagu dan memakai Riwayat.
- Lagu radio tidak diberi penanda khusus di daftar antrean.
## Teknis
- File baru: `services/radio.ts`, `components/player/AutoRadioSync.tsx` (dipasang di `App.tsx` setelah `AutoResumeSync`).
- Diubah: `services/artistApi.ts` (`fetchArtistRadio`, pemetaan baris Deezer dipisah jadi `mapDeezerRows`), `components/player/TrackMenuSheet.tsx`, `pages/PlaybackSettingsPage.tsx`.
- Memakai `addToQueue(track, { fromSearch: true })` yang sudah ada, jadi sinkron antrean native ikut jalan seperti biasa.
- Hanya JS (OTA). Belum dibuild atau diuji di perangkat; hanya sintaks yang dicek.
