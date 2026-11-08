# Animasi premium — catatan pekerjaan yang belum selesai

Dibuat setelah tahap 1–3 (lihat zip `musicverse-0_5_50_4-flicker-fix`). Semua perubahan sebelumnya **belum diuji di perangkat** (hanya cek tipe), jadi bagian "Uji dulu" di bawah sebaiknya dijalankan sebelum melanjutkan.

## Sistem animasi yang dipakai (jangan buat yang baru)

Tanpa library. CSS keyframes + variabel easing (`--ease`, `--ease-spring`, `--ease-hero` di `index.css`), kelas `mv-in` / `mv-list` / `mv-pop` / `mv-rise`, `Presence`, `useExitGhost`, WAAPI (`element.animate`), dan `services/playerSheet.ts` untuk pemutar penuh. Hormati Reduce Motion: CSS sudah dimatikan global di `index.css`, tetapi **animasi WAAPI/inline harus dicek manual** (`matchMedia('(prefers-reduced-motion: reduce)')`). Hindari `animation` inline untuk nama animasi, karena mengalahkan `motion-reduce:animate-none`.

## Belum dikerjakan

### 1. Shared element cover (daftar → Full Player → Disc) — risiko tertinggi
- Fondasi ada: `FullPlayer.tsx` sudah menggerakkan cover dari `[data-mini-cover]` (kartu mini) ke cover penuh lewat `measureGeometry` / `renderSheet` (sekitar baris 38–330).
- Yang belum: asal dari **thumbnail baris lagu** (`TrackRow` memanggil `openFullPlayer()` saat diketuk) dan tujuan ke **Disc**.
- Pendekatan yang disarankan: simpan `getBoundingClientRect()` thumbnail yang diketuk di store kecil (mis. di `PlayerUiContext` atau `services/playerSheet.ts`), lalu baca di `FullPlayer` sebagai pengganti `[data-mini-cover]` bila ada. Bentuk dasar: FLIP (translate + scale) pada cover penuh.
- Risiko: bentrok dengan `renderSheet` (progress seretan), dengan transisi Mini Player → Disc yang baru diperbaiki (`MiniPlayer.tsx`), dan thumbnail yang bergulir/terpotong di daftar. Jangan sentuh `flyToBubble`, `stopLeave`, `commitRoll`.
- Untuk Disc: cover disc (`MiniBubble.tsx`) memakai `CoverArt instant`; jangan ubah itu.

### 2. Download berhasil
- Belum ada umpan balik selain toast. Perlu dicari tempat status unduhan tampil (`DownloadsSection.tsx`, `TrackMenuSheet.tsx`, `useAudioPlayerController.ts`).
- Pakai `usePulse` (`hooks/usePulse.ts`) pada ikon/penanda unduhan saat statusnya berubah ke selesai.

### 3. Kategori pencarian
- `SearchPage.tsx` hanya punya filter teks (`TrackList` terkontrol). Tidak ditemukan kategori. Periksa `ArtistSearchPanel.tsx` / `BrowsePage.tsx` / `ArtistList.tsx` bila kategori yang dimaksud ada di sana.
- Pastikan pergantian kategori tidak me-remount `ul` (akan memicu stagger awal dan kedip).

### 4. Seret-untuk-tutup di `QueuePanel`
- `QueuePanel.tsx` memakai `useExitGhost()` sendiri, **bukan** `OverlayPortal`, jadi `useSheetDrag` belum berlaku.
- Pasang `useSheetDrag(exitRef)` di sana. Waspadai handle reorder (`touch-none`, sudah dikecualikan oleh `ownsGesture`) dan layout panel samping desktop (sudah dilewati di ≥1024px).

### 5. Indikator equalizer di daftar lain
- `PlayingBars` (`components/ui/PlayingBars.tsx`) baru dipakai di `playlist/TrackRow.tsx`.
- Belum di `library/LocalFolder.tsx` dan `library/DownloadsSection.tsx` (keduanya masih memakai ikon `PauseLines` / `Play` untuk status). Pasang tanpa mengubah lebar kolom.

### 6. Reorder antrean — penyempurnaan opsional
- Haptic saat melewati slot, dan feedback bayangan saat dilepas.
- Verifikasi di perangkat bahwa urutan antrean sampai ke daftar dalam render yang sama dengan pelepasan (lihat "Uji dulu").

## Uji dulu (sudah dikode, belum dicoba)

| Fitur | File | Yang diuji |
|---|---|---|
| Flicker Mini Player → Disc | `MiniPlayer.tsx`, `MiniBubble.tsx`, `CoverArt.tsx` | Ketuk pegangan kartu dan geser samping: disc muncul dengan sampul langsung terisi, tanpa kedip/glow nyala sesaat |
| Crossfade cover | `CoverArt.tsx` (`crossfade`), `FullPlayer.tsx`, `MiniPlayer.tsx` | Ganti lagu: cover lama bertahan sampai yang baru siap; internet lambat tidak menampilkan latar kosong |
| Seret sheet | `hooks/useSheetDrag.ts`, `OverlayPortal.tsx`, `useExitGhost.ts` | Seret dari judul; daftar di dalam sheet tetap bisa digulir; tombol tetap bisa diketuk setelah menyeret; animasi keluar lanjut dari posisi jari |
| Reorder antrean | `UpcomingList.tsx` | Urutan akhir benar; baris meluncur ke slot (bukan melompat). Jika urutan baru terlambat >0,6 dtk, baris melompat seperti dulu |
| Animasi daftar Cari | `TrackList.tsx`, `TrackRow.tsx`, `index.css` | Mengetik cepat: baris lama tenang, baris baru masuk cepat; tidak ada daftar berkedip |
| Pulse | `hooks/usePulse.ts`, `TrackRow.tsx`, `PlayerControls.tsx` | Tidak membal saat daftar pertama dimuat; membal saat tambah/hapus playlist, ganti status, ubah antrean |
| Equalizer | `PlayingBars.tsx`, `TrackRow.tsx` | Bergerak saat playing, diam saat pause, tidak menggeser baris; diam saat Reduce Motion |

## Batasan yang harus tetap dijaga
Tidak mengubah desain/warna/ukuran, Liquid Glass Bottom Navigation, sistem playback/antrean/playlist/gesture, dan transisi Mini Player → Disc kecuali untuk kompatibilitas.
