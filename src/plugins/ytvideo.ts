import { pluginFetch } from './http'
import { getYoutubeStreams } from './ytmusic'
import type { PluginTrackHit, ResolverPlugin } from './types'

/**
 * Plugin YouTube (padanan plugin `ytvideo` StreamBeats/Bloomee): mencari VIDEO biasa di YouTube (filter "Videos") dan
 * memakai pengambil stream yang sama dengan ytmusic. Jadi cadangan langsung ke YouTube bila YouTube Music tidak
 * punya lagunya (mis. versi lain, remix, rilis tanpa Topic), tanpa API pihak ketiga.
 */

const SEARCH_URL = 'https://www.youtube.com/youtubei/v1/search?alt=json&key=AIzaSyC9XL3ZjWddXya6X74dJoCTL-WEYFDNX30'
const WEB_VERSION = '2.20260222.01.00'
const WEB_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36'
/** Filter "Videos" pencarian YouTube (sama dengan SearchFilter::Track di plugin ytvideo). */
const VIDEOS_PARAMS = 'EgIQAQ%3D%3D'

function textOf(node: any): string {
  if (!node) return ''
  if (typeof node.simpleText === 'string') return node.simpleText
  if (Array.isArray(node.runs)) return node.runs.map((run: { text?: string }) => run.text ?? '').join('')
  return ''
}

function parseClock(text: string): number | null {
  const m = /^(?:(\d+):)?(\d{1,2}):(\d{2})$/.exec(text.trim())
  if (!m) return null
  return Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3])
}

function collectVideos(node: unknown, out: any[]): void {
  if (Array.isArray(node)) {
    for (const child of node) collectVideos(child, out)
  } else if (node && typeof node === 'object') {
    const renderer = (node as any).videoRenderer
    if (renderer) out.push(renderer)
    else for (const child of Object.values(node)) collectVideos(child, out)
  }
}

/** Nama kanal artis YouTube sering berakhiran " - Topic" atau "VEVO". */
function cleanChannel(name: string): string {
  return name.replace(/\s+-\s+Topic$/i, '').replace(/VEVO$/i, '').trim()
}

function toHit(r: any): PluginTrackHit | null {
  const id: unknown = r.videoId
  if (typeof id !== 'string' || !id) return null
  const title = textOf(r.title).trim()
  if (!title) return null
  const durationSec = parseClock(textOf(r.lengthText))
  // Siaran langsung / premiere tanpa durasi bukan lagu.
  if (durationSec === null) return null
  const thumbs: Array<{ url?: string }> = r.thumbnail?.thumbnails ?? []
  return {
    id,
    title,
    artist: cleanChannel(textOf(r.ownerText) || textOf(r.shortBylineText)),
    album: '',
    durationSec,
    cover: thumbs[thumbs.length - 1]?.url ?? '',
  }
}

async function search(query: string, signal?: AbortSignal): Promise<PluginTrackHit[]> {
  const body = {
    context: { client: { clientName: 'WEB', clientVersion: WEB_VERSION, hl: 'en', gl: 'US' } },
    query,
    params: VIDEOS_PARAMS,
  }
  const response = await pluginFetch(SEARCH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': WEB_UA,
      Origin: 'https://www.youtube.com',
      Referer: 'https://www.youtube.com/',
    },
    body: JSON.stringify(body),
    signal,
  })
  const items: any[] = []
  collectVideos(await response.json(), items)
  return items.map(toHit).filter((hit): hit is PluginTrackHit => hit !== null).slice(0, 8)
}

export const ytVideoPlugin: ResolverPlugin = { id: 'ytvideo', name: 'YouTube', search, getStreams: getYoutubeStreams }
