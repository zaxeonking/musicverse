import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { fetchLyrics, LyricsError, type LyricsResult } from '../services/lyricsApi'
import { readOfflineLyrics, saveOfflineLyrics } from '../native/offlineLyrics'
import { readCachedLyrics, saveCachedLyrics } from '../native/lyricsCache'
import { onProviderPrefsChange } from '../utils/lyricProviderPrefs'
import { getLyricSourcePin, lyricPinKey, subscribeLyricSourcePins } from '../utils/lyricSourcePins'
import type { PlaylistTrack } from '../types/spotify'
import { parseDuration } from '../utils/formatTime'

export type LyricsState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; result: LyricsResult }
  | { status: 'error'; message: string }

const CACHE_LIMIT = 40
/** Lirik yang sudah dicari (termasuk "tidak ditemukan") dipakai ulang selama sesi, tanpa memanggil server lagi. */
const cache = new Map<string, LyricsResult>()

const prefetching = new Set<string>()

// Pengaturan provider berubah -> hasil sesi lama (mis. tanpa kata) tidak boleh dipakai lagi.
onProviderPrefsChange(() => cache.clear())

/**
 * Cari lirik lebih awal (lagu yang baru mulai diputar dan lagu berikutnya) tanpa menunggu panel lirik dibuka,
 * supaya lirik sudah siap begitu lagu mulai. Hasil masuk ke cache yang sama dengan useLyrics.
 */
export function prefetchLyrics(track: PlaylistTrack): void {
  const key = cacheKey(track)
  if (cache.has(key) || prefetching.has(key)) return
  prefetching.add(key)
  void (async () => {
    try {
      const stored = await readOfflineLyrics(track)
      const persisted = stored ?? (await readCachedLyrics(key))
      const result = persisted ?? (await fetchLyrics(track, { signal: new AbortController().signal }))
      if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value as string)
      cache.set(key, result)
      if (!stored) void saveOfflineLyrics(track, result)
      if (!persisted) void saveCachedLyrics(key, result)
    } catch {
      // Gagal diam-diam: useLyrics akan mencoba lagi dan menampilkan pesan bila perlu.
    } finally {
      prefetching.delete(key)
    }
  })()
}

/** Sumber yang dipilih pengguna ikut jadi kunci, supaya lirik dari sumber berbeda tidak saling menimpa di cache. */
function cacheKey(track: PlaylistTrack): string {
  const pin = getLyricSourcePin(track)
  return `${track.title}|${track.artists}|${track.album}|${Math.round(parseDuration(track.duration) ?? 0)}${pin ? `|src:${pin}` : ''}`.toLowerCase()
}

/** Lagu yang liriknya baru diganti sumbernya: salinan lirik unduhan di perangkat dilewati SEKALI supaya diganti yang baru. */
const bypassStored = new Set<string>()

/** Dipanggil menu Sumber lirik sebelum mengganti sumber. */
export function markLyricsSourceChange(track: PlaylistTrack): void {
  bypassStored.add(lyricPinKey(track))
}

/** Mengambil lirik untuk `track` selama `enabled`. Mengganti lagu membatalkan permintaan lama. */
export function useLyrics(track: PlaylistTrack | null, enabled: boolean): { state: LyricsState; retry: () => void } {
  const [state, setState] = useState<LyricsState>({ status: 'idle' })
  const [attempt, setAttempt] = useState(0)
  const trackRef = useRef(track)
  trackRef.current = track
  // Ganti sumber lirik (menu Sumber lirik) = kunci berubah = cari ulang.
  useSyncExternalStore(subscribeLyricSourcePins, () => (track ? (getLyricSourcePin(track) ?? '') : ''))
  const key = track ? cacheKey(track) : null

  useEffect(() => {
    const current = trackRef.current
    if (!enabled || !current || !key) {
      setState({ status: 'idle' })
      return
    }
    const cached = cache.get(key)
    if (cached) {
      setState({ status: 'ready', result: cached })
      return
    }
    const controller = new AbortController()
    setState({ status: 'loading' })
    const remember = (result: LyricsResult) => {
      if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value as string)
      cache.set(key, result)
      setState({ status: 'ready', result })
    }
    void (async () => {
      // Lagu unduhan: pakai lirik yang tersimpan di perangkat dulu (cepat, dan jalan tanpa internet), kecuali sumbernya baru diganti.
      const skipStored = bypassStored.delete(lyricPinKey(current))
      const stored = skipStored ? null : await readOfflineLyrics(current)
      if (controller.signal.aborted) return
      if (stored) {
        remember(stored)
        return
      }
      const persisted = await readCachedLyrics(key)
      if (controller.signal.aborted) return
      if (persisted) {
        remember(persisted)
        return
      }
      try {
        const result = await fetchLyrics(current, { signal: controller.signal })
        if (controller.signal.aborted) return
        remember(result)
        void saveCachedLyrics(key, result)
        // Lagu unduhan yang liriknya belum tersimpan: simpan sekarang agar lain kali tersedia offline.
        void saveOfflineLyrics(current, result)
      } catch (error: unknown) {
        if (controller.signal.aborted) return
        const offline = typeof navigator !== 'undefined' && !navigator.onLine
        setState({
          status: 'error',
          message: offline
            ? "You're offline. Lirik hanya tersedia untuk lagu unduhan yang liriknya sudah tersimpan."
            : error instanceof LyricsError
              ? error.message
              : 'Lirik gagal dimuat karena kesalahan yang tidak diketahui.',
        })
      }
    })()
    return () => controller.abort()
  }, [enabled, key, attempt])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])
  return { state, retry }
}
