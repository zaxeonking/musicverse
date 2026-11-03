import { MusicVerseNative } from '../native/musicVerseNative'
import { isNativeApp } from '../native/platform'
import type { PlaybackInfo } from '../types/spotify'
import { durationFit, isLikelyClip, strictDurationProblem } from '../utils/clipDetect'
import { metadataMismatch, scoreCandidate, type WantedTrack } from '../utils/matchTrack'
import { getNetworkTier } from '../utils/networkQuality'
import { probeAudioDuration } from '../utils/probeAudio'
import { extractSpotifyTrackLink } from '../utils/spotifyUrl'
import { stripArtistPrefix } from '../utils/trackTitle'
import type { ResolverPlugin, StreamSource } from './types'
import { ytMusicPlugin } from './ytmusic'

/**
 * Daftar plugin pemutaran, dicoba berurutan. Menambah sumber baru = buat `ResolverPlugin`
 * (lihat ytmusic.ts) lalu daftarkan di sini atau lewat `registerPlugin`.
 */
const plugins: ResolverPlugin[] = [ytMusicPlugin]

const DISABLED_KEY = 'mv:plugins:disabled'

function readDisabled(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(DISABLED_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

export function registerPlugin(plugin: ResolverPlugin): void {
  if (!plugins.some((p) => p.id === plugin.id)) plugins.push(plugin)
}

export function listPlugins(): Array<{ id: string; name: string; enabled: boolean }> {
  const disabled = readDisabled()
  return plugins.map((p) => ({ id: p.id, name: p.name, enabled: !disabled.includes(p.id) }))
}

export function setPluginEnabled(id: string, enabled: boolean): void {
  const next = readDisabled().filter((v) => v !== id)
  if (!enabled) next.push(id)
  try {
    localStorage.setItem(DISABLED_KEY, JSON.stringify(next))
  } catch {
    /* abaikan */
  }
}

/* ---------------- cache hasil resolve (sadar kedaluwarsa) ---------------- */

const CACHE_MAX_MS = 30 * 60_000
const CACHE_SAFETY_MS = 60_000
const cache = new Map<string, { info: PlaybackInfo; until: number }>()

function cacheKey(wanted: WantedTrack): string {
  return `${wanted.title}|${wanted.artists}`.toLowerCase()
}

/** Membuang hasil resolve yang tersimpan untuk lagu ini (mis. URL-nya ditolak sumber walau belum kedaluwarsa). */
export function forgetResolved(track: { title: string; artists?: string }): void {
  cache.delete(cacheKey({ title: track.title, artists: track.artists ?? '', duration: '' }))
}

function cacheGet(key: string): PlaybackInfo | null {
  const hit = cache.get(key)
  if (!hit) return null
  if (Date.now() >= hit.until) {
    cache.delete(key)
    return null
  }
  return hit.info
}

function cachePut(key: string, info: PlaybackInfo, stream: StreamSource): void {
  const now = Date.now()
  for (const [k, v] of cache) if (now >= v.until) cache.delete(k)
  const limit = stream.expiresAt !== null ? stream.expiresAt - CACHE_SAFETY_MS : now + CACHE_MAX_MS
  const until = Math.min(now + CACHE_MAX_MS, limit)
  if (until > now) cache.set(key, { info, until })
}

/* ---------------- resolusi ---------------- */

const ACCEPT_SCORE = 0.7
const MAX_CANDIDATES = 2
const MAX_STREAMS_PER_CANDIDATE = 2
/**
 * Batas total waktu plugin; lewat ini aplikasi pindah ke API lama. Dulu tetap 9 dtk: di sinyal lemah rangkaian
 * (visitorData + cari + ambil stream + baca metadata lewat proxy) hampir selalu melewati batas itu, sehingga plugin
 * "selalu gagal" dan aplikasi balik ke pihak ketiga. Sekarang batasnya mengikuti kualitas jaringan; unduhan (tidak
 * ada pendengar yang menunggu) diberi waktu paling longgar.
 */
const PLUGIN_BUDGET_BY_TIER = { good: 9_000, medium: 16_000, poor: 28_000 } as const
const PLUGIN_BUDGET_STRICT_MS = 35_000

function pluginBudgetMs(strict: boolean): number {
  return strict ? PLUGIN_BUDGET_STRICT_MS : PLUGIN_BUDGET_BY_TIER[getNetworkTier()]
}

function probeTimeoutMs(strict: boolean): number {
  return strict || getNetworkTier() !== 'good' ? 12_000 : 7_000
}
/** Plugin yang gagal berturut-turut dilewati sementara, supaya tidak menambah jeda sebelum API lama. */
const BREAKER_AFTER = 3
const BREAKER_PAUSE_MS = 5 * 60_000
let failStreak = 0
let pausedUntil = 0

function formatClock(totalSec: number | null): string {
  if (totalSec === null) return ''
  const s = Math.round(totalSec)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

let proxyUnavailable = false

/** Kode galat Capacitor untuk metode native yang tidak ada (APK lama). */
export function isNativeUnimplemented(error: unknown): boolean {
  const e = error as { code?: unknown; message?: unknown } | null
  const text = typeof e?.message === 'string' ? e.message.toLowerCase() : ''
  return e?.code === 'UNIMPLEMENTED' || text.includes('not implemented') || text.includes('unimplemented')
}

/**
 * Menyalurkan URL audio lewat proxy lokal native (StreamProxy). Di sana koneksi yang putus di tengah lagu otomatis
 * disambung dari byte terakhir, jadi <audio> tidak melihat error jaringan saat sinyal hilang sebentar. User-Agent
 * (bila ada) dikirim proxy karena <audio> di WebView tidak bisa. Tanpa proxy (web / APK lama) URL dipakai apa adanya.
 */
export async function proxyRemoteUrl(url: string, userAgent?: string): Promise<string> {
  if (!isNativeApp() || proxyUnavailable) return url
  if (!/^https?:\/\//i.test(url) || url.startsWith('http://127.0.0.1')) return url
  try {
    return (await MusicVerseNative.proxyStream({ url, userAgent })).url
  } catch (error) {
    if (isNativeUnimplemented(error)) {
      proxyUnavailable = true
      console.warn('[MusicVerse] APK ini belum punya StreamProxy: stream plugin tidak bisa dikirimi User-Agent dan koneksi putus tidak disambung. Pasang APK versi terbaru.')
    }
    return url
  }
}

async function toPlayableUrl(stream: StreamSource): Promise<string> {
  const userAgent = stream.headers?.['User-Agent']
  if (!userAgent) return stream.url
  return proxyRemoteUrl(stream.url, userAgent)
}

/** Pemeriksaan ketat untuk unduhan: artis/versi cocok dan durasi file sangat dekat dengan lagu di playlist. null = lolos. */
function strictProblem(wanted: WantedTrack, info: PlaybackInfo, actual: number | null, expected: number | null): string | null {
  const mismatch = metadataMismatch(wanted, info)
  if (mismatch) return mismatch
  return strictDurationProblem(actual, expected)
}

/**
 * Mencari lagu lewat plugin dan mengembalikan info playback, atau null bila semua plugin gagal / tidak
 * ada hasil yang cocok. Tidak pernah melempar error: pemanggil lanjut ke API lama.
 * Setiap stream diperiksa dulu (metadata audio terbaca di WebView, bukan klip) sebelum dipakai.
 */
export async function resolveViaPlugins(
  wanted: WantedTrack,
  options: { signal?: AbortSignal; expected: number | null; strict?: boolean },
): Promise<PlaybackInfo | null> {
  const { expected, strict = false } = options
  const key = cacheKey(wanted)
  const cached = cacheGet(key)
  // Mode unduhan menambah pemeriksaan ketat (artis, versi, durasi); hasil cache yang tidak lolos dibuang.
  if (cached && (!strict || strictProblem(wanted, cached, cached.probedDuration ?? null, expected) === null)) return cached
  if (Date.now() < pausedUntil) return null

  const inner = new AbortController()
  const forward = () => inner.abort()
  if (options.signal?.aborted) return null
  options.signal?.addEventListener('abort', forward, { once: true })
  const budget = setTimeout(() => inner.abort(), pluginBudgetMs(strict))
  const signal = inner.signal

  const disabled = readDisabled()
  const query = [stripArtistPrefix(wanted.title, wanted.artists), wanted.artists.split(/\s*[,&;]\s*/)[0]]
    .filter(Boolean)
    .join(' ')
  const spotifyUrl = extractSpotifyTrackLink(wanted.url ?? '') ?? ''
  let hadFailure = false

  try {
    for (const plugin of plugins) {
      if (disabled.includes(plugin.id)) continue
      if (signal.aborted) return null
      try {
        const hits = await plugin.search(query, signal)
        const scored = hits
          .map((hit) => {
            const probe: PlaybackInfo = {
              title: hit.title,
              artist: hit.artist,
              album: hit.album,
              duration: formatClock(hit.durationSec),
              cover: hit.cover,
              spotifyUrl,
              audioUrl: '',
            }
            // Durasi dari hasil pencarian: kecocokan durasi (bobot terbesar) langsung terhitung.
            return { hit, score: scoreCandidate(wanted, probe, false, hit.durationSec) }
          })
          .filter((c) => c.score >= ACCEPT_SCORE)
          .sort((a, b) => b.score - a.score)
          .slice(0, MAX_CANDIDATES)

        for (const { hit, score } of scored) {
          const streams = (await plugin.getStreams(hit.id, signal)).slice(0, MAX_STREAMS_PER_CANDIDATE)
          for (const stream of streams) {
            const playable = await toPlayableUrl(stream)
            const actual = await probeAudioDuration(playable, probeTimeoutMs(strict), signal)
            // Tidak terbaca di WebView (mis. ditolak CDN) atau jelas bukan lagunya: coba berikutnya.
            if (actual === null) {
              hadFailure = true
              continue
            }
            if (isLikelyClip(actual, expected)) continue
            const fit = durationFit(actual, expected)
            if (fit !== null && fit < 0.7) continue
            const info: PlaybackInfo = {
              title: hit.title,
              artist: hit.artist,
              album: hit.album,
              duration: formatClock(actual),
              cover: hit.cover,
              spotifyUrl,
              audioUrl: playable,
              source: `plugin:${plugin.id}`,
              apiSource: 'plugin',
              probedDuration: actual,
              directUrl: stream.url,
              directUserAgent: stream.headers?.['User-Agent'],
            }
            if (strict) {
              const problem = strictProblem(wanted, info, actual, expected)
              if (problem) {
                console.warn(`[MusicVerse] Plugin ${plugin.id} ditolak untuk unduhan: ${problem}`)
                continue
              }
            }
            console.info(`[MusicVerse] Plugin ${plugin.id}: "${hit.title}" skor ${score.toFixed(2)}, ${actual.toFixed(1)} dtk`)
            cachePut(key, info, stream)
            failStreak = 0
            return info
          }
        }
      } catch (error) {
        if (signal.aborted) return null
        hadFailure = true
        console.warn(`[MusicVerse] Plugin ${plugin.id} gagal:`, error)
      }
    }
    return null
  } finally {
    clearTimeout(budget)
    options.signal?.removeEventListener('abort', forward)
    // Hanya kegagalan nyata (jaringan / stream tak terbaca) yang dihitung; "tidak ada yang cocok" bukan gagal.
    if (hadFailure && !options.signal?.aborted) {
      failStreak += 1
      if (failStreak >= BREAKER_AFTER) {
        pausedUntil = Date.now() + BREAKER_PAUSE_MS
        failStreak = 0
        console.warn('[MusicVerse] Plugin dijeda 5 menit karena gagal berturut-turut; memakai API lama.')
      }
    }
  }
}

/**
 * Menyiapkan link stream lagu berikutnya di latar belakang (hasil masuk cache), sehingga saat lagu
 * berganti tidak ada lagi jeda mencari/mengambil link. Aman dipanggil berkali-kali.
 */
export function warmResolve(wanted: WantedTrack, expected: number | null): void {
  if (cacheGet(cacheKey(wanted)) || Date.now() < pausedUntil) return
  // Beri waktu lagu yang sedang dimuat menyelesaikan permintaannya lebih dulu.
  setTimeout(() => {
    void resolveViaPlugins(wanted, { expected })
  }, 2_500)
}
