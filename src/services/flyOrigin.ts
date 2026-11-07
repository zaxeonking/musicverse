/**
 * Titik awal sampul "terbang" saat pemutar penuh dibuka. MiniPlayer mencatat posisi sampulnya TEPAT saat dilepas (termasuk
 * geseran seret ke atas), sebelum kartunya bergerak kembali; FullPlayer memakainya sebagai asal terbang. Tanpa ini posisi
 * dibaca saat kartu sedang bergerak balik, jadi titik awalnya tidak tentu.
 */
let origin: { rect: DOMRect; at: number } | null = null

export function setFlyOrigin(rect: DOMRect | null | undefined) {
  origin = rect && rect.width > 0 ? { rect, at: performance.now() } : null
}

/** Ambil (sekali pakai) asal terbang bila masih baru; null bila tidak ada / kedaluwarsa. */
export function takeFlyOrigin(maxAgeMs = 1500): DOMRect | null {
  const current = origin
  origin = null
  return current && performance.now() - current.at <= maxAgeMs ? current.rect : null
}
