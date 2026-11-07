import { isNativeApp } from '../native/platform'
import type { SpotifyApiPlaylistResponse, SpotifyApiTrack } from '../types/spotify'
import { pluginFetch } from './http'

/**
 * Impor playlist Spotify LANGSUNG ke Spotify (tanpa api.nexadev.my.id), port dari plugin `spotify-importer`
 * milik StreamBeats/bloom-factory. Urutan:
 *   1. token anonim dari halaman embed (`__NEXT_DATA__`), lalu playlist embed "seed", lalu /get_access_token
 *   2. API partner (pathfinder `fetchPlaylist`, lalu `queryPlaylist` lawas) dan API resmi api.spotify.com/v1 (paginasi
 *      100 lagu); dipakai yang mengembalikan lagu lebih banyak (API resmi dilewati bila partner sudah lengkap)
 *   3. bila token/partner/API gagal: baca data langsung dari halaman embed (hanya memuat sebagian lagu)
 * Hanya jalan di APK (butuh HTTP native bebas CORS). Di browser selalu gagal dengan `retryable: false`.
 *
 * Belum diport: client-credentials (butuh client id/secret) dan pemindaian JS web player untuk operasi selain
 * `fetchPlaylist` (plugin asli juga memakai hash tetap untuk `fetchPlaylist`).
 */

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const SEED_PLAYLISTS = ['37i9dQZF1DXcBWIGoYBM5M', '37i9dQZEVXbMDoHDwVN2tF', '37i9dQZF1DWXRqgorJj26U']
const TRACK_FIELDS =
  'total,next,items(track(id,name,duration_ms,is_local,explicit,artists(name),album(name,images(url))))'
/** Token dianggap habis bila sisa umurnya kurang dari ini (detik). */
const TOKEN_MIN_REMAINING_S = 30
const MAX_PAGES = 200
const PATHFINDER_URL = 'https://api-partner.spotify.com/pathfinder/v1/query'
/** Hash persisted-query yang sama dengan plugin asli (bukan hasil scraping). */
const FETCH_PLAYLIST_HASH = '32b05e92e438438408674f95d0fdad8082865dc32acd55bd97f5113b8579092b'
const QUERY_PLAYLIST_HASH = '908a5597b4d0af0489a9ad6a2d41bc3b416ff47c0884016d92bbd6822d0eb6d8'

export class ImporterError extends Error {
  /** false = diulang pun hasilnya sama (playlist tidak ada / privat / bukan di APK). */
  readonly retryable: boolean
  readonly aborted: boolean
  constructor(message: string, options: { retryable?: boolean; aborted?: boolean } = {}) {
    super(message)
    this.name = 'ImporterError'
    this.retryable = options.retryable ?? true
    this.aborted = options.aborted ?? false
  }
}

export interface ImportOptions {
  signal?: AbortSignal
}

type Json = Record<string, unknown>

interface AccessToken {
  token: string
  /** Detik epoch; null = tidak diketahui. */
  expiresAt: number | null
}

interface CollectionInfo {
  title: string
  author?: string
  cover: string
}

/* ------------------------------------------------------------------ */
/* Util                                                                */
/* ------------------------------------------------------------------ */

