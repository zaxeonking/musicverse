import { useEffect, useRef } from 'react'

const SPRING = 'cubic-bezier(0.34, 1.56, 0.64, 1)'

/**
 * Membal kecil (scale) pada elemen setiap kali `trigger` BERUBAH setelah pemasangan pertama: umpan balik untuk
 * suka, tambah/hapus playlist, antrean, status lagu. Lewat WAAPI pada elemen yang sama (tanpa remount, tanpa state),
 * hanya transform; tidak jalan saat Reduce Motion. `amount` = skala puncak.
 */
export function usePulse<T extends HTMLElement | SVGElement>(trigger: unknown, amount = 1.18, ms = 340) {
  const ref = useRef<T>(null)
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    const el = ref.current
    if (!el || typeof el.animate !== 'function') return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    el.animate(
      [{ transform: 'scale(1)' }, { transform: `scale(${amount})`, offset: 0.4 }, { transform: 'scale(1)' }],
      { duration: ms, easing: SPRING },
    )
  }, [trigger, amount, ms])
  return ref
}
