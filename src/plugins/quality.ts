import type { StreamSource } from './types'

/**
 * Pilihan kualitas unduhan (padanan `AudioStreamQualityPreference` / `url-high` + `url-low` di StreamBeats).
 *  - high  : seperti sebelumnya (M4A dulu, bitrate tertinggi). Default.
 *  - normal: mendekati 128 kbps.
 *  - low   : mendekati 64 kbps (hemat kuota dan ruang).
 * Hanya berlaku untuk sumber plugin; API pihak ketiga tidak menyediakan pilihan bitrate.
 */
export type DownloadQuality = 'high' | 'normal' | 'low'

export const DOWNLOAD_QUALITIES: ReadonlyArray<{ id: DownloadQuality; label: string; hint: string }> = [
  { id: 'high', label: 'Tinggi', hint: 'Bitrate tertinggi yang tersedia' },
  { id: 'normal', label: 'Sedang', hint: '±128 kbps' },
  { id: 'low', label: 'Hemat', hint: '±64 kbps' },
]

export const DEFAULT_DOWNLOAD_QUALITY: DownloadQuality = 'high'

export function isDownloadQuality(value: unknown): value is DownloadQuality {
  return value === 'high' || value === 'normal' || value === 'low'
}

const TARGET_BPS: Record<Exclude<DownloadQuality, 'high'>, number> = { normal: 128_000, low: 64_000 }
/**
 * Keunggulan M4A/AAC atas WebM/Opus pada selisih bitrate yang sebanding (skala log; 0,3 ≈ 35%): hanya M4A yang bisa
 * diberi tag + sampul (AudioFinalizer), dan M4A paling andal di semua pemutar.
 */
const MP4_BONUS = 0.3

/**
 * Mengurutkan stream menurut pilihan kualitas; yang paling sesuai di depan, sisanya tetap tersedia sebagai cadangan.
 * `high` mengembalikan urutan apa adanya dari plugin. Urutan stabil; bitrate tak diketahui (0) paling belakang.
 */
export function orderStreamsForQuality(streams: readonly StreamSource[], quality: DownloadQuality): StreamSource[] {
  if (quality === 'high') return [...streams]
  const target = TARGET_BPS[quality]
  const cost = (s: StreamSource): number =>
    s.bitrate > 0 ? Math.abs(Math.log(s.bitrate / target)) - (s.mime.includes('mp4') ? MP4_BONUS : 0) : Number.POSITIVE_INFINITY
  return streams
    .map((stream, index) => ({ stream, index, cost: cost(stream) }))
    .sort((a, b) => (a.cost === b.cost ? a.index - b.index : a.cost < b.cost ? -1 : 1))
    .map((entry) => entry.stream)
}