function isRecord(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function pick(root: unknown, path: ReadonlyArray<string | number>): unknown {
  let node: unknown = root
  for (const key of path) {
    if (Array.isArray(node) && typeof key === 'number') node = node[key]
    else if (isRecord(node) && typeof key === 'string') node = node[key]
    else return undefined
  }
  return node
}

/** Status HTTP dari pesan galat `pluginFetch` ("HTTP 404 dari host"); undefined bila bukan galat HTTP. */
export function httpStatusOf(error: unknown): number | undefined {
  const match = /HTTP (\d{3})/.exec(error instanceof Error ? error.message : String(error))
  return match ? Number(match[1]) : undefined
}

export function formatDurationMs(ms: number | undefined): string {
  if (!ms || ms <= 0) return ''
  const total = Math.round(ms / 1000)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

export function splitArtistsSubtitle(subtitle: string): string[] {
  return subtitle
    .replace(/\u00a0/g, ',')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new ImporterError('Permintaan dibatalkan.', { retryable: false, aborted: true })
}

async function getText(url: string, headers: Record<string, string>, signal?: AbortSignal): Promise<string> {
  throwIfAborted(signal)
  const response = await pluginFetch(url, { headers, signal, timeoutMs: 20_000 })
  return response.text()
}

async function getJson(url: string, headers: Record<string, string>, signal?: AbortSignal): Promise<unknown> {
  return JSON.parse(await getText(url, headers, signal))
}

/* ------------------------------------------------------------------ */
/* Halaman embed                                                       */
/* ------------------------------------------------------------------ */

/** Mengambil JSON `<script id="__NEXT_DATA__">` dari HTML; null bila tidak ada / rusak. */
export function extractNextData(html: string): unknown {
  const marker = html.indexOf('__NEXT_DATA__')
  if (marker < 0) return null
  const open = html.lastIndexOf('<script', marker)
  if (open < 0) return null
  const tagEnd = html.indexOf('>', open)
  if (tagEnd < 0) return null
  const close = html.indexOf('</script>', tagEnd + 1)
  if (close < 0) return null
  try {
    return JSON.parse(html.slice(tagEnd + 1, close).trim())
  } catch {
    return null
  }
}

function findDeep(root: unknown, keys: readonly string[], type: 'string' | 'number'): string | number | undefined {
  const stack: unknown[] = [root]
  while (stack.length > 0) {
    const node = stack.pop()
    if (Array.isArray(node)) {
      for (const child of node) stack.push(child)
    } else if (isRecord(node)) {
      for (const key of keys) {
        const value = node[key]
        if (type === 'string' && typeof value === 'string' && value) return value
        if (type === 'number' && typeof value === 'number') return value
      }
      for (const child of Object.values(node)) stack.push(child)
    }
  }
  return undefined
}

async function fetchEmbedHtml(kind: string, id: string, signal?: AbortSignal): Promise<string> {
  return getText(
    `https://open.spotify.com/embed/${kind}/${id}`,
    {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      Referer: 'https://open.spotify.com/',
    },
    signal,
  )
}

export function tokenFromEmbedHtml(html: string): AccessToken | null {
  const data = extractNextData(html)
  if (data !== null) {
    const token = findDeep(data, ['accessToken', 'access_token'], 'string')
    if (typeof token !== 'string') return null
    const expiresMs = findDeep(data, ['accessTokenExpirationTimestampMs'], 'number')
    return { token, expiresAt: typeof expiresMs === 'number' ? Math.floor(expiresMs / 1000) : null }
  }
  const raw = /"accessToken"\s*:\s*"([^"]+)"/.exec(html)
  if (!raw) return null
  const exp = /"accessTokenExpirationTimestampMs"\s*:\s*(\d+)/.exec(html)
  return { token: raw[1].trim(), expiresAt: exp ? Math.floor(Number(exp[1]) / 1000) : null }
}

export function entityFromEmbedHtml(html: string): Json {
  const data = extractNextData(html)
  if (data === null) throw new ImporterError('Data halaman embed Spotify tidak terbaca.')
  const entity = pick(data, ['props', 'pageProps', 'state', 'data', 'entity'])
  if (!isRecord(entity)) throw new ImporterError('Data playlist tidak ditemukan di halaman embed Spotify.')
  return entity
}

/* ------------------------------------------------------------------ */
/* Token                                                               */
/* ------------------------------------------------------------------ */

function tokenUsable(token: AccessToken | null, nowS: number): token is AccessToken {
  if (!token) return false
  return token.expiresAt === null || token.expiresAt - nowS > TOKEN_MIN_REMAINING_S
}

