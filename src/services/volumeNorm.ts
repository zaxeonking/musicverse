import { useSyncExternalStore } from 'react'
import { readJson, writeJson } from '../utils/safeStorage'

const KEY = 'musicverse:volnorm:v1'

function load(): boolean {
  const out = readJson(KEY)
  if (out.status !== 'ok' || typeof out.value !== 'object' || out.value === null) return true
  return (out.value as { enabled?: unknown }).enabled !== false
}

let enabled = load()
const listeners = new Set<() => void>()

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

/** Normalisasi volume (menyamakan keras antar lagu). Menyala secara bawaan. */
export function getVolumeNorm(): boolean {
  return enabled
}

export function setVolumeNorm(next: boolean): void {
  enabled = next
  writeJson(KEY, { enabled: next })
  for (const listener of [...listeners]) listener()
}

export function useVolumeNorm(): boolean {
  return useSyncExternalStore(subscribe, () => enabled)
}
