import { pluginFetch } from '../plugins/http'
import { formatDurationMs } from '../plugins/spotifyImporter'
import type { PlaylistTrack } from '../types/spotify'
import { normalizeSearchText } from '../utils/trackSearch'
import { pickDeezerTrackId } from '../utils/deezerMatch'

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
  artist?: { id?: number; name?: string }
  album?: { id?: number; title?: string; cover_medium?: string }
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

function mapDeezerRows(rows: readonly DeezerTrack[]): PlaylistTrack[] {
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

async function deezerTopSongs(artistId: string, signal?: AbortSignal): Promise<PlaylistTrack[]> {
  const rows = await getList<DeezerTrack>(`${DEEZER}/artist/${encodeURIComponent(artistId)}/top?limit=100`, 'data', signal)
  return mapDeezerRows(rows)
}

/**
 * Radio artis Deezer: campuran lagu artis itu dan artis-artis yang mirip (dipilih Deezer). Dipakai radio otomatis.
 * Hanya jalan di APK (pluginFetch, bebas CORS), sama seperti pencarian artis.
 */
export async function fetchArtistRadio(artistId: string, limit = 40, signal?: AbortSignal): Promise<PlaylistTrack[]> {
  const rows = await getList<DeezerTrack>(`${DEEZER}/artist/${encodeURIComponent(artistId)}/radio?limit=${limit}`, 'data', signal)
  return mapDeezerRows(rows)
}

/** Calon lagu radio beserta id Deezer-nya (untuk menilai kecocokan genre dan tempo). */
export interface RadioCandidate {
  track: PlaylistTrack
  dzId?: string
  albumId?: string
}

/** Versi `fetchArtistRadio` yang menyimpan id lagu dan album Deezer. */
export async function fetchArtistRadioCandidates(artistId: string, limit = 60, signal?: AbortSignal): Promise<RadioCandidate[]> {
  const rows = await getList<DeezerTrack>(`${DEEZER}/artist/${encodeURIComponent(artistId)}/radio?limit=${limit}`, 'data', signal)
  const out: RadioCandidate[] = []
  for (const row of rows) {
    const [track] = mapDeezerRows([row])
    if (!track) continue
    out.push({ track, dzId: row.id ? String(row.id) : undefined, albumId: row.album?.id ? String(row.album.id) : undefined })
  }
  return out
}

export interface DeezerSeed {
  artistId?: string
  dzId?: string
  albumId?: string
}

/** Cari lagu yang sedang diputar di Deezer (judul + artis) untuk mendapat id artis, lagu, dan albumnya. Tidak ketemu = null. */
export async function findDeezerSeed(title: string, artist: string, signal?: AbortSignal): Promise<DeezerSeed | null> {
  const q = `artist:"${artist.replace(/"/g, '')}" track:"${title.replace(/"/g, '')}"`
  const rows = await getList<DeezerTrack>(`${DEEZER}/search?q=${encodeURIComponent(q)}&limit=5`, 'data', signal)
  const wantedTitle = normalizeSearchText(title)
  const wantedArtist = normalizeSearchText(artist)
  const hit =
    rows.find((row) => normalizeSearchText(row.title ?? '') === wantedTitle && normalizeSearchText(row.artist?.name ?? '') === wantedArtist) ??
    rows.find((row) => normalizeSearchText(row.artist?.name ?? '') === wantedArtist)
  if (!hit) return null
  return {
    artistId: hit.artist?.id ? String(hit.artist.id) : undefined,
    dzId: hit.id ? String(hit.id) : undefined,
    albumId: hit.album?.id ? String(hit.album.id) : undefined,
  }
}

/**
 * Id lagu Deezer untuk rekaman yang SAMA (judul + artis + durasi cocok); null = tidak ada yang cocok. Dipakai mencari ISRC
 * lagu non-Deezer (mis. playlist Spotify). Galat jaringan dilempar (pemanggil memutuskan), "tidak ketemu" bukan galat.
 */
export async function findDeezerTrackId(title: string, artist: string, durationS: number | null, signal?: AbortSignal): Promise<string | undefined> {
  const q = `artist:"${artist.replace(/"/g, '')}" track:"${title.replace(/"/g, '')}"`
  const rows = await getList<DeezerTrack>(`${DEEZER}/search?q=${encodeURIComponent(q)}&limit=8`, 'data', signal)
  return pickDeezerTrackId(rows, title, artist, durationS)
}

const albumGenreCache = new Map<string, number[]>()
const trackTempoCache = new Map<string, number>()

/** Id genre album di Deezer (mis. Pop, Rap/Hip Hop). Hasil disimpan selama aplikasi berjalan. */
export async function fetchAlbumGenreIds(albumId: string, signal?: AbortSignal): Promise<number[]> {
  const cached = albumGenreCache.get(albumId)
  if (cached) return cached
  const body = await getJson(`${DEEZER}/album/${encodeURIComponent(albumId)}`, signal)
  const data = (body.genres as { data?: { id?: number }[] } | undefined)?.data
  const ids = Array.isArray(data) ? data.map((genre) => genre.id).filter((id): id is number => typeof id === 'number' && id > 0) : []
  albumGenreCache.set(albumId, ids)
  return ids
}

/** Tempo (BPM) lagu dari Deezer; 0 = tidak diketahui. Hasil disimpan selama aplikasi berjalan. */
export async function fetchTrackTempo(dzId: string, signal?: AbortSignal): Promise<number> {
  const cached = trackTempoCache.get(dzId)
  if (cached !== undefined) return cached
  const body = await getJson(`${DEEZER}/track/${encodeURIComponent(dzId)}`, signal)
  const bpm = typeof body.bpm === 'number' && Number.isFinite(body.bpm) && body.bpm > 0 ? body.bpm : 0
  trackTempoCache.set(dzId, bpm)
  return bpm
}

/** ISRC lagu dari Deezer (`/track/{id}`); undefined = tidak ada. Pencarian Deezer tidak menyertakan ISRC, jadi perlu panggilan ini. */
export async function fetchTrackIsrc(dzId: string, signal?: AbortSignal): Promise<string | undefined> {
  const body = await getJson(`${DEEZER}/track/${encodeURIComponent(dzId)}`, signal)
  return typeof body.isrc === 'string' && body.isrc.trim() !== '' ? body.isrc.trim().toUpperCase() : undefined
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

/* ---------- Bahan Beranda: chart dunia dan penentuan artis dari kata kunci ---------- */

interface DeezerSearchTrack extends DeezerTrack {
  artist?: { id?: number; name?: string; picture_big?: string; picture_medium?: string }
}

/** Lagu teratas chart Deezer. Dipakai Beranda (banner dan rekomendasi) saat belum ada riwayat dengar. */
export async function fetchChartTracks(limit = 30, signal?: AbortSignal): Promise<PlaylistTrack[]> {
  const rows = await getList<DeezerTrack>(`${DEEZER}/chart/0/tracks?limit=${limit}`, 'data', signal)
  return mapDeezerRows(rows)
}

/** Artis teratas chart Deezer. */
export async function fetchChartArtists(limit = 20, signal?: AbortSignal): Promise<ArtistHit[]> {
  const rows = await getList<DeezerArtist>(`${DEEZER}/chart/0/artists?limit=${limit}`, 'data', signal)
  const out: ArtistHit[] = []
  for (const row of rows) {
    if (!row.id || !row.name) continue
    out.push({ id: String(row.id), name: row.name, picture: pictureOf(row), fans: row.nb_fan ?? 0 })
  }
  return out
}

/**
 * Artis dari hasil teratas pencarian bebas (judul lagu ATAU nama artis). Dipakai Beranda untuk mengubah
 * kata kunci yang pernah dicari menjadi "benih" rekomendasi. Null bila tidak ada hasil.
 */
export async function searchTrackArtist(query: string, signal?: AbortSignal): Promise<ArtistHit | null> {
  const term = query.trim()
  if (!term) return null
  const rows = await getList<DeezerSearchTrack>(`${DEEZER}/search?q=${encodeURIComponent(term)}&limit=1`, 'data', signal)
  const artist = rows[0]?.artist
  if (!artist?.id || !artist.name) return null
  return { id: String(artist.id), name: artist.name, picture: pictureOf(artist), fans: 0 }
}

/* ---------- Bahan tab Cari (kosong): genre dan suasana ---------- */

export interface GenreHit {
  id: string
  name: string
  picture: string
}

/** Daftar genre Deezer (tanpa "Semua"). */
export async function fetchGenres(signal?: AbortSignal): Promise<GenreHit[]> {
  const rows = await getList<{ id?: number; name?: string; picture_medium?: string }>(`${DEEZER}/genre`, 'data', signal)
  const out: GenreHit[] = []
  for (const row of rows) {
    if (!row.id || !row.name) continue
    out.push({ id: String(row.id), name: row.name, picture: row.picture_medium ?? '' })
  }
  return out
}

/** Lagu teratas satu genre. */
export async function fetchGenreTracks(genreId: string, limit = 50, signal?: AbortSignal): Promise<PlaylistTrack[]> {
  const rows = await getList<DeezerTrack>(`${DEEZER}/chart/${encodeURIComponent(genreId)}/tracks?limit=${limit}`, 'data', signal)
  return mapDeezerRows(rows)
}

/** Artis teratas satu genre. */
export async function fetchGenreArtists(genreId: string, limit = 12, signal?: AbortSignal): Promise<ArtistHit[]> {
  const rows = await getList<DeezerArtist>(`${DEEZER}/chart/${encodeURIComponent(genreId)}/artists?limit=${limit}`, 'data', signal)
  const out: ArtistHit[] = []
  for (const row of rows) {
    if (!row.id || !row.name) continue
    out.push({ id: String(row.id), name: row.name, picture: pictureOf(row), fans: row.nb_fan ?? 0 })
  }
  return out
}

/**
 * Lagu untuk satu suasana: isi playlist Deezer teratas dari kata kunci (playlist kurasi lebih pas daripada mencocokkan judul).
 * Bila tidak ada playlist yang cukup besar, jatuh ke pencarian lagu biasa.
 */
export async function fetchMoodTracks(query: string, limit = 50, signal?: AbortSignal): Promise<PlaylistTrack[]> {
  const q = encodeURIComponent(query)
  const lists = await getList<{ id?: number }>(`${DEEZER}/search/playlist?q=${q}&limit=3`, 'data', signal)
  for (const list of lists) {
    if (!list.id) continue
    const rows = await getList<DeezerTrack>(`${DEEZER}/playlist/${list.id}/tracks?limit=${limit}`, 'data', signal)
    const tracks = mapDeezerRows(rows)
    if (tracks.length >= 10) return tracks
  }
  return mapDeezerRows(await getList<DeezerTrack>(`${DEEZER}/search?q=${q}&limit=${limit}`, 'data', signal))
}

/* ---------- Bahan Beranda ala StreamBeats: playlist kurasi dan rilisan baru ---------- */

export interface PlaylistHit {
  id: string
  title: string
  cover: string
  /** Sampul besar (±1000px), hanya untuk banner: jangan dipakai di kartu (memori gambar besar). */
  coverXl: string
  /** Jumlah lagu (0 bila tidak diketahui). */
  count: number
  /** Pembuat playlist (Deezer, editor, atau pengguna). */
  by: string
  /** Deskripsi; hanya terisi dari `fetchPlaylistDetail`. */
  description: string
}

export interface NewAlbumHit {
  id: string
  title: string
  artist: string
  cover: string
}

interface DeezerPlaylist {
  id?: number
  title?: string
  description?: string
  nb_tracks?: number
  picture_big?: string
  picture_xl?: string
  picture_medium?: string
  user?: { name?: string }
  creator?: { name?: string }
  tracks?: { data?: DeezerTrack[] }
}

function mapPlaylistRow(row: DeezerPlaylist): PlaylistHit | null {
  if (!row.id || !row.title) return null
  return {
    id: String(row.id),
    title: row.title,
    cover: row.picture_big || row.picture_medium || row.picture_xl || '',
    coverXl: row.picture_xl || row.picture_big || row.picture_medium || '',
    count: row.nb_tracks ?? 0,
    by: row.user?.name || row.creator?.name || '',
    description: (row.description ?? '').trim(),
  }
}

/** Playlist yang sedang ramai di chart Deezer ("Trending community playlists"). */
export async function fetchChartPlaylists(limit = 12, signal?: AbortSignal): Promise<PlaylistHit[]> {
  const rows = await getList<DeezerPlaylist>(`${DEEZER}/chart/0/playlists?limit=${limit}`, 'data', signal)
  return rows.flatMap((row) => mapPlaylistRow(row) ?? [])
}

/** Playlist dari kata kunci. `limit` kecil: tiap kata kunci hanya mengambil beberapa teratas. */
export async function searchPlaylists(query: string, limit = 2, signal?: AbortSignal): Promise<PlaylistHit[]> {
  const term = query.trim()
  if (!term) return []
  const rows = await getList<DeezerPlaylist>(`${DEEZER}/search/playlist?q=${encodeURIComponent(term)}&limit=${limit}`, 'data', signal)
  return rows.flatMap((row) => mapPlaylistRow(row) ?? [])
}

/** Satu playlist lengkap: deskripsi dan lagunya (satu permintaan). */
export async function fetchPlaylistDetail(playlistId: string, signal?: AbortSignal): Promise<{ playlist: PlaylistHit; tracks: PlaylistTrack[] } | null> {
  const body = (await getJson(`${DEEZER}/playlist/${encodeURIComponent(playlistId)}`, signal)) as DeezerPlaylist
  const playlist = mapPlaylistRow(body)
  if (!playlist) return null
  return { playlist, tracks: mapDeezerRows((body.tracks?.data ?? []).slice(0, 100)) }
}

/** Album dan single yang baru rilis (pilihan editor Deezer). */
export async function fetchNewReleases(limit = 16, signal?: AbortSignal): Promise<NewAlbumHit[]> {
  const rows = await getList<{ id?: number; title?: string; cover_big?: string; cover_medium?: string; artist?: { name?: string } }>(
    `${DEEZER}/editorial/0/releases?limit=${limit}`,
    'data',
    signal,
  )
  const out: NewAlbumHit[] = []
  for (const row of rows) {
    if (!row.id || !row.title) continue
    out.push({ id: String(row.id), title: row.title, artist: row.artist?.name ?? '', cover: row.cover_big || row.cover_medium || '' })
  }
  return out
}