async function tokenFromAnonymousEndpoint(signal?: AbortSignal): Promise<AccessToken | null> {
  for (const reason of ['transport', 'init']) {
    try {
      const body = await getJson(
        `https://open.spotify.com/get_access_token?reason=${reason}&productType=web_player`,
        { Accept: '*/*', Referer: 'https://open.spotify.com/', 'User-Agent': USER_AGENT },
        signal,
      )
      const token = asString(pick(body, ['accessToken']))
      if (token) {
        const ms = asNumber(pick(body, ['accessTokenExpirationTimestampMs']))
        return { token, expiresAt: ms === undefined ? null : Math.floor(ms / 1000) }
      }
    } catch (error) {
      if (signal?.aborted) throw error
    }
  }
  return null
}

/** Token anonim web player berlaku ~1 jam: dipakai ulang oleh semua pemanggil (pencarian, info lagu, impor). */
let cachedToken: AccessToken | null = null
const TOKEN_ASSUMED_LIFETIME_S = 600

/** Buang token tersimpan (mis. setelah Spotify menolaknya dengan 401/403). */
export function invalidateAccessToken(): void {
  cachedToken = null
}

export async function getAccessToken(
  target: string | { kind: string; id: string } | null,
  signal?: AbortSignal,
  nowS = Date.now() / 1000,
): Promise<string> {
  if (tokenUsable(cachedToken, nowS)) return cachedToken.token
  const embed = typeof target === 'string' ? { kind: 'playlist', id: target } : target
  const sources: Array<() => Promise<AccessToken | null>> = [
    ...(embed ? [async () => tokenFromEmbedHtml(await fetchEmbedHtml(embed.kind, embed.id, signal))] : []),
    ...SEED_PLAYLISTS.map((seed) => async () => tokenFromEmbedHtml(await fetchEmbedHtml('playlist', seed, signal))),
    () => tokenFromAnonymousEndpoint(signal),
  ]
  // Semua sumber token dijalankan BERSAMAAN; yang pertama memberi token valid dipakai (dulu berurutan: tiap halaman
  // embed besar harus selesai/gagal dulu sebelum sumber berikutnya dicoba).
  const token = await new Promise<AccessToken | null>((resolve) => {
    let pending = sources.length
    let done = false
    const settle = (value: AccessToken | null): void => {
      if (done) return
      if (value !== null) {
        done = true
        resolve(value)
      } else if (--pending === 0) {
        done = true
        resolve(null)
      }
    }
    for (const source of sources) {
      source().then(
        (value) => settle(tokenUsable(value, nowS) ? value : null),
        () => settle(null),
      )
    }
  })
  throwIfAborted(signal)
  if (token === null) throw new ImporterError('Tidak bisa mendapatkan token Spotify.')
  cachedToken = { token: token.token, expiresAt: token.expiresAt ?? Math.floor(nowS) + TOKEN_ASSUMED_LIFETIME_S }
  return token.token
}

/* ------------------------------------------------------------------ */
/* Parsing lagu                                                        */
/* ------------------------------------------------------------------ */

function toTrack(args: {
  title: string | undefined
  artists: string[]
  album: string | undefined
  cover: string | undefined
  durationMs: number | undefined
  id: string | undefined
}): SpotifyApiTrack | null {
  const title = args.title?.trim()
  if (!title || !args.id) return null
  return {
    title,
    artists: args.artists.join(', '),
    album: args.album ?? '',
    cover: args.cover ?? '',
    duration: formatDurationMs(args.durationMs),
    url: `https://open.spotify.com/track/${args.id}`,
  }
}

