import { normalizeSearchText } from './trackSearch'
import { stripArtistPrefix } from './trackTitle'

/** Bagian lagu yang cukup untuk mengenali lagu yang sama (PlaylistTrack, unduhan, lokal, riwayat). */
export interface SongRef {
  id?: string
  title: string
  artists?: string
  url?: string
}

interface SongKey {
  title: string
  artists: string[]
}

function plain(value: string): string {
  return normalizeSearchText(value)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const cache = new Map<string, SongKey>()
const CACHE_MAX = 4000

function keyOf(song: SongRef): SongKey {
  const artistsRaw = song.artists ?? ''
  const cacheKey = `${song.title}\u0001${artistsRaw}`
  const hit = cache.get(cacheKey)
  if (hit) return hit
  const artists = normalizeSearchText(artistsRaw)
    .split(/\s*(?:,|&|;| feat\.? | ft\.? | and | x )\s*/)
    .map(plain)
    .filter(Boolean)
  const key: SongKey = { title: plain(stripArtistPrefix(song.title, artistsRaw)), artists }
  if (cache.size >= CACHE_MAX) cache.clear()
  cache.set(cacheKey, key)
  return key
}

/**
 * Lagu yang sama walau datang dari sumber berbeda (hasil cari, album, daftar lagu artis, playlist, unduhan, lokal): ID lagu
 * tiap sumber bisa berbeda untuk lagu yang sama, jadi dikenali dari ID / URL yang persis sama, atau judul yang sama dan
 * artisnya beririsan (bila salah satu tidak punya artis, judul saja cukup). Judul bahasa/ejaan lain atau versi yang berbeda
 * (mis. "(Live)") dianggap lagu lain.
 */
export function isSameSong(a: SongRef, b: SongRef): boolean {
  if (a.id && b.id && a.id === b.id) return true
  if (a.url && b.url && a.url === b.url) return true
  const ka = keyOf(a)
  const kb = keyOf(b)
  if (!ka.title || ka.title !== kb.title) return false
  if (ka.artists.length === 0 || kb.artists.length === 0) return true
  return ka.artists.some((name) => kb.artists.includes(name))
}

/**
 * Pencocokan untuk daftar: bila lagu aktif ada di daftar dengan ID yang persis sama, hanya baris itu yang dianggap aktif
 * (daftar dengan dua versi judul sama tidak menyala dua-duanya); bila tidak, semua baris yang lagu yang sama.
 */
export function makeSongMatcher(list: readonly SongRef[], playing: SongRef | null | undefined): (song: SongRef) => boolean {
  if (!playing) return () => false
  const exact = playing.id ? list.some((song) => song.id === playing.id) : false
  if (exact) return (song) => song.id === playing.id
  return (song) => isSameSong(song, playing)
}

/** Judul yang sudah dinormalkan (tanpa awalan "Artis - ", huruf kecil, tanpa tanda baca): kunci pengelompokan sebelum `isSameSong`. */
export function songTitleKey(song: SongRef): string {
  return keyOf(song).title
}
