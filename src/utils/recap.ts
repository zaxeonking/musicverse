import type { PlaylistTrack } from '../types/spotify'
import { parseDuration } from './formatTime'
import { recentKey } from './libraryStorage'
import { splitArtists, type PlayLogEntry } from './playLog'

export type RecapPeriod = '7d' | '30d' | 'all'

export const RECAP_PERIODS: Array<{ id: RecapPeriod; label: string }> = [
  { id: '7d', label: '7 hari' },
  { id: '30d', label: '30 hari' },
  { id: 'all', label: 'Semua' },
]

/** Durasi dianggap 3,5 menit bila lagu tidak punya durasi tercatat. */
export const FALLBACK_DURATION_S = 210

export interface Recap {
  plays: number
  uniqueTracks: number
  uniqueArtists: number
  /** Perkiraan: jumlah durasi lagu per putaran (lagu yang dilewati di tengah tetap dihitung penuh). */
  totalSeconds: number
  topTracks: Array<{ track: PlaylistTrack; count: number }>
  topArtists: Array<{ name: string; count: number }>
  /** Putaran per hari dalam seminggu, indeks 0 = Senin ... 6 = Minggu. */
  perWeekday: number[]
  /** Indeks hari paling aktif, atau -1 bila kosong. */
  busiestWeekday: number
  /** Jam (0-23) paling sering mendengar, atau -1. */
  busiestHour: number
  /** Hari kalender (YYYY-MM-DD) dengan putaran terbanyak. */
  busiestDay: { date: string; plays: number } | null
  /** Jumlah hari kalender berbeda yang ada putarannya di periode ini. */
  activeDays: number
}

export const WEEKDAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']

function sinceFor(period: RecapPeriod, now: number): number {
  if (period === '7d') return now - 7 * 86_400_000
  if (period === '30d') return now - 30 * 86_400_000
  return 0
}

function dayKey(at: number): string {
  const d = new Date(at)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function argMax(values: readonly number[]): number {
  let best = -1
  let max = 0
  values.forEach((v, i) => {
    if (v > max) {
      max = v
      best = i
    }
  })
  return best
}

/** Dihitung seluruhnya di perangkat dari log putar; tidak ada data yang dikirim ke mana pun. */
export function computeRecap(log: readonly PlayLogEntry[], period: RecapPeriod, top = 5, now: number = Date.now()): Recap {
  const since = sinceFor(period, now)
  const tracks = new Map<string, { track: PlaylistTrack; count: number }>()
  const artists = new Map<string, number>()
  const days = new Map<string, number>()
  const perWeekday = [0, 0, 0, 0, 0, 0, 0]
  const perHour = new Array<number>(24).fill(0)
  let plays = 0
  let totalSeconds = 0

  for (const { track, at } of log) {
    if (at < since) continue
    plays += 1
    totalSeconds += parseDuration(track.duration) ?? FALLBACK_DURATION_S
    const key = recentKey(track)
    const hit = tracks.get(key)
    if (hit) hit.count += 1
    else tracks.set(key, { track, count: 1 })
    for (const name of splitArtists(track.artists)) artists.set(name, (artists.get(name) ?? 0) + 1)
    const d = new Date(at)
    perWeekday[(d.getDay() + 6) % 7] += 1
    perHour[d.getHours()] += 1
    const dk = dayKey(at)
    days.set(dk, (days.get(dk) ?? 0) + 1)
  }

  let busiestDay: Recap['busiestDay'] = null
  for (const [date, count] of days) if (!busiestDay || count > busiestDay.plays) busiestDay = { date, plays: count }

  return {
    plays,
    uniqueTracks: tracks.size,
    uniqueArtists: artists.size,
    totalSeconds,
    topTracks: [...tracks.values()].sort((a, b) => b.count - a.count).slice(0, top),
    topArtists: [...artists.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, top),
    perWeekday,
    busiestWeekday: argMax(perWeekday),
    busiestHour: argMax(perHour),
    busiestDay,
    activeDays: days.size,
  }
}

/** 12600 → "3 jam 30 menit"; di bawah satu jam → "45 menit". */
export function formatListening(seconds: number): string {
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} menit`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h} jam` : `${h} jam ${m} menit`
}

export interface Streaks {
  /** Hari berturut-turut mendengar sampai hari ini (atau kemarin: hari ini masih boleh menyusul). 0 bila sudah terputus. */
  current: number
  /** Rangkaian hari berturut-turut terpanjang di seluruh log. */
  longest: number
}

/** Nomor hari kalender lokal (bukan 24 jam penuh), supaya pergantian jam musim panas tidak memutus rangkaian. */
function dayNumber(at: number): number {
  const d = new Date(at)
  return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000)
}

/** Streak mendengar harian dari SELURUH log (tidak terpengaruh pilihan periode). Log hanya menyimpan putaran terbaru. */
export function computeStreaks(log: readonly PlayLogEntry[], now: number = Date.now()): Streaks {
  const days = [...new Set(log.map((entry) => dayNumber(entry.at)))].sort((a, b) => a - b)
  if (days.length === 0) return { current: 0, longest: 0 }
  let longest = 1
  let run = 1
  for (let i = 1; i < days.length; i += 1) {
    run = days[i] === days[i - 1] + 1 ? run + 1 : 1
    if (run > longest) longest = run
  }
  const today = dayNumber(now)
  const last = days[days.length - 1]
  if (last < today - 1) return { current: 0, longest } // sudah lewat kemarin: rangkaian putus
  let current = 1
  for (let i = days.length - 1; i > 0 && days[i] === days[i - 1] + 1; i -= 1) current += 1
  return { current, longest }
}