export function parseApiTrack(track: unknown): SpotifyApiTrack | null {
  if (!isRecord(track) || track.is_local === true) return null
  const artists = Array.isArray(track.artists)
    ? track.artists.map((a) => asString(pick(a, ['name']))).filter((n): n is string => !!n)
    : []
  return toTrack({
    title: asString(track.name),
    artists,
    album: asString(pick(track, ['album', 'name'])),
    cover: asString(pick(track, ['album', 'images', 0, 'url'])),
    durationMs: asNumber(track.duration_ms),
    id: asString(track.id),
  })
}

function uriToId(uri: string | undefined): string | undefined {
  return uri?.split(':').pop() || undefined
}

export function parseEmbedTrack(item: unknown, defaultCover?: string): SpotifyApiTrack | null {
  if (!isRecord(item)) return null
  const artists = Array.isArray(item.artists)
    ? item.artists.map((a) => asString(pick(a, ['name']))).filter((n): n is string => !!n)
    : splitArtistsSubtitle(asString(item.subtitle) ?? '')
  return toTrack({
    title: asString(item.name) ?? asString(item.title),
    artists,
    album: asString(pick(item, ['album', 'name'])),
    cover:
      asString(pick(item, ['album', 'images', 0, 'url'])) ??
      asString(pick(item, ['visualIdentity', 'image', 0, 'url'])) ??
      defaultCover,
    durationMs: asNumber(item.duration_ms) ?? asNumber(item.duration),
    id: asString(item.id) ?? uriToId(asString(item.uri)),
  })
}

/* ------------------------------------------------------------------ */
/* API resmi                                                           */
/* ------------------------------------------------------------------ */

async function apiGet(url: string, token: string, signal?: AbortSignal): Promise<unknown> {
  try {
    return await getJson(url, { Authorization: `Bearer ${token}`, Accept: 'application/json' }, signal)
  } catch (error) {
    // Token ditolak: jangan dipakai lagi pada percobaan berikutnya.
    if (error instanceof Error && /HTTP (401|403)\b/.test(error.message)) invalidateAccessToken()
    throw error
  }
}

async function tracksViaApi(id: string, token: string, signal?: AbortSignal): Promise<SpotifyApiTrack[]> {
  const tracks: SpotifyApiTrack[] = []
  let next: string | undefined =
    `https://api.spotify.com/v1/playlists/${id}/tracks?offset=0&limit=100&fields=${encodeURIComponent(TRACK_FIELDS)}`
  for (let page = 0; next && page < MAX_PAGES; page += 1) {
    const data = await apiGet(next, token, signal)
    const items = pick(data, ['items'])
    if (!Array.isArray(items) || items.length === 0) break
    for (const item of items) {
      const parsed = parseApiTrack(pick(item, ['track']))
      if (parsed) tracks.push(parsed)
    }
    next = asString(pick(data, ['next']))
  }
  return tracks
}

async function infoViaApi(id: string, token: string, signal?: AbortSignal): Promise<CollectionInfo> {
  const data = await apiGet(
    `https://api.spotify.com/v1/playlists/${id}?fields=${encodeURIComponent('name,owner(display_name),images')}`,
    token,
    signal,
  )
  return {
    title: asString(pick(data, ['name'])) ?? '',
    author: asString(pick(data, ['owner', 'display_name'])),
    cover: asString(pick(data, ['images', 0, 'url'])) ?? '',
  }
}

/* ------------------------------------------------------------------ */
/* API partner (pathfinder)                                            */
/* ------------------------------------------------------------------ */

async function pathfinderPost(body: unknown, token: string, signal?: AbortSignal): Promise<unknown> {
  throwIfAborted(signal)
  const response = await pluginFetch(PATHFINDER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Referer: 'https://open.spotify.com/',
      'User-Agent': USER_AGENT,
    },
    body: JSON.stringify(body),
    signal,
    timeoutMs: 30_000,
  })
  return JSON.parse(await response.text())
}

function partnerQuery(id: string, offset: number, limit: number): unknown {
  return {
    operationName: 'fetchPlaylist',
    variables: { uri: `spotify:playlist:${id}`, offset, limit: Math.min(limit, 100), enableWatchFeedEntrypoint: false },
    extensions: { persistedQuery: { version: 1, sha256Hash: FETCH_PLAYLIST_HASH } },
  }
}

