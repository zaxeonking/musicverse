import { useCallback, useRef, type MouseEvent, type PointerEvent } from 'react'

/** Jarak geser minimal (px) agar dianggap geser, dan seberapa dominan arah mendatarnya dibanding tegaknya. */
export const SWIPE_MIN_PX = 56
const SWIPE_RATIO = 1.6
/** Sentuhan yang dimulai sangat dekat tepi layar dibiarkan untuk gestur Kembali Android. */
const EDGE_PX = 24

/**
 * Geser ke kanan atau kiri pada sebuah baris/kartu memanggil `onSwipe(index)`; `index` = urutan
 * elemen `<li>` anak langsung dari `<ul>` yang digeser. Satu pendengar di `<ul>` cukup untuk seluruh
 * daftar, jadi kartu tidak perlu diubah. Menggulir tegak lurus tidak terpengaruh (pasang
 * `touch-action: pan-y` di `<ul>`), dan klik yang menyusul pelepasan jari setelah geser ditelan
 * sehingga playlist tidak ikut terbuka.
 */
export function useSwipeSelect(onSwipe: (index: number) => void) {
  const callbackRef = useRef(onSwipe)
  callbackRef.current = onSwipe

  const startRef = useRef<{ x: number; y: number; index: number } | null>(null)
  const swallowUntilRef = useRef(0)

  const onPointerDown = useCallback((event: PointerEvent<HTMLUListElement>) => {
    startRef.current = null
    if (event.pointerType === 'mouse' && event.button !== 0) return
    if (event.clientX < EDGE_PX || event.clientX > window.innerWidth - EDGE_PX) return
    const item = (event.target as HTMLElement).closest('li')
    if (!item || item.parentElement !== event.currentTarget) return
    const index = Array.prototype.indexOf.call(event.currentTarget.children, item)
    if (index >= 0) startRef.current = { x: event.clientX, y: event.clientY, index }
  }, [])

  const onPointerMove = useCallback((event: PointerEvent<HTMLUListElement>) => {
    const start = startRef.current
    if (!start) return
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy) * SWIPE_RATIO) return
    startRef.current = null
    swallowUntilRef.current = Date.now() + 600
    navigator.vibrate?.(15)
    callbackRef.current(start.index)
  }, [])

  const end = useCallback(() => {
    startRef.current = null
  }, [])

  const onClickCapture = useCallback((event: MouseEvent<HTMLUListElement>) => {
    if (Date.now() < swallowUntilRef.current) {
      swallowUntilRef.current = 0
      event.preventDefault()
      event.stopPropagation()
    }
  }, [])

  return { onPointerDown, onPointerMove, onPointerUp: end, onPointerCancel: end, onClickCapture }
}
