import { ArrowLeft, Disc3, Play, Search, Shuffle, UserRound } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import CoverArt from '../components/ui/CoverArt'
import EmptyState from '../components/ui/EmptyState'
import { useLibrary } from '../context/LibraryContext'
import { useMyPlaylists } from '../context/MyPlaylistsContext'
import { useTrackMenu } from '../context/TrackMenuContext'
import { useAudioPlayer } from '../hooks/useAudioPlayer'
import { useLongPress } from '../hooks/useLongPress'
import type { PlaylistTrack } from '../types/spotify'
import { fallbackCover } from '../utils/fallbackCover'
import { recentKey } from '../utils/libraryStorage'
import { readPlayLog, splitArtists } from '../utils/playLog'

type Tab = 'artist' | 'album'

interface Group {
  name: string
  tracks: PlaylistTrack[]
}

/** Satu lagu di detail Artis / Album. Tahan lama (atau klik kanan) = menu lagu. */
function BrowseTrackRow({ track, subtitle, onPlay }: { track: PlaylistTrack; subtitle: string; onPlay: () => void }) {
  const { openTrackMenu } = useTrackMenu()
  const press = useLongPress(() => openTrackMenu(track, { place: 'browse' }))
  return (
    <li {...press} className="flex select-none items-center gap-3 px-1 py-1 [-webkit-touch-callout:none]">
      <div className="w-12 shrink-0">
        <CoverArt cover={fallbackCover(`${track.title}${track.album}`)} src={track.cover} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{track.title}</p>
        <p className="truncate text-xs text-ink-muted">{subtitle}</p>
      </div>
      <button type="button" className="icon-btn" aria-label={`Putar ${track.title}`} onClick={onPlay}>
        <Play className="h-5 w-5" aria-hidden="true" />
      </button>
    </li>
  )
}

function norm(s: string): string {
  return s.trim().toLowerCase()
}

function group(tracks: readonly PlaylistTrack[], tab: Tab): Group[] {
  const map = new Map<string, Group>()
  for (const track of tracks) {
    const names = tab === 'artist' ? splitArtists(track.artists) : track.album.trim() ? [track.album.trim()] : []
    for (const name of names) {
      const key = norm(name)
      const hit = map.get(key)
      if (hit) hit.tracks.push(track)
      else map.set(key, { name, tracks: [track] })
    }
  }
  return [...map.values()].sort((a, b) => b.tracks.length - a.tracks.length || a.name.localeCompare(b.name, 'id'))
}

/** Telusuri lagu yang sudah ada di perangkat (Koleksi, Playlist saya, riwayat) per artis atau album. */
export default function BrowsePage() {
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get('tab') === 'album' ? 'album' : 'artist'
  const selected = params.get('g')
  const [query, setQuery] = useState('')
  const { saved } = useLibrary()
  const { playlists } = useMyPlaylists()
  const player = useAudioPlayer()

  const all = useMemo(() => {
    const seen = new Set<string>()
    const out: PlaylistTrack[] = []
    const add = (t: PlaylistTrack) => {
      const key = recentKey(t)
      if (seen.has(key)) return
      seen.add(key)
      out.push(t)
    }
    for (const p of saved) p.tracks.forEach(add)
    for (const p of playlists) p.tracks.forEach(add)
    for (const e of readPlayLog()) add(e.track)
    return out
  }, [saved, playlists])

  const groups = useMemo(() => group(all, tab), [all, tab])
  const active = selected ? groups.find((g) => norm(g.name) === norm(selected)) : undefined
  const q = norm(query)
  const filtered = q ? groups.filter((g) => norm(g.name).includes(q)) : groups
  const setTab = (next: Tab) => setParams({ tab: next })

  return (
    <div className="space-y-4 px-4 pb-8 pt-2 sm:px-0">
      {active ? (
        <button type="button" onClick={() => setParams({ tab })} className="focus-ring -ml-1 inline-flex items-center gap-1 rounded-md p-1 text-sm text-ink-muted">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {tab === 'artist' ? 'Artis' : 'Album'}
        </button>
      ) : (
        <Link to="/library" className="focus-ring -ml-1 inline-flex items-center gap-1 rounded-md p-1 text-sm text-ink-muted">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Playlist
        </Link>
      )}

      {active ? (
        <>
          <header>
            <h1 className="text-3xl font-extrabold text-ink">{active.name}</h1>
            <p className="mt-1 text-sm text-ink-muted">{active.tracks.length} lagu di perangkat ini</p>
          </header>
          <div className="flex gap-2">
            <button type="button" className="btn-primary" onClick={() => player.playList(active.tracks, 0)}>
              <Play className="h-4 w-4" aria-hidden="true" />
              Putar semua
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => player.playAll([...active.tracks].sort(() => Math.random() - 0.5))}
            >
              <Shuffle className="h-4 w-4" aria-hidden="true" />
              Acak
            </button>
          </div>
          <ul className="space-y-1">
            {active.tracks.map((track, i) => (
              <BrowseTrackRow
                key={recentKey(track)}
                track={track}
                subtitle={tab === 'artist' ? track.album || track.artists : track.artists}
                onPlay={() => player.playList(active.tracks, i)}
              />
            ))}
          </ul>
        </>
      ) : (
        <>
          <h1 className="text-3xl font-extrabold text-ink">Artis & Album</h1>
          <div className="flex gap-2" role="tablist">
            {(['artist', 'album'] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={`focus-ring h-9 rounded-full px-4 text-sm font-medium ${tab === t ? 'bg-accent text-black' : 'bg-raised text-ink'}`}
              >
                {t === 'artist' ? 'Artis' : 'Album'}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 rounded-full bg-raised px-4 py-2 text-sm text-ink">
            <Search className="h-4 w-4 text-ink-muted" aria-hidden="true" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tab === 'artist' ? 'Cari artis' : 'Cari album'}
              className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-ink-muted"
            />
          </label>
          {filtered.length === 0 ? (
            <EmptyState
              compact
              icon={tab === 'artist' ? UserRound : Disc3}
              title="Belum ada data"
            />
          ) : (
            <ul className="space-y-1">
              {filtered.map((g) => (
                <li key={g.name}>
                  <button
                    type="button"
                    onClick={() => setParams({ tab, g: g.name })}
                    className="focus-ring flex w-full items-center gap-3 rounded-lg px-1 py-1 text-left"
                  >
                    <div className={`w-12 shrink-0 ${tab === 'artist' ? 'overflow-hidden rounded-full' : ''}`}>
                      <CoverArt cover={fallbackCover(g.name)} src={g.tracks[0]?.cover} />
                    </div>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{g.name}</span>
                      <span className="block text-xs text-ink-muted">{g.tracks.length} lagu</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
