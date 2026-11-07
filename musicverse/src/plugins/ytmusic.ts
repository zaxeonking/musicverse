import { defaultPluginTimeoutMs, pluginFetch } from './http'
import type { PluginTrackHit, ResolverPlugin, StreamSource } from './types'

/**
 * Plugin YouTube Music (port ringkas dari plugin `ytmusic` Bloomee):
 *  - search : API WEB_REMIX filter "Songs".
 *  - streams: klien VISIONOS (tanpa PO token), lalu ANDROID_VR, ANDROID tanpa androidSdkVersion, lalu IOS; semuanya mengembalikan URL
 *    langsung tanpa cipher. (TVHTML5 + dekode cipher belum dibawa; jika semuanya gagal, aplikasi mencoba plugin `ytvideo`.)
 */

const SEARCH_URL = 'https://music.youtube.com/youtubei/v1/search?key=AIzaSyC9XL3ZjWddXya6X74dJoCTL-WEYFDNX30&prettyPrint=false'
const PLAYER_URL = 'https://www.youtube.com/youtubei/v1/player?prettyPrint=false'
const WEB_VERSION = '1.20260222.01.00'
const WEB_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36'
const SONGS_PARAMS = 'EgWKAQIIAWoMEA4QChADEAQQCRAF'

/**
 * Klien pengambil stream. URUTAN PENTING: klien yang dipakai harus yang URL-nya tidak butuh PO token.
 *
 * Klien `ANDROID` yang membawa `androidSdkVersion` (dipakai sampai v0.4.11) memicu syarat PO token di server video
 * YouTube: playerResponse-nya OK dan beberapa detik/MB pertama terbaca (lolos pemeriksaan durasi), tetapi permintaan
 * Range berikutnya ditolak 403. Gejalanya: lagu berhenti di tengah buffering, geser maju/mundur macet, dan unduhan
 * berputar di "Menyiapkan…" karena URL ditolak lalu di-resolve ulang dari klien yang sama.
 *
 *  - VISIONOS     : klien utama (default yt-dlp sejak 2026.08.19; tanpa JS runtime dan tanpa PO token). Konteks sama
 *                   dengan yt-dlp (`visionos`), X-YouTube-Client-Name 101.
 *  - ANDROID sdkless: ANDROID tanpa `androidSdkVersion` (cadangan; sebelumnya dipakai yt-dlp).
 *  - IOS          : cadangan terakhir.
 * Klien berikutnya hanya dipakai bila yang sebelumnya gagal / tanpa stream, atau bila stream klien itu baru saja
 * ditolak server video (lihat `markClientRejected`).
 */
const VISIONOS = {
  name: 'VISIONOS',
  id: '101',
  version: '1.02',
  ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15',
  context: { deviceMake: 'Apple', deviceModel: 'RealityDevice17,1', osName: 'visionOS', osVersion: '26.5.23O471' },
}
const ANDROID_SDKLESS = {
  name: 'ANDROID',
  id: '3',
  version: '20.10.38',
  ua: 'com.google.android.youtube/20.10.38 (Linux; U; Android 11) gzip',
  context: { osName: 'Android', osVersion: '11' },
}
const IOS = {
  name: 'IOS',
  id: '5',
  version: '20.10.4',
  ua: 'com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)',
  context: { deviceMake: 'Apple', deviceModel: 'iPhone16,2', osName: 'iOS', osVersion: '18.3.2.22D82' },
}
/**
 * ANDROID_VR (Oculus Quest 3): klien yang juga dipakai Metrolist dan yt-dlp; URL-nya langsung tanpa cipher.
 * Ditaruh setelah VISIONOS dan sebelum ANDROID/IOS sebagai cadangan tambahan. Bila URL-nya ditolak server video,
 * `markClientRejected` melewatinya 10 menit seperti klien lain.
 */
const ANDROID_VR = {
  name: 'ANDROID_VR',
  id: '28',
  version: '1.65.10',
  ua: 'com.google.android.apps.youtube.vr.oculus/1.65.10 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip',
  context: { deviceMake: 'Oculus', deviceModel: 'Quest 3', androidSdkVersion: 32, osName: 'Android', osVersion: '12L' },
}
type PlayerClient = typeof VISIONOS | typeof ANDROID_SDKLESS | typeof IOS | typeof ANDROID_VR
const CLIENTS: readonly PlayerClient[] = [VISIONOS, ANDROID_VR, ANDROID_SDKLESS, IOS]

