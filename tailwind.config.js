/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // Hover hanya aktif di perangkat yang benar-benar punya pointer hover (tidak "menempel" di layar sentuh).
  future: { hoverOnlyWhenSupported: true },
  theme: {
    extend: {
      colors: {
        bg: '#121212',
        card: '#181818',
        raised: { DEFAULT: '#242424', hover: '#2e2e2e' },
        accent: {
          DEFAULT: '#1DB954',
          soft: '#1ed760',
          deep: '#169c46',
        },
        ink: {
          DEFAULT: '#ffffff',
          muted: '#a7a7a7',
          // Dinaikkan dari #6a6a6a (±3.3:1) agar teks sekunder lolos kontras AA (≥4.5:1) di atas bg/card.
          faint: '#8a8a8a',
        },
        danger: '#ff6b6b',
        // Halaman web (landing, privasi, ketentuan). Terang, supaya aplikasi gelap di dalamnya jadi satu-satunya benda pekat.
        site: {
          fog: '#E8EDEE',
          paper: '#F5F8F8',
          ink: '#11181B',
          slate: '#47565C',
          green: '#0A6E31',
          line: 'rgba(17,24,27,0.14)',
        },
        line: 'rgba(255,255,255,0.08)',
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['"DM Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        // Teks bacaan di halaman web (dimuat hanya di situs, bukan di APK).
        reading: ['Newsreader', 'Georgia', 'Cambria', 'serif'],
      },
      spacing: {
        sidebar: '17rem',
      },
      // Skala radius: kontrol = full, permukaan/kartu = lg, thumbnail & baris = md, sheet = 2xl (atas saja).
      boxShadow: {
        now: 'inset 3px 0 0 0 #1DB954',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'page-in': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'none' },
        },
        'glow-pulse': {
          from: { opacity: '0' },
          '25%': { opacity: '1' },
          to: { opacity: '0.6' },
        },
        'player-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'none' },
        },
        'grow-right': {
          from: { opacity: '0', transform: 'translate3d(42%, 0, 0) scale(0.18)' },
          to: { opacity: '1', transform: 'none' },
        },
        'grow-left': {
          from: { opacity: '0', transform: 'translate3d(-42%, 0, 0) scale(0.18)' },
          to: { opacity: '1', transform: 'none' },
        },
        'bubble-in': {
          from: { opacity: '0', transform: 'scale(0.3)' },
          to: { opacity: '1', transform: 'none' },
        },
        // Disc yang muncul setelah keyboard selesai naik: naik pelan dari bawah sambil membesar.
        // Jarak awal (`--rise-from`) = posisi kartu di belakang keyboard; disc naik dari sana ke atas keyboard.
        'bubble-rise': {
          from: { opacity: '0', transform: 'translate3d(0, var(--rise-from, 28px), 0) scale(0.6)' },
          '30%': { opacity: '1' },
          to: { opacity: '1', transform: 'none' },
        },
        'sheet-expand': {
          '0%': { transform: 'translateY(100%) scale(0.94)', opacity: '0.4', borderRadius: '28px' },
          '60%': { opacity: '1' },
          '100%': { transform: 'none', opacity: '1', borderRadius: '0px' },
        },
        // Ikon centang/daftar yang baru berganti di picker playlist: membal kecil supaya perubahannya terasa.
        pop: { '0%': { transform: 'scale(0.4)', opacity: '0.4' }, '60%': { transform: 'scale(1.25)', opacity: '1' }, '100%': { transform: 'none', opacity: '1' } },
        eq: { '0%, 100%': { transform: 'scaleY(0.4)' }, '50%': { transform: 'scaleY(1)' } },
        disc: { to: { transform: 'rotate(360deg)' } },
        'sheet-up': { from: { transform: 'translateY(100%)' }, to: { transform: 'none' } },
        'lyrics-up': { from: { opacity: '0', transform: 'translateY(100%)' }, to: { opacity: '1', transform: 'none' } },
        'panel-in': { from: { transform: 'translateX(100%)' }, to: { transform: 'none' } },
        shimmer: { from: { backgroundPosition: '200% 0' }, to: { backgroundPosition: '-200% 0' } },
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out both',
        'page-in': 'page-in 200ms ease-out both',
        'player-up': 'player-up 220ms ease-out both',
        'glow-pulse': 'glow-pulse 1400ms ease-out backwards',
        'grow-right': 'grow-right 340ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'grow-left': 'grow-left 340ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'bubble-in': 'bubble-in 300ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'bubble-rise': 'bubble-rise 380ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'sheet-expand': 'sheet-expand 420ms cubic-bezier(0.22, 1, 0.36, 1) both',
        pop: 'pop 260ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
        disc: 'disc 18s linear infinite',
        eq: 'eq 1.1s ease-in-out infinite',
        'sheet-up': 'sheet-up 240ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'lyrics-up': 'lyrics-up 380ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'panel-in': 'panel-in 240ms cubic-bezier(0.22, 1, 0.36, 1) both',
        shimmer: 'shimmer 1.6s linear infinite',
      },
    },
  },
  plugins: [],
}
