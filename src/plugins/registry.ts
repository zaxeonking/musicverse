import type { PlaybackInfo } from '../types/spotify'
import { durationFit, isLikelyClip } from '../utils/clipDetect'
import { scoreCandidate, type WantedTrack } from '../utils/matchTrack'
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

function formatClock(totalSec: number | null): string {
  if (totalSec === null) return ''
  const s = Math.round(totalSec)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/**
 * Mencari lagu lewat plugin dan mengembalikan info playback, atau null bila semua plugin gagal / tidak
 * ada hasil yang cocok. Tidak pernah melempar error: pemanggil lanjut ke API lama.
 * Setiap stream diperiksa dulu (metadata audio terbaca di WebView, bukan klip) sebelum dipakai.
 */
export async function resolveViaPlugins(
  wanted: WantedTrack,
  options: { signal?: AbortSignal; expected: number | null },
): Promise<PlaybackInfo | null> {
  const { signal, expected } = options
  const key = cacheKey(wanted)
  const cached = cacheGet(key)
  if (cached) return cached

  const disabled = readDisabled()
  const query = [stripArtistPrefix(wanted.title, wanted.artists), wanted.artists.split(/\s*[,&;]\s*/)[0]]
    .filter(Boolean)
    .join(' ')
  const spotifyUrl = extractSpotifyTrackLink(wanted.url ?? '') ?? ''

  for (const plugin of plugins) {
    if (disabled.includes(plugin.id)) continue
    if (signal?.aborted) return null
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
          const actual = await probeAudioDuration(stream.url, 7000, signal)
          // Tidak terbaca di WebView (mis. ditolak CDN) atau jelas bukan lagunya: coba berikutnya.
          if (actual === null || isLikelyClip(actual, expected)) continue
          const fit = durationFit(actual, expected)
          if (fit !== null && fit < 0.7) continue
          const info: PlaybackInfo = {
            title: hit.title,
            artist: hit.artist,
            album: hit.album,
            duration: formatClock(actual),
            cover: hit.cover,
            spotifyUrl,
            audioUrl: stream.url,
            source: `plugin:${plugin.id}`,
            probedDuration: actual,
          }
          console.info(`[MusicVerse] Plugin ${plugin.id}: "${hit.title}" skor ${score.toFixed(2)}, ${actual.toFixed(1)} dtk`)
          cachePut(key, info, stream)
          return info
        }
      }
    } catch (error) {
      if (signal?.aborted) return null
      console.warn(`[MusicVerse] Plugin ${plugin.id} gagal:`, error)
    }
  }
  return null
}
