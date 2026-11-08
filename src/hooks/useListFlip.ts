import { useLayoutEffect, useRef, type RefObject } from 'react'
import { springEasing } from '../utils/spring'

const FALLBACK = 'cubic-bezier(0.22, 1, 0.36, 1)'

/**
 * Baris yang berpindah tempat (naik/turun, ada yang dihapus di atasnya) meluncur ke slot barunya dengan pegas (FLIP) alih-alih melompat.
 * Pasang `data-row-id` di tiap anak langsung `list`. Hanya animasi saat DAFTAR id berubah (urutan/isi), bukan tiap render, sehingga
 * progres, mode pilih, dan render lain tidak memicu gerak. Hanya transform; Reduce Motion = tanpa animasi. Posisi gulir tidak disentuh.
 */
export function useListFlip(listRef: RefObject<HTMLElement>, signature: string) {
  const prev = useRef<{ sig: string; tops: Map<string, number> } | null>(null)
  useLayoutEffect(() => {
    const list = listRef.current
    if (!list) {
      prev.current = null
      return
    }
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    const tops = new Map<string, number>()
    const count = Math.min(list.children.length, 80)
    const before = prev.current
    const changed = before !== null && before.sig !== signature
    for (let i = 0; i < count; i++) {
      const row = list.children[i] as HTMLElement
      const id = row.dataset.rowId
      if (!id) continue
      const top = row.offsetTop
      tops.set(id, top)
      const was = before?.tops.get(id)
      if (changed && !reduce && was !== undefined && Math.abs(was - top) > 1 && typeof row.animate === 'function') {
        row.animate([{ transform: `translate3d(0, ${was - top}px, 0)` }, { transform: 'translate3d(0, 0, 0)' }], {
          duration: 420,
          easing: springEasing(FALLBACK, 0.85, 24, 0.42),
        })
      }
    }
    prev.current = { sig: signature, tops }
  }, [listRef, signature])
}