/** Satu lagu dari objek track partner (`trackUnion` / `Track`); null bila tidak lengkap. */
export function parsePartnerTrack(t: unknown, requireId = false): SpotifyApiTrack | null {
  if (!isRecord(t)) return null
  const id = asString(t.id) ?? uriToId(asString(t.uri))
  if (requireId && !id) return null
  const artistItems = pick(t, ['artists', 'items'])
  const artists = Array.isArray(artistItems)
    ? artistItems
        .map((a) => asString(pick(a, ['profile', 'name'])) ?? asString(pick(a, ['name'])))
        .filter((n): n is string => !!n)
    : []
  return toTrack({
    title: asString(t.name),
    artists,
    album: asString(pick(t, ['albumOfTrack', 'name'])),
    cover: asString(pick(t, ['albumOfTrack', 'coverArt', 'sources', 0, 'url'])),
    durationMs:
      asNumber(pick(t, ['duration', 'totalMilliseconds'])) ?? asNumber(pick(t, ['trackDuration', 'totalMilliseconds'])),
    id,
  })
}

/** Item `fetchPlaylist`: `itemV2` berisi Track langsung atau TrackResponseWrapper -> trackUnion. */
export function parsePartnerItem(item: unknown): SpotifyApiTrack | null {
  const itemV2 = pick(item, ['itemV2'])
  if (!isRecord(itemV2)) return null
  const data = itemV2.data
  if (!isRecord(data)) return null
  let union: unknown
  if (itemV2.__typename === 'TrackResponseWrapper' && data.__typename === 'Track') union = data
  else if (data.__typename === 'TrackResponseWrapper') union = data.trackUnion
  else return null
  return parsePartnerTrack(union)
}

interface PartnerResult {
  tracks: SpotifyApiTrack[]
  /** Jumlah lagu yang dilaporkan Spotify (termasuk yang tidak bisa diparse); null bila tidak ada. */
  declaredTotal: number | null
  info: CollectionInfo | null
}

async function tracksViaPartner(id: string, token: string, signal?: AbortSignal): Promise<PartnerResult> {
  const tracks: SpotifyApiTrack[] = []
  let offset = 0
  let declaredTotal: number | null = null
  let info: CollectionInfo | null = null
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const data = await pathfinderPost(partnerQuery(id, offset, 100), token, signal)
    const playlist = pick(data, ['data', 'playlistV2'])
    const content = pick(playlist, ['content'])
    if (!isRecord(content)) throw new ImporterError('Struktur respons partner Spotify tidak dikenal.')
    if (page === 0) {
      declaredTotal = asNumber(content.totalCount) ?? null
      const title = asString(pick(playlist, ['name']))
      if (title) {
        info = {
          title,
          author: asString(pick(playlist, ['ownerV2', 'data', 'name'])),
          cover: asString(pick(playlist, ['images', 'items', 0, 'sources', 0, 'url'])) ?? '',
        }
      }
    }
    const items = Array.isArray(content.items) ? content.items : []
    for (const item of items) {
      const parsed = parsePartnerItem(item)
      if (parsed) tracks.push(parsed)
    }
    const next = asNumber(pick(content, ['pagingInfo', 'nextOffset'])) ?? offset + items.length
    if (items.length === 0 || next <= offset) break
    offset = next
    if (declaredTotal !== null && declaredTotal > 0 && offset >= declaredTotal) break
  }
  return { tracks, declaredTotal, info }
}

