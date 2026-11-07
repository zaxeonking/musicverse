import { isNativeApp } from '../native/platform'
import { pluginFetch } from './http'

/**
 * Modul saran pencarian (padanan jenis plugin `search-suggestion-provider` StreamBeats). Penyedia disusun sebagai daftar:
 *  1. YouTube Music `music/get_search_suggestions` (port `ytmusic-search-suggestion`): saran kata kunci asli, dicoba dulu.
 *  2. iTunes Search API (padanan `itunes-search-suggestions`): "judul artis" dari katalog Apple Music.
 *  3. MusicBrainz (padanan `musicbrainz-suggestions`): rekaman dari basis data musik terbuka.
 * Bila YouTube Music sudah memberi cukup saran, penyedia lain tidak dipanggil sama sekali (tanpa permintaan tambahan).
 * Bila kurang / gagal, 2 dan 3 dipanggil bersamaan dan hasilnya digabung berurutan tanpa duplikat. Hanya jalan di APK
 * (butuh HTTP native bebas CORS); di browser hasilnya selalu kosong. Galat jaringan tidak pernah dilempar: saran hanyalah bonus.
 */

export interface SuggestionOptions {
  signal?: AbortSignal
  limit?: number
}

export interface SuggestionProvider {
  id: string
  name: string
  suggest(query: string, options: SuggestionOptions): Promise<string[]>
}

const YTM_URL = 'https://music.youtube.com/youtubei/v1/music/get_search_suggestions'
const YTM_API_KEY = 'AIzaSyC9XL3ZjWddXya6X74dJoCTL-KOUN-VSxo'
const YTM_CLIENT_VERSION = '1.20260222.01.00'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

/** Teks saran dari respons YTM: bagian pertama berisi saran kata kunci (juga riwayat). */
export function parseYtmSuggestions(body: unknown, limit = 8): string[] {
  const contents = (body as { contents?: unknown } | null)?.contents
  if (!Array.isArray(contents) || contents.length === 0) return []
  const items = (contents[0] as { searchSuggestionsSectionRenderer?: { contents?: unknown } })
    ?.searchSuggestionsSectionRenderer?.contents
  if (!Array.isArray(items)) return []
  const out: string[] = []
  for (const item of items) {
    const record = item as {
      searchSuggestionRenderer?: { suggestion?: { runs?: Array<{ text?: unknown }> } }
      historySuggestionRenderer?: { suggestion?: { runs?: Array<{ text?: unknown }> } }
    }
    const runs = (record.searchSuggestionRenderer ?? record.historySuggestionRenderer)?.suggestion?.runs
    if (!Array.isArray(runs)) continue
    const text = runs.map((r) => (typeof r.text === 'string' ? r.text : '')).join('').trim()
    if (text && !out.includes(text)) out.push(text)
    if (out.length >= limit) break
  }
  return out
}

export const ytmSuggestionProvider: SuggestionProvider = {
  id: 'ytmusic-search-suggestion',
  name: 'YouTube Music',
  async suggest(query, { signal, limit = 8 }) {
    const response = await pluginFetch(`${YTM_URL}?key=${YTM_API_KEY}`, {
      method: 'POST',
      headers: {
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        Origin: 'https://music.youtube.com',
        Referer: 'https://music.youtube.com/',
        'X-Goog-Api-Key': YTM_API_KEY,
      },
      body: JSON.stringify({
        context: { client: { clientName: 'WEB_REMIX', clientVersion: YTM_CLIENT_VERSION, hl: 'en', gl: 'US' } },
        input: query,
      }),
      timeoutMs: 6_000,
      signal,
    })
    return parseYtmSuggestions(JSON.parse(await response.text()), limit)
  },
}

const ITUNES_URL = 'https://itunes.apple.com/search'

/** "judul artis" dari hasil iTunes Search API (`results[].trackName` + `artistName`), tanpa duplikat. */
export function parseItunesSuggestions(body: unknown, limit = 8): string[] {
  const results = (body as { results?: unknown } | null)?.results
  if (!Array.isArray(results)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of results) {
    const record = item as { trackName?: unknown; artistName?: unknown }
    const title = typeof record.trackName === 'string' ? record.trackName.trim() : ''
    if (!title) continue
    const artist = typeof record.artistName === 'string' ? record.artistName.trim() : ''
    const text = artist ? `${title} ${artist}` : title
    const key = text.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(text)
    if (out.length >= limit) break
  }
  return out
}

export const itunesSuggestionProvider: SuggestionProvider = {
  id: 'itunes-search-suggestions',
  name: 'iTunes',
  async suggest(query, { signal, limit = 8 }) {
    const url = `${ITUNES_URL}?term=${encodeURIComponent(query)}&media=music&entity=song&limit=${Math.min(25, limit * 3)}`
    const response = await pluginFetch(url, { headers: { Accept: 'application/json' }, timeoutMs: 5_000, signal })
    return parseItunesSuggestions(JSON.parse(await response.text()), limit)
  },
}

