import { ArrowLeft, ChevronRight, Loader2, Play, Shuffle, UserRound } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useAudioPlayer } from '../../hooks/useAudioPlayer'
import { useOverlayHistory } from '../../hooks/useOverlayHistory'
import { fetchArtistSongs, searchArtists, type ArtistHit } from '../../services/artistApi'
import type { PlaylistTrack } from '../../types/spotify'
import { fallbackCover } from '../../utils/fallbackCover'
import { getRowActivity } from '../../utils/playerStatus'
import CoverArt from '../ui/CoverArt'
import EmptyState from '../ui/EmptyState'
import TrackList from './TrackList'

export interface ArtistRequest {
  q: string
  /** Berubah setiap submit, jadi mencari kata yang sama dua kali tetap memuat ulang. */
  n: number
}

type Phase = 'idle' | 'searching' | 'list' | 'loading' | 'songs' | 'error'

/**
 * Hasil mode "Artis" di Beranda: daftar artis (foto bulat) -> ketuk -> semua lagu artis itu.
 * Artis TIDAK pernah dibungkus sebagai PlaylistTrack, jadi tidak bisa tertukar dengan lagu.
 */
export default function ArtistSearchPanel({ request }: { request: ArtistRequest | null }) {
  const player = useAudioPlayer()
  const [phase, setPhase] = useState<Phase>('idle')
  const [artists, setArtists] = useState<ArtistHit[]>([])
  const [selected, setSelected] = useState<ArtistHit | null>(null)
  const [songs, setSongs] = useState<PlaylistTrack[]>([])
  const songsCtl = useRef<AbortController | null>(null)

  useEffect(() => {
    songsCtl.current?.abort()
    setSelected(null)
    setSongs([])
    if (!request) {
      setPhase('idle')
      return
    }
    const ctl = new AbortController()
    setPhase('searching')
    searchArtists(request.q, ctl.signal)
      .then((found) => {
        if (ctl.signal.aborted) return
        setArtists(found)
        setPhase('list')
      })
      .catch(() => {
        if (!ctl.signal.aborted) setPhase('error')
      })
    return () => ctl.abort()
  }, [request])

  useEffect(() => () => songsCtl.current?.abort(), [])

  function openArtist(artist: ArtistHit) {
    songsCtl.current?.abort()
    const ctl = new AbortController()
    songsCtl.current = ctl
    setSelected(artist)
    setSongs([])
    setPhase('loading')
    fetchArtistSongs(artist.id, ctl.signal)
      .then((found) => {
        if (ctl.signal.aborted) return
        setSongs(found)
        setPhase('songs')
      })
      .catch(() => {
        if (!ctl.signal.aborted) setPhase('error')
      })
  }

  function backToList() {
    songsCtl.current?.abort()
    setSelected(null)
    setPhase('list')
  }

  // Back (termasuk Back Android) dari detail artis kembali ke daftar artis, bukan keluar dari Beranda.
  useOverlayHistory(selected !== null, backToList)

  if (phase === 'idle') return null

  if (phase === 'searching') {
    return (
      <p className="flex items-center gap-2 text-sm text-ink-muted" role="status">
        <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        Mencari artis…
      </p>
    )
  }

  if (phase === 'error') {
    return (
      <EmptyState
        compact
        icon={UserRound}
        title="Gagal memuat artis"
        action={
          selected ? (
            <button type="button" className="btn-secondary" onClick={() => openArtist(selected)}>
              Coba lagi
            </button>
          ) : undefined
        }
      />
    )
  }

  // Daftar artis hasil pencarian.
  if (!selected) {
    if (artists.length === 0) return <EmptyState compact icon={UserRound} title="Artis tidak ditemukan" />
    return (
      <section aria-label="Hasil artis">
        <h2 className="mb-2 font-display text-xl font-bold tracking-tight text-ink">Artis</h2>
        <ul className="space-y-1">
          {artists.map((artist) => (
            <li key={artist.id}>
              <button
                type="button"
                onClick={() => openArtist(artist)}
                className="focus-ring flex w-full items-center gap-3 rounded-lg px-1 py-1 text-left"
              >
                <div className="w-14 shrink-0 overflow-hidden rounded-full">
                  <CoverArt cover={fallbackCover(artist.name)} />
                </div>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">{artist.name}</span>
                  <span className="block truncate text-xs text-ink-muted">
                    {artist.genre ? `Artis, ${artist.genre}` : 'Artis'}
                  </span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-ink-muted" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      </section>
    )
  }

  // Detail artis: semua lagunya.
  return (
    <section aria-label={`Lagu ${selected.name}`} className="space-y-4">
      <button
        type="button"
        onClick={backToList}
        className="focus-ring -ml-1 inline-flex items-center gap-1 rounded-md p-1 text-sm text-ink-muted"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Artis
      </button>

      <header className="flex items-center gap-4">
        <div className="w-20 shrink-0 overflow-hidden rounded-full">
          <CoverArt cover={fallbackCover(selected.name)} src={songs[0]?.cover} />
        </div>
        <div className="min-w-0">
          <h2 className="truncate font-display text-2xl font-extrabold text-ink">{selected.name}</h2>
          <p className="text-sm text-ink-muted">{phase === 'songs' ? `${songs.length} lagu` : 'Memuat lagu…'}</p>
        </div>
      </header>

      {phase === 'loading' ? (
        <p className="flex items-center gap-2 text-sm text-ink-muted" role="status">
          <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          Memuat lagu…
        </p>
      ) : (
        <>
          <div className="flex gap-2">
            <button type="button" className="btn-primary" disabled={songs.length === 0} onClick={() => player.playList(songs, 0)}>
              <Play className="h-4 w-4" aria-hidden="true" />
              Putar semua
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={songs.length === 0}
              onClick={() => player.playAll([...songs].sort(() => Math.random() - 0.5))}
            >
              <Shuffle className="h-4 w-4" aria-hidden="true" />
              Acak
            </button>
          </div>
          <TrackList
            key={selected.id}
            tracks={songs}
            emptyState={<EmptyState compact icon={UserRound} title="Belum ada lagu" />}
            searchable
            onPlay={(_track, index) => player.playList(songs, index)}
            playingTrackId={player.currentTrack?.id ?? null}
            playbackActivity={getRowActivity(player.status)}
          />
        </>
      )}
    </section>
  )
}
