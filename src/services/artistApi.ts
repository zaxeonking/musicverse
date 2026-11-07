import { pluginFetch } from '../plugins/http'
import { formatDurationMs } from '../plugins/spotifyImporter'
import type { PlaylistTrack } from '../types/spotify'
import { normalizeSearchText } from '../utils/trackSearch'

/**
 * Pencarian artis dari luar, bukan dari playlist di perangkat. Gabungan dua sumber (hybrid):
 *  - Deezer  : daftar artis (foto profil, jumlah penggemar) + 100 lagu terpopuler (urutan teratas).
 *  - iTunes  : lagu selengkapnya (sampai 200 per profil artis), dipakai melengkapi daftar Deezer.
 * Audio TIDAK diambil di sini: lagu diputar lewat alur yang sama (judul + artis -> plugin ytmusic).
 * Memakai pluginFetch (HTTP native, bebas CORS), jadi seperti saran pencarian: hanya jalan di APK.
 */

const DEEZER = 'https://api.deezer.com'
const ITUNES = 'https://itunes.apple.com'
/** Storefront iTunes. Artis Indonesia sering tidak ada di katalog US, jadi pakai ID. */
const STORE = 'ID'
/** Satu artis kadang punya beberapa profil di iTunes ("Ungu" dan "UNGU"): gabungkan paling banyak segini. */
const MAX_ITUNES_PROFILES = 3

export interface ArtistHit {
  id: string
  name: string
  /** URL foto profil (kosong jika tidak ada). */
  picture: string
  /** Jumlah penggemar; 0 jika tidak diketahui. */
  fans: number
}

interface DeezerArtist {
  id?: number
  name?: string
  picture_medium?: string
  picture_big?: string
  nb_fan?: number
}

export interface AlbumHit {
  id: string
  title: string
  cover: string
  /** Tahun rilis (kosong jika tidak diketahui). */
  year: string
  /** Album, Single, EP, dst. */
  kind: string
  /** Disusun dari lagu yang sudah dimuat (cadangan bila daftar album Deezer kosong/gagal), bukan dari API album. */
  local?: boolean
}

interface DeezerAlbum {
  id?: number
  title?: string
  cover_medium?: string
  release_date?: string
  record_type?: string
}

interface DeezerTrack {
  id?: number
  title?: string
  duration?: number
  link?: string
  artist?: { name?: string }
  album?: { title?: string; cover_medium?: string }
}

interface ItunesRow {
  wrapperType?: string
  artistId?: number
  artistName?: string
  trackId?: number
  trackName?: string
  collectionName?: string
  trackTimeMillis?: number
  artworkUrl100?: string
  trackViewUrl?: string
}

async function getJson(url: string, signal?: AbortSignal): Promise<Record<string, unknown>> {
  const response = await pluginFetch(url, { headers: { Accept: 'application/json' }, timeoutMs: 10_000, signal })
  const body = JSON.parse(await response.text()) as Record<string, unknown>
  // Deezer membalas galat (mis. kuota habis) dengan HTTP 200 dan { error }. Itu kegagalan, bukan "tidak ada hasil".
  if (body.error) throw new Error(`Deezer: ${JSON.stringify(body.error).slice(0, 120)}`)
  return body
}

async function getList<T>(url: string, key: 'data' | 'results', signal?: AbortSignal): Promise<T[]> {
  const body = await getJson(url, signal)
  return Array.isArray(body[key]) ? (body[key] as T[]) : []
}

/**
 * Gambar bawaan Deezer untuk artis tanpa foto (siluet abu-abu) dianggap kosong, supaya tampil gradien app.
 * Cirinya: alamat tanpa kode gambar (…/artist//…) atau kode md5 string kosong (d41d8cd9…).
 */
function pictureOf(row: DeezerArtist): string {
  const url = row.picture_big || row.picture_medium || ''
  return /\/artist\/\/|d41d8cd98f00b204e9800998ecf8427e/.test(url) ? '' : url
}

