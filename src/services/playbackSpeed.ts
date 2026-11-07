import { useSyncExternalStore } from 'react'
import { readJson, writeJson } from '../utils/safeStorage'

const KEY = 'musicverse:speed:v1'

/** Pilihan kecepatan putar. Nada tetap (pitch tidak ikut berubah). */
export const SPEED_OPTIONS = [0.75, 0.9, 1, 1.1, 1.25, 1.5, 2] as const

function clamp(value: number): number {
  return Number.isFinite(value) ? Math.min(2, Math.max(0.5, value)) : 1
}

function load(): number {
  const out = readJson(KEY)
  return out.status === 'ok' && typeof out.value === 'number' ? clamp(out.value) : 1
}

let speed = load()
const listeners = new Set<() => void>()

export function getPlaybackSpeed(): number {
  return speed
}

export function setPlaybackSpeed(value: number): void {
  const next = clamp(value)
  if (next === speed) return
  speed = next
  writeJson(KEY, next)
  for (const listener of [...listeners]) listener()
}

export function subscribeSpeed(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

export function usePlaybackSpeed(): number {
  return useSyncExternalStore(subscribeSpeed, () => speed)
}

export function speedLabel(value: number): string {
  return `${Number(value.toFixed(2))}x`
}
