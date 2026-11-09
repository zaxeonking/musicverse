import { ArrowLeft, Music2, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLibrary } from '../../context/LibraryContext'
import { usePlaylist } from '../../context/PlaylistContext'
import { useAudioPlayer } from '../../hooks/useAudioPlayer'
import { collectAllSongs } from '../../utils/allSongs'
import { getRowActivity } from '../../utils/playerStatus'
import ArtistMatches from '../playlist/ArtistMatches'
import TrackList from '../playlist/TrackList'
import EmptyState from '../ui/EmptyState'
import SectionHeader from '../ui/SectionHeader'

/**
 * "Semua lagu": satu daftar dari semua lagu yang benar-benar ada di perangkat (playlist aktif + Koleksi + riwayat putar),
 * dengan kolom saring sendiri (judul dan nama artis). Dulu isi halaman Cari; kini salah satu pintasan jelajah.
 */
export default function AllSongsView() {
  const [query, setQuery] = useState('')
  const { playlist, status } = usePlaylist()
  const { saved, recent } = useLibrary()
  const player = useAudioPlayer()

  const songs = useMemo(
    () => collectAllSongs([playlist?.tracks ?? [], ...saved.map((item) => item.tracks), recent.map((item) => item.track)]),
    [playlist, saved, recent],
  )

  const emptyState =
    status === 'loading' ? (
      <EmptyState icon={Music2} title="Memuat lagu…" />
    ) : (
      <EmptyState
        icon={Music2}
        title="Belum ada lagu"
        action={
          <Link to="/search" className="btn-primary">
            Cari lagu
          </Link>
        }
      />
    )

  return (
    <div className="space-y-5">
      <Link to="/search" className="back-glass focus-ring inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Jelajah
      </Link>

      <label htmlFor="all-songs-filter" className="sr-only">
        Saring lagu berdasarkan judul atau artis
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
        <input
          id="all-songs-filter"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Saring: judul lagu atau artis"
          enterKeyHint="search"
          autoComplete="off"
          className="h-12 w-full rounded-full bg-raised pl-12 pr-12 text-base text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-accent [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Hapus saringan"
            className="mv-pop icon-btn absolute right-0.5 top-1/2 -translate-y-1/2"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
      </div>

      <ArtistMatches query={query} />

      <section aria-label="All Songs">
        <SectionHeader title="Semua lagu" subtitle={songs.length > 0 ? `${songs.length} lagu` : undefined} />
        <TrackList
          tracks={songs}
          query={query}
          onQueryChange={setQuery}
          includeAlbum={false}
          emptyState={emptyState}
          searchable
          onPlay={player.selectTrack}
          playingTrack={player.currentTrack}
          playbackActivity={getRowActivity(player.status)}
        />
      </section>
    </div>
  )
}