export async function searchArtists(query: string, signal?: AbortSignal): Promise<ArtistHit[]> {
  const term = query.trim()
  if (!term) return []
  const rows = await getList<DeezerArtist>(`${DEEZER}/search/artist?q=${encodeURIComponent(term)}&limit=10`, 'data', signal)
  const seen = new Set<string>()
  const out: ArtistHit[] = []
  for (const row of rows) {
    if (!row.id || !row.name) continue
    const id = String(row.id)
    if (seen.has(id)) continue
    seen.add(id)
    out.push({ id, name: row.name, picture: pictureOf(row), fans: row.nb_fan ?? 0 })
  }
  // Penggemar terbanyak di atas (sort stabil: yang sama banyak tetap urutan relevansi Deezer).
  return out.sort((a, b) => b.fans - a.fans)
}

async function deezerTopSongs(artistId: string, signal?: AbortSignal): Promise<PlaylistTrack[]> {
  const rows = await getList<DeezerTrack>(`${DEEZER}/artist/${encodeURIComponent(artistId)}/top?limit=100`, 'data', signal)
  const out: PlaylistTrack[] = []
  for (const row of rows) {
    if (!row.title) continue
    out.push({
      id: `dz-${row.id ?? out.length}`,
      title: row.title,
      artists: row.artist?.name ?? '',
      album: row.album?.title ?? '',
      duration: formatDurationMs((row.duration ?? 0) * 1000),
      cover: row.album?.cover_medium ?? '',
      // URL lagu wajib non-kosong (validasi Koleksi/Riwayat). Bukan tautan Spotify, jadi tombol "buka di Spotify" otomatis tersembunyi.
      url: row.link ?? `https://www.deezer.com/search/${encodeURIComponent(row.title)}`,
    })
  }
  return out
}

/** Profil iTunes yang namanya sama persis dengan artis Deezer (huruf besar/kecil diabaikan). */
async function itunesProfiles(name: string, signal?: AbortSignal): Promise<string[]> {
  const rows = await getList<ItunesRow>(
    `${ITUNES}/search?term=${encodeURIComponent(name)}&media=music&entity=musicArtist&limit=10&country=${STORE}`,
    'results',
    signal,
  )
  const wanted = normalizeSearchText(name)
  const ids: string[] = []
  for (const row of rows) {
    if (!row.artistId || !row.artistName || normalizeSearchText(row.artistName) !== wanted) continue
    const id = String(row.artistId)
    if (!ids.includes(id)) ids.push(id)
    if (ids.length >= MAX_ITUNES_PROFILES) break
  }
  return ids
}

async function itunesSongs(profileId: string, signal?: AbortSignal): Promise<PlaylistTrack[]> {
  const rows = await getList<ItunesRow>(`${ITUNES}/lookup?id=${encodeURIComponent(profileId)}&entity=song&limit=200&country=${STORE}`, 'results', signal)
  const out: PlaylistTrack[] = []
  for (const row of rows) {
    // Baris pertama adalah artisnya sendiri (wrapperType 'artist'); sisanya lagu.
    if (row.wrapperType !== 'track' || !row.trackName) continue
    out.push({
      id: `it-${row.trackId ?? `${profileId}-${out.length}`}`,
      title: row.trackName,
      artists: row.artistName ?? '',
      album: row.collectionName ?? '',
      duration: formatDurationMs(row.trackTimeMillis),
      cover: (row.artworkUrl100 ?? '').replace('100x100', '300x300'),
      url: row.trackViewUrl ?? `${ITUNES}/search?term=${encodeURIComponent(row.trackName)}`,
    })
  }
  return out
}

const keyOf = (track: PlaylistTrack) => normalizeSearchText(track.title)

/**
 * Semua lagu artis: 100 terpopuler Deezer di urutan teratas, lalu sisanya dari iTunes.
 * Profil iTunes hanya dipakai kalau ADA lagunya yang juga ada di daftar Deezer (mencegah artis lain yang namanya sama);
 * kalau Deezer kosong, profil iTunes pertama yang namanya persis sama dipakai.
 * Gagal total hanya jika kedua sumber gagal; kalau salah satu saja yang gagal, hasil sumber lain tetap ditampilkan.
 */
