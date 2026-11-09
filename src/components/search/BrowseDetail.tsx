import { ArrowLeft, CloudOff, Play, Shuffle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MOODS } from '../../config/moods'
import { useAudioPlayer } from '../../hooks/useAudioPlayer'
import { fetchAlbumSongs, type ArtistHit } from '../../services/artistApi'
import { getGenreArtists, getGenreTracks, getMoodTracks, getPlaylistDetail } from '../../services/homeFeed'
import type { PlaylistTrack } from '../../types/spotify'
import { getRowActivity } from '../../utils/playerStatus'
import { ArtistBubble, HomeRow } from '../home/HomeCards'
import { openArtistFromFeed } from '../home/homeNav'
import TrackList from '../playlist/TrackList'
import EmptyState from '../ui/EmptyState'

type Phase = 'loading' | 'ready' | 'error'

interface BrowseDetailProps {
  view: 'genre' | 'mood' | 'playlist' | 'album'
  id: string
  /** Nama genre / playlist / album (dari alamat). Suasana memakai judul dari config. */
  name?: string
  /** Hanya album: nama artis dan sampul (dari alamat). */
  artist?: string
  cover?: string
}

/** Isi satu suasana atau genre: lagu teratas (dan artis teratas untuk genre), dengan Putar semua dan Acak. */
export default function BrowseDetail({ view, id, name, artist, cover }: BrowseDetailProps) {
  const player = useAudioPlayer()
  const navigate = useNavigate()
  // Playlist/album dibuka dari Beranda: kembali ke tempat asal (Beranda), bukan ke jelajah.
  const fromHome = view === 'playlist' || view === 'album'
  const mood = view === 'mood' ? MOODS.find((m) => m.id === id) : undefined
  const title = mood?.title ?? name ?? 'Jelajah'
  const [phase, setPhase] = useState<Phase>('loading')
  const [tracks, setTracks] = useState<PlaylistTrack[]>([])
  const [artists, setArtists] = useState<ArtistHit[]>([])

  useEffect(() => {
    if (view === 'mood' && !mood) {
      setPhase('error')
      return
    }
    let off = false
    setPhase('loading')
    void (async () => {
      let found: PlaylistTrack[] | null
      if (view === 'playlist') found = (await getPlaylistDetail(id))?.tracks ?? null
      else if (view === 'album') found = await fetchAlbumSongs({ id, title: name ?? '', cover: cover ?? '', year: '', kind: 'Album' }, artist ?? '').catch(() => null)
      else found = mood ? await getMoodTracks(mood.query) : await getGenreTracks(id)
      const top = view === 'genre' ? await getGenreArtists(id) : null
      if (off) return
      if (!found || found.length === 0) {
        setPhase('error')
        return
      }
      setTracks(found)
      setArtists(top ?? [])
      setPhase('ready')
    })()
    return () => {
      off = true
    }
  }, [view, id, mood, name, artist, cover])

  return (
    <div className="space-y-5">
      {fromHome ? (
        <button type="button" onClick={() => navigate(-1)} className="back-glass focus-ring inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-ink">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Kembali
        </button>
      ) : (
        <Link to="/search" className="back-glass focus-ring inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-ink">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Jelajah
        </Link>
      )}
      <header>
        <h2 className="font-display text-3xl font-extrabold tracking-tight text-ink">{title}</h2>
        {phase === 'ready' && (
          <p className="mt-1 text-sm text-ink-muted">
            {view === 'album' && artist ? `${artist} · ` : ''}
            {tracks.length} lagu
          </p>
        )}
      </header>

      {phase === 'loading' && (
        <div aria-hidden="true" className="space-y-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex animate-pulse items-center gap-3 motion-reduce:animate-none">
              <div className="h-12 w-12 rounded-md bg-raised" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-2/3 rounded bg-raised" />
                <div className="h-3 w-1/3 rounded bg-raised" />
              </div>
            </div>
          ))}
        </div>
      )}

      {phase === 'error' && (
        <EmptyState
          icon={CloudOff}
          tone="error"
          title="Lagunya tidak bisa dimuat"
          description="Bagian ini butuh internet (di aplikasi Android). Coba lagi nanti."
        />
      )}

      {phase === 'ready' && (
        <>
          <div className="flex gap-2">
            <button type="button" className="btn-primary" onClick={() => player.playList(tracks, 0)}>
              <Play className="h-4 w-4" aria-hidden="true" />
              Putar semua
            </button>
            <button type="button" className="btn-secondary" onClick={() => player.playAll([...tracks].sort(() => Math.random() - 0.5))}>
              <Shuffle className="h-4 w-4" aria-hidden="true" />
              Acak
            </button>
          </div>

          {artists.length > 0 && (
            <HomeRow title="Artis teratas">
              {artists.map((hit) => (
                <ArtistBubble key={hit.id} name={hit.name} picture={hit.picture} onOpen={() => openArtistFromFeed(hit)} />
              ))}
            </HomeRow>
          )}

          <TrackList
            key={`${view}-${id}`}
            tracks={tracks}
            query=""
            includeAlbum={false}
            searchable
            onPlay={player.selectTrack}
            playingTrack={player.currentTrack}
            playbackActivity={getRowActivity(player.status)}
          />
        </>
      )}
    </div>
  )
}
