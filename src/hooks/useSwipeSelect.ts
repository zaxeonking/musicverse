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

export type SwipeIcon = 'queue' | 'like' | 'unlike' | 'select' | 'unselect' | 'blocked'
/** Petunjuk yang muncul di celah selama menggeser: ikon + label pendek untuk aksi yang akan terjadi. */
export interface SwipeHint {
  icon: SwipeIcon
  label: string
}

const ICONS: Record<SwipeIcon, string> = {
  queue: '<path d="M11 12H3"/><path d="M16 6H3"/><path d="M16 18H3"/><path d="M18 9v6"/><path d="M21 12h-6"/>',
  like: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  unlike:
    '<line x1="2" x2="22" y1="2" y2="22"/><path d="M16.5 16.5 12 21l-7-7c-1.5-1.45-3-3.2-3-5.5a5.5 5.5 0 0 1 2.14-4.35"/><path d="M8.76 3.1c1.15.22 2.13.78 3.24 1.9 1.5-1.5 2.74-2 4.5-2A5.5 5.5 0 0 1 22 8.5c0 2.12-1.3 3.78-2.67 5.17"/>',
  select: '<path d="M20 6 9 17l-5-5"/>',
  unselect: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  blocked: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
}

function makeHint(hint: SwipeHint): HTMLElement {
  const el = document.createElement('span')
  el.setAttribute('aria-hidden', 'true')
  el.dataset.swipeHint = hint.icon
  el.style.cssText =
    'position:absolute;top:50%;display:flex;flex-direction:column;align-items:center;gap:2px;width:56px;pointer-events:none;' +
    `color:rgb(${ACCENT});font-size:10px;font-weight:600;line-height:1;opacity:0;`
  el.innerHTML =
    `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${ICONS[hint.icon]}</svg>` +
    `<span>${hint.label}</span>`
  return el
}

interface Drag {
  x: number
  y: number
  index: number
  item: HTMLElement
  pointerId: number
  dragging: boolean
  armed: boolean
  /** Arah geser terakhir: 1 = kanan, -1 = kiri. */
  direction: 1 | -1
  hintEl: HTMLElement | null
  hintDir: 1 | -1 | 0
  hintPosition: string | null
}

const reducedMotion = () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Ikuti jari: baris bergeser, membesar tipis, dan diberi bingkai hijau yang makin jelas sampai "siap" (getar sekali). */
function paint(item: HTMLElement, dx: number, armed: boolean, hintEl: HTMLElement | null) {
  const offset = Math.sign(dx) * Math.min(MAX_OFFSET_PX, Math.abs(dx) * 0.6)
  const progress = Math.min(1, Math.abs(dx) / SWIPE_MIN_PX)
  item.style.transition = 'none'
  item.style.transform = `translateX(${offset}px) scale(${1 - 0.02 * progress})`
  item.style.boxShadow = `0 0 0 2px rgba(${ACCENT}, ${0.15 + 0.85 * progress * progress})`
  item.style.backgroundColor = `rgba(${ACCENT}, ${armed ? 0.16 : 0.1 * progress})`
  if (hintEl) {
    // Celah yang terbuka ada di sisi awal baris: ikon diam di tepi asal baris (baris bergeser `offset`), muncul makin jelas.
    const right = dx > 0
    hintEl.style.left = right ? `${-offset + 6}px` : 'auto'
    hintEl.style.right = right ? 'auto' : `${offset + 6}px`
    hintEl.style.opacity = String(Math.min(1, Math.max(0, (progress - 0.25) / 0.5)))
    hintEl.style.transition = 'transform 160ms cubic-bezier(0.34, 1.56, 0.64, 1)'
    hintEl.style.transform = `translateY(-50%) scale(${armed ? 1.18 : 0.9 + 0.1 * progress})`
  }
}

/** Kembali ke posisi semula dengan pegas kecil. */
function release(item: HTMLElement, hintEl: HTMLElement | null, hintPosition: string | null) {
  if (hintEl) {
    hintEl.style.transition = 'opacity 160ms ease-out'
    hintEl.style.opacity = '0'
    window.setTimeout(() => {
      hintEl.remove()
      item.style.position = hintPosition ?? ''
    }, 200)
  }
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
 * Geser ke kanan atau kiri pada sebuah baris/kartu memanggil `onSwipe(index, direction)` (1 = kanan, -1 = kiri) saat jari DILEPAS setelah melewati
 * ambang; `index` = urutan elemen `<li>` anak langsung dari `<ul>` yang digeser. Selama menggeser, baris ikut jari
 * (dengan efek karet dan bingkai hijau), lalu kembali dengan pegas. Satu pendengar di `<ul>` cukup untuk seluruh
 * daftar, jadi kartu tidak perlu diubah. Menggulir tegak tidak terpengaruh (pasang `touch-action: pan-y` di `<ul>`),
 * dan klik yang menyusul pelepasan jari setelah geser ditelan sehingga playlist tidak ikut terbuka.
 */
export function useSwipeSelect(onSwipe: (index: number, direction: 1 | -1) => void, getHint?: (index: number, direction: 1 | -1) => SwipeHint | null) {
  const callbackRef = useRef(onSwipe)
  callbackRef.current = onSwipe
  const hintRef = useRef(getHint)
  hintRef.current = getHint

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
      dragRef.current = { x: event.clientX, y: event.clientY, index, item, pointerId: event.pointerId, dragging: false, armed: false, direction: 1, hintEl: null, hintDir: 0, hintPosition: null }
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

    drag.direction = dx >= 0 ? 1 : -1
    if (drag.hintDir !== drag.direction && hintRef.current && !reducedMotion()) {
      // Arah berubah (atau baru mulai): ganti petunjuk sesuai aksi arah itu.
      drag.hintEl?.remove()
      drag.hintEl = null
      drag.hintDir = drag.direction
      const hint = hintRef.current(drag.index, drag.direction)
      if (hint) {
        if (drag.hintPosition === null) drag.hintPosition = drag.item.style.position
        if (getComputedStyle(drag.item).position === 'static') drag.item.style.position = 'relative'
        drag.hintEl = makeHint(hint)
        drag.item.appendChild(drag.hintEl)
      }
    }
    const armed = Math.abs(dx) >= SWIPE_MIN_PX
    if (armed !== drag.armed) {
      drag.armed = armed
      if (armed) navigator.vibrate?.(10)
    }
    if (!reducedMotion()) paint(drag.item, dx, armed, drag.hintEl)
  }, [])

  const finish = useCallback((commit: boolean) => {
    const drag = dragRef.current
    dragRef.current = null
    if (!drag || !drag.dragging) return
    swallowUntilRef.current = Date.now() + 600
    release(drag.item, drag.hintEl, drag.hintPosition)
    if (commit && drag.armed) {
      navigator.vibrate?.(15)
      callbackRef.current(drag.index, drag.direction)
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
