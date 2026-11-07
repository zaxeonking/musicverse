# 0.5.43 (nav)

File: src/components/layout/BottomNav.tsx (hanya animasi; bentuk / tata letak navbar tidak diubah)

- Lensa kaca sekarang digerakkan fisika pegas lewat satu loop rAF (tanpa render ulang React per frame, jadi tidak patah-patah):
  - Saat digeser: mengejar jari dengan pegas kaku (halus, tidak menempel kasar).
  - Saat dilepas: mendarat ke tab tujuan dengan pegas lebih lembut (sedikit membal), kecepatan geser terbawa.
  - Melar searah geseran sesuai kecepatan nyata, lalu menyusut saat melambat.
  - Pindah tab lewat ketukan / Back memakai pegas yang sama.
- Tiap tab punya `--p` (0..1) = kedekatan lensa dengan tab itu. Ikon (membesar), nama tab (memudar + naik), dan warna aksen mengikuti `--p`, jadi tab menyala/meredup pelan saat lensa lewat, bukan berganti mendadak.
- Nama tab hanya terlihat di tab yang sedang di bawah lensa / aktif. aria-label tetap ada di tiap tab.
- "Kurangi gerakan": lensa langsung pindah tanpa pegas.
