# 0.5.47.8

- ⚠️ Pratinjau widget di daftar widget peluncur (resource native, `drawable-nodpi/widget_preview_*.png`) hanya muncul bila **APK** 0.5.47.5 atau lebih baru terpasang; update OTA tidak membawanya. Tidak ada perubahan kode widget di rilis ini.

## Perbaikan build
- `services/spotifyApi.ts`: `searchRelatedTracks` mengubah hasil `withImporterRetry` (`TrackMeta[] | null`) menjadi `[]` bila semua percobaan gagal. Memperbaiki galat TS2322 yang menggagalkan `tsc -b` di Vercel.

## Tombol Sebelumnya di notifikasi
- `NATIVE_PREVIOUS_DEPTH` 3 -> 20 (sama dengan `NATIVE_UPCOMING_DEPTH`): sampai 20 lagu sebelum lagu aktif diserahkan ke native untuk tombol Sebelumnya saat WebView beku.
- Lagu sebelumnya yang tautannya kedaluwarsa (> 90 menit) atau belum ada di cache kini di-resolve ulang di latar (satu per satu, dari yang terdekat), lalu diserahkan ulang ke native, bukan lagi menghentikan daftar. Gagal di-resolve = berhenti di situ, dicoba lagi saat lagu berganti.
- Perubahan sisi JS; terasa di HP setelah build baru.

## Tema (Pengaturan > Tema)
- Mode **Gelap / Terang / Otomatis** (ikut pengaturan sistem), 8 tema siap pakai di tiap mode.
- **Kustom**: aksen dan latar sendiri (slider + hex + aksen cepat); latar gelap dan terang disimpan terpisah, rentang latar dibatasi per mode supaya teks terbaca.
- **Bentuk sudut**: Tajam / Normal / Bulat (`--mv-radius`).
- **Aksen ikut sampul lagu** (opsional), dipasang oleh `ThemeAccentSync`.
- **Bagikan tema**: salin / tempel kode `MVT1.…`.
- Peralihan halus saat tema diganti; pemutar penuh tetap gelap (`.mv-dark-scope`).
- Warna kini variabel CSS (`--mv-*`); lapisan putih transparan jadi `veil` (putih di gelap, hitam di terang). Komponen baru: pakai `bg-veil/10`, bukan `bg-white/10`.
- File baru: `utils/theme.ts`, `hooks/useTheme.ts`, `components/settings/ColorField.tsx`, `components/player/ThemeAccentSync.tsx`, `pages/ThemeSettingsPage.tsx`.
- Belum dikompilasi penuh dan belum diuji di perangkat (hanya cek tipe sebagian dan hitungan kontras).
