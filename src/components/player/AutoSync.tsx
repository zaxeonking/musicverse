import { useEffect, useRef } from 'react'
import { useAudioPlayer } from '../../hooks/useAudioPlayer'
import { MusicVerseNative } from '../../native/musicVerseNative'
import { isNativeApp } from '../../native/platform'
import { fetchArtistSongs, searchArtists } from '../../services/artistApi'
import type { PlaylistTrack } from '../../types/spotify'
import { recentKey } from '../../utils/libraryStorage'
import { PLAY_LOG_EVENT, readPlayLog } from '../../utils/playLog'
import { normalizeSearchText } from '../../utils/trackSearch'

/** Paling banyak lagu per daftar di layar mobil (Android Auto membatasi daftar panjang untuk keselamatan berkendara). */
const MAX_ITEMS = 40
/** Jeda sebelum daftar diterbitkan ulang, supaya pergantian lagu beruntun tidak menulis berulang. */
const PUBLISH_DELAY_MS = 1500

/** Lagu dari Riwayat, terbaru dulu, tanpa duplikat. */
function recentTracks(): PlaylistTrack[] {
  const seen = new Set<string>()
  const out: PlaylistTrack[] = []
  for (const { track } of readPlayLog()) {
    const key = recentKey(track)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(track)
    if (out.length >= MAX_ITEMS) break
  }
  return out
}

/** Id item telusur -> lagu yang diputar (item yang diketuk lalu lanjut ke lagu sesudahnya di daftar yang sama). */
function tracksFromMediaId(mediaId: string, queue: readonly PlaylistTrack[]): PlaylistTrack[] {
  const [kind, ...rest] = mediaId.split(':')
  if (kind === 'recent') {
    const id = rest.join(':')
    const list = recentTracks()
    const at = list.findIndex((track) => track.id === id)
    return at >= 0 ? list.slice(at) : []
  }
  if (kind === 'queue') {
    const index = Number(rest[0])
    const id = rest.slice(1).join(':')
    // Antrean bisa sudah berubah sejak daftar diterbitkan: percayai id, bukan indeks.
    const at = Number.isInteger(index) && queue[index]?.id === id ? index : queue.findIndex((track) => track.id === id)
    return at >= 0 ? queue.slice(at) : []
  }
  return []
}

/**
 * Pencarian suara. Kosong = "putar musik" (lanjut dari Riwayat, atau antrean bila Riwayat kosong).
 * Selain itu: lagu/artis yang cocok di Riwayat; bila tidak ada, artis dengan nama itu (APK, lewat Deezer) dan lagu-lagunya.
 * Judul lagu yang belum pernah diputar dan bukan nama artis tidak ditemukan.
 */
async function tracksFromQuery(query: string, queue: readonly PlaylistTrack[]): Promise<PlaylistTrack[]> {
  const recent = recentTracks()
  const wanted = normalizeSearchText(query)
  if (!wanted) return recent.length > 0 ? recent : [...queue]
  const words = wanted.split(' ').filter(Boolean)
  const matches = recent.filter((track) => {
    const hay = normalizeSearchText(`${track.title} ${track.artists}`)
    return words.every((word) => hay.includes(word))
  })
  if (matches.length > 0) return matches
  try {
    const hits = await searchArtists(query)
    const artist = hits.find((hit) => normalizeSearchText(hit.name) === wanted) ?? hits.find((hit) => normalizeSearchText(hit.name).includes(wanted))
    if (!artist) return []
    return (await fetchArtistSongs(artist)).slice(0, MAX_ITEMS)
  } catch {
    return [] // tanpa internet / sumber menolak
  }
}

/**
 * Android Auto (hanya APK):
 *  1. Menerbitkan daftar telusur "Baru diputar" (Riwayat) dan "Antrean" ke native, supaya mobil bisa menelusurinya.
 *  2. Menangani permintaan putar dari mobil / Asisten: ketuk lagu di daftar, atau perintah suara. Native tidak bisa
 *     mencari sumber audio sendiri, jadi permintaan diserahkan ke sini (`consumeAutoRequest`, juga saat aplikasi baru
 *     dibuka karena permintaan itu).
 */
export default function AutoSync() {
  const player = useAudioPlayer()
  const { queue, currentIndex, currentTrack, playAll } = player
  const queueRef = useRef(queue)
  queueRef.current = queue
  const playAllRef = useRef(playAll)
  playAllRef.current = playAll

  // 1) Terbitkan daftar telusur.
  useEffect(() => {
    if (!isNativeApp()) return undefined
    const publish = (): void => {
      const start = currentIndex ?? 0
      const upcoming = queue.slice(start, start + MAX_ITEMS)
      const payload = {
        recent: recentTracks().map((track) => ({ id: `recent:${track.id}`, title: track.title, artist: track.artists })),
        queue: upcoming.map((track, i) => ({ id: `queue:${start + i}:${track.id}`, title: track.title, artist: track.artists })),
      }
      MusicVerseNative.setAutoBrowse({ json: JSON.stringify(payload) }).catch(() => undefined) // APK lama: tidak ada
    }
    const timer = window.setTimeout(publish, PUBLISH_DELAY_MS)
    window.addEventListener(PLAY_LOG_EVENT, publish)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener(PLAY_LOG_EVENT, publish)
    }
  }, [queue, currentIndex, currentTrack])

  // 2) Permintaan dari mobil.
  useEffect(() => {
    if (!isNativeApp()) return undefined
    let alive = true
    let busy = false
    /** Permintaan baru datang selagi yang lama diproses (mis. menunggu pencarian artis): ulangi sesudahnya. */
    let again = false
    const run = async (): Promise<void> => {
      if (busy) {
        again = true
        return
      }
      busy = true
      try {
        const request = await MusicVerseNative.consumeAutoRequest()
        if (!alive || !request.kind) return
        const payload = request.payload ?? ''
        const tracks = request.kind === 'media' ? tracksFromMediaId(payload, queueRef.current) : await tracksFromQuery(payload, queueRef.current)
        if (alive && tracks.length > 0) playAllRef.current(tracks)
      } catch {
        // APK lama (tanpa metode) atau gagal: abaikan
      } finally {
        busy = false
        if (again && alive) {
          again = false
          void run()
        }
      }
    }
    void run() // permintaan yang menunggu sejak sebelum aplikasi siap (mis. dibuka dari Android Auto)
    const handle = MusicVerseNative.addListener('autoRequest', () => {
      void run()
    })
    return () => {
      alive = false
      handle.then((h) => h.remove()).catch(() => undefined)
    }
  }, [])

  return null
}
