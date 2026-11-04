import { getNetworkTier } from '../utils/networkQuality'

/**
 * HTTP untuk plugin. Di APK, CapacitorHttp (aktif di capacitor.config.ts) meneruskan fetch() lewat
 * HTTP native: bebas CORS dan boleh mengirim header seperti User-Agent. Di browser biasa (dev web)
 * sumber seperti YouTube akan ditolak CORS, dan itu normal: audio hanya bisa diputar/diunduh di APK.
 */
export interface PluginFetchInit {
  method?: 'GET' | 'POST'
  headers?: Record<string, string>
  body?: string
  /** Kosong = menyesuaikan kualitas jaringan (sinyal jelek diberi waktu lebih lama, bukan langsung dianggap gagal). */
  timeoutMs?: number
  signal?: AbortSignal
}

/** Batas waktu satu request plugin menurut kualitas koneksi. Sebelumnya tetap 8 dtk sehingga di sinyal lemah plugin selalu "gagal". */
export function defaultPluginTimeoutMs(): number {
  const tier = getNetworkTier()
  return tier === 'poor' ? 16_000 : tier === 'medium' ? 10_000 : 8_000
}

export async function pluginFetch(url: string, init: PluginFetchInit = {}): Promise<Response> {
  const { method = 'GET', headers, body, timeoutMs = defaultPluginTimeoutMs(), signal } = init
  const controller = new AbortController()
  const onAbort = () => controller.abort()
  if (signal?.aborted) controller.abort()
  else signal?.addEventListener('abort', onAbort, { once: true })
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { method, headers, body, signal: controller.signal })
    if (!response.ok) throw new Error(`HTTP ${response.status} dari ${new URL(url).host}`)
    return response
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}
