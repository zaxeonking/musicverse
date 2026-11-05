import { isNativeApp } from '../native/platform'
import { pluginFetch } from './http'

/**
 * Modul saran pencarian (padanan jenis plugin `search-suggestion-provider` StreamBeats). Penyedia disusun sebagai
 * daftar supaya mudah ditambah. Saat ini: YouTube Music `music/get_search_suggestions` (port dari plugin
 * `ytmusic-search-suggestion`), iTunes Search API (padanan `itunes-search-suggestions`), dan MusicBrainz (padanan
 * `musicbrainz-suggestions`). Semua penyedia dijalankan BERSAMAAN dan hasilnya digabung (YouTube Music di depan). Hanya jalan di APK (butuh HTTP native bebas CORS); di browser
 * hasilnya selalu kosong. Galat jaringan tidak pernah dilempar: saran hanyalah bonus.
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

/** Judul + artis dari hasil pencarian iTunes (`/search?entity=song`), tanpa duplikat. */
export function parseItunesSuggestions(body: unknown, limit = 8): string[] {
  const results = (body as { results?: unknown } | null)?.results
  if (!Array.isArray(results)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of results) {
    const r = item as { trackName?: unknown; artistName?: unknown }
    const title = typeof r.trackName === 'string' ? r.trackName.trim() : ''
    const artist = typeof r.artistName === 'string' ? r.artistName.trim() : ''
    if (!title) continue
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
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=${Math.min(25, limit * 2)}`
    const response = await pluginFetch(url, { headers: { Accept: 'application/json', 'User-Agent': USER_AGENT }, timeoutMs: 6_000, signal })
    return parseItunesSuggestions(JSON.parse(await response.text()), limit)
  },
}

/** Judul + artis dari pencarian rekaman MusicBrainz (`/ws/2/recording`), tanpa duplikat. */
export function parseMusicBrainzSuggestions(body: unknown, limit = 8): string[] {
  const recordings = (body as { recordings?: unknown } | null)?.recordings
  if (!Array.isArray(recordings)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of recordings) {
    const r = item as { title?: unknown; 'artist-credit'?: unknown }
    const title = typeof r.title === 'string' ? r.title.trim() : ''
    if (!title) continue
    const credit = Array.isArray(r['artist-credit']) ? (r['artist-credit'] as Array<{ name?: unknown }>) : []
    const artist = typeof credit[0]?.name === 'string' ? credit[0].name.trim() : ''
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
    const url = `https://musicbrainz.org/ws/2/recording/?query=${encodeURIComponent(query)}&fmt=json&limit=${Math.min(25, limit * 2)}`
    // MusicBrainz mewajibkan User-Agent yang menyebut aplikasi.
    const response = await pluginFetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'MusicVerse/0.4 ( https://github.com/musicverse )' },
      timeoutMs: 6_000,
      signal,
    })
    return parseMusicBrainzSuggestions(JSON.parse(await response.text()), limit)
  },
}

const providers: SuggestionProvider[] = [ytmSuggestionProvider, itunesSuggestionProvider, musicBrainzSuggestionProvider]
const cache = new Map<string, string[]>()
const CACHE_MAX = 50

export function listSuggestionProviders(): Array<{ id: string; name: string }> {
  return providers.map(({ id, name }) => ({ id, name }))
}

/**
 * Menggabungkan saran beberapa penyedia: urutan penyedia dipertahankan, duplikat (tanpa beda huruf besar) dibuang, dan
 * tiap penyedia diberi jatah bergiliran supaya satu penyedia tidak memenuhi seluruh daftar.
 */
export function mergeSuggestions(lists: ReadonlyArray<readonly string[]>, limit: number): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (let round = 0; out.length < limit; round += 1) {
    let any = false
    for (const list of lists) {
      if (round >= list.length) continue
      any = true
      const text = list[round]
      const key = text.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push(text)
      if (out.length >= limit) break
    }
    if (!any) break
  }
  return out
}

/**
 * Saran untuk `query`. Semua penyedia jalan bersamaan (masing-masing dibatasi 6 dtk); yang gagal/kosong dilewati.
 * Selalu mengembalikan array (kosong bila semuanya gagal).
 */
export async function getSearchSuggestions(query: string, options: SuggestionOptions = {}): Promise<string[]> {
  const text = query.trim()
  if (text.length < 2 || !isNativeApp()) return []
  const key = text.toLowerCase()
  const cached = cache.get(key)
  if (cached) return cached
  const limit = options.limit ?? 8
  const settled = await Promise.allSettled(providers.map((provider) => provider.suggest(text, options)))
  if (options.signal?.aborted) return []
  const lists = settled.map((result) =>
    result.status === 'fulfilled' ? result.value.filter((s) => s.toLowerCase() !== key) : [],
  )
  const merged = mergeSuggestions(lists, limit)
  if (merged.length > 0) {
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string)
    cache.set(key, merged)
  }
  return merged
}
