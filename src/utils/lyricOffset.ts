import { readJson, removeKey, writeJson } from './safeStorage'

/**
 * Penyelarasan waktu lirik per lagu (detik; positif = lirik maju). Satu sumber kebenaran untuk panel lirik, strip lirik
 * mini player, dan tombol +/-: mengubahnya di satu tempat langsung terasa di semua tempat. Kunci penyimpanan sama dengan
 * yang lama (`musicverse:lyricsOffset:<judul|artis>`), jadi penyelarasan lama tetap terbaca.
 */
export const OFFSET_STEP_S = 0.2
export const OFFSET_MAX_S = 30

export function offsetStorageKey(trackKey?: string): string | null {
  return trackKey ? `musicverse:lyricsOffset:${trackKey.toLowerCase()}` : null
}

const listeners = new Set<() => void>()
const memory = new Map<string, number>()

function clamp(value: number): number {
  const rounded = Math.round(value * 10) / 10
  return Math.max(-OFFSET_MAX_S, Math.min(OFFSET_MAX_S, rounded))
}

export function getLyricOffset(trackKey: string | undefined): number {
  const key = offsetStorageKey(trackKey)
  if (!key) return 0
  const cached = memory.get(key)
  if (cached !== undefined) return cached
  const saved = readJson(key)
  const value = saved.status === 'ok' && typeof saved.value === 'number' && Number.isFinite(saved.value) ? clamp(saved.value) : 0
  memory.set(key, value)
  return value
}

export function setLyricOffset(trackKey: string | undefined, value: number): void {
  const key = offsetStorageKey(trackKey)
  if (!key) return
  const next = clamp(value)
  memory.set(key, next)
  if (next === 0) removeKey(key)
  else writeJson(key, next)
  listeners.forEach((fn) => fn())
}

export function subscribeLyricOffset(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
