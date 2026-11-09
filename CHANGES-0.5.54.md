# 0.5.54 (Optimasi performa: kontrol pemutar tidak lagi render ulang tiap detik)

Files: src/context/AudioPlayerContext.tsx, src/hooks/useAudioPlayer.ts, src/components/player/PlayerControls.tsx, package.json (appVersion 0.5.54), CHANGES.md (0.5.53 diarsipkan), CHANGES-0.5.54.md, PROJECT_STRUCTURE.md

1. Render ulang kontrol transport
   - `TransportControls` (Prev/Play/Next di mini dan full player) sebelumnya membaca seluruh konteks waktu hanya untuk `seekable`, sehingga render ulang sekitar 4 kali per detik saat lagu diputar.
   - Kini `seekable` punya konteks sendiri (`PlaybackSeekableContext`, nilai boolean) dan hook `useSeekable()`. Komponen hanya render ulang saat nilainya berubah.
   - Tidak ada perubahan tampilan, animasi, efek, perilaku pemutaran, maupun logika bisnis.
