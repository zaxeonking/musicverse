import type { LyricLine } from '../utils/lrc'
import { parseTtml } from '../utils/ttml'
import { parseLyricsPlus, ttmlFromBetterLyrics } from '../utils/lyricsPlus'
import { activeWordProviders, loadProviderPrefs, type WordProviderId } from '../utils/lyricProviderPrefs'

/**
 * Provider lirik PER KATA (karaoke asli), diadaptasi dari analisis APK Auralys 4.3.2 (fork Metrolist):
 *  - LyricsPlus  : GET {mirror}/v2/lyrics/get  -> JSON ber-`syllabus` (waktu ms)
 *  - BetterLyrics: GET lyrics-api.boidu.dev/getLyrics -> { ttml } (TTML gaya Apple Music)
 *
 * PENTING: nama parameter query & bentuk respons berasal dari ingatan atas kode Metrolist + nama field di DEX Auralys,
 * BELUM diuji ke server sungguhan (jaringan dimatikan saat ini ditulis). Semua provider best-effort: gagal / bentuk
 * tak dikenal = dilewati diam-diam, sumber lama (LRCLIB dkk.) tetap jalan. Lihat CHANGES.md, bagian 0.5.54 "Verifikasi".
 */

export interface WordLyricsQuery {
  title: string
  artist: string
  album?: string
  /** ISRC (huruf besar, 12 karakter) bila diketahui; dipakai Binimum untuk pencocokan tepat. */
  isrc?: string
  /** Durasi lagu (detik) dari playlist, untuk memverifikasi hasil. */
  durationS: number | null
}

export interface WordLyricsHit {
  provider: WordProviderId
  lines: LyricLine[]
  /** true bila setidaknya sebagian baris punya waktu kata asli. */
  wordSynced: boolean
}

const LYRICSPLUS_MIRRORS = ['https://lyricsplus.prjktla.my.id', 'https://lyricsplus.binimum.org', 'https://lyricsplus.atomix.one']
const BETTERLYRICS_BASE = 'https://lyrics-api.boidu.dev'
/** Binimum: indeks lirik (ISRC / metadata) yang menunjuk ke TTML. Auralys mencobanya SEBELUM mirror LyricsPlus. Hanya APK (lyricsUrl ke host lain, tak bisa lewat proxy tetap). */
const BINIMUM_BASE = 'https://lyrics-api.binimum.org/'
const ISRC_RE = /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/

function isNative(): boolean {
  const cap = typeof window !== 'undefined' ? (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor : undefined
  return cap?.isNativePlatform?.() === true
}

/**
 * APK (CapacitorHttp, tanpa CORS): langsung, LyricsPlus dengan 3 mirror. Web: lewat proxy same-origin (`/lyricsplus`, `/boidu`;
 * lihat api/proxy.js, vercel.json, vite.config.ts), hanya satu mirror karena proxy menunjuk satu upstream.
 * `VITE_LYRICS_PLUS_BASE` / `VITE_LYRICS_BETTER_BASE` menimpa keduanya.
 */
export function lyricsPlusBases(): string[] {
  const configured = import.meta.env?.VITE_LYRICS_PLUS_BASE?.trim()
  if (configured) return [configured.replace(/\/+$/, '')]
  return isNative() ? LYRICSPLUS_MIRRORS : ['/lyricsplus']
}

export function betterLyricsBase(): string {
  const configured = import.meta.env?.VITE_LYRICS_BETTER_BASE?.trim()
  if (configured) return configured.replace(/\/+$/, '')
  return isNative() ? BETTERLYRICS_BASE : '/boidu'
}
/** Batas per permintaan dan batas total semua provider: jangan menahan lirik sumber lama terlalu lama. */
const REQUEST_TIMEOUT_MS = 4_000
const TOTAL_TIMEOUT_MS = 7_000
/** Lirik yang berakhir jauh melewati durasi lagu = kemungkinan lagu lain / versi lain. */
const MAX_OVERRUN_S = 12
const MIN_LINES = 3

/** GET JSON dengan batas waktu. 404 -> null (tidak ada); galat jaringan / status lain -> lempar (pemanggil memutuskan lanjut ke mirror). */
async function getJsonQuiet(url: string, signal: AbortSignal): Promise<unknown | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  const onAbort = () => controller.abort()
  if (signal.aborted) controller.abort()
  else signal.addEventListener('abort', onAbort, { once: true })
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } })
    if (response.status === 404) return null
    if (!response.ok) throw new Error(`status ${response.status}`)
    return await response.json()
  } finally {
    clearTimeout(timer)
    signal.removeEventListener('abort', onAbort)
  }
}

function query(params: Record<string, string | undefined>): string {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v) p.set(k, v)
  return p.toString()
}

/** Lirik yang masuk akal untuk lagu ini? Tolak yang terlalu pendek atau berakhir jauh melewati durasi lagu. */
export function plausibleFor(lines: readonly LyricLine[], durationS: number | null): boolean {
  if (lines.filter((l) => l.text.trim() !== '').length < MIN_LINES) return false
  if (durationS === null) return true
  const last = lines[lines.length - 1]
  const lastTime = last.end ?? last.time
  return lastTime <= durationS + MAX_OVERRUN_S && lines[0].time <= durationS
}

