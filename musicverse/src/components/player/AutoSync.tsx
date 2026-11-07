import { useEffect, useMemo, useRef } from 'react'
import { useMyPlaylists } from '../../context/MyPlaylistsContext'
import { useAudioPlayer } from '../../hooks/useAudioPlayer'
import { MusicVerseNative } from '../../native/musicVerseNative'
import { toPlaylistTrack, useOffline, type DownloadedTrack } from '../../native/offline'
import { isNativeApp } from '../../native/platform'
import { fetchArtistSongs, searchArtists } from '../../services/artistApi'
import type { MyPlaylist } from '../../types/library'
import type { PlaylistTrack } from '../../types/spotify'
import { recentKey } from '../../utils/libraryStorage'
import { isLikedId } from '../../utils/myPlaylistStorage'
import { PLAY_LOG_EVENT, readPlayLog } from '../../utils/playLog'
import { normalizeSearchText } from '../../utils/trackSearch'

/** Paling banyak lagu per daftar di layar mobil (Android Auto membatasi daftar panjang untuk keselamatan berkendara). */
const MAX_ITEMS = 40
/** Jeda sebelum daftar diterbitkan ulang, supaya pergantian lagu beruntun tidak menulis berulang. */
const PUBLISH_DELAY_MS = 1500
/** Batas pustaka yang ditulis ke native (Lagu Disukai / Unduhan / tiap playlist, dan jumlah playlist). */
const MAX_LIBRARY_TRACKS = 100
const MAX_LIBRARY_PLAYLISTS = 30

/** Pustaka yang bisa ditelusuri dari mobil selain Riwayat dan Antrean. */
interface LibrarySource {
  playlists: readonly MyPlaylist[]
  /** Unduhan, terbaru dulu (urutan yang sama dengan daftar di mobil). */
  downloads: readonly PlaylistTrack[]
}

function downloadTracks(items: readonly DownloadedTrack[]): PlaylistTrack[] {
  return [...items].sort((a, b) => b.savedAt - a.savedAt).map(toPlaylistTrack)
}

function likedTracks(library: LibrarySource): readonly PlaylistTrack[] {
  return library.playlists.find((playlist) => isLikedId(playlist.id))?.tracks ?? []
}

const row = (prefix: string, track: PlaylistTrack) => ({ id: `${prefix}:${track.id}`, title: track.title, artist: track.artists })