/** Kontrak `queryPlaylist` lawas (50 lagu per halaman); dipakai bila `fetchPlaylist` tidak memberi hasil. */
async function tracksViaPartnerLegacy(id: string, token: string, signal?: AbortSignal): Promise<SpotifyApiTrack[]> {
  const tracks: SpotifyApiTrack[] = []
  const limit = 50
  let offset = 0
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const data = await pathfinderPost(
      {
        variables: { uri: `spotify:playlist:${id}`, offset, limit },
        operationName: 'queryPlaylist',
        extensions: { persistedQuery: { version: 1, sha256Hash: QUERY_PLAYLIST_HASH } },
      },
      token,
      signal,
    )
    const items = pick(data, ['data', 'playlistV2', 'content', 'items'])
    if (!Array.isArray(items) || items.length === 0) break
    for (const item of items) {
      const parsed = parsePartnerTrack(pick(item, ['itemV2', 'data']), true)
      if (parsed) tracks.push(parsed)
    }
    offset += items.length
    if (items.length < limit) break
  }
  return tracks
}

/* ------------------------------------------------------------------ */
/* Embed                                                               */
/* ------------------------------------------------------------------ */

export function infoFromEntity(entity: Json): CollectionInfo {
  return {
    title: asString(entity.name) ?? asString(entity.title) ?? '',
    author: asString(pick(entity, ['owner', 'display_name'])) ?? asString(entity.subtitle),
    cover: asString(pick(entity, ['images', 0, 'url'])) ?? asString(pick(entity, ['coverArt', 'sources', 0, 'url'])) ?? '',
  }
}

export function tracksFromEntity(entity: Json, defaultCover?: string): SpotifyApiTrack[] {
  const list = entity.trackList
  if (!Array.isArray(list)) return []
  return list.map((item) => parseEmbedTrack(item, defaultCover)).filter((t): t is SpotifyApiTrack => t !== null)
}

/* ------------------------------------------------------------------ */
/* Satu lagu: info lewat tautan & pencarian judul                      */
/* ------------------------------------------------------------------ */

/** Info satu lagu (bentuk yang dipakai `PlaybackInfo`, tanpa audio). */
export interface TrackMeta {
  title: string
  artist: string
  album: string
  /** "m:ss"; kosong bila tidak diketahui. */
  duration: string
  year?: number
  cover: string
  spotifyUrl: string
}

function yearOf(date: string | undefined): number | undefined {
  const year = date ? Number(date.slice(0, 4)) : NaN
  return Number.isInteger(year) && year > 1000 ? year : undefined
}

/** Objek track API Spotify (`/v1/tracks/{id}`, item `/v1/search`) -> info lagu. */
export function trackMetaFromApi(track: unknown): TrackMeta | null {
  if (!isRecord(track)) return null
  const id = asString(track.id)
  const title = asString(track.name)?.trim()
  if (!id || !title) return null
  const artists = Array.isArray(track.artists)
    ? track.artists.map((a) => asString(pick(a, ['name']))).filter((n): n is string => !!n)
    : []
  return {
    title,
    artist: artists.join(', '),
    album: asString(pick(track, ['album', 'name'])) ?? '',
    duration: formatDurationMs(asNumber(track.duration_ms)),
    year: yearOf(asString(pick(track, ['album', 'release_date']))),
    cover: asString(pick(track, ['album', 'images', 0, 'url'])) ?? '',
    spotifyUrl: `https://open.spotify.com/track/${id}`,
  }
}

/** Entitas halaman `/embed/track/{id}` -> info lagu (field berbeda dengan API; sebisanya). */
export function trackMetaFromEntity(entity: Json, fallbackId: string): TrackMeta | null {
  const title = (asString(entity.name) ?? asString(entity.title))?.trim()
  if (!title) return null
  const artists = Array.isArray(entity.artists)
    ? entity.artists.map((a) => asString(pick(a, ['name']))).filter((n): n is string => !!n)
    : splitArtistsSubtitle(asString(entity.subtitle) ?? '')
  const id = asString(entity.id) ?? uriToId(asString(entity.uri)) ?? fallbackId
  return {
    title,
    artist: artists.join(', '),
    album: asString(pick(entity, ['album', 'name'])) ?? '',
    duration: formatDurationMs(asNumber(entity.duration) ?? asNumber(entity.duration_ms)),
    year: yearOf(asString(pick(entity, ['releaseDate', 'isoString'])) ?? asString(pick(entity, ['album', 'release_date']))),
    cover:
      asString(pick(entity, ['visualIdentity', 'image', 0, 'url'])) ??
      asString(pick(entity, ['coverArt', 'sources', 0, 'url'])) ??
      asString(pick(entity, ['album', 'images', 0, 'url'])) ??
      '',
    spotifyUrl: `https://open.spotify.com/track/${id}`,
  }
}