const MB_URL = 'https://musicbrainz.org/ws/2/recording'
/**
 * MusicBrainz mewajibkan User-Agent yang jelas dan meminta info kontak pengembang (email/URL) di dalamnya:
 * https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting . Isi kontak Anda di sini sebelum merilis ke banyak orang.
 */
const MB_USER_AGENT = 'MusicVerse/0.4 (Android app; saran pencarian)'

/** Escape karakter khusus Lucene supaya judul seperti "Hello: (Live)" tidak membuat MusicBrainz menolak (HTTP 400). */
export function escapeLucene(text: string): string {
  return text.replace(/[+\-&|!(){}\[\]^"~*?:\\/]/g, '\\$&')
}

/** "judul artis" dari `recordings[]` MusicBrainz (`title` + `artist-credit`), tanpa duplikat (satu rekaman muncul di banyak rilis). */
export function parseMusicBrainzSuggestions(body: unknown, limit = 8): string[] {
  const recordings = (body as { recordings?: unknown } | null)?.recordings
  if (!Array.isArray(recordings)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of recordings) {
    const record = item as { title?: unknown; score?: unknown; 'artist-credit'?: unknown }
    const title = typeof record.title === 'string' ? record.title.trim() : ''
    if (!title) continue
    if (typeof record.score === 'number' && record.score < 60) continue
    const credit = Array.isArray(record['artist-credit']) ? (record['artist-credit'] as Array<{ name?: unknown; joinphrase?: unknown; artist?: { name?: unknown } }>) : []
    const artist = credit
      .map((part, index) => {
        const name = typeof part.name === 'string' ? part.name : typeof part.artist?.name === 'string' ? part.artist.name : ''
        const join = typeof part.joinphrase === 'string' ? part.joinphrase : ''
        return index < credit.length - 1 ? `${name}${join}` : name
      })
      .join('')
      .trim()
    const text = artist ? `${title} ${artist}` : title
    const key = text.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(text)
    if (out.length >= limit) break
  }
  return out
}

export const musicBrainzSuggestionProvider: SuggestionProvider = {
  id: 'musicbrainz-suggestions',
  name: 'MusicBrainz',
  async suggest(query, { signal, limit = 8 }) {
    const url = `${MB_URL}?query=${encodeURIComponent(escapeLucene(query))}&fmt=json&limit=${Math.min(25, limit * 3)}`
    const response = await pluginFetch(url, {
      headers: { 'User-Agent': MB_USER_AGENT, Accept: 'application/json' },
      timeoutMs: 6_000,
      signal,
    })
    return parseMusicBrainzSuggestions(JSON.parse(await response.text()), limit)
  },
}

/** Penyedia utama (dicoba sendirian dulu) dan penyedia pelengkap (dipanggil bersamaan bila yang utama kurang / gagal). */
const primary: SuggestionProvider = ytmSuggestionProvider
const fallbacks: SuggestionProvider[] = [itunesSuggestionProvider, musicBrainzSuggestionProvider]
const providers: SuggestionProvider[] = [primary, ...fallbacks]

/** Menggabungkan daftar saran berurutan, tanpa duplikat (tak peka huruf besar/kecil) dan tanpa yang sama dengan `query`. */
export function mergeSuggestions(lists: readonly (readonly string[])[], query: string, limit: number): string[] {
  const q = query.trim().toLowerCase()
  const seen = new Set<string>([q])
  const out: string[] = []
  for (const list of lists) {
    for (const text of list) {
      const key = text.trim().toLowerCase()
      if (!key || seen.has(key)) continue
      seen.add(key)
      out.push(text.trim())
      if (out.length >= limit) return out
    }
  }
  return out
}
const cache = new Map<string, string[]>()
const CACHE_MAX = 50

export function listSuggestionProviders(): Array<{ id: string; name: string }> {
  return providers.map(({ id, name }) => ({ id, name }))
}

/** Saran untuk `query`: penyedia utama dulu; bila kurang dari `limit`, penyedia pelengkap melengkapi. Selalu mengembalikan array. */
export async function getSearchSuggestions(query: string, options: SuggestionOptions = {}): Promise<string[]> {
  const text = query.trim()
  if (text.length < 2 || !isNativeApp()) return []
  const limit = options.limit ?? 8
  const key = text.toLowerCase()
  const cacheKey = `${key}|${limit}`
  const cached = cache.get(cacheKey)
  if (cached) return cached
  const attempt = async (provider: SuggestionProvider): Promise<string[]> => {
    try {
      return await provider.suggest(text, options)
    } catch {
      return [] // saran hanyalah bonus: gagal = kosong
    }
  }
  const first = mergeSuggestions([await attempt(primary)], text, limit)
  if (options.signal?.aborted) return []
  let found = first
  if (first.length < limit) {
    const rest = await Promise.all(fallbacks.map(attempt))
    if (options.signal?.aborted) return []
    found = mergeSuggestions([first, ...rest], text, limit)
  }
  if (found.length > 0) {
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string)
    cache.set(cacheKey, found)
  }
  return found
}
