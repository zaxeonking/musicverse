import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { findDownloaded } from '../native/offline'
import { getManualPin, pinKey } from '../plugins/manualPins'
import { resolveViaPluginsDetailed } from '../plugins/registry'
import type { PlaylistTrack } from '../types/spotify'
import { parseDuration } from '../utils/formatTime'
import { isLocalTrackUrl } from '../utils/localTrack'
import { useOnlineStatus } from './useOnlineStatus'

/** ok = ada sumber audio; missing = tidak ditemukan; unknown = belum bisa dicek (sinyal/server), akan dicoba lagi. */
export type TrackAvailability = 'ok' | 'missing' | 'unknown'

// v2: hasil v1 hanya dari pencarian (tanpa membaca audio) sehingga bisa memuat lagu yang sebenarnya tidak bisa diputar.
const CACHE_KEY = 'mv:availability:v2'
/** Lagu yang sudah dinyatakan ada tidak dicek ulang selama ini (hanya hasil "ada" yang disimpan). */
const OK_TTL_MS = 12 * 60 * 60_000
const MAX_CACHED = 2000
/** Pengecekan berjalan pelan di latar belakang supaya tidak mengganggu pemutaran. */
const CONCURRENCY = 2
const GAP_MS = 250

function readCache(): Record<string, number> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}')
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}
    const out: Record<string, number> = {}
    const now = Date.now()
    for (const [key, at] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof at === 'number' && now - at < OK_TTL_MS) out[key] = at
    }
    return out
  } catch {
    return {}
  }
}

function writeCache(map: Record<string, number>): void {
  try {
    const keys = Object.keys(map)
    if (keys.length > MAX_CACHED) {
      keys.sort((a, b) => map[a] - map[b])
      for (const key of keys.slice(0, keys.length - MAX_CACHED)) delete map[key]
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(map))
  } catch {
    /* abaikan: cache hanya mempercepat */
  }
}

async function checkOne(track: PlaylistTrack, signal: AbortSignal): Promise<TrackAvailability | 'aborted'> {
  // Sudah terunduh (APK) atau sudah dipilih manual: pasti bisa diputar, tanpa jaringan.
  if (isLocalTrackUrl(track.url) || findDownloaded(track) || getManualPin(track)) return 'ok'
  const { outcome } = await resolveViaPluginsDetailed(
    { title: track.title, artists: track.artists ?? '', duration: track.duration ?? '', url: track.url },
    { signal, expected: parseDuration(track.duration ?? ''), searchOnly: true },
  )
  if (outcome === 'aborted') return 'aborted'
  if (outcome === 'ok') return 'ok'
  // Tidak ketemu, audio ditolak, stream tidak terbaca, atau melewati batas 6 detik: semuanya "tidak ditemukan" supaya
  // lagunya bisa dicari manual / dicek ulang, bukan dibiarkan terlihat siap diputar.
  return 'missing'
}

/** Daftar kosong yang stabil (identitasnya tetap) untuk dipakai saat belum ada playlist. */
export const NO_TRACKS: readonly PlaylistTrack[] = []

export interface TrackAvailabilityState {
  results: Readonly<Record<string, TrackAvailability>>
  done: number
  total: number
  running: boolean
  /** True bila pengecekan tertunda karena perangkat offline. */
  offline: boolean
  missing: PlaylistTrack[]
  unknownCount: number
  /** Cek ulang semua lagu (mengabaikan hasil "ada" yang tersimpan). */
  rerun: () => void
  /** Cek ulang satu lagu, mis. setelah pengguna memilih sumbernya secara manual. */
  recheckOne: (track: PlaylistTrack) => void
}

/**
 * Memeriksa ketersediaan audio semua lagu di sebuah playlist: mencari tiap lagu di YouTube Music / YouTube dengan aturan
 * pencocokan yang sama seperti saat diputar, tanpa mengambil stream. Hasilnya perkiraan: audio yang ditemukan tetap diperiksa
 * lagi (durasi file, bukan cuplikan) saat benar-benar diputar atau diunduh.
 */
export function useTrackAvailability(tracks: readonly PlaylistTrack[], enabled: boolean): TrackAvailabilityState {
  const online = useOnlineStatus()
  const [results, setResults] = useState<Record<string, TrackAvailability>>({})
  const [running, setRunning] = useState(false)
  const [run, setRun] = useState(0)
  const forceRef = useRef(false)

  useEffect(() => {
    setResults({})
    if (!enabled || tracks.length === 0 || !online) {
      setRunning(false)
      return
    }
    const controller = new AbortController()
    const force = forceRef.current
    forceRef.current = false
    const cache = force ? {} : readCache()
    const queue: PlaylistTrack[] = []
    const initial: Record<string, TrackAvailability> = {}
    for (const track of tracks) {
      if (cache[pinKey(track)] !== undefined) initial[track.id] = 'ok'
      else queue.push(track)
    }
    setResults(initial)
    if (queue.length === 0) {
      setRunning(false)
      return
    }
    setRunning(true)
    let next = 0
    const worker = async (): Promise<void> => {
      while (!controller.signal.aborted) {
        const index = next
        next += 1
        if (index >= queue.length) return
        const track = queue[index]
        let result: TrackAvailability | 'aborted'
        try {
          result = await checkOne(track, controller.signal)
        } catch {
          result = 'unknown'
        }
        if (result === 'aborted' || controller.signal.aborted) return
        if (result === 'ok') {
          const latest = readCache()
          latest[pinKey(track)] = Date.now()
          writeCache(latest)
        }
        setResults((prev) => ({ ...prev, [track.id]: result }))
        await new Promise((resolve) => setTimeout(resolve, GAP_MS))
      }
    }
    void Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, () => worker())).then(() => {
      if (!controller.signal.aborted) setRunning(false)
    })
    return () => controller.abort()
  }, [tracks, enabled, online, run])

  const rerun = useCallback(() => {
    forceRef.current = true
    setRun((n) => n + 1)
  }, [])

  const recheckOne = useCallback((track: PlaylistTrack) => {
    // Setelah pilihan manual disimpan, lagunya dianggap ada (pilihan itu dipakai lebih dulu saat diputar).
    if (getManualPin(track)) {
      setResults((prev) => ({ ...prev, [track.id]: 'ok' }))
      return
    }
  }, [])

  return useMemo(() => {
    const values = Object.values(results)
    return {
      results,
      done: values.length,
      total: tracks.length,
      running,
      offline: enabled && tracks.length > 0 && !online,
      missing: tracks.filter((t) => results[t.id] === 'missing'),
      unknownCount: values.filter((v) => v === 'unknown').length,
      rerun,
      recheckOne,
    }
  }, [results, tracks, running, enabled, online, rerun, recheckOne])
}