/** GET teks dengan batas waktu (untuk TTML dari `lyricsUrl`). Status bukan 2xx / galat -> null. */
async function getTextQuiet(url: string, signal: AbortSignal): Promise<string | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  const onAbort = () => controller.abort()
  if (signal.aborted) controller.abort()
  else signal.addEventListener('abort', onAbort, { once: true })
  try {
    const response = await fetch(url, { signal: controller.signal })
    return response.ok ? await response.text() : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
    signal.removeEventListener('abort', onAbort)
  }
}

/** ISRC valid (huruf besar, tanpa strip) atau undefined. */
export function normalizeIsrc(value: string | undefined | null): string | undefined {
  const v = (value ?? '').replace(/-/g, '').trim().toUpperCase()
  return ISRC_RE.test(v) ? v : undefined
}

/**
 * Binimum (cek dex Auralys): `GET lyrics-api.binimum.org/?isrc=...` atau `?track&artist&album&duration`;
 * respons `{total, source, results[{lyricsUrl, timing_type, ...}], error}`. Hasil pertama ber-`lyricsUrl` diunduh sebagai TTML.
 */
async function viaBinimum(q: WordLyricsQuery, signal: AbortSignal): Promise<LyricLine[] | null> {
  if (!isNative()) return null
  const isrc = normalizeIsrc(q.isrc)
  const searches = [
    ...(isrc ? [query({ isrc })] : []),
    query({ track: q.title, artist: q.artist, album: q.album, duration: q.durationS ? String(Math.round(q.durationS)) : undefined }),
  ]
  for (const qs of searches) {
    if (signal.aborted) return null
    try {
      const body = await getJsonQuiet(`${BINIMUM_BASE}?${qs}`, signal)
      const results = (body as { results?: unknown; error?: unknown } | null)?.results
      if (!Array.isArray(results)) continue
      for (const r of results) {
        const url = (r as { lyricsUrl?: unknown } | null)?.lyricsUrl
        if (typeof url !== 'string' || !/^https:\/\//i.test(url)) continue
        const ttml = await getTextQuiet(url, signal)
        const lines = ttml ? parseTtml(ttml) : []
        return lines.length > 0 ? lines : null
      }
    } catch {
      // Binimum bermasalah: lanjut (pencarian metadata / mirror LyricsPlus).
    }
  }
  return null
}

async function viaLyricsPlus(q: WordLyricsQuery, signal: AbortSignal): Promise<LyricLine[] | null> {
  const fromBinimum = await viaBinimum(q, signal)
  if (fromBinimum && plausibleFor(fromBinimum, q.durationS)) return fromBinimum
  const qs = query({ title: q.title, artist: q.artist, album: q.album, duration: q.durationS ? String(Math.round(q.durationS)) : undefined })
  for (const base of lyricsPlusBases()) {
    if (signal.aborted) return null
    try {
      const body = await getJsonQuiet(`${base}/v2/lyrics/get?${qs}`, signal)
      if (body === null) return null // 404 = lagu memang tidak ada di server ini; mirror lain berbagi data yang sama
      return parseLyricsPlus(body)
    } catch {
      // Mirror ini sedang bermasalah: coba mirror berikutnya.
    }
  }
  return null
}

async function viaBetterLyrics(q: WordLyricsQuery, signal: AbortSignal): Promise<LyricLine[] | null> {
  const qs = query({ s: q.title, a: q.artist, al: q.album, d: q.durationS ? String(Math.round(q.durationS)) : undefined })
  try {
    const ttml = ttmlFromBetterLyrics(await getJsonQuiet(`${betterLyricsBase()}/getLyrics?${qs}`, signal))
    if (!ttml) return null
    const lines = parseTtml(ttml)
    return lines.length > 0 ? lines : null
  } catch {
    return null
  }
}

const RUNNERS: Record<WordProviderId, (q: WordLyricsQuery, signal: AbortSignal) => Promise<LyricLine[] | null>> = {
  lyricsplus: viaLyricsPlus,
  betterlyrics: viaBetterLyrics,
}

/**
 * Coba provider kata sesuai preferensi (urutan + saklar). Hasil pertama yang masuk akal DAN berwaktu kata dipakai;
 * kalau hanya ada hasil per baris, hasil itu dikembalikan sebagai cadangan. TIDAK PERNAH melempar: null = tidak ada.
 */
export async function fetchWordLyrics(q: WordLyricsQuery, outer: AbortSignal, options: { force?: boolean } = {}): Promise<WordLyricsHit | null> {
  // `force`: pengguna memilih sumber ini secara manual, jadi saklar "Lirik per kata" dan provider yang dimatikan diabaikan.
  const providers = options.force ? loadProviderPrefs().order : activeWordProviders()
  if (providers.length === 0 || !q.title) return null
  const total = new AbortController()
  const timer = setTimeout(() => total.abort(), TOTAL_TIMEOUT_MS)
  const onAbort = () => total.abort()
  if (outer.aborted) total.abort()
  else outer.addEventListener('abort', onAbort, { once: true })
  try {
    let lineOnly: WordLyricsHit | null = null
    for (const provider of providers) {
      if (total.signal.aborted) break
      const lines = await RUNNERS[provider](q, total.signal).catch(() => null)
      if (!lines || !plausibleFor(lines, q.durationS)) continue
      const hit: WordLyricsHit = { provider, lines, wordSynced: lines.some((l) => !!l.words?.length) }
      if (hit.wordSynced) return hit
      lineOnly ??= hit
    }
    return lineOnly
  } finally {
    clearTimeout(timer)
    outer.removeEventListener('abort', onAbort)
  }
}