/** Galat yang pasti sama bila diulang (tidak ada / privat / ditolak): 400, 403, 404 dari SEMUA jalur. */
function allDeterministic(failures: readonly unknown[]): boolean {
  return failures.length > 0 && failures.every((f) => [400, 403, 404].includes(httpStatusOf(f) ?? 0))
}

function failureCollector(signal: AbortSignal | undefined): { failures: unknown[]; note: (error: unknown) => void } {
  const failures: unknown[] = []
  return {
    failures,
    note: (error) => {
      if (signal?.aborted) throw new ImporterError('Permintaan dibatalkan.', { retryable: false, aborted: true })
      failures.push(error)
    },
  }
}

/** Info satu lagu dari id track Spotify: API resmi, lalu halaman embed. */
export async function importSpotifyTrack(trackId: string, options: ImportOptions = {}): Promise<TrackMeta> {
  const { signal } = options
  if (!isNativeApp()) throw new ImporterError('Impor langsung Spotify hanya tersedia di APK.', { retryable: false })
  throwIfAborted(signal)
  const { failures, note } = failureCollector(signal)

  try {
    const token = await getAccessToken({ kind: 'track', id: trackId }, signal)
    const meta = trackMetaFromApi(await apiGet(`https://api.spotify.com/v1/tracks/${trackId}`, token, signal))
    if (meta) return meta
    note(new ImporterError('Respons track Spotify tidak lengkap.'))
  } catch (error) {
    note(error)
  }
  try {
    const entity = entityFromEmbedHtml(await fetchEmbedHtml('track', trackId, signal))
    const meta = trackMetaFromEntity(entity, trackId)
    if (meta) return meta
    note(new ImporterError('Data track di halaman embed tidak lengkap.'))
  } catch (error) {
    note(error)
  }
  const fixed = allDeterministic(failures)
  throw new ImporterError(fixed ? 'Lagu tidak ditemukan atau tidak bisa diakses.' : 'Gagal mengambil info lagu dari Spotify.', {
    retryable: !fixed,
  })
}

