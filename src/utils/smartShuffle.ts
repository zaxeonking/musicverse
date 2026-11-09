import { useSyncExternalStore } from 'react'
import type { PlaylistTrack } from '../types/spotify'
import { recentKey } from './libraryStorage'
import { readPlayLog } from './playLog'
import { createShuffleOrder, createSmartShuffleOrder } from './playerQueue'
import { readJson, writeJson } from './safeStorage'

/**
 * Acak cerdas (Pengaturan > Pemutaran). Bawaan MATI: acak biasa tetap acak murni.
 * Menyala = artis yang sama tidak berturut-turut dan lagu yang jarang diputar cenderung lebih awal (lihat `createSmartShuffleOrder`).
 */
const KEY = 'musicverse:smart-shuffle:v1'

let current: boolean | null = null
const listeners = new Set<() => void>()

export function getSmartShuffle(): boolean {
  if (current === null) {
    const out = readJson(KEY)
    current = out.status === 'ok' && typeof out.value === 'object' && out.value !== null && (out.value as { on?: unknown }).on === true
  }
  return current
}

export function setSmartShuffle(on: boolean): void {
  current = on
  writeJson(KEY, { on })
  for (const listener of [...listeners]) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useSmartShuffle(): boolean {
  return useSyncExternalStore(subscribe, getSmartShuffle, getSmartShuffle)
}

/** Jumlah putar tiap lagu dari log Riwayat (maksimal 1.500 putaran terakhir). */
function countPlays(): Map<string, number> {
  const counts = new Map<string, number>()
  for (const { track } of readPlayLog()) {
    const key = recentKey(track)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}

/** Urutan acak untuk antrean: cerdas bila saklar menyala, selain itu acak biasa. Lagu `first` selalu di depan. */
export function makeShuffleOrder(tracks: readonly PlaylistTrack[], first: number): number[] {
  if (!getSmartShuffle() || tracks.length < 3) return createShuffleOrder(tracks.length, first)
  return createSmartShuffleOrder(tracks, first, countPlays(), recentKey)
}
