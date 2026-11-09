import { readJson, writeJson } from './safeStorage'

/**
 * Sumber lirik yang dipilih pengguna untuk SATU lagu (menu "Sumber lirik" di panel lirik). Tanpa pilihan = otomatis
 * (mengikuti prioritas di Pengaturan). Kunci: judul + artis (huruf kecil), sama dengan penyelarasan lirik per lagu.
 * Disimpan di localStorage berawalan `mv:` sehingga ikut Cadangan. Tidak pernah melempar error.
 */
export type LyricSourceId = 'ytmusic' | 'word' | 'lrclib' | 'netease' | 'ovh'

export const LYRIC_SOURCES: ReadonlyArray<{ id: LyricSourceId; label: string; hint: string }> = [
  { id: 'ytmusic', label: 'YouTube Music', hint: 'Lirik per baris atau biasa, sesuai yang tampil di YT Music' },
  { id: 'word', label: 'LyricsPlus / BetterLyrics', hint: 'Lirik per kata (karaoke), bila tersedia' },
  { id: 'lrclib', label: 'LRCLIB', hint: 'Lirik per baris, komunitas' },
  { id: 'netease', label: 'NetEase', hint: 'Lirik per baris' },
  { id: 'ovh', label: 'lyrics.ovh', hint: 'Teks biasa tanpa waktu' },
]

const KEY = 'mv:lyricSource:v1'
const MAX_PINS = 500
const isId = (v: unknown): v is LyricSourceId => LYRIC_SOURCES.some((s) => s.id === v)

interface PinEntry {
  source: LyricSourceId
  at: number
}

export function lyricPinKey(track: { title: string; artists?: string }): string {
  return `${track.title}|${track.artists ?? ''}`.toLowerCase()
}

function read(): Record<string, PinEntry> {
  const saved = readJson(KEY)
  if (saved.status !== 'ok' || typeof saved.value !== 'object' || saved.value === null || Array.isArray(saved.value)) return {}
  const out: Record<string, PinEntry> = {}
  for (const [key, entry] of Object.entries(saved.value as Record<string, unknown>)) {
    const e = entry as { source?: unknown; at?: unknown } | null
    if (e && isId(e.source)) out[key] = { source: e.source, at: typeof e.at === 'number' ? e.at : 0 }
  }
  return out
}

const listeners = new Set<() => void>()

export function subscribeLyricSourcePins(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getLyricSourcePin(track: { title: string; artists?: string }): LyricSourceId | null {
  return read()[lyricPinKey(track)]?.source ?? null
}

/** `null` = kembali ke otomatis. */
export function setLyricSourcePin(track: { title: string; artists?: string }, source: LyricSourceId | null): void {
  const map = read()
  const key = lyricPinKey(track)
  if (source === null) delete map[key]
  else map[key] = { source, at: Date.now() }
  const keys = Object.keys(map)
  if (keys.length > MAX_PINS) {
    keys.sort((a, b) => map[a].at - map[b].at)
    for (const k of keys.slice(0, keys.length - MAX_PINS)) delete map[k]
  }
  writeJson(KEY, map)
  listeners.forEach((fn) => fn())
}
