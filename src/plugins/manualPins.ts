import type { ManualPick } from './types'

/**
 * Pilihan manual pengguna per lagu. Bila pencarian otomatis tidak menemukan lagu yang cocok lalu pengguna memilih hasil
 * sendiri (Cari manual), pilihan itu disimpan di sini dan dipakai lagi setiap lagu itu diputar atau diunduh, jadi tidak
 * error lagi. Kuncinya sama dengan cache resolve (judul + artis playlist, huruf kecil). Disimpan di localStorage dengan
 * awalan `mv:` sehingga ikut Cadangan. Tidak pernah melempar error.
 */
const KEY = 'mv:manualPins:v1'
const MAX_PINS = 500

interface PinEntry {
  pick: ManualPick
  at: number
}

type PinMap = Record<string, PinEntry>

export function pinKey(track: { title: string; artists?: string }): string {
  return `${track.title}|${track.artists ?? ''}`.toLowerCase()
}

function isPick(value: unknown): value is ManualPick {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return typeof v.id === 'string' && typeof v.pluginId === 'string' && typeof v.title === 'string' && typeof v.artist === 'string'
}

function read(): PinMap {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}
    const out: PinMap = {}
    for (const [key, entry] of Object.entries(parsed as Record<string, unknown>)) {
      const e = entry as { pick?: unknown; at?: unknown } | null
      if (e && isPick(e.pick)) out[key] = { pick: e.pick, at: typeof e.at === 'number' ? e.at : 0 }
    }
    return out
  } catch {
    return {}
  }
}

function write(map: PinMap): boolean {
  try {
    const keys = Object.keys(map)
    if (keys.length > MAX_PINS) {
      // Buang yang paling lama dipilih.
      keys.sort((a, b) => map[a].at - map[b].at)
      for (const key of keys.slice(0, keys.length - MAX_PINS)) delete map[key]
    }
    localStorage.setItem(KEY, JSON.stringify(map))
    return true
  } catch {
    return false
  }
}

export function getManualPin(track: { title: string; artists?: string }): ManualPick | null {
  return read()[pinKey(track)]?.pick ?? null
}

/** Menyimpan pilihan manual untuk lagu ini. Mengembalikan false bila penyimpanan penuh atau tidak bisa diakses. */
export function setManualPin(track: { title: string; artists?: string }, pick: ManualPick): boolean {
  const map = read()
  map[pinKey(track)] = { pick, at: Date.now() }
  return write(map)
}

/** Melupakan pilihan manual untuk lagu ini (kembali ke pencarian otomatis). */
export function forgetManualPin(track: { title: string; artists?: string }): void {
  const map = read()
  if (!(pinKey(track) in map)) return
  delete map[pinKey(track)]
  write(map)
}
