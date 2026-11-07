import { readJson, writeJson } from './safeStorage'

/**
 * Log pemutaran ringan di dalam aplikasi (200 baris terakhir, disimpan di perangkat): menjawab "kenapa lagu tadi berulang /
 * tidak lanjut" tanpa perlu adb. Dibuka lewat Pengaturan > Pemutaran > Salin log pemutaran. Hanya berisi keputusan pemutar
 * (lagu selesai, pindah, seek, galat, muat ulang); tidak ada data pribadi selain judul lagu.
 */
const KEY = 'musicverse:playback-log:v1'
const MAX_LINES = 200

function load(): string[] {
  const saved = readJson(KEY)
  if (saved.status !== 'ok' || !Array.isArray(saved.value)) return []
  return saved.value.filter((line): line is string => typeof line === 'string').slice(-MAX_LINES)
}

let lines: string[] = load()
let timer: ReturnType<typeof setTimeout> | null = null

function persistSoon(): void {
  if (timer !== null) return
  timer = setTimeout(() => {
    timer = null
    writeJson(KEY, lines)
  }, 1500)
}

function stamp(): string {
  const now = new Date()
  const pad = (n: number, width = 2) => String(n).padStart(width, '0')
  return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}.${pad(now.getMilliseconds(), 3)}`
}

export function plog(message: string): void {
  lines.push(`${stamp()} ${message}`)
  if (lines.length > MAX_LINES) lines = lines.slice(-MAX_LINES)
  persistSoon()
}

export function getPlaybackLog(): string {
  return lines.join('\n')
}

export function clearPlaybackLog(): void {
  lines = []
  writeJson(KEY, lines)
}
