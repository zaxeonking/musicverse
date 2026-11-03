/**
 * HTTP untuk plugin. Di APK, CapacitorHttp (aktif di capacitor.config.ts) meneruskan fetch() lewat
 * HTTP native: bebas CORS dan boleh mengirim header seperti User-Agent. Di browser biasa (dev web)
 * sumber seperti YouTube akan ditolak CORS, dan itu normal: pemutaran jatuh ke API lama.
 */
export interface PluginFetchInit {
  method?: 'GET' | 'POST'
  headers?: Record<string, string>
  body?: string
  timeoutMs?: number
  signal?: AbortSignal
}

export async function pluginFetch(url: string, init: PluginFetchInit = {}): Promise<Response> {
  const { method = 'GET', headers, body, timeoutMs = 8000, signal } = init
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
