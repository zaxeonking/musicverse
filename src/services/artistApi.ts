import { pluginFetch } from '../plugins/http'
import { formatDurationMs } from '../plugins/spotifyImporter'
import type { PlaylistTrack } from '../types/spotify'
import { normalizeSearchText } from '../utils/trackSearch'

/**
 * Pencarian artis dari luar (katalog iTunes / Apple Music), bukan dari playlist di perangkat.
 *  1. searchArtists      : nama -> daftar artis (musicArtist).
 *  2. fetchArtistSongs   : artistId -> lagu-lagu artis itu (lookup entity=song, maks 200 dari Apple).
 * Audio TIDAK diambil di sini: lagu diputar lewat alur yang sama (judul + artis -> plugin ytmusic).
 * Memakai pluginFetch (HTTP native, bebas CORS), jadi seperti saran pencarian: hanya jalan di APK.
 */

/** Storefront. Artis Indonesia sering tidak ada di katalog US, jadi pakai ID. */
const STORE = 'ID'
const BASE = 'https://itunes.apple.com'

export interface ArtistHit {
  id: string
  name: string
  genre: string
}

interface ItunesRow {
  wrapperType?: string
  artistId?: number
  artistName?: string
  primaryGenreName?: string
  trackId?: number
  trackName?: string
  collectionName?: string
  trackTimeMillis?: number
  artworkUrl100?: string
  trackViewUrl?: string
}

async function getRows(url: string, signal?: AbortSignal): Promise<ItunesRow[]> {
  const response = await pluginFetch(url, { headers: { Accept: 'application/json' }, timeoutMs: 10_000, signal })
  const body = JSON.parse(await response.text()) as { results?: unknown }
  return Array.isArray(body.results) ? (body.results as ItunesRow[]) : []
}

export async function searchArtists(query: string, signal?: AbortSignal): Promise<ArtistHit[]> {
  const term = query.trim()
  if (!term) return []
  const rows = await getRows(
    `${BASE}/search?term=${encodeURIComponent(term)}&media=music&entity=musicArtist&limit=8&country=${STORE}`,
    signal,
  )
  const seen = new Set<string>()
  const out: ArtistHit[] = []
  for (const row of rows) {
    if (!row.artistId || !row.artistName) continue
    const id = String(row.artistId)
    if (seen.has(id)) continue
    seen.add(id)
    out.push({ id, name: row.artistName, genre: row.primaryGenreName ?? '' })
  }
  return out
}

export async function fetchArtistSongs(artistId: string, signal?: AbortSignal): Promise<PlaylistTrack[]> {
  const rows = await getRows(`${BASE}/lookup?id=${encodeURIComponent(artistId)}&entity=song&limit=200&country=${STORE}`, signal)
  const seen = new Set<string>()
  const out: PlaylistTrack[] = []
  for (const row of rows) {
    // Baris pertama adalah artisnya sendiri (wrapperType 'artist'); sisanya lagu.
    if (row.wrapperType !== 'track' || !row.trackName) continue
    // Lagu yang sama sering muncul di banyak album/rilis: satu saja per judul.
    const key = normalizeSearchText(row.trackName)
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      id: `it-${row.trackId ?? out.length}`,
      title: row.trackName,
      artists: row.artistName ?? '',
      album: row.collectionName ?? '',
      duration: formatDurationMs(row.trackTimeMillis),
      cover: (row.artworkUrl100 ?? '').replace('100x100', '300x300'),
      // URL lagu wajib non-kosong (validasi Koleksi/Riwayat). Bukan tautan Spotify, jadi tombol "buka di Spotify" otomatis tersembunyi.
      url: row.trackViewUrl ?? `${BASE}/search?term=${encodeURIComponent(row.trackName)}`,
    })
  }
  return out
}
