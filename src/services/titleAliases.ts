import { pluginFetch } from '../plugins/http'
import { normalizeSearchText } from '../utils/trackSearch'
import { stripArtistPrefix } from '../utils/trackTitle'
import { scriptGap, sameSpelling, type WantedTrack } from '../utils/matchTrack'
import { parseDuration } from '../utils/formatTime'

/**
 * Nama lain untuk lagu yang SAMA dalam bahasa/aksara lain (judul Spotify "Yuzutsu" = "夕星-ゆうづつ-" di YouTube Music).
 * Sumber: katalog iTunes di beberapa negara (us/jp/kr). Hasil hanya dipakai bila durasinya sama dengan lagu di playlist
 * dan artisnya cocok (atau beda aksara), jadi lagu lain tidak ikut. Dipakai untuk (1) menambah kata kunci pencarian dan
 * (2) menilai judul hasil: judul dianggap cocok bila cocok dengan judul ASLI atau salah satu nama lainnya.
 */
export interface TrackAlias {
  title: string
  artist: string
}

const STOREFRONTS = ['us', 'jp', 'kr'] as const
const DURATION_TOLERANCE_S = 2.5
const MAX_ALIASES = 6

const cache = new Map<string, TrackAlias[]>()

interface ItunesSong {
  trackName?: unknown
  artistName?: unknown
  trackTimeMillis?: unknown
  kind?: unknown
}

function aliasKey(wanted: WantedTrack): string {
  return normalizeSearchText(`${wanted.title}|${wanted.artists}|${wanted.duration}`)
}

/** Nama lain yang sudah pernah diambil di sesi ini (tanpa jaringan). */
export function peekAliases(wanted: WantedTrack): TrackAlias[] {
  return cache.get(aliasKey(wanted)) ?? []
}

async function searchStorefront(term: string, country: string, signal?: AbortSignal): Promise<ItunesSong[]> {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&country=${country}&media=music&entity=song&limit=10`
  const response = await pluginFetch(url, { timeoutMs: 6000, signal })
  const body = (await response.json()) as { results?: unknown }
  return Array.isArray(body.results) ? (body.results as ItunesSong[]) : []
}

/** Nama lain lagu ini ([] bila tidak ada / gagal). Tidak pernah melempar error; hasil di-cache selama sesi. */
export async function fetchTitleAliases(wanted: WantedTrack, signal?: AbortSignal): Promise<TrackAlias[]> {
  const key = aliasKey(wanted)
  const hit = cache.get(key)
  if (hit) return hit
  const expected = parseDuration(wanted.duration)
  // Tanpa durasi acuan tidak ada cara memastikan itu lagu yang sama.
  if (expected === null) return []
  const title = stripArtistPrefix(wanted.title, wanted.artists)
  const artist = wanted.artists.split(/\s*[,&;]\s*/)[0]?.trim() ?? ''
  const term = `${title} ${artist}`.trim()
  if (!term) return []

  const settled = await Promise.allSettled(STOREFRONTS.map((country) => searchStorefront(term, country, signal)))
  const found: TrackAlias[] = []
  // Kunci = judul + artis: nama lain bisa berupa judul yang sama dengan artis beda aksara (RADWIMPS = ラッドウィンプス).
  const seen = new Set<string>([`${normalizeSearchText(title)}|${normalizeSearchText(artist)}`])
  for (const result of settled) {
    if (result.status !== 'fulfilled') continue
    for (const song of result.value) {
      if (typeof song.trackName !== 'string' || typeof song.artistName !== 'string') continue
      if (typeof song.trackTimeMillis !== 'number' || Math.abs(song.trackTimeMillis / 1000 - expected) > DURATION_TOLERANCE_S) continue
      const artistOk =
        normalizeSearchText(song.artistName).includes(normalizeSearchText(artist)) ||
        normalizeSearchText(artist).includes(normalizeSearchText(song.artistName)) ||
        sameSpelling(artist, song.artistName) ||
        scriptGap(artist, song.artistName)
      if (!artistOk) continue
      const name = song.trackName.trim()
      const id = `${normalizeSearchText(name)}|${normalizeSearchText(song.artistName)}`
      if (!name || seen.has(id)) continue
      seen.add(id)
      found.push({ title: name, artist: song.artistName.trim() })
      if (found.length >= MAX_ALIASES) break
    }
    if (found.length >= MAX_ALIASES) break
  }
  // Hanya hasil nyata yang di-cache; kegagalan jaringan tidak, supaya dicoba lagi lain kali.
  if (settled.some((r) => r.status === 'fulfilled')) cache.set(key, found)
  return found
}
