import { getManualPin } from './manualPins'
import { pluginFetch } from './http'
import { ytMusicPlugin } from './ytmusic'
import { parseLyricsBrowseId, parsePlainLyrics, parseTimedLyricsToLrc } from '../utils/ytLyricsParse'

/**
 * Lirik dari YouTube Music (sumber PERTAMA lirik; sumber lain hanya bila ini tidak ada).
 *  1. cari video lagunya (pilihan manual pengguna bila ada, kalau tidak hasil teratas pencarian YouTube Music yang cocok),
 *  2. `next` -> browseId tab lirik,
 *  3. `browse` klien ANDROID_MUSIC -> lirik bertanda waktu; `browse` klien web -> lirik biasa (cadangan).
 * Tidak pernah melempar error (null = tidak ada), supaya sumber lirik berikutnya tetap jalan.
 */
const KEY = 'AIzaSyC9XL3ZjWddXya6X74dJoCTL-WEYFDNX30'
const NEXT_URL = `https://music.youtube.com/youtubei/v1/next?key=${KEY}&prettyPrint=false`
const BROWSE_URL = `https://music.youtube.com/youtubei/v1/browse?key=${KEY}&prettyPrint=false`
const WEB_VERSION = '1.20260222.01.00'
const WEB_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36'
const ANDROID_MUSIC_VERSION = '7.21.50'
const ANDROID_MUSIC_UA = `com.google.android.apps.youtube.music/${ANDROID_MUSIC_VERSION} (Linux; U; Android 11) gzip`
/** Batas waktu seluruh pengambilan lirik dari YouTube Music; lewat ini sumber lain yang dipakai. */
const BUDGET_MS = 7_000

export interface YtMusicLyrics {
  videoId: string
  title: string
  artist: string
  durationSec: number | null
  synced: string | null
  plain: string | null
}

async function post(url: string, body: unknown, headers: Record<string, string>, signal: AbortSignal): Promise<unknown> {
  const response = await pluginFetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body), signal, timeoutMs: BUDGET_MS })
  return response.json()
}

const webContext = { client: { clientName: 'WEB_REMIX', clientVersion: WEB_VERSION, hl: 'en', gl: 'US' } }
const webHeaders = { Origin: 'https://music.youtube.com', 'User-Agent': WEB_UA }

export async function fetchYtMusicLyrics(
  track: { title: string; artists: string },
  pickVideo: (hits: Array<{ id: string; title: string; artist: string; durationSec: number | null }>) => { id: string; title: string; artist: string; durationSec: number | null } | null,
  outer: AbortSignal,
  searchQuery: string,
): Promise<YtMusicLyrics | null> {
  const controller = new AbortController()
  const onAbort = () => controller.abort()
  if (outer.aborted) return null
  outer.addEventListener('abort', onAbort, { once: true })
  const timer = setTimeout(() => controller.abort(), BUDGET_MS)
  const signal = controller.signal
  try {
    // 1. Video: pilihan manual (video itu yang dikehendaki pengguna) lebih dulu, lalu pencarian.
    const pin = getManualPin(track)
    let video: { id: string; title: string; artist: string; durationSec: number | null } | null =
      pin && (pin.pluginId === 'ytmusic' || pin.pluginId === 'ytvideo')
        ? { id: pin.id, title: pin.title, artist: pin.artist, durationSec: pin.durationSec }
        : null
    if (!video) video = pickVideo(await ytMusicPlugin.search(searchQuery, signal))
    if (!video) return null

    // 2. Tab lirik.
    const next = await post(NEXT_URL, { context: webContext, videoId: video.id, isAudioOnly: true }, webHeaders, signal)
    const browseId = parseLyricsBrowseId(next)
    if (!browseId) return null

    // 3. Isi lirik: bertanda waktu dan biasa diminta bersamaan; yang bertanda waktu diutamakan pemanggil.
    const [timed, plain] = await Promise.allSettled([
      post(
        BROWSE_URL,
        { context: { client: { clientName: 'ANDROID_MUSIC', clientVersion: ANDROID_MUSIC_VERSION, hl: 'en', gl: 'US', osName: 'Android', osVersion: '11' } }, browseId },
        { 'User-Agent': ANDROID_MUSIC_UA, 'X-YouTube-Client-Name': '21', 'X-YouTube-Client-Version': ANDROID_MUSIC_VERSION },
        signal,
      ),
      post(BROWSE_URL, { context: webContext, browseId }, webHeaders, signal),
    ])
    const synced = timed.status === 'fulfilled' ? parseTimedLyricsToLrc(timed.value) : null
    const plainText = plain.status === 'fulfilled' ? parsePlainLyrics(plain.value) : null
    if (!synced && !plainText) return null
    return { videoId: video.id, title: video.title, artist: video.artist, durationSec: video.durationSec, synced, plain: plainText }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
    outer.removeEventListener('abort', onAbort)
  }
}