/** User-Agent klien -> sampai kapan klien itu dilewati (stream-nya baru ditolak server video). */
const rejectedUntil = new Map<string, number>()
const REJECT_PAUSE_MS = 10 * 60_000

/**
 * Dipanggil saat URL stream dari klien ini ditolak server video (HTTP 401/403/410) setelah berhasil di-resolve.
 * Klien itu dilewati 10 menit supaya resolve berikutnya memakai klien lain, bukan mengulang URL yang sama-sama ditolak.
 */
export function markClientRejected(userAgent: string | undefined): void {
  if (!userAgent) return
  if (CLIENTS.some((c) => c.ua === userAgent)) rejectedUntil.set(userAgent, Date.now() + REJECT_PAUSE_MS)
}

function orderedClients(): PlayerClient[] {
  const now = Date.now()
  const usable = CLIENTS.filter((c) => (rejectedUntil.get(c.ua) ?? 0) <= now)
  const paused = CLIENTS.filter((c) => (rejectedUntil.get(c.ua) ?? 0) > now)
  return [...usable, ...paused]
}

/* ---------------- visitorData (di-cache agar request berikutnya cepat) ---------------- */

const VISITOR_KEY = 'mv:plugin:ytmusic:visitor'
let visitorData: string | null = null

function loadVisitor(): string | null {
  if (visitorData) return visitorData
  try {
    visitorData = localStorage.getItem(VISITOR_KEY)
  } catch {
    /* storage tidak tersedia */
  }
  return visitorData
}

function saveVisitor(value: string): void {
  visitorData = value
  try {
    localStorage.setItem(VISITOR_KEY, value)
  } catch {
    /* abaikan */
  }
}

async function fetchVisitor(signal?: AbortSignal): Promise<string | null> {
  try {
    const response = await pluginFetch('https://www.youtube.com/sw.js_data', {
      headers: { Accept: 'application/json', 'User-Agent': 'com.google.android.youtube/20.10.38 (Linux; U; ANDROID 11)' },
      timeoutMs: defaultPluginTimeoutMs(),
      signal,
    })
    let text = await response.text()
    if (text.startsWith(")]}'")) text = text.slice(4).trim()
    const value = (JSON.parse(text) as any)?.[0]?.[2]?.[0]?.[0]?.[13]
    if (typeof value === 'string' && value) {
      saveVisitor(value)
      return value
    }
  } catch {
    /* tanpa visitorData masih bisa dicoba */
  }
  return null
}

/* ---------------- search ---------------- */

function parseClock(text: string): number | null {
  const m = /^(?:(\d+):)?(\d{1,2}):(\d{2})$/.exec(text.trim())
  if (!m) return null
  return Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3])
}

function collectItems(node: unknown, out: any[]): void {
  if (Array.isArray(node)) {
    for (const child of node) collectItems(child, out)
  } else if (node && typeof node === 'object') {
    const renderer = (node as any).musicResponsiveListItemRenderer
    if (renderer) out.push(renderer)
    else for (const child of Object.values(node)) collectItems(child, out)
  }
}

function toHit(r: any): PluginTrackHit | null {
  const id: unknown =
    r.playlistItemData?.videoId ??
    r.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint?.videoId
  if (typeof id !== 'string' || !id) return null
  const joinRuns = (col: any): string =>
    ((col?.musicResponsiveListItemFlexColumnRenderer?.text?.runs ?? []) as Array<{ text?: string }>)
      .map((run) => run.text ?? '')
      .join('')
  const title = joinRuns(r.flexColumns?.[0]).trim()
  if (!title) return null
  const segments = joinRuns(r.flexColumns?.[1]).split(' • ').map((s) => s.trim()).filter(Boolean)
  const last = segments[segments.length - 1]
  const durationSec = last ? parseClock(last) : null
  if (durationSec !== null) segments.pop()
  if (segments[0] === 'Song' || segments[0] === 'Video') segments.shift()
  const thumbs: Array<{ url?: string }> = r.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails ?? []
  return {
    id,
    title,
    artist: segments[0] ?? '',
    album: segments[1] ?? '',
    durationSec,
    cover: thumbs[thumbs.length - 1]?.url ?? '',
  }
}