/** Cari lagu lewat judul (dan artis) di Spotify; mengembalikan hasil teratas. */
export async function searchSpotifyTrack(query: string, options: ImportOptions = {}): Promise<TrackMeta> {
  const { signal } = options
  if (!isNativeApp()) throw new ImporterError('Pencarian langsung Spotify hanya tersedia di APK.', { retryable: false })
  throwIfAborted(signal)
  const text = query.trim()
  if (!text) throw new ImporterError('Judul lagu kosong.', { retryable: false })
  const { failures, note } = failureCollector(signal)

  try {
    const token = await getAccessToken(null, signal)
    const data = await apiGet(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(text)}&type=track&limit=5`,
      token,
      signal,
    )
    const items = pick(data, ['tracks', 'items'])
    if (Array.isArray(items)) {
      for (const item of items) {
        const meta = trackMetaFromApi(item)
        if (meta) return meta
      }
      // Pencarian sukses tapi kosong: mengulang tidak ada gunanya.
      throw new ImporterError('Spotify tidak menemukan lagu untuk judul ini.', { retryable: false })
    }
    note(new ImporterError('Respons pencarian Spotify tidak dikenal.'))
  } catch (error) {
    if (error instanceof ImporterError && !error.retryable) throw error
    note(error)
  }
  const fixed = allDeterministic(failures)
  throw new ImporterError(fixed ? 'Pencarian Spotify ditolak.' : 'Gagal mencari lagu di Spotify.', { retryable: !fixed })
}

/* ------------------------------------------------------------------ */
/* Titik masuk                                                         */
/* ------------------------------------------------------------------ */

/**
 * Mengimpor satu playlist. Melempar ImporterError; `retryable` memberi tahu pemanggil apakah mengulang ada gunanya.
 */
export async function importSpotifyPlaylist(playlistId: string, options: ImportOptions = {}): Promise<SpotifyApiPlaylistResponse> {
  const { signal } = options
  if (!isNativeApp()) {
    throw new ImporterError('Impor langsung Spotify hanya tersedia di APK.', { retryable: false })
  }
  throwIfAborted(signal)

  const failures: unknown[] = []
  const note = (error: unknown): void => {
    if (signal?.aborted) throw new ImporterError('Permintaan dibatalkan.', { retryable: false, aborted: true })
    failures.push(error)
  }

  let tracks: SpotifyApiTrack[] = []
  let info: CollectionInfo | null = null

  try {
    const token = await getAccessToken(playlistId, signal)

    // 1) Partner (fetchPlaylist; bila kosong, queryPlaylist lawas).
    let declaredTotal: number | null = null
    try {
      const partner = await tracksViaPartner(playlistId, token, signal)
      tracks = partner.tracks
      declaredTotal = partner.declaredTotal
      info = partner.info
    } catch (error) {
      note(error)
    }
    if (tracks.length === 0) {
      try {
        tracks = await tracksViaPartnerLegacy(playlistId, token, signal)
      } catch (error) {
        note(error)
      }
    }

    // 2) API resmi: dilewati bila partner sudah memberi semua lagu yang dilaporkan Spotify; selain itu dibandingkan
    // dan yang lebih banyak dipakai (seperti plugin asli).
    // totalCount 0/null tidak bisa dipercaya (mis. fetchPlaylist kosong lalu lagu datang dari jalur lawas).
    const partnerComplete = tracks.length > 0 && declaredTotal !== null && declaredTotal > 0 && tracks.length >= declaredTotal
    if (!partnerComplete) {
      try {
        const viaApi = await tracksViaApi(playlistId, token, signal)
        if (viaApi.length > tracks.length) tracks = viaApi
      } catch (error) {
        note(error)
      }
    }
    if (!info?.title) {
      try {
        info = await infoViaApi(playlistId, token, signal)
      } catch (error) {
        note(error)
      }
    }
  } catch (error) {
    note(error)
  }

  // Embed: dipakai sebagai cadangan lagu, dan untuk judul/sampul bila API tidak memberinya.
  if (tracks.length === 0 || !info?.title) {
    try {
      const entity = entityFromEmbedHtml(await fetchEmbedHtml('playlist', playlistId, signal))
      const embedInfo = infoFromEntity(entity)
      if (!info?.title) info = { ...embedInfo, cover: info?.cover || embedInfo.cover }
      if (tracks.length === 0) tracks = tracksFromEntity(entity, embedInfo.cover || undefined)
    } catch (error) {
      note(error)
    }
  }

  if (tracks.length === 0) {
    // 404 dari semua jalur = playlist tidak ada / privat: mengulang tidak akan membantu.
    const notFound = allDeterministic(failures)
    throw new ImporterError(
      notFound ? 'Playlist tidak ditemukan atau bersifat privat.' : 'Gagal mengambil lagu dari Spotify.',
      { retryable: !notFound },
    )
  }

  return {
    status: true,
    author: info?.author,
    data: { title: info?.title?.trim() || 'Playlist Spotify', cover: info?.cover ?? '' },
    tracks,
  }
}
