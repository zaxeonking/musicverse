import { BarChart3, Disc3, Download, History, Library, Music2, Sparkles, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { MOODS } from '../../config/moods'
import { useTrackMenu } from '../../context/TrackMenuContext'
import { useAudioPlayer } from '../../hooks/useAudioPlayer'
import { isNativeApp } from '../../native/platform'
import type { GenreHit } from '../../services/artistApi'
import { getGenres, getMoodTracks } from '../../services/homeFeed'
import type { Cover } from '../../types'
import { fallbackCover } from '../../utils/fallbackCover'
import SectionHeader from '../ui/SectionHeader'
import BrowseTile from './BrowseTile'

interface LocalTile {
  title: string
  to: string
  icon: typeof Music2
  cover: Cover
}

/** Pintasan ke isi perangkat sendiri: bekerja tanpa jaringan. */
const LOCAL_TILES: readonly LocalTile[] = [
  { title: 'Semua lagu', to: '/search?view=all', icon: Music2, cover: { from: '#1f8f4e', to: '#0b3d20', shape: 'bars' } },
  { title: 'Artis & Album', to: '/browse', icon: UserRound, cover: { from: '#c2561d', to: '#5c2208', shape: 'rings' } },
  { title: 'Riwayat', to: '/history', icon: History, cover: { from: '#5a4bd6', to: '#1f1650', shape: 'dots' } },
  { title: 'Rekap dengar', to: '/history/recap', icon: BarChart3, cover: { from: '#d03a7e', to: '#4f0c37', shape: 'bars' } },
  { title: 'Playlist', to: '/library', icon: Library, cover: { from: '#2b7fb8', to: '#0d2c44', shape: 'sun' } },
]

function shuffled<T>(list: readonly T[]): T[] {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * Isi tab Cari saat kosong (gaya jelajah Spotify, versi MusicVerse): Kejutkan aku, pintasan isi perangkat,
 * suasana (kotak buatan sendiri, selalu tampil) dan genre (dari Deezer, hanya bila ada jaringan di APK).
 */
export default function SearchBrowse() {
  const player = useAudioPlayer()
  const { showToast } = useTrackMenu()
  const [genres, setGenres] = useState<GenreHit[]>([])
  const [surprising, setSurprising] = useState(false)

  useEffect(() => {
    let off = false
    void getGenres().then((found) => {
      if (!off && found) setGenres(found)
    })
    return () => {
      off = true
    }
  }, [])

  async function surprise() {
    if (surprising) return
    setSurprising(true)
    try {
      const mood = MOODS[Math.floor(Math.random() * MOODS.length)]
      const tracks = await getMoodTracks(mood.query)
      if (!tracks || tracks.length === 0) {
        showToast('Tidak bisa memuat lagu. Cek koneksi internetmu.')
        return
      }
      player.playList(shuffled(tracks), 0)
      showToast(`Memutar suasana “${mood.title}”`)
    } finally {
      setSurprising(false)
    }
  }

  const tiles = isNativeApp()
    ? [...LOCAL_TILES, { title: 'Unduhan', to: '/downloads', icon: Download, cover: { from: '#2e8c6e', to: '#0b3a2c', shape: 'dots' as const } }]
    : LOCAL_TILES

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3">
        <BrowseTile wide title="Kejutkan aku" icon={Sparkles} busy={surprising} onClick={() => void surprise()} cover={{ from: '#1ed760', to: '#0a5a2a', shape: 'rings' }} />
      </div>

      <section aria-label="Di perangkatmu">
        <SectionHeader title="Di perangkatmu" subtitle="Tanpa internet pun bisa" />
        <div className="grid grid-cols-2 gap-3">
          {tiles.map((tile) => (
            <BrowseTile key={tile.to} title={tile.title} to={tile.to} icon={tile.icon} cover={tile.cover} />
          ))}
        </div>
      </section>

      <section aria-label="Suasana">
        <SectionHeader title="Suasana" subtitle="Pilih rasa harimu" />
        <div className="grid grid-cols-2 gap-3">
          {MOODS.map((mood) => (
            <BrowseTile key={mood.id} title={mood.title} to={`/search?view=mood&id=${mood.id}`} cover={mood.cover} />
          ))}
        </div>
      </section>

      {genres.length > 0 && (
        <section aria-label="Genre">
          <SectionHeader title="Genre" />
          <div className="grid grid-cols-2 gap-3">
            {genres.map((genre) => (
              <BrowseTile
                key={genre.id}
                title={genre.name}
                image={genre.picture}
                icon={Disc3}
                to={`/search?view=genre&id=${genre.id}&name=${encodeURIComponent(genre.name)}`}
                cover={fallbackCover(genre.name)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
