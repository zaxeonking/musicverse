import { getBaseUrl } from '../services/spotifyApi'

/**
 * Kualitas koneksi berdasarkan ping (waktu tempuh bolak-balik ke server API).
 *  - good   : ping 1–5 ms        → lagu berikutnya dimuat SETELAH lagu ini selesai (tanpa preload dini).
 *  - medium : ping 6–150 ms      → lagu berikutnya dimuat menjelang lagu ini selesai.
 *  - poor   : ping > 150 ms / timeout / offline → lagu berikutnya dimuat jauh lebih awal.
 */
export type NetworkTier = 'good' | 'medium' | 'poor'

/** Batas atas ping (ms) tiap tingkat. */
export const GOOD_PING_MAX_MS = 5
export const MEDIUM_PING_MAX_MS = 150

/** Berapa detik SEBELUM lagu selesai lagu berikutnya mulai dimuat. 0 = tunggu lagu selesai. */
export const PRELOAD_LEAD_BY_TIER_S: Record<NetworkTier, number> = {
  good: 0,
  medium: 25,
  poor: 60,
}

const SAMPLES = 4 // sampel pertama dibuang (handshake TLS), sisanya diambil median
const SAMPLE_TIMEOUT_MS = 3_000
const REFRESH_MS = 20_000

let pingMs: number | null = null
// Sebelum ada hasil ukur, anggap sedang: perilaku paling mendekati sebelumnya.
let tier: NetworkTier = 'medium'
let timer = 0
let running = false
let measuring = false
const listeners = new Set<(tier: NetworkTier) => void>()

export function classifyPing(ms: number | null): NetworkTier {
  if (ms === null) return 'poor'
  if (ms <= GOOD_PING_MAX_MS) return 'good'
  if (ms <= MEDIUM_PING_MAX_MS) return 'medium'
  return 'poor'
}

export function getNetworkTier(): NetworkTier {
  return tier
}

/** Ping terakhir dalam ms (null = belum terukur / gagal). */
export function getLastPingMs(): number | null {
  return pingMs
}

export function subscribeNetworkTier(listener: (tier: NetworkTier) => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function setResult(ms: number | null) {
  pingMs = ms
  const next = classifyPing(ms)
  if (next === tier) return
  tier = next
  for (const listener of [...listeners]) listener(next)
}

async function sampleOnce(url: string): Promise<number> {
  const controller = new AbortController()
  const abortTimer = window.setTimeout(() => controller.abort(), SAMPLE_TIMEOUT_MS)
  const started = performance.now()
  try {
    // no-cors: respons buram tapi waktu sampai header diterima tetap terukur; tidak butuh CORS dari server.
    await fetch(url, { method: 'HEAD', mode: 'no-cors', cache: 'no-store', signal: controller.signal })
    return performance.now() - started
  } finally {
    window.clearTimeout(abortTimer)
  }
}

/** Mengukur ping sekarang (median beberapa sampel). Gagal / offline = null → dianggap `poor`. */
export async function measurePing(): Promise<number | null> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return null
  const url = getBaseUrl()
  const values: number[] = []
  for (let i = 0; i < SAMPLES; i += 1) {
    try {
      const ms = await sampleOnce(url)
      if (i > 0) values.push(ms)
    } catch {
      // Timeout / jaringan putus: hitung sebagai ping sangat tinggi.
      if (i > 0) values.push(SAMPLE_TIMEOUT_MS)
    }
  }
  if (values.length === 0) return null
  values.sort((a, b) => a - b)
  return values[Math.floor(values.length / 2)]
}

async function refresh() {
  if (measuring) return
  measuring = true
  try {
    setResult(await measurePing())
  } finally {
    measuring = false
  }
}

function onVisibility() {
  if (document.visibilityState === 'visible') void refresh()
}
function onConnectionChange() {
  if (navigator.onLine === false) setResult(null)
  else void refresh()
}

/** Mulai memantau ping secara berkala (aman dipanggil berulang). Mengembalikan fungsi untuk berhenti. */
export function startNetworkMonitor(): () => void {
  if (typeof window === 'undefined') return () => {}
  if (!running) {
    running = true
    void refresh()
    timer = window.setInterval(() => void refresh(), REFRESH_MS)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('online', onConnectionChange)
    window.addEventListener('offline', onConnectionChange)
  }
  return stopNetworkMonitor
}

export function stopNetworkMonitor(): void {
  if (!running) return
  running = false
  window.clearInterval(timer)
  document.removeEventListener('visibilitychange', onVisibility)
  window.removeEventListener('online', onConnectionChange)
  window.removeEventListener('offline', onConnectionChange)
}
