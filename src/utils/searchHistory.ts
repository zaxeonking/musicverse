import { readJson, writeJson } from './safeStorage'

/**
 * Riwayat kata kunci yang dicari di Beranda (judul lagu atau nama artis), terbaru dulu, disimpan di perangkat.
 * Dipakai Beranda sebagai bahan rekomendasi "Karena kamu mencari ...". Tautan Spotify tidak dicatat.
 */

const KEY = 'musicverse:search-history:v1'
const MAX_ITEMS = 20

export function readSearchHistory(): string[] {
  const out = readJson(KEY)
  if (out.status !== 'ok' || !Array.isArray(out.value)) return []
  return out.value.filter((item): item is string => typeof item === 'string' && item.trim() !== '').slice(0, MAX_ITEMS)
}

export function recordSearch(query: string): void {
  const text = query.trim().replace(/\s+/g, ' ')
  if (text.length < 2 || text.length > 80) return
  const lower = text.toLowerCase()
  const next = [text, ...readSearchHistory().filter((item) => item.toLowerCase() !== lower)].slice(0, MAX_ITEMS)
  writeJson(KEY, next)
}

export function clearSearchHistory(): void {
  writeJson(KEY, [])
}
