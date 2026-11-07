import { useCallback, useRef, type MouseEvent, type PointerEvent } from 'react'

/** Jarak geser (px) yang membuat geser "siap" dan dipilih saat jari dilepas. */
export const SWIPE_MIN_PX = 64
/** Jarak awal (px) sebelum gerakan dianggap geser mendatar (bukan mengetuk atau menggulir). */
const SWIPE_START_PX = 10
/** Seberapa dominan arah mendatar dibanding tegaknya. */
const SWIPE_RATIO = 1.3
/** Baris paling jauh ikut jari (px); lebih dari itu terasa tertahan karet. */
const MAX_OFFSET_PX = 96
/** Sentuhan yang dimulai sangat dekat tepi layar dibiarkan untuk gestur Kembali Android. */
const EDGE_PX = 24

const ACCENT = '29, 185, 84'
const SPRING = 'transform 320ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 220ms ease-out, background-color 220ms ease-out'

interface Drag {
  x: number
  y: number
  index: number
  item: HTMLElement
  pointerId: number
  dragging: boolean
  armed: boolean
}

const reducedMotion = () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Ikuti jari: baris bergeser, membesar tipis, dan diberi bingkai hijau yang makin jelas sampai "siap" (getar sekali). */
function paint(item: HTMLElement, dx: number, armed: boolean) {
  const offset = Math.sign(dx) * Math.min(MAX_OFFSET_PX, Math.abs(dx) * 0.6)
  const progress = Math.min(1, Math.abs(dx) / SWIPE_MIN_PX)
  item.style.transition = 'none'
  item.style.transform = `translateX(${offset}px) scale(${1 - 0.02 * progress})`
  item.style.boxShadow = `0 0 0 2px rgba(${ACCENT}, ${0.15 + 0.85 * progress * progress})`
  item.style.backgroundColor = `rgba(${ACCENT}, ${armed ? 0.16 : 0.1 * progress})`
}

/** Kembali ke posisi semula dengan pegas kecil. */
function release(item: HTMLElement) {
  item.style.transition = reducedMotion() ? 'none' : SPRING
  item.style.transform = ''
  item.style.boxShadow = ''
  item.style.backgroundColor = ''
  window.setTimeout(() => {
    item.style.transition = ''
    item.style.willChange = ''
    item.style.userSelect = ''
    item.style.borderRadius = ''
  }, 340)
}

/**
 * Geser ke kanan atau kiri pada sebuah baris/kartu memanggil `onSwipe(index)` saat jari DILEPAS setelah melewati
 * ambang; `index` = urutan elemen `<li>` anak langsung dari `<ul>` yang digeser. Selama menggeser, baris ikut jari
 * (dengan efek karet dan bingkai hijau), lalu kembali dengan pegas. Satu pendengar di `<ul>` cukup untuk seluruh
 * daftar, jadi kartu tidak perlu diubah. Menggulir tegak tidak terpengaruh (pasang `touch-action: pan-y` di `<ul>`),
 * dan klik yang menyusul pelepasan jari setelah geser ditelan sehingga playlist tidak ikut terbuka.
 */
export function useSwipeSelect(onSwipe: (index: number) => void) {
  const callbackRef = useRef(onSwipe)
  callbackRef.current = onSwipe

  const dragRef = useRef<Drag | null>(null)
  const swallowUntilRef = useRef(0)

  const onPointerDown = useCallback((event: PointerEvent<HTMLUListElement>) => {
    dragRef.current = null
    if (event.pointerType === 'mouse' && event.button !== 0) return
    if (event.clientX < EDGE_PX || event.clientX > window.innerWidth - EDGE_PX) return
    const item = (event.target as HTMLElement).closest('li')
    if (!item || item.parentElement !== event.currentTarget) return
    const index = Array.prototype.indexOf.call(event.currentTarget.children, item)
    if (index >= 0) {
      dragRef.current = { x: event.clientX, y: event.clientY, index, item, pointerId: event.pointerId, dragging: false, armed: false }
    }
  }, [])

  const onPointerMove = useCallback((event: PointerEvent<HTMLUListElement>) => {
    const drag = dragRef.current
    if (!drag || event.pointerId !== drag.pointerId) return
    const dx = event.clientX - drag.x
    const dy = event.clientY - drag.y

    if (!drag.dragging) {
      // Gerakan tegak lebih dulu = menggulir: lepaskan, jangan ikut campur.
      if (Math.abs(dy) > SWIPE_START_PX && Math.abs(dy) * SWIPE_RATIO > Math.abs(dx)) {
        dragRef.current = null
        return
      }
      if (Math.abs(dx) < SWIPE_START_PX || Math.abs(dx) < Math.abs(dy) * SWIPE_RATIO) return
      drag.dragging = true
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        /* pointer sudah lepas: abaikan */
      }
      drag.item.style.willChange = 'transform'
      drag.item.style.userSelect = 'none'
      drag.item.style.borderRadius = '0.75rem'
    }

    const armed = Math.abs(dx) >= SWIPE_MIN_PX
    if (armed !== drag.armed) {
      drag.armed = armed
      if (armed) navigator.vibrate?.(10)
    }
    if (!reducedMotion()) paint(drag.item, dx, armed)
  }, [])

  const finish = useCallback((commit: boolean) => {
    const drag = dragRef.current
    dragRef.current = null
    if (!drag || !drag.dragging) return
    swallowUntilRef.current = Date.now() + 600
    release(drag.item)
    if (commit && drag.armed) {
      navigator.vibrate?.(15)
      callbackRef.current(drag.index)
    }
  }, [])

  const onPointerUp = useCallback(() => finish(true), [finish])
  const onPointerCancel = useCallback(() => finish(false), [finish])

  const onClickCapture = useCallback((event: MouseEvent<HTMLUListElement>) => {
    if (Date.now() < swallowUntilRef.current) {
      swallowUntilRef.current = 0
      event.preventDefault()
      event.stopPropagation()
    }
  }, [])

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onClickCapture }
}
