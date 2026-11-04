import { isNativeApp } from '../native/platform'
import { pluginFetch } from './http'

/**
 * Modul saran pencarian (padanan jenis plugin `search-suggestion-provider` StreamBeats). Penyedia disusun sebagai
 * daftar supaya mudah ditambah (iTunes, MusicBrainz, ...). Saat ini: YouTube Music `music/get_search_suggestions`
 * (port dari plugin `ytmusic-search-suggestion`). Hanya jalan di APK (butuh HTTP native bebas CORS); di browser
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

const providers: SuggestionProvider[] = [ytmSuggestionProvider]
const cache = new Map<string, string[]>()
const CACHE_MAX = 50

export function listSuggestionProviders(): Array<{ id: string; name: string }> {
  return providers.map(({ id, name }) => ({ id, name }))
}

/** Saran untuk `query`; provider dicoba berurutan sampai ada hasil. Selalu mengembalikan array (kosong bila gagal). */
export async function getSearchSuggestions(query: string, options: SuggestionOptions = {}): Promise<string[]> {
  const text = query.trim()
  if (text.length < 2 || !isNativeApp()) return []
  const key = text.toLowerCase()
  const cached = cache.get(key)
  if (cached) return cached
  for (const provider of providers) {
    if (options.signal?.aborted) return []
    try {
      const found = (await provider.suggest(text, options)).filter((s) => s.toLowerCase() !== key)
      if (found.length > 0) {
        if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string)
        cache.set(key, found)
        return found
      }
    } catch {
      /* provider berikutnya */
    }
  }
  return []
}
