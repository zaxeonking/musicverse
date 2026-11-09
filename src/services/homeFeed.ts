import type { PlaylistTrack } from '../types/spotify'
import { readJson, writeJson } from '../utils/safeStorage'
import { normalizeSearchText } from '../utils/trackSearch'
import { cachedArtistSearch } from '../utils/artistSearchStore'
import {
  fetchArtistRadio,
  fetchChartArtists,
  fetchChartTracks,
  fetchGenreArtists,
  fetchGenres,
  fetchGenreTracks,
  fetchMoodTracks,
  searchTrackArtist,
  type ArtistHit,
  type GenreHit,
} from './artistApi'

/**
 * Bahan Beranda (banner, rekomendasi, foto artis). Semuanya dari Deezer lewat `artistApi`, disimpan di perangkat
 * dengan masa berlaku supaya Beranda cepat dan hemat permintaan. Galat jaringan tidak pernah dilempar:
 * bila gagal dan ada salinan lama, salinan lama dipakai; bila tidak, hasilnya null dan bagian itu tidak tampil.
 * Seperti pencarian artis, hanya jalan di APK (Deezer tidak membuka CORS untuk browser).
 */

const HOUR = 3_600_000
const DAY = 24 * HOUR

async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T | null> {
  const out = readJson(key)
  let stale: T | null = null
  if (out.status === 'ok' && typeof out.value === 'object' && out.value !== null) {
    const entry = out.value as { at?: unknown; data?: unknown }
    if (typeof entry.at === 'number' && entry.data !== undefined) {
      stale = entry.data as T
      if (Date.now() - entry.at < ttlMs) return stale
    }
  }
  try {
    const data = await load()
    writeJson(key, { at: Date.now(), data })
    return data
  } catch {
    return stale
  }
}

export function getChartTracks(): Promise<PlaylistTrack[] | null> {
  return cached('mv:home:chart-tracks:v1', 6 * HOUR, () => fetchChartTracks(30))
}

export function getChartArtists(): Promise<ArtistHit[] | null> {
  return cached('mv:home:chart-artists:v1', 6 * HOUR, () => fetchChartArtists(20))
}

/** Lagu rekomendasi (radio artis) untuk satu benih. */
export function getArtistRadio(artistId: string): Promise<PlaylistTrack[] | null> {
  return cached(`mv:home:radio:${artistId}`, 12 * HOUR, () => fetchArtistRadio(artistId, 20))
}

/** Artis (dengan foto) dari nama artis yang pernah didengar. */
export async function resolveArtistByName(name: string): Promise<ArtistHit | null> {
  const key = normalizeSearchText(name)
  if (!key) return null
  return cached(`mv:home:artist:${key}`, 30 * DAY, async () => {
    const found = await cachedArtistSearch(name)
    if (found.length === 0) throw new Error('not found')
    return found[0]
  })
}

/** Artis dari kata kunci yang pernah dicari (judul atau nama artis). */
export async function resolveArtistByQuery(query: string): Promise<ArtistHit | null> {
  const key = normalizeSearchText(query)
  if (!key) return null
  return cached(`mv:home:seed:${key}`, 30 * DAY, async () => {
    const hit = await searchTrackArtist(query)
    if (!hit) throw new Error('not found')
    return hit
  })
}

/* ---------- Tab Cari (kosong) ---------- */

export function getGenres(): Promise<GenreHit[] | null> {
  return cached('mv:browse:genres:v1', 7 * DAY, () => fetchGenres())
}

export function getGenreTracks(genreId: string): Promise<PlaylistTrack[] | null> {
  return cached(`mv:browse:genre-tracks:${genreId}`, 6 * HOUR, () => fetchGenreTracks(genreId, 50))
}

export function getGenreArtists(genreId: string): Promise<ArtistHit[] | null> {
  return cached(`mv:browse:genre-artists:${genreId}`, 6 * HOUR, () => fetchGenreArtists(genreId, 12))
}

export function getMoodTracks(query: string): Promise<PlaylistTrack[] | null> {
  return cached(`mv:browse:mood:${normalizeSearchText(query)}`, 12 * HOUR, async () => {
    const tracks = await fetchMoodTracks(query, 50)
    if (tracks.length === 0) throw new Error('empty')
    return tracks
  })
}
