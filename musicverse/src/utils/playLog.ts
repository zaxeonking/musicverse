import type { PlaylistTrack } from '../types/spotify'
import { recentKey, toStoredTrack } from './libraryStorage'
import { readJson, removeKey, writeJson } from './safeStorage'

/**
 * Log pemutaran lengkap (tidak digabung per lagu seperti "Baru diputar"), dipakai halaman Riwayat dan statistik.
 * Dibatasi MAX_LOG entri terbaru supaya penyimpanan tidak membengkak.
 */

const KEY = 'musicverse:play-log:v1'
export const MAX_LOG = 1500
/** Entri yang sama berturut-turut dalam rentang ini dianggap satu pemutaran (mis. lanjut setelah jeda). */
const DEDUPE_MS = 30_000

export interface PlayLogEntry {
  track: PlaylistTrack
  at: number
  /** true = dicatat dari jurnal native (lagu diputar native saat JS beku/mati), bukan oleh JS sendiri. */
  native?: boolean
}

/**
 * Jurnal native vs catatan JS untuk lagu yang sama: JS yang baru bangun dari beku mencatat lagu aktif pada waktu bangunnya,
 * paling lambat selama satu lagu sesudah native memulainya. Jendela ini menyatukan keduanya jadi satu pemutaran.
 */
export const NATIVE_BEFORE_MS = 90_000
export const NATIVE_AFTER_MS = 15 * 60_000

export function readPlayLog(): PlayLogEntry[] {
  const out = readJson(KEY)
  if (out.status !== 'ok' || typeof out.value !== 'object' || out.value === null) return []
  const items = (out.value as { items?: unknown }).items
  if (!Array.isArray(items)) return []
  const list: PlayLogEntry[] = []
  for (const raw of items) {
    if (typeof raw !== 'object' || raw === null) continue
    const r = raw as { track?: Partial<PlaylistTrack>; at?: unknown }
    const t = r.track
    if (!t || typeof t.id !== 'string' || typeof t.title !== 'string' || typeof t.url !== 'string') continue
    if (typeof r.at !== 'number') continue
    const fromNative = (raw as { native?: unknown }).native === true
    list.push({
      at: r.at,
      ...(fromNative ? { native: true } : {}),
      track: toStoredTrack({
        id: t.id,
        title: t.title,
        url: t.url,
        artists: typeof t.artists === 'string' ? t.artists : '',
        album: typeof t.album === 'string' ? t.album : '',
        duration: typeof t.duration === 'string' ? t.duration : '',
        cover: typeof t.cover === 'string' ? t.cover : '',
      }),
    })
  }
  return list.sort((a, b) => b.at - a.at)
}

export function appendPlayLog(track: PlaylistTrack, at: number = Date.now()): void {
  const list = readPlayLog()
  const last = list[0]
  if (last && recentKey(last.track) === recentKey(track)) {
    // Entri terakhir dari jurnal native untuk lagu yang sama: JS yang baru bangun mencatat lagu itu lagi, jangan ganda.
    const span = last.native ? NATIVE_AFTER_MS : DEDUPE_MS
    if (at - last.at < span) return
  }
  const next = [{ track: toStoredTrack(track), at }, ...list].slice(0, MAX_LOG)
  writeJson(KEY, { version: 1, items: next })
}

/**
 * Memasukkan lagu yang diputar native saat JS tidak melihatnya (jurnal native). Entri yang sudah dicatat JS (id sama, waktu
 * berdekatan) atau sudah pernah masuk dari jurnal yang sama dilewati. Mengembalikan entri yang benar-benar ditambahkan.
 */
export function mergeNativePlays(items: ReadonlyArray<{ track: PlaylistTrack; at: number }>): PlayLogEntry[] {
  const list = readPlayLog()
  const existing = list.slice()
  const added: PlayLogEntry[] = []
  for (const item of [...items].sort((a, b) => a.at - b.at)) {
    const duplicate = existing.some((entry) => {
      if (entry.track.id !== item.track.id) return false
      if (entry.native) return entry.at === item.at
      return entry.at >= item.at - NATIVE_BEFORE_MS && entry.at <= item.at + NATIVE_AFTER_MS
    })
    if (duplicate) continue
    const entry: PlayLogEntry = { track: toStoredTrack(item.track), at: item.at, native: true }
    added.push(entry)
    list.push(entry)
  }
  if (added.length === 0) return []
  const next = list.sort((a, b) => b.at - a.at).slice(0, MAX_LOG)
  writeJson(KEY, { version: 1, items: next.map((e) => ({ track: e.track, at: e.at, ...(e.native ? { native: true } : {}) })) })
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(PLAY_LOG_EVENT))
  return added
}

export function clearPlayLog(): void {
  removeKey(KEY)
}

/** Dikirim ke `window` setelah satu entri riwayat dihapus, supaya halaman Riwayat yang terbuka ikut menyegarkan diri. */
export const PLAY_LOG_EVENT = 'musicverse:play-log-changed'

/**
 * Menghapus satu entri riwayat (diidentifikasi waktu putarnya `at`; `trackId` mempersempit bila dua entri kebetulan
 * sama waktunya). Mengembalikan false bila tidak ada yang cocok. Entri lain tidak disentuh.
 */
export function removePlayLogEntry(at: number, trackId?: string): boolean {
  const list = readPlayLog()
  const next = list.filter((entry) => !(entry.at === at && (trackId === undefined || entry.track.id === trackId)))
  if (next.length === list.length) return false
  writeJson(KEY, { version: 1, items: next })
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(PLAY_LOG_EVENT))
  return true
}

export interface PlayStats {
  total: number
  unique: number
  topTracks: Array<{ track: PlaylistTrack; count: number }>
  topArtists: Array<{ name: string; count: number }>
}

export function splitArtists(artists: string): string[] {
  return artists
    .split(',')
    .map((a) => a.trim())
    .filter(Boolean)
}

export function computeStats(log: readonly PlayLogEntry[], top = 5): PlayStats {
  const tracks = new Map<string, { track: PlaylistTrack; count: number }>()
  const artists = new Map<string, number>()
  for (const { track } of log) {
    const key = recentKey(track)
    const hit = tracks.get(key)
    if (hit) hit.count += 1
    else tracks.set(key, { track, count: 1 })
    for (const name of splitArtists(track.artists)) artists.set(name, (artists.get(name) ?? 0) + 1)
  }
  return {
    total: log.length,
    unique: tracks.size,
    topTracks: [...tracks.values()].sort((a, b) => b.count - a.count).slice(0, top),
    topArtists: [...artists.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, top),
  }
}
