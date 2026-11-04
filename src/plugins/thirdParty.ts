import { isSafeHttpUrl } from '../utils/spotifyUrl'
import { pluginFetch } from './http'

/**
 * Sumber audio PIHAK KETIGA: cadangan TERAKHIR untuk unduhan, hanya dipakai bila pengguna menyalakannya di Pengaturan
 * unduhan (default MATI) dan plugin YouTube Music / YouTube tidak menemukan yang cocok. Sumber ini butuh tautan lagu
 * Spotify dan mengembalikan audio yang asal-usulnya tidak kita kendalikan, jadi hasilnya TIDAK dipercaya begitu saja:
 * `registry.ts` memverifikasi judul, artis, dan durasi file sebelum dipakai, lalu isi berkasnya diperiksa lagi
 * setelah diunduh (sama seperti sumber plugin).
 */
export interface ThirdPartyAudio {
  title: string
  artist: string
  album: string
  /** "m:ss" bila diketahui; bukan acuan (durasi sebenarnya dibaca dari audionya). */
  duration: string
  cover: string
  audioUrl: string
}

export interface ThirdPartySource {
  /** Dipakai sebagai kunci `avoid` (`plugin:<id>`) seperti plugin biasa. */
  id: string
  name: string
  fetch(spotifyUrl: string, signal?: AbortSignal): Promise<ThirdPartyAudio>
}

const KYZZ_BASE = 'https://app.kyzznekoo.my.id'
const NEXA_BASE = 'https://api.nexadev.my.id'
const TIMEOUT_MS = 30_000

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

async function getJson(url: string, signal?: AbortSignal): Promise<Record<string, unknown>> {
  const response = await pluginFetch(url, { headers: { Accept: 'application/json' }, timeoutMs: TIMEOUT_MS, signal })
  const body: unknown = await response.json()
  if (!isRecord(body) || body.status !== true || !isRecord(body.data)) throw new Error('Respons sumber cadangan tidak valid.')
  return body.data
}

function audioUrlOf(data: Record<string, unknown>): string {
  const url = text(data.url).trim()
  // Hanya audio PENUH: `preview` (cuplikan ~30 dtk) sengaja tidak pernah dipakai.
  if (!url || !isSafeHttpUrl(url)) throw new Error('Sumber cadangan tidak memberi audio.')
  return url
}

const kyzz: ThirdPartySource = {
  id: 'tp-kyzz',
  name: 'Cadangan 1',
  async fetch(spotifyUrl, signal) {
    let lastError: unknown
    // Permintaan kedua dst. kadang gagal sesaat (rate limit / timeout): satu kali ulang.
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const data = await getJson(`${KYZZ_BASE}/api/download/spotify?url=${encodeURIComponent(spotifyUrl)}`, signal)
        const meta = isRecord(data.metadata) ? data.metadata : {}
        return {
          title: text(meta.name),
          artist: text(meta.artist),
          album: text(meta.album),
          duration: text(meta.duration),
          cover: text(meta.image),
          audioUrl: audioUrlOf(data),
        }
      } catch (error) {
        if (signal?.aborted) throw error
        lastError = error
        if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 700))
      }
    }
    throw lastError
  },
}

const nexa: ThirdPartySource = {
  id: 'tp-nexa',
  name: 'Cadangan 2',
  async fetch(spotifyUrl, signal) {
    const data = await getJson(`${NEXA_BASE}/api/spotify?url=${encodeURIComponent(spotifyUrl)}`, signal)
    return {
      title: text(data.title),
      artist: text(data.artist),
      album: '',
      duration: text(data.duration),
      cover: text(data.thumbnail),
      audioUrl: audioUrlOf(data),
    }
  },
}

/** Urutan dicoba: Cadangan 1, lalu Cadangan 2. */
export const THIRD_PARTY_SOURCES: readonly ThirdPartySource[] = [kyzz, nexa]
