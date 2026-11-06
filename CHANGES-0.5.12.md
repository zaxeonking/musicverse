# 0.5.12 — Penerapan aturan antislop-ui + gutter responsif

Dihapus (R-10, R-12, R-13, R-19):
- BottomNav: kaca cair, kilau gradien, glow radial hijau, tumpukan inset-shadow -> bar solid + penanda aktif datar.
- MiniPlayer: blur 40px, glow warna sampul yang berdenyut, bayangan inset -> kartu solid. Hook useCoverGlow ikut dihapus.
- MiniBubble: blur dan sheen conic-gradient. MobileHeader: backdrop-blur.
- PlaylistHeader: orb sampul blur-3xl di belakang header.
- FullPlayer: glow putih tombol putar, blur bar "Berikutnya", teks artis uppercase.
- Bayangan besar (shadow-lg/xl/2xl) pada setiap sampul dan sheet; bayangan hanya tersisa di elemen yang benar-benar melayang.
- Radius: sampul pemutar penuh 1.75rem dan MiniPlayer 3xl -> skala yang sudah ada (xl/2xl).

Responsif (R-03, Two-State Layout):
- Gutter halaman punya langkah tablet: 16px -> 24px (sm) -> 32px (lg), termasuk HorizontalRow dan bar pencarian.
- Grid kartu playlist menambah langkah md (4 kolom).
- Hanya JS\/CSS (OTA).
