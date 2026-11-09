# 0.5.54.6 (Pengaturan Kurangi gerakan)

Files: src/utils/motion.ts (baru), src/pages/ThemeSettingsPage.tsx, src/pages/SettingsPage.tsx, src/main.tsx, src/index.css, tailwind.config.js, src/tour/steps.ts, src/tour/DemoStage.tsx, src/tour/TourHost.tsx, src/pages/MyPlaylistPage.tsx, src/services/playerSheet.ts, src/hooks/useExitGhost.ts, src/hooks/useSheetDrag.ts, src/hooks/usePulse.ts, src/hooks/useSwipeSelect.ts, src/hooks/useListFlip.ts, src/components/playlist/TrackList.tsx, src/components/ui/MarqueeText.tsx, src/components/layout/BottomNav.tsx, src/components/layout/PageTransition.tsx, src/components/home/HomeBanner.tsx, src/components/player/UpcomingList.tsx, src/components/player/MiniPlayer.tsx, src/components/player/KaraokeWords.tsx, src/components/player/LyricsPanel.tsx, package.json (appVersion 0.5.54.6), CHANGES.md (0.5.54.5 diarsipkan), CHANGES-0.5.54.6.md, PROJECT_STRUCTURE.md

1. Saklar Kurangi gerakan (Pengaturan > Tema > Gerakan)
   - Sebelumnya aplikasi hanya mengikuti preferensi sistem (`prefers-reduced-motion`). Kini ada saklar sendiri; efektifnya = saklar menyala ATAU sistem memintanya. Bila sistem yang memintanya, saklar terkunci menyala dan hintnya menjelaskan.
   - Bawaan MATI. Pilihan disimpan di `musicverse:reduce-motion:v1` (ikut tercermin ke berkas data APK seperti pengaturan lain).
   - `src/utils/motion.ts`: `prefersReducedMotion()` (dipakai semua kode JS animasi), `setReduceMotion`, `useReduceMotion`, `initMotion` (dipanggil di main.tsx sesudah penyimpanan dimuat). Kondisi efektif dicerminkan ke `html.reduce-motion`.
   - Semua `matchMedia('(prefers-reduced-motion: reduce)')` di kode diganti `prefersReducedMotion()` (seret sheet, pegas pemutar, mini player, banner, geser pilih, FLIP daftar, karaoke, marquee, tutorial, dll).
   - `index.css`: blok `@media (prefers-reduced-motion)` kini punya padanan `html.reduce-motion` (animasi/transisi dinolkan; kartu mini player tetap membuka).
   - `tailwind.config.js`: varian `motion-reduce:` didefinisikan ulang lewat plugin supaya juga aktif lewat `html.reduce-motion` (kelas `motion-reduce:*` yang sudah ada tidak perlu diubah).
   - Entri "Yang baru" 0.5.54.6 ditambahkan.

Catatan
- Tidak butuh APK baru (JS dan CSS saja; bisa lewat OTA).
- Belum dijalankan: lingkungan tanpa node_modules/jaringan, jadi `npm run typecheck` dan `npm run build` belum diuji. Jalankan keduanya sebelum rilis; periksa terutama bahwa kelas `motion-reduce:*` di CSS hasil build punya selektor `html.reduce-motion`.
