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
/**
 * Dugaan dini: kolom isian baru difokus di layar sentuh, jadi keyboard hampir pasti segera naik. WebView mengecil lebih
 * dulu daripada pengukuran (rAF + resize) mengabarkan "terbuka", sehingga tanpa ini nav bawah ikut terangkat bersama
 * tepi bawah WebView lalu baru turun. Dengan dugaan ini nav langsung disembunyikan saat fokus, sebelum WebView berubah
 * ukuran. Dugaan dibatalkan bila fokus lepas, atau bila dalam PENDING_MS tinggi layar ternyata tidak berubah
 * (mis. keyboard fisik).
 */
const PENDING_MS = 900
let pending = false
let pendingTimer = 0
const listeners = new Set<() => void>()
let detach: (() => void) | null = null

const visible = (): boolean => state.open || pending
const notify = () => listeners.forEach((listener) => listener())

function setPending(value: boolean): void {
  window.clearTimeout(pendingTimer)
  pendingTimer = 0
  if (value) {
    pendingTimer = window.setTimeout(() => {
      pendingTimer = 0
      if (!pending) return
      const before = visible()
      pending = false
      if (before !== visible()) notify()
    }, PENDING_MS)
  }
  if (pending === value) return
  const before = visible()
  pending = value
  if (before !== visible()) notify()
}

function evaluate(): void {
  const before = visible()
  const next = nextKeyboardState(state, readInput())
  state = next
  // Terukur terbuka: dugaan dini sudah terbukti, tidak perlu lagi.
  if (next.open && pending) {
    pending = false
    window.clearTimeout(pendingTimer)
    pendingTimer = 0
  }
  if (before !== visible()) notify()
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
  const onFocusIn = () => {
    const coarse = readInput().coarsePointer
    if (coarse && isEditable(document.activeElement) && !state.open) setPending(true)
    onFocusChange()
  }
  const onFocusOut = () => {
    // Fokus berpindah antar kolom: activeElement baru terisi sesudah focusout, jadi cek dulu di giliran berikutnya.
    window.setTimeout(() => {
      if (!isEditable(document.activeElement)) setPending(false)
    }, 0)
    onFocusChange()
  }
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
  document.addEventListener('focusin', onFocusIn)
  document.addEventListener('focusout', onFocusOut)
  return () => {
    window.removeEventListener('resize', schedule)
    window.removeEventListener('orientationchange', schedule)
    window.visualViewport?.removeEventListener('resize', schedule)
    document.removeEventListener('focusin', onFocusIn)
    document.removeEventListener('focusout', onFocusOut)
    window.cancelAnimationFrame(raf)
    window.clearTimeout(pendingTimer)
    pending = false
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
  getSnapshot: (): boolean => visible(),
  getServerSnapshot: (): boolean => false,
}

/**
 * true selama keyboard layar terbuka (lihat utils/keyboardState). Satu pendengar DOM dibagi ke semua pemakai
 * (BottomNav, MiniPlayer, AppShell), dipasang saat pemakai pertama muncul dan dilepas saat yang terakhir pergi.
 */
export function useKeyboardOpen(): boolean {
  return useSyncExternalStore(keyboardStore.subscribe, keyboardStore.getSnapshot, keyboardStore.getServerSnapshot)
}
