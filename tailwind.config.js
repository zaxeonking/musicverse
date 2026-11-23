import plugin from 'tailwindcss/plugin'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // Hover hanya aktif di perangkat yang benar-benar punya pointer hover (tidak "menempel" di layar sentuh).
  future: { hoverOnlyWhenSupported: true },
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--mv-bg, 18 18 18) / <alpha-value>)',
        card: 'rgb(var(--mv-card, 24 24 24) / <alpha-value>)',
        raised: {
          DEFAULT: 'rgb(var(--mv-raised, 36 36 36) / <alpha-value>)',
          hover: 'rgb(var(--mv-raised-hover, 46 46 46) / <alpha-value>)',
        },
        accent: {
          // Bisa ditimpa per area lewat variabel CSS --mv-accent ("r g b"), mis. pemutar penuh memakai warna sampul.
          DEFAULT: 'rgb(var(--mv-accent, 29 185 84) / <alpha-value>)',
          soft: 'rgb(var(--mv-accent-soft, 30 215 96) / <alpha-value>)',
          deep: 'rgb(var(--mv-accent-deep, 22 156 70) / <alpha-value>)',
          // Warna teks/ikon di atas latar aksen (hitam atau putih, mengikuti terang-gelapnya aksen).
          on: 'rgb(var(--mv-on-accent, 0 0 0) / <alpha-value>)',
        },
        ink: {
          DEFAULT: 'rgb(var(--mv-ink, 255 255 255) / <alpha-value>)',
          muted: 'rgb(var(--mv-ink-muted, 167 167 167) / <alpha-value>)',
          // Dinaikkan dari #6a6a6a (±3.3:1) agar teks sekunder lolos kontras AA (≥4.5:1) di atas bg/card.
          faint: 'rgb(var(--mv-ink-faint, 138 138 138) / <alpha-value>)',
        },
        // Aksen kedua MusicVerse (Coral Orange): titik hidup, penanda aktif, tombol putar.
        coral: {
          DEFAULT: 'rgb(var(--mv-coral, 255 118 87) / <alpha-value>)',
        },
        danger: {
          DEFAULT: 'rgb(var(--mv-danger, 255 107 107) / <alpha-value>)',
          on: 'rgb(var(--mv-on-danger, 0 0 0) / <alpha-value>)',
        },
        // Lapisan transparan di atas permukaan (hover, tekan, garis tipis): putih di mode gelap, hitam di mode terang.
        veil: 'rgb(var(--mv-veil, 255 255 255) / <alpha-value>)',
        // Halaman web (landing, privasi, ketentuan). Tema gelap: arang netral dengan permukaan bertingkat, aksen hijau MusicVerse.
        site: {
          fog: '#111111',
          paper: '#181818',
          raise: '#212121',
          ink: '#F3F3F1',
          slate: '#A6A6A2',
          green: '#1DB954',
          line: 'rgba(255,255,255,0.12)',
        },
        line: 'rgb(var(--mv-veil, 255 255 255) / 0.08)',
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
      // Bentuk sudut bisa diubah di Pengaturan > Tema (--mv-radius: 0,3 tajam, 1 normal, 1,6 bulat). `full` tidak ikut berubah.
      borderRadius: {
        md: 'calc(0.375rem * var(--mv-radius, 1))',
        lg: 'calc(0.5rem * var(--mv-radius, 1))',
        xl: 'calc(0.75rem * var(--mv-radius, 1))',
        '2xl': 'calc(1rem * var(--mv-radius, 1))',
        '3xl': 'calc(1.5rem * var(--mv-radius, 1))',
      },
      // Skala radius: kontrol = full, permukaan/kartu = lg, thumbnail & baris = md, sheet = 2xl (atas saja).
      boxShadow: {
        now: 'inset 3px 0 0 0 rgb(var(--mv-accent, 29 185 84))',
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
        // Disc -> kartu: kartu dibuka dari lingkaran 56px di pojok disc ke bentuk penuh (kebalikan gerakan mengerut).
        // -48px di ujung = tidak memotong apa pun, jadi bayangan kartu tetap utuh setelah animasi selesai.
        'card-from-right': {
          '0%': { clipPath: 'inset(calc(100% - 72px) 0px 0px calc(100% - 72px) round 36px)', opacity: '0.4' },
          '35%': { opacity: '1' },
          '100%': { clipPath: 'inset(-48px -48px -48px -48px round 24px)', opacity: '1' },
        },
        'card-from-left': {
          '0%': { clipPath: 'inset(calc(100% - 72px) calc(100% - 72px) 0px 0px round 36px)', opacity: '0.4' },
          '35%': { opacity: '1' },
          '100%': { clipPath: 'inset(-48px -48px -48px -48px round 24px)', opacity: '1' },
        },
        // Disc yang muncul setelah kartu tenggelam ke belakang nav: naik sedikit dari arah nav sambil membesar, lalu mengendap.
        // Disc yang muncul di bawah kartu yang sedang mengerut: hanya memudar masuk dan mengendap dari sedikit lebih kecil.
        'bubble-morph': {
          from: { opacity: '0', transform: 'scale(0.72)' },
          '45%': { opacity: '1' },
          to: { opacity: '1', transform: 'none' },
        },
        // Riak halus di sekeliling disc yang baru jadi: membesar sedikit sambil memudar.
        'disc-halo': {
          from: { opacity: '0.6', transform: 'scale(1)' },
          to: { opacity: '0', transform: 'scale(1.45)' },
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
        // Cincin yang melebar dari tombol putar utama (transform + opacity saja).
        'play-ring': { from: { opacity: '0.55', transform: 'scale(1)' }, to: { opacity: '0', transform: 'scale(1.55)' } },
        disc: { to: { transform: 'rotate(360deg)' } },
        'sheet-up': { from: { transform: 'translateY(100%)' }, to: { transform: 'none' } },
        'lyrics-up': { from: { opacity: '0', transform: 'translateY(100%)' }, to: { opacity: '1', transform: 'none' } },
        'panel-in': { from: { transform: 'translateX(100%)' }, to: { transform: 'none' } },
        'fs-in': { from: { opacity: '0', transform: 'translateY(14px) scale(0.97)' }, to: { opacity: '1', transform: 'none' } },
        shimmer: { from: { backgroundPosition: '200% 0' }, to: { backgroundPosition: '-200% 0' } },
      },
      animation: {
        'fade-in': 'fade-in 220ms ease-out both',
        'page-in': 'page-in 200ms ease-out both',
        'player-up': 'player-up 220ms ease-out both',
        'glow-pulse': 'glow-pulse 1400ms ease-out backwards',
        'card-from-right': 'card-from-right 460ms cubic-bezier(0.32, 0.72, 0, 1) both',
        'card-from-left': 'card-from-left 460ms cubic-bezier(0.32, 0.72, 0, 1) both',
        'bubble-morph': 'bubble-morph 340ms cubic-bezier(0.34, 1.3, 0.64, 1) both',
        'disc-halo': 'disc-halo 720ms cubic-bezier(0.22, 1, 0.36, 1) 120ms both',
        'bubble-in': 'bubble-in 300ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'bubble-rise': 'bubble-rise 380ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'sheet-expand': 'sheet-expand 420ms cubic-bezier(0.22, 1, 0.36, 1) both',
        pop: 'pop 260ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
        disc: 'disc 18s linear infinite',
        eq: 'eq 1.1s ease-in-out infinite',
        'play-ring': 'play-ring 2.4s cubic-bezier(0.22, 1, 0.36, 1) infinite',
        'sheet-up': 'sheet-up var(--sheet-ms, 340ms) var(--sheet-ease, cubic-bezier(0.32, 0.72, 0, 1)) both',
        'lyrics-up': 'lyrics-up 380ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'panel-in': 'panel-in 240ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'fs-in': 'fs-in 480ms cubic-bezier(0.22, 1, 0.36, 1) both',
        shimmer: 'shimmer 1.6s linear infinite',
      },
    },
  },
  plugins: [
    // `motion-reduce:` berlaku bila sistem meminta kurangi gerakan ATAU saklar Pengaturan > Tema menyalakan html.reduce-motion (src/utils/motion.ts).
    plugin(({ addVariant }) => {
      addVariant('motion-reduce', ['@media (prefers-reduced-motion: reduce)', 'html.reduce-motion &'])
    }),
  ],
}
