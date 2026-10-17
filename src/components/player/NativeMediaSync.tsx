import { useEffect, useRef, useState } from 'react'
import { usePlaybackTime, usePlayerActions, useAudioPlayer } from '../../hooks/useAudioPlayer'
import { MusicVerseNative, type NativeMediaActionEvent } from '../../native/musicVerseNative'
import { composeNotificationCover } from '../../utils/notificationCover'
import { fallbackCover } from '../../utils/fallbackCover'
import { stripArtistPrefix } from '../../utils/trackTitle'

/** Selisih (detik) antara posisi yang diperkirakan notifikasi dan posisi sebenarnya sebelum dilaporkan ulang. */
const DRIFT_S = 1.5
/** Laporkan ulang posisi paling lambat setiap sekian milidetik. */
const REFRESH_MS = 8000
/** Loncat maju/mundur dari notifikasi tidak dipakai; seek lewat bilah posisi. */

async function blobUrlToBase64(url: string): Promise<string | null> {
  try {
    const blob = await (await fetch(url)).blob()
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => {
        const text = typeof reader.result === 'string' ? reader.result : ''
        resolve(text.includes(',') ? text.slice(text.indexOf(',') + 1) : null)
      }
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

/**
 * Versi APK dari MediaSessionSync: notifikasi media dibuat oleh foreground service native
 * (ikon, sampul bawaan, dan tombol berada di dalam APK), bukan oleh Media Session browser.
 * Layanan ini juga yang menjaga proses tetap hidup saat layar mati / aplikasi di latar belakang.
 * Tidak merender apa pun.
 */
export default function NativeMediaSync() {
  const { status, currentTrack, playbackInfo, hasNext, hasPrevious } = useAudioPlayer()
  const actions = usePlayerActions()
  const { currentTime, duration } = usePlaybackTime()

  const latest = useRef({ status, actions, currentTime })
  useEffect(() => {
    latest.current = { status, actions, currentTime }
  })

  const trackId = currentTrack?.id ?? null
  const artists = currentTrack?.artists ?? ''
  const title = stripArtistPrefix(currentTrack?.title ?? '', artists)
  const album = currentTrack?.album ?? ''
  // Lagu yang diputar dari unduhan memakai sampul lokal (tetap tampil tanpa internet).
  const coverUrl = (playbackInfo?.source === 'offline' ? playbackInfo.cover : currentTrack?.cover) || undefined
  const playing = status === 'playing' || status === 'buffering' || status === 'loading' || status === 'resolving'

  // Tombol notifikasi / layar kunci / headset -> pemutar.
  useEffect(() => {
    let removed = false
    let handle: { remove: () => Promise<void> } | null = null
    void MusicVerseNative.addListener('mediaAction', (event: NativeMediaActionEvent) => {
      const { status: s, actions: a } = latest.current
      switch (event.action) {
        case 'play':
          if (s === 'paused' || s === 'ended' || s === 'error') a.togglePlayPause()
          break
        case 'pause':
        case 'stop':
          a.pause()
          break
        case 'next':
          a.playNext()
          break
        case 'previous':
          a.playPrevious()
          break
        case 'seek':
          if (event.seekMs !== undefined) a.seekTo(event.seekMs / 1000)
          break
      }
    }).then((h) => {
      if (removed) void h.remove()
      else handle = h
    })
    return () => {
      removed = true
      void handle?.remove()
    }
  }, [])

  // Sampul: dibuat sekali per lagu (sampul lagu + badge logo) lalu dikirim ke native sebagai base64.
  const [cover, setCover] = useState<{ trackId: string; base64: string } | null>(null)
  useEffect(() => {
    if (trackId === null) {
      setCover(null)
      return
    }
    let cancelled = false
    composeNotificationCover(coverUrl, fallbackCover(`${title}${album}`))
      .then(async (url) => {
        if (!url) return
        const base64 = await blobUrlToBase64(url)
        URL.revokeObjectURL(url)
        if (!cancelled && base64) setCover({ trackId, base64 })
      })
      .catch(() => {
        // Tetap memakai sampul bawaan APK.
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackId, coverUrl])

  const sentTrack = useRef<string | null>(null)
  const sentCover = useRef<string | null>(null)
  const reported = useRef<{ position: number; at: number; playing: boolean; duration: number } | null>(null)
  const lastMeta = useRef('')

  useEffect(() => {
    if (trackId === null) {
      if (sentTrack.current !== null) {
        sentTrack.current = null
        sentCover.current = null
        reported.current = null
        lastMeta.current = ''
        void MusicVerseNative.stopPlayback().catch(() => {})
      }
      return
    }

    const durationS = duration !== null && Number.isFinite(duration) && duration > 0 ? duration : 0
    const newTrack = sentTrack.current !== trackId
    const coverReady = cover !== null && cover.trackId === trackId ? cover.base64 : null
    const coverToSend = coverReady !== null && sentCover.current !== trackId ? coverReady : null

    const now = performance.now()
    const last = reported.current
    const expected = last ? last.position + (last.playing ? (now - last.at) / 1000 : 0) : null
    const meta = `${trackId}|${title}|${artists}|${album}|${hasNext}|${hasPrevious}`
    const stale =
      newTrack ||
      coverToSend !== null ||
      meta !== lastMeta.current ||
      last === null ||
      last.playing !== playing ||
      last.duration !== durationS ||
      now - last.at > REFRESH_MS ||
      expected === null ||
      Math.abs(expected - currentTime) > DRIFT_S
    if (!stale) return

    sentTrack.current = trackId
    if (coverToSend !== null) sentCover.current = trackId
    reported.current = { position: currentTime, at: now, playing, duration: durationS }
    lastMeta.current = meta
    void MusicVerseNative.updateNowPlaying({
      title,
      artist: artists,
      album,
      durationMs: Math.round(durationS * 1000),
      positionMs: Math.round(Math.max(0, currentTime) * 1000),
      playing,
      hasNext,
      hasPrevious,
      resetCover: newTrack,
      coverBase64: coverToSend ?? undefined,
    }).catch((error: unknown) => {
      console.warn('[MusicVerse] Notifikasi native gagal diperbarui:', error)
    })
  }, [trackId, title, artists, album, playing, hasNext, hasPrevious, currentTime, duration, cover])

  return null
}
