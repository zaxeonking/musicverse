import { useSyncExternalStore } from 'react'
import { INITIAL_KEYBOARD_STATE, nextKeyboardState, type KeyboardInput, type KeyboardState } from '../utils/keyboardState'

const TEXT_INPUT_TYPES = new Set(['', 'text', 'search', 'url', 'email', 'tel', 'password', 'number'])

function isEditable(el: Element | null): boolean {
  if (!el) return false
  if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled
  if (el instanceof HTMLInputElement) return TEXT_INPUT_TYPES.has(el.type) && !el.readOnly && !el.disabled
  return el instanceof HTMLElement && el.isContentEditable
}

function readInput(): KeyboardInput {
  const vv = window.visualViewport
  const scale = vv?.scale ?? 1
  // WebView Android: innerHeight ikut mengecil. Browser dengan keyboard "resize visual": hanya visualViewport yang mengecil.
  const height = vv && vv.height < window.innerHeight ? vv.height : window.innerHeight
  const coarse =
    (typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches) ||
    (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0)
  return { width: window.innerWidth, height, scale, editableFocused: isEditable(document.activeElement), coarsePointer: coarse }
}

let state: KeyboardState = INITIAL_KEYBOARD_STATE
const listeners = new Set<() => void>()
let detach: (() => void) | null = null

function evaluate(): void {
  const next = nextKeyboardState(state, readInput())
  const changed = next.open !== state.open
  state = next
  if (changed) listeners.forEach((listener) => listener())
}

function attach(): () => void {
  let raf = 0
  const timers = new Set<number>()
  const schedule = () => {
    if (raf) return
    raf = window.requestAnimationFrame(() => {
      raf = 0
      evaluate()
    })
  }
  // Fokus berpindah lebih dulu daripada WebView mengecil (animasi keyboard): ukur lagi sesudahnya.
  const onFocusChange = () => {
    schedule()
    for (const delay of [120, 350]) {
      const id = window.setTimeout(() => {
        timers.delete(id)
        evaluate()
      }, delay)
      timers.add(id)
    }
  }
  evaluate()
  window.addEventListener('resize', schedule)
  window.addEventListener('orientationchange', schedule)
  window.visualViewport?.addEventListener('resize', schedule)
  document.addEventListener('focusin', onFocusChange)
  document.addEventListener('focusout', onFocusChange)
  return () => {
    window.removeEventListener('resize', schedule)
    window.removeEventListener('orientationchange', schedule)
    window.visualViewport?.removeEventListener('resize', schedule)
    document.removeEventListener('focusin', onFocusChange)
    document.removeEventListener('focusout', onFocusChange)
    window.cancelAnimationFrame(raf)
    timers.forEach((id) => window.clearTimeout(id))
  }
}

/** Diekspor untuk tes. Jangan dipakai komponen: gunakan `useKeyboardOpen`. */
export const keyboardStore = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    if (listeners.size === 1 && typeof window !== 'undefined') detach = attach()
    return () => {
      listeners.delete(listener)
      if (listeners.size === 0) {
        detach?.()
        detach = null
        state = INITIAL_KEYBOARD_STATE
      }
    }
  },
  getSnapshot: (): boolean => state.open,
  getServerSnapshot: (): boolean => false,
}

/**
 * true selama keyboard layar terbuka (lihat utils/keyboardState). Satu pendengar DOM dibagi ke semua pemakai
 * (BottomNav, MiniPlayer, AppShell), dipasang saat pemakai pertama muncul dan dilepas saat yang terakhir pergi.
 */
export function useKeyboardOpen(): boolean {
  return useSyncExternalStore(keyboardStore.subscribe, keyboardStore.getSnapshot, keyboardStore.getServerSnapshot)
}
