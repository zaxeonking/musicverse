# Redesign MusicVerse — Immersive Music Experience

Identitas: Electric Violet `#8B5CF6` + Coral Orange `#FF7657` di atas `#0B0B10` (surface `#15151D`, elevated `#20202B`
diturunkan otomatis oleh sistem tema yang sudah ada, jadi tema terang/gelap dan pilihan aksen pengguna tetap bekerja).

## File baru
- `src/components/ui/Waveform.tsx` — gelombang audio kecil (hanya `transform`).
- `src/components/home/HomeMood.tsx` — grid suasana asimetris (Chill, Focus, Night Drive, Energetic, Heartbreak).
- `src/components/home/HomeArtists.tsx` — sorotan artis.

## File diubah
- `src/utils/theme.ts` — preset `verse` (bawaan baru; pilihan tersimpan pengguna lama tidak berubah).
- `tailwind.config.js`, `src/index.css`, `index.html` — warna `coral`, animasi `play-ring`, `.mv-art`, theme-color.
- `src/components/ui/Logo.tsx` — lambang "orbit suara" + wordmark.
- `src/components/home/HomeHeader.tsx`, `HomeBanner.tsx`, `HomeCards.tsx`, `HomeShelf.tsx`, `HomeSections.tsx`, `HomeRecently.tsx`
- `src/pages/HomePage.tsx`
- `src/config/moods.ts` (mood Night Drive + `HOME_MOODS`), `src/config/homeShelves.ts` (`layout` per deretan), `src/config/navigation.ts` (label/ikon)
- `src/components/layout/BottomNav.tsx` — hanya gaya; logika gestur/pegas tidak diubah.
- `src/components/player/MiniPlayer.tsx` — hanya gaya + gelombang; logika drag/disc/playback tidak diubah.
- `src/tour/*` — teks tutorial disesuaikan dengan label tab baru (Jelajah, Pustaka).
