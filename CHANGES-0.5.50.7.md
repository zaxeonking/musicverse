# 0.5.50.7 (animasi premium: #1-#7 + Reduce Motion)

APK tidak perlu diganti (JS/CSS saja, bisa lewat OTA). appVersion 0.5.50.7 (versionCode 505007). Tur "Yang baru" ditambah satu langkah.

# Animasi premium (lanjutan): #3, #4, #5, #7

Hanya JS/CSS (bisa lewat OTA). Cek sintaks TypeScript lulus (tidak ada node_modules, jadi `tsc -b` penuh dan uji di perangkat belum dijalankan).
Tidak menyentuh: Mini Player -> Disc, BottomNav, playback/queue, warna, ukuran, tata letak. Reduce Motion tetap lewat aturan global di index.css (+ cek di hook).

## #3 Indikator equalizer
- `ui/PlayingBars.tsx`: tambah `CoverPlayingBadge` (overlay `absolute inset-0` di atas sampul, tidak mengubah ukuran baris).
- Dipasang di baris tanpa kolom nomor: Riwayat, Unduhan, Lokal. Playlist saya: ikon di atas sampul diganti batang saat aktif/jeda.
- Antrean: nomor di "Sedang diputar" diganti batang (kotak w-6 yang sama).
- Bergerak saat `playing`, diam di tinggi sedang saat `paused`, hilang saat lagu berpindah (mengikuti lagu aktif).

## #4 Hasil pencarian
- `.mv-swap` (index.css): fade opacity saja, 220 ms. Dipakai saat ganti kategori Lagu/Artis (HomePage) dan tab Lagu/Album/buka album (ArtistSearchPanel); kuncinya tampilan, bukan fase muat, jadi tidak berulang tiap mengetik.
- Stagger dan FLIP hasil pencarian di `TrackList` sudah ada dan tidak diubah.

## #5 Microinteraction
- Toast punya ikon kecil yang membal (`ToastTone`: added/removed/like/unlike). Dipasang di: suka/batal suka (geser), tambah ke antrean (geser + menu), hapus dari antrean, hapus dari playlist, mulai unduh, hapus unduhan.
- Pulse tombol saat status lagu berganti (`usePulse`) di baris Riwayat, Unduhan, Lokal, Playlist saya.
- Unduhan selesai: sampul baris baru membal sekali (hanya untuk lagu yang muncul setelah halaman terbuka).
- Playlist saya: hapus lagu = baris memudar + bergeser keluar 180 ms lalu dihapus; baris lain meluncur dengan pegas. Naik/turun juga meluncur, bukan melompat (`hooks/useListFlip.ts`).

## #7 Bottom sheet
- `utils/spring.ts`: easing pegas teredam (`linear()`), cadangan cubic-bezier bila tidak didukung. Lampauan < 0,2%.
- Masuk semua sheet: `--sheet-ease` / `--sheet-ms` (index.css, @supports) dipakai kelas `animate-sheet-up`; pegas kembali di `useSheetDrag` memakai easing yang sama.
- `useSheetDrag` kini juga dipasang di QueuePanel, TrackActionSheet, CrossfadeSheet, SleepTimerSheet, ManualSearchSheet (sebelumnya hanya yang lewat OverlayPortal). Resistance (karet) dan tutup-dengan-seret sama untuk semuanya.

## Batas
- Belum dicoba di perangkat. `linear()` perlu WebView Chrome 113+; di bawah itu otomatis kembali ke kurva lama.
- Penghapusan di Playlist saya ditunda 180 ms (hanya bila Reduce Motion mati).

# Lanjutan: #1 Shared element cover + Reduce Motion

## #1 Shared element transition sampul
- `services/coverOrigin.ts` (baru): baris daftar menandai thumbnail-nya (`data-cover-thumb`) tepat sebelum `openFullPlayer()`; FullPlayer mengambilnya sekali saat dipasang (kedaluwarsa 1,2 dtk, jadi buka lewat mini player/seretan tidak pernah memakai tanda lama).
- Dipasang di baris: playlist/Cari/hasil artis (`playlist/TrackRow`), Riwayat, Unduhan, Lokal. (Playlist saya tidak membuka pemutar penuh saat diketuk, jadi tidak ikut.)
- `FullPlayer.tsx`: titik awal sampul sekarang berurutan: (1) thumbnail daftar bila lagunya sama dan masih terlihat, (2) sampul mini player, (3) Disc Player (`[data-mini-disc]` di `MiniBubble`, sampul terbang ke/dari piringan bulat), (4) cadangan lama (membesar + memudar).
- Memakai mesin `progress` yang sama (satu pegas, transform), jadi seret-untuk-tutup tetap bersambung. Thumbnail sumber disembunyikan (`visibility`) selama sampul terbang dan tampil lagi saat kembali / saat FullPlayer dilepas.
- Radius sudut ikut berinterpolasi hanya untuk thumbnail dan disc (sumbernya bulat/persegi kecil); mini player biasa tetap radius tetap yang murah.
- Tutup dari posisi penuh: tujuan diukur ulang (kembali ke thumbnail yang sekarang, atau ke mini player/disc bila lagu sudah berganti). Tutup lewat seretan: tujuan dari saat dibuka dipertahankan supaya tidak melompat.

## Reduce Motion (audit)
- Sudah patuh: semua pemakai WAAPI (`useExitGhost`, `useSheetDrag`, `usePulse`, `useListFlip`, FLIP `TrackList`, `UpcomingList`, `MiniPlayer`, `MarqueeText`, tur), mesin pegas `playerSheet` (langsung selesai), gulir halus lirik, `PageTransition`, dan animasi CSS lewat aturan global.
- Celah yang diperbaiki: aturan global hanya memendekkan durasi, tapi jeda stagger (`animation-delay` 0–780 ms di `.mv-list`) tetap berjalan; karena fill-mode `backwards`, item daftar tetap tersembunyi selama jeda. Kini `animation-delay` dan `transition-delay` juga dinolkan.
- Dengan Reduce Motion: sampul langsung di posisi akhir (tanpa terbang), sheet muncul/tutup langsung, equalizer diam, FLIP/pulse/hapus-baris tanpa animasi, toast tanpa membal.