async function search(query: string, signal?: AbortSignal): Promise<PluginTrackHit[]> {
  const body = {
    context: { client: { clientName: 'WEB_REMIX', clientVersion: WEB_VERSION, hl: 'en', gl: 'US' } },
    query,
    params: SONGS_PARAMS,
  }
  const response = await pluginFetch(SEARCH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://music.youtube.com', 'User-Agent': WEB_UA },
    body: JSON.stringify(body),
    signal,
  })
  const items: any[] = []
  collectItems(await response.json(), items)
  return items.map(toHit).filter((hit): hit is PluginTrackHit => hit !== null).slice(0, 8)
}

/* ---------------- streams ---------------- */

async function playerStreams(client: PlayerClient, id: string, visitor: string | null, signal?: AbortSignal): Promise<StreamSource[]> {
  const body: any = {
    context: {
      client: { clientName: client.name, clientVersion: client.version, userAgent: client.ua, hl: 'en', gl: 'US', utcOffsetMinutes: 0, ...client.context },
    },
    videoId: id,
    playbackContext: { contentPlaybackContext: { html5Preference: 'HTML5_PREF_WANTS' } },
    contentCheckOk: true,
    racyCheckOk: true,
  }
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': client.ua,
    'X-YouTube-Client-Name': client.id,
    'X-YouTube-Client-Version': client.version,
  }
  if (visitor) {
    body.context.client.visitorData = visitor
    headers['X-Goog-Visitor-Id'] = visitor
  }
  const response = await pluginFetch(PLAYER_URL, { method: 'POST', headers, body: JSON.stringify(body), signal })
  const data: any = await response.json()
  const status = data?.playabilityStatus?.status
  if (status !== 'OK') throw new Error(`${client.name}: ${status ?? '?'} ${data?.playabilityStatus?.reason ?? ''}`.trim())

  const formats: any[] = [...(data.streamingData?.adaptiveFormats ?? []), ...(data.streamingData?.formats ?? [])]
  const streams: StreamSource[] = []
  const configLoud = Number(data?.playerConfig?.audioConfig?.loudnessDb)
  for (const f of formats) {
    const mime = String(f.mimeType ?? '')
    // Hanya audio dengan URL langsung (tanpa signatureCipher).
    if (!mime.startsWith('audio/') || typeof f.url !== 'string') continue
    let expiresAt: number | null = null
    try {
      const expire = Number(new URL(f.url).searchParams.get('expire'))
      if (Number.isFinite(expire) && expire > 0) expiresAt = expire * 1000
    } catch {
      /* URL tak terbaca: biarkan null */
    }
    const formatLoud = Number(f.loudnessDb)
    const loudnessDb = Number.isFinite(configLoud) ? configLoud : Number.isFinite(formatLoud) ? formatLoud : undefined
    streams.push({ url: f.url, bitrate: Number(f.bitrate) || 0, mime, headers: { 'User-Agent': client.ua }, expiresAt, loudnessDb })
  }
  // MP4/AAC dulu (seek paling andal di WebView), lalu bitrate tertinggi.
  streams.sort((a, b) => Number(b.mime.includes('mp4')) - Number(a.mime.includes('mp4')) || b.bitrate - a.bitrate)
  return streams
}

async function getStreams(id: string, signal?: AbortSignal): Promise<StreamSource[]> {
  let visitor = loadVisitor() ?? (await fetchVisitor(signal))
  let lastError: unknown = new Error('Tidak ada stream audio.')
  let first = true
  for (const client of orderedClients()) {
    try {
      const streams = await playerStreams(client, id, visitor, signal)
      if (streams.length > 0) return streams
    } catch (error) {
      if (signal?.aborted) throw error
      lastError = error
      // Gagal pada klien pertama biasanya karena visitorData basi: ambil ulang sekali.
      if (first) visitor = (await fetchVisitor(signal)) ?? visitor
    }
    first = false
  }
  throw lastError
}

/** Pengambil stream YouTube (VISIONOS, lalu ANDROID sdkless, lalu IOS), dipakai bersama oleh plugin `ytvideo`. */
export { getStreams as getYoutubeStreams }

export const ytMusicPlugin: ResolverPlugin = { id: 'ytmusic', name: 'YouTube Music', search, getStreams }
