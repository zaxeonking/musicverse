import { useEffect, useRef, useState } from 'react'
import { usePlaybackTime, usePlayerActions, useAudioPlayer } from '../../hooks/useAudioPlayer'
import { MusicVerseNative, type NativeMediaActionEvent, type NowPlayingUpdate } from '../../native/musicVerseNative'
import { audioEngine } from '../../services/audioEngine'
import { composeNotificationCover } from '../../utils/notificationCover'
import { fallbackCover } from '../../utils/fallbackCover'
import { parseDurationText } from '../../hooks/useAudioPlayerController'
import { parseDuration } from '../../utils/formatTime'
import { useMyPlaylists } from '../../context/MyPlaylistsContext'

/** Selisih (detik) antara posisi yang diperkirakan notifikasi dan posisi sebenarnya sebelum dilaporkan ulang. */
const DRIFT_S = 1.5
/** Laporkan ulang posisi paling lambat setiap sekian milidetik. */
const REFRESH_MS = 8000
/** Detak: selama memutar, posisi sebenarnya dari elemen audio dikirim ke notifikasi tiap sekian milidetik. */
const HEARTBEAT_MS = 2000

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
  const { isLiked, toggleLike } = useMyPlaylists()

  const latest = useRef({ status, actions, currentTime, currentTrack, toggleLike })
  useEffect(() => {
    latest.current = { status, actions, currentTime, currentTrack, toggleLike }
  })

  // Hati di widget layar utama mengikuti status suka lagu aktif (dan koreksi bila ketukan di widget gagal).
  const liked = currentTrack ? isLiked(currentTrack) : false
  const likedTitle = currentTrack?.title ?? ''
  useEffect(() => {
    if (!likedTitle) return
    void MusicVerseNative.setWidgetLiked({ title: likedTitle, liked }).catch(() => {})
  }, [liked, likedTitle])

  const trackId = currentTrack?.id ?? null
  const artists = currentTrack?.artists ?? ''
  const title = currentTrack?.title ?? ''
  const album = currentTrack?.album ?? ''
  // Lagu yang diputar dari unduhan memakai sampul lokal (tetap tampil tanpa internet).
  const coverUrl = (playbackInfo?.source === 'offline' || playbackInfo?.source === 'local' ? playbackInfo.cover : currentTrack?.cover) || undefined
  const playing = status === 'playing' || status === 'buffering' || status === 'loading' || status === 'resolving'
  // Jeda antar lagu (mencari/memuat audio) atau buffering: notifikasi menampilkan indikator memuat, bukan sekadar gambar diam.
  const loading = status === 'buffering' || status === 'loading' || status === 'resolving'

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
        case 'like': {
          // Tombol hati di widget: sukai / batal sukai lagu aktif (sama dengan tombol hati di pemutar penuh).
          const { currentTrack: track, toggleLike: toggle } = latest.current
          if (track) toggle(track)
          break
        }
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
  // Sampul yang sudah disusun disimpan per lagu (12 terakhir): kembali ke lagu sebelumnya (tombol Sebelumnya) langsung
  // membawa sampulnya bersama pembaruan judul, tanpa menunggu menyusun ulang.
  const coverCache = useRef(new Map<string, string>())
  useEffect(() => {
    if (trackId === null) {
      setCover(null)
      return
    }
    const cached = coverCache.current.get(trackId)
    if (cached) {
      setCover({ trackId, base64: cached })
      return
    }
    let cancelled = false
    // Tanpa badge logo: di APK ikon aplikasi sudah ditampilkan sistem di sisi kiri sampul.
    composeNotificationCover(coverUrl, fallbackCover(`${title}${album}`), false)
      .then(async (url) => {
        if (!url) return
        const base64 = await blobUrlToBase64(url)
        URL.revokeObjectURL(url)
        if (!cancelled && base64) {
          const cache = coverCache.current
          cache.set(trackId, base64)
          while (cache.size > 12) cache.delete(cache.keys().next().value as string)
          setCover({ trackId, base64 })
        }
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
  const reported = useRef<{ position: number; at: number; playing: boolean; loading: boolean; duration: number } | null>(null)
  const lastMeta = useRef('')
  /** Keadaan terakhir yang dikirim ke native (tanpa sampul); dasar untuk detak posisi. */
  const lastPayload = useRef<NowPlayingUpdate | null>(null)
  /** Durasi terakhir yang pernah diketahui untuk lagu aktif: tidak boleh kembali ke 0 (bilah notifikasi jadi rata). */
  const knownDuration = useRef<{ trackId: string; seconds: number } | null>(null)

  useEffect(() => {
    if (trackId === null) {
      if (sentTrack.current !== null) {
        sentTrack.current = null
        sentCover.current = null
        reported.current = null
        lastMeta.current = ''
        lastPayload.current = null
        knownDuration.current = null
        void MusicVerseNative.stopPlayback().catch(() => {})
      }
      return
    }

    // Durasi audio kadang belum diketahui (metadata belum dimuat / stream): pakai durasi dari data lagu supaya
    // bilah progres notifikasi tidak macet di 0.
    const positive = (value: number | null | undefined): number | null =>
      value !== null && value !== undefined && Number.isFinite(value) && value > 0 ? value : null
    // Urutan sumber: durasi audio sebenarnya -> durasi sumber yang sudah dibaca -> teks durasi sumber -> teks durasi playlist
    // -> durasi terakhir yang pernah diketahui untuk lagu ini. Stream tanpa Content-Length melaporkan durasi tak terhingga.
    const kept = knownDuration.current?.trackId === trackId ? knownDuration.current.seconds : null
    const durationS =
      positive(duration) ??
      positive(audioEngine.getLiveDuration()) ??
      positive(playbackInfo?.probedDuration) ??
      positive(parseDuration(playbackInfo?.duration)) ??
      positive(currentTrack ? (parseDurationText(currentTrack.duration) ?? parseDuration(currentTrack.duration)) : null) ??
      kept ??
      0
    if (durationS > 0) knownDuration.current = { trackId, seconds: durationS }
    const newTrack = sentTrack.current !== trackId
    const coverReady = cover !== null && cover.trackId === trackId ? cover.base64 : (coverCache.current.get(trackId) ?? null)
    const coverToSend = coverReady !== null && sentCover.current !== trackId ? coverReady : null

    const now = performance.now()
    const last = reported.current
    const expected = last ? last.position + (last.playing ? (now - last.at) / 1000 : 0) : null
    const interrupted = !playing && audioEngine.isInterrupted()
    const meta = `${trackId}|${title}|${artists}|${album}|${hasNext}|${hasPrevious}|${interrupted}`
    const stale =
      newTrack ||
      coverToSend !== null ||
      meta !== lastMeta.current ||
      last === null ||
      last.playing !== playing ||
      last.loading !== loading ||
      last.duration !== durationS ||
      now - last.at > REFRESH_MS ||
      expected === null ||
      Math.abs(expected - currentTime) > DRIFT_S
    if (!stale) return

    sentTrack.current = trackId
    if (coverToSend !== null) sentCover.current = trackId
    reported.current = { position: currentTime, at: now, playing, loading, duration: durationS }
    lastMeta.current = meta
    const payload: NowPlayingUpdate = {
      title,
      artist: artists,
      album,
      durationMs: Math.round(durationS * 1000),
      positionMs: Math.round(Math.max(0, currentTime) * 1000),
      playing,
      loading,
      hasNext,
      hasPrevious,
      interrupted,
      resetCover: newTrack,
      coverBase64: coverToSend ?? undefined,
    }
    lastPayload.current = { ...payload, resetCover: false, coverBase64: undefined }
    void MusicVerseNative.updateNowPlaying(payload).catch((error: unknown) => {
      console.warn('[MusicVerse] Notifikasi native gagal diperbarui:', error)
    })
  }, [trackId, title, artists, album, playing, loading, hasNext, hasPrevious, currentTime, duration, cover, currentTrack])

  // Detak posisi: tidak bergantung pada render React / event `timeupdate` (yang bisa jarang atau berhenti saat layar mati
  // atau saat memutar berkas lokal). Posisi dan durasi dibaca langsung dari elemen audio, sehingga bilah progres
  // notifikasi dan layar kunci selalu berpatokan pada posisi yang benar, bukan stuck di 0.
  useEffect(() => {
    if (trackId === null || status !== 'playing') return
    const timer = window.setInterval(() => {
      const base = lastPayload.current
      const live = audioEngine.getLiveTime()
      if (!base || live === null) return
      const liveDuration = audioEngine.getLiveDuration()
      const next: NowPlayingUpdate = {
        ...base,
        playing: true,
        loading: false,
        positionMs: Math.round(Math.max(0, live) * 1000),
        durationMs: liveDuration !== null ? Math.round(liveDuration * 1000) : base.durationMs,
      }
      lastPayload.current = next
      void MusicVerseNative.updateNowPlaying(next).catch(() => {})
    }, HEARTBEAT_MS)
    return () => window.clearInterval(timer)
  }, [trackId, status])

  return null
}
