import { useEffect, type RefObject } from 'react'
import { springEasing } from '../utils/spring'
import { swallowNextClick } from '../utils/swallowNextClick'
import { prefersReducedMotion } from '../utils/motion'

/** Jarak (px) sebelum sentuhan dianggap seretan, dan batas keputusan lepas. */
const START_PX = 8
const CLOSE_FRACTION = 0.3
const CLOSE_VELOCITY = 0.6
/** Pegas kembali: pegas teredam hampir kritis (lampauan < 0,2%, tidak memantul). Cadangan bila `linear()` tak didukung. */
const SPRING_FALLBACK = 'cubic-bezier(0.34, 1.3, 0.64, 1)'
const SPRING_MS = 460

const reduced = () => prefersReducedMotion()

/** Elemen di antara target dan panel yang punya gestur sendiri (scroll / touch-action: none): seretan sheet tidak boleh membajaknya. */
function ownsGesture(target: HTMLElement, panel: HTMLElement): boolean {
  for (let el: HTMLElement | null = target; el && el !== panel; el = el.parentElement) {
    const style = getComputedStyle(el)
    if (style.touchAction === 'none') return true
    if (/(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight + 1) return true
    if (el.matches('input, textarea, select, [role="slider"], [data-no-sheet-drag]')) return true
  }
  return false
}

/** Karet: ke bawah mengikuti jari (sedikit teredam), ke atas tertahan dan makin berat. */
function resist(dy: number): number {
  if (dy >= 0) return dy * 0.94
  return -Math.min(28, Math.sqrt(-dy) * 3.2)
}

/**
 * Seret panel sheet ke bawah untuk menutup (satu tempat untuk semua menu bawah lewat OverlayPortal).
 *  - hanya sentuhan/pena, hanya sheet bawah (bukan panel samping desktop),
 *  - hanya dari area yang tidak punya gestur sendiri (judul, ruang kosong); daftar yang bisa digulir tetap menggulir,
 *  - lepas melewati ~30% tinggi atau lemparan cepat = tutup (lewat klik pada latar, jadi `onClose` tiap sheet tetap dipakai),
 *  - selain itu panel kembali dengan pegas. Hanya transform + opacity.
 */
export function useSheetDrag(rootRef: RefObject<HTMLElement>) {
  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    let panel: HTMLElement | null = null
    let backdrop: HTMLElement | null = null
    let spring: Animation | null = null
    let g: { id: number; x: number; y: number; base: number; dragging: boolean; lastY: number; lastT: number; v: number; height: number } | null = null

    const isDesktop = () => window.matchMedia?.('(min-width: 1024px)').matches ?? false
    const findPanel = () => root.querySelector<HTMLElement>('[role="dialog"]')

    // touch-action: none hanya di panel itu sendiri; area dalam yang bisa digulir tetap menggulir (punya scroll container sendiri).
    const arm = () => {
      const p = findPanel()
      if (!p || isDesktop()) return
      if (p.scrollHeight > p.clientHeight + 1) return // panel sendiri yang digulir: jangan matikan geser vertikalnya
      p.style.touchAction = 'none'
    }
    arm()

    const currentOffset = (el: HTMLElement) => {
      try {
        return new DOMMatrixReadOnly(getComputedStyle(el).transform).m42
      } catch {
        return 0
      }
    }

    const apply = (offset: number) => {
      if (!panel) return
      panel.style.transform = `translate3d(0, ${offset}px, 0)`
      if (backdrop) backdrop.style.opacity = String(1 - Math.min(1, Math.max(0, offset) / (g?.height || 1)) * 0.85)
    }

    const settle = () => {
      if (!panel) return
      const from = currentOffset(panel)
      const back = backdrop ? Number(backdrop.style.opacity || 1) : 1
      const p = panel
      const b = backdrop
      p.style.transform = ''
      if (b) b.style.opacity = ''
      if (reduced() || typeof p.animate !== 'function') return
      spring?.cancel()
      spring = p.animate([{ transform: `translate3d(0, ${from}px, 0)` }, { transform: 'translate3d(0, 0, 0)' }], {
        duration: SPRING_MS,
        easing: springEasing(SPRING_FALLBACK),
      })
      b?.animate([{ opacity: back }, { opacity: 1 }], { duration: SPRING_MS * 0.6, easing: 'ease-out' })
      spring.onfinish = spring.oncancel = () => {
        spring = null
      }
    }

    const onDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' || isDesktop()) return
      const p = findPanel()
      const target = event.target as HTMLElement | null
      if (!p || !target || !p.contains(target) || ownsGesture(target, p)) return
      panel = p
      backdrop = null
      for (let i = 0; i < root.children.length; i++) {
        const child = root.children[i] as HTMLElement
        if (child !== p && child.getAttribute('aria-hidden') === 'true') {
          backdrop = child
          break
        }
      }
      // Animasi masuk (fill: both) menahan transform: dilepas dulu. Jangan membajak saat panel masih naik.
      if (p.getAnimations().some((a) => a !== spring && a.playState === 'running')) return
      let base = 0
      if (spring) {
        base = currentOffset(p)
        spring.cancel()
        spring = null
        p.style.transform = `translate3d(0, ${base}px, 0)`
      }
      p.style.animation = 'none'
      g = { id: event.pointerId, x: event.clientX, y: event.clientY, base, dragging: false, lastY: event.clientY, lastT: event.timeStamp, v: 0, height: p.offsetHeight }
    }

    const onMove = (event: PointerEvent) => {
      if (!g || event.pointerId !== g.id || !panel) return
      const dx = event.clientX - g.x
      const dy = event.clientY - g.y
      if (!g.dragging) {
        if (Math.hypot(dx, dy) < START_PX) return
        // Mendatar atau ke atas dari posisi diam: bukan seretan menutup.
        if (Math.abs(dx) > Math.abs(dy) || (dy < 0 && g.base <= 0)) {
          g = null
          return
        }
        g.dragging = true
        root.setPointerCapture(event.pointerId)
      }
      const dt = event.timeStamp - g.lastT
      if (dt > 0) g.v = g.v * 0.5 + ((event.clientY - g.lastY) / dt) * 0.5
      g.lastY = event.clientY
      g.lastT = event.timeStamp
      apply(g.base + resist(dy))
    }

    const onEnd = (event: PointerEvent, cancelled: boolean) => {
      if (!g || event.pointerId !== g.id) return
      const state = g
      g = null
      if (!state.dragging || !panel) return
      const offset = currentOffset(panel)
      const close = !cancelled && (offset > state.height * CLOSE_FRACTION || (state.v > CLOSE_VELOCITY && offset > 24))
      if (close && backdrop) {
        // Sheet menutup lewat penutup latarnya sendiri (onClose tiap sheet). Ghost keluar melanjutkan dari posisi saat ini.
        backdrop.click()
      } else {
        settle()
      }
      swallowNextClick()
    }

    const up = (e: PointerEvent) => onEnd(e, false)
    const cancel = (e: PointerEvent) => onEnd(e, true)
    root.addEventListener('pointerdown', onDown)
    root.addEventListener('pointermove', onMove)
    root.addEventListener('pointerup', up)
    root.addEventListener('pointercancel', cancel)
    return () => {
      root.removeEventListener('pointerdown', onDown)
      root.removeEventListener('pointermove', onMove)
      root.removeEventListener('pointerup', up)
      root.removeEventListener('pointercancel', cancel)
      spring?.cancel()
    }
  }, [rootRef])
}
