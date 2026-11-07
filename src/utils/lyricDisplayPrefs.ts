import { readJson, writeJson } from './safeStorage'

/**
 * Tampilan teks tambahan di bawah baris lirik. Hanya memengaruhi TAMPILAN (data dari server tetap disimpan di cache,
 * jadi saklar berlaku seketika tanpa mengunduh ulang).
 *  - `translation`: terjemahan dari server.
 *  - `romanization`: romanisasi dari server, atau dari romanisasi lokal (kana, Hangul, Hindi, Sirilik) bila server tidak punya.
 */
export interface LyricDisplayPrefs {
  translation: boolean
  romanization: boolean
}

export const DEFAULT_DISPLAY_PREFS: LyricDisplayPrefs = { translation: true, romanization: true }

const KEY = 'musicverse:lyricDisplay'

/** Membaca preferensi; nilai rusak / tidak dikenal diabaikan (bawaan: semuanya tampil, seperti sebelum ada saklar). */
export function loadDisplayPrefs(): LyricDisplayPrefs {
  const saved = readJson(KEY)
  if (saved.status !== 'ok' || typeof saved.value !== 'object' || saved.value === null) return { ...DEFAULT_DISPLAY_PREFS }
  const v = saved.value as Record<string, unknown>
  return {
    translation: typeof v.translation === 'boolean' ? v.translation : DEFAULT_DISPLAY_PREFS.translation,
    romanization: typeof v.romanization === 'boolean' ? v.romanization : DEFAULT_DISPLAY_PREFS.romanization,
  }
}

let current: LyricDisplayPrefs | null = null
const listeners = new Set<() => void>()

/** Snapshot yang stabil (objek yang sama sampai preferensi berubah), syarat useSyncExternalStore. */
export function getDisplayPrefs(): LyricDisplayPrefs {
  if (current === null) current = loadDisplayPrefs()
  return current
}

export function saveDisplayPrefs(next: LyricDisplayPrefs): void {
  current = { translation: next.translation, romanization: next.romanization }
  writeJson(KEY, current)
  listeners.forEach((fn) => fn())
}

export function subscribeDisplayPrefs(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