export async function fetchArtistSongs(artist: ArtistHit, signal?: AbortSignal): Promise<PlaylistTrack[]> {
  const [deezerResult, profilesResult] = await Promise.allSettled([
    deezerTopSongs(artist.id, signal),
    itunesProfiles(artist.name, signal),
  ])
  if (signal?.aborted) throw new Error('aborted')
  const deezer = deezerResult.status === 'fulfilled' ? deezerResult.value : []
  const profiles = profilesResult.status === 'fulfilled' ? profilesResult.value : []
  if (deezerResult.status === 'rejected' && profilesResult.status === 'rejected') throw deezerResult.reason

  const songResults = await Promise.allSettled(profiles.map((id) => itunesSongs(id, signal)))
  if (signal?.aborted) throw new Error('aborted')
  const profileSongs = songResults.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []))
  if (deezer.length === 0 && profileSongs.length === 0 && deezerResult.status === 'rejected') throw deezerResult.reason

  const deezerKeys = new Set(deezer.map(keyOf))
  const accepted = deezer.length === 0 ? profileSongs.slice(0, 1) : profileSongs.filter((songs) => songs.some((song) => deezerKeys.has(keyOf(song))))

  const seen = new Set<string>()
  const out: PlaylistTrack[] = []
  for (const track of [...deezer, ...accepted.flat()]) {
    const key = keyOf(track)
    // Judul yang sama sering muncul dari beberapa rilis/sumber: satu saja (Deezer lebih dulu).
    if (seen.has(key)) continue
    seen.add(key)
    out.push(track)
  }
  return out
}

const ALBUM_KIND: Record<string, string> = { album: 'Album', single: 'Single', ep: 'EP', compile: 'Kompilasi' }

/** Diskografi artis (terbaru dulu), satu entri per judul. */
export async function fetchArtistAlbums(artistId: string, signal?: AbortSignal): Promise<AlbumHit[]> {
  const rows = await getList<DeezerAlbum>(`${DEEZER}/artist/${encodeURIComponent(artistId)}/albums?limit=100`, 'data', signal)
  const sorted = rows.filter((row) => row.id && row.title).sort((a, b) => (b.release_date ?? '').localeCompare(a.release_date ?? ''))
  const seen = new Set<string>()
  const out: AlbumHit[] = []
  for (const row of sorted) {
    const key = normalizeSearchText(row.title ?? '')
    if (seen.has(key)) continue
    seen.add(key)
    const kind = (row.record_type ?? '').toLowerCase()
    out.push({
      id: String(row.id),
      title: row.title ?? '',
      cover: row.cover_medium ?? '',
      year: (row.release_date ?? '').slice(0, 4),
      kind: ALBUM_KIND[kind] ?? (kind ? kind.charAt(0).toUpperCase() + kind.slice(1) : 'Album'),
    })
  }
  return out
}

/** Lagu satu album, sesuai urutan di album. */
export async function fetchAlbumSongs(album: AlbumHit, artistName: string, signal?: AbortSignal): Promise<PlaylistTrack[]> {
  const rows = await getList<DeezerTrack>(`${DEEZER}/album/${encodeURIComponent(album.id)}/tracks?limit=200`, 'data', signal)
  const out: PlaylistTrack[] = []
  for (const row of rows) {
    if (!row.title) continue
    out.push({
      id: `dz-${row.id ?? `${album.id}-${out.length}`}`,
      title: row.title,
      artists: row.artist?.name ?? artistName,
      album: album.title,
      duration: formatDurationMs((row.duration ?? 0) * 1000),
      cover: album.cover,
      url: row.link ?? `https://www.deezer.com/search/${encodeURIComponent(row.title)}`,
    })
  }
  return out
}

/** Cadangan: kelompokkan lagu yang sudah dimuat berdasarkan nama albumnya (lagu Deezer dan iTunes sama-sama membawa nama album). */
export function albumsFromSongs(songs: readonly PlaylistTrack[]): AlbumHit[] {
  const groups = new Map<string, { title: string; cover: string; count: number }>()
  for (const song of songs) {
    const title = song.album.trim()
    if (!title) continue
    const key = normalizeSearchText(title)
    const group = groups.get(key)
    if (group) {
      group.count += 1
      if (!group.cover && song.cover) group.cover = song.cover
    } else {
      groups.set(key, { title, cover: song.cover, count: 1 })
    }
  }
  return [...groups.entries()].map(([key, group]) => ({
    id: `local:${key}`,
    title: group.title,
    cover: group.cover,
    year: '',
    kind: `${group.count} lagu`,
    local: true,
  }))
}