/** Isi untuk `setAutoLibrary`: Lagu Disukai, Unduhan, dan playlist buatan (yang berisi lagu). */
function libraryPayload(library: LibrarySource) {
  return {
    liked: likedTracks(library).slice(0, MAX_LIBRARY_TRACKS).map((track) => row('liked', track)),
    downloads: library.downloads.slice(0, MAX_LIBRARY_TRACKS).map((track) => row('dl', track)),
    playlists: library.playlists
      .filter((playlist) => !isLikedId(playlist.id) && playlist.tracks.length > 0)
      .slice(0, MAX_LIBRARY_PLAYLISTS)
      .map((playlist) => ({
        id: playlist.id,
        name: playlist.name,
        tracks: playlist.tracks.slice(0, MAX_LIBRARY_TRACKS).map((track) => row(`pl:${playlist.id}`, track)),
      })),
  }
}

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
function tracksFromMediaId(mediaId: string, queue: readonly PlaylistTrack[], library: LibrarySource): PlaylistTrack[] {
  const [kind, ...rest] = mediaId.split(':')
  /** Lagu yang diketuk dan semua sesudahnya di daftar yang sama (id dipercaya, bukan posisi: daftar bisa berubah). */
  const fromHere = (list: readonly PlaylistTrack[], id: string): PlaylistTrack[] => {
    const at = list.findIndex((track) => track.id === id)
    return at >= 0 ? list.slice(at) : []
  }
  if (kind === 'liked') return fromHere(likedTracks(library), rest.join(':'))
  if (kind === 'dl') return fromHere(library.downloads, rest.join(':'))
  if (kind === 'pl') {
    const playlist = library.playlists.find((item) => item.id === rest[0])
    return playlist ? fromHere(playlist.tracks, rest.slice(1).join(':')) : []
  }
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
 * Selain itu: lagu/artis yang cocok di Riwayat, Lagu Disukai, Unduhan, atau playlist buatan; bila tidak ada, artis dengan nama itu
 * (APK, lewat Deezer) dan lagu-lagunya. Judul lagu yang belum ada di salah satunya dan bukan nama artis tidak ditemukan.
 */
async function tracksFromQuery(query: string, queue: readonly PlaylistTrack[], library: LibrarySource): Promise<PlaylistTrack[]> {
  const recent = recentTracks()
  const wanted = normalizeSearchText(query)
  if (!wanted) return recent.length > 0 ? recent : [...queue]
  const words = wanted.split(' ').filter(Boolean)
  // Riwayat dulu, lalu Lagu Disukai, Unduhan, dan playlist buatan; lagu yang sama tidak dihitung dua kali.
  const seen = new Set<string>()
  const candidates: PlaylistTrack[] = []
  for (const track of [...recent, ...likedTracks(library), ...library.downloads, ...library.playlists.flatMap((playlist) => playlist.tracks)]) {
    const key = recentKey(track)
    if (seen.has(key)) continue
    seen.add(key)
    candidates.push(track)
  }
  const matches = candidates.filter((track) => {
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
 *  1. Menerbitkan daftar telusur ke native, supaya mobil bisa menelusurinya: "Baru diputar" (Riwayat) dan "Antrean", serta
 *     "Lagu Disukai", "Playlist saya", dan "Unduhan" (pustaka; ditulis terpisah karena lebih besar dan jarang berubah).
 *  2. Menangani permintaan putar dari mobil / Asisten: ketuk lagu di daftar, atau perintah suara. Native tidak bisa
 *     mencari sumber audio sendiri, jadi permintaan diserahkan ke sini (`consumeAutoRequest`, juga saat aplikasi baru
 *     dibuka karena permintaan itu).
 */
export default function AutoSync() {
  const player = useAudioPlayer()
  const { queue, currentIndex, currentTrack, playAll, status, togglePlayPause } = player
  const queueRef = useRef(queue)
  queueRef.current = queue
  const { playlists } = useMyPlaylists()
  const { items: downloadItems } = useOffline()
  const downloads = useMemo(() => downloadTracks(downloadItems), [downloadItems])
  const libraryRef = useRef<LibrarySource>({ playlists, downloads })
  libraryRef.current = { playlists, downloads }
  const playAllRef = useRef(playAll)
  playAllRef.current = playAll
  const resumeRef = useRef({ status, hasTrack: currentTrack !== null, togglePlayPause })
  resumeRef.current = { status, hasTrack: currentTrack !== null, togglePlayPause }

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

  // 1b) Terbitkan pustaka (Lagu Disukai, Playlist saya, Unduhan). Hanya ditulis bila isinya berubah.
  const lastLibraryRef = useRef('')
  useEffect(() => {
    if (!isNativeApp()) return undefined
    const timer = window.setTimeout(() => {
      const json = JSON.stringify(libraryPayload({ playlists, downloads }))
      if (json === lastLibraryRef.current) return
      lastLibraryRef.current = json
      MusicVerseNative.setAutoLibrary({ json }).catch(() => undefined) // APK lama: tidak ada
    }, PUBLISH_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [playlists, downloads])

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
        if (request.kind === 'resume') {
          // Tombol Putar di widget (aplikasi tadinya tertutup): lanjutkan lagu terakhir. togglePlayPause sudah menangani
          // sesi pulihan dan jeda lama (mengambil tautan audio baru, lanjut dari posisi terakhir).
          const { status: current, hasTrack, togglePlayPause: toggle } = resumeRef.current
          if (hasTrack && (current === 'paused' || current === 'ended' || current === 'error')) {
            toggle()
            // Aplikasi hanya dibuka demi memutar: kembali ke layar sebelumnya, pemutaran lanjut lewat service.
            window.setTimeout(() => {
              MusicVerseNative.sendToBackground().catch(() => undefined)
            }, 600)
          }
          return
        }
        const payload = request.payload ?? ''
        const tracks =
          request.kind === 'media'
            ? tracksFromMediaId(payload, queueRef.current, libraryRef.current)
            : await tracksFromQuery(payload, queueRef.current, libraryRef.current)
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
