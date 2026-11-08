import { Music2, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import ArtistMatches from '../components/playlist/ArtistMatches'
import TrackList from '../components/playlist/TrackList'
import EmptyState from '../components/ui/EmptyState'
import SectionHeader from '../components/ui/SectionHeader'
import { useLibrary } from '../context/LibraryContext'
import { usePlaylist } from '../context/PlaylistContext'
import { useAudioPlayer } from '../hooks/useAudioPlayer'
import { collectAllSongs } from '../utils/allSongs'
import { getRowActivity } from '../utils/playerStatus'

/**
 * Halaman Cari: satu daftar "All Songs" dari semua lagu yang benar-benar ada di perangkat
 * (playlist aktif + Koleksi + riwayat putar). Kolom pencarian menyaring daftar itu berdasarkan
 * judul dan nama artis; kolom kosong = semua lagu tampil lagi. Tidak ada data contoh.
 */
export default function SearchPage() {
  const [query, setQuery] = useState('')
  const { playlist, status } = usePlaylist()
  const { saved, recent } = useLibrary()
  const player = useAudioPlayer()

  const songs = useMemo(
    () =>
      collectAllSongs([
        playlist?.tracks ?? [],
        ...saved.map((item) => item.tracks),
        recent.map((item) => item.track),
      ]),
    [playlist, saved, recent],
  )

  const emptyState =
    status === 'loading' ? (
      <EmptyState
        icon={Music2}
        title="Memuat lagu…"
      />
    ) : (
      <EmptyState
        icon={Music2}
        title="Belum ada lagu"
        action={
          <Link to="/" className="btn-primary">
            Ke Beranda
          </Link>
        }
      />
    )

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-4xl">Cari</h1>

      {/* Tanpa latar pekat: cahaya latar (mv-glow di AppShell) tetap menyambung di belakang kolom cari. Lapisan blur + pudar di
          bawahnya hanya menjaga daftar yang tergulir tidak menabrak kolom cari. */}
      <div className="sticky top-0 z-10 -mx-4 px-4 py-2 lg:-mx-8 lg:px-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 -top-2 -z-10 bottom-[-14px] bg-bg/30 backdrop-blur-xl [-webkit-mask-image:linear-gradient(to_bottom,black_65%,transparent)] [mask-image:linear-gradient(to_bottom,black_65%,transparent)]"
        />
        <label htmlFor="search-input" className="sr-only">
          Cari lagu berdasarkan judul atau artis
        </label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted"
            aria-hidden="true"
          />
          <input
            id="search-input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Judul lagu atau artis"
            enterKeyHint="search"
            autoComplete="off"
            className="h-12 w-full rounded-full border border-veil/10 bg-raised/60 bg-[linear-gradient(to_bottom,rgb(var(--mv-accent,29_185_84)/0.14),transparent_85%)] shadow-[inset_0_1px_0_rgb(var(--mv-veil,255_255_255)/0.1)] backdrop-blur-md pl-12 pr-12 text-base text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-accent [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Hapus pencarian"
              className="mv-pop icon-btn absolute right-0.5 top-1/2 -translate-y-1/2"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      <ArtistMatches query={query} />

      <section aria-label="All Songs">
        <SectionHeader
          title="All Songs"
          subtitle={songs.length > 0 ? `${songs.length} lagu` : undefined}
        />
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
