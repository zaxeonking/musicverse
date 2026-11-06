import { ArrowDown, ArrowLeft, ArrowUp, Check, Download, ListMusic, Loader2, MoreHorizontal, Pause, Pencil, Pin, PinOff, Play, RefreshCw, Trash2, X } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import CoverArt from '../components/ui/CoverArt'
import EmptyState from '../components/ui/EmptyState'
import { useLibrary } from '../context/LibraryContext'
import { myPlaylistErrorText, useMyPlaylists } from '../context/MyPlaylistsContext'
import { useTrackMenu } from '../context/TrackMenuContext'
import { useAudioPlayer } from '../hooks/useAudioPlayer'
import { useLongPress } from '../hooks/useLongPress'
import { bulkDownloadText, downloadTracks } from '../native/downloads'
import { trackKey } from '../native/offline'
import { fetchPlaylist } from '../services/spotifyApi'
import { isNativeApp } from '../native/platform'
import type { PlaylistTrack } from '../types/spotify'
import { fallbackCover } from '../utils/fallbackCover'
import { isLikedId, MAX_MY_PLAYLIST_NAME } from '../utils/myPlaylistStorage'
import { getRowActivity } from '../utils/playerStatus'

function TrackLine({
  playlistId,
  track,
  index,
  last,
  activity,
  onPlay,
  onRemove,
  onMove,
}: {
  playlistId: string
  track: PlaylistTrack
  index: number
  last: boolean
  activity: ReturnType<typeof getRowActivity>
  onPlay: () => void
  onRemove: () => void
  onMove: (to: number) => void
}) {
  const { openTrackMenu } = useTrackMenu()
  // Tahan lama pada baris = menu lagu dengan opsi salin / pindahkan ke playlist lain.
  const press = useLongPress(() => openTrackMenu(track, { fromPlaylistId: playlistId, place: 'my-playlist' }))
  const fallback = useMemo(() => fallbackCover(`${track.title}${track.album}`), [track.title, track.album])
  const Icon = activity === 'playing' ? Pause : activity === 'loading' ? Loader2 : Play
  const current = activity !== 'none'
  return (
    <li {...press} className={`flex items-center gap-2 rounded-md px-2 py-2 transition-colors hover:bg-raised ${current ? 'bg-raised' : ''}`}>
      <button
        type="button"
        onClick={onPlay}
        aria-label={`${activity === 'playing' ? 'Jeda' : 'Putar'} ${track.title}`}
        className="relative w-12 shrink-0 rounded-md focus-ring"
      >
        <CoverArt cover={fallback} src={track.cover} />
        <span className="absolute inset-0 flex items-center justify-center rounded-md bg-black/40 text-white">
          <Icon className={`h-5 w-5 ${activity === 'loading' ? 'animate-spin' : ''}`} aria-hidden="true" />
        </span>
      </button>
      <button type="button" onClick={onPlay} className="min-w-0 flex-1 text-left focus-ring rounded-md">
        <span className={`block truncate text-sm font-medium ${current ? 'text-accent' : 'text-ink'}`}>{track.title}</span>
        <span className="block truncate text-xs text-ink-muted">{track.artists}</span>
      </button>
      <div className="flex shrink-0 items-center">
        <button type="button" onClick={() => onMove(index - 1)} disabled={index === 0} aria-label={`Naikkan ${track.title}`} className="icon-btn h-9 w-9">
          <ArrowUp className="h-4 w-4" aria-hidden="true" />
        </button>
        <button type="button" onClick={() => onMove(index + 1)} disabled={last} aria-label={`Turunkan ${track.title}`} className="icon-btn h-9 w-9">
          <ArrowDown className="h-4 w-4" aria-hidden="true" />
        </button>
        <button type="button" onClick={() => openTrackMenu(track, { fromPlaylistId: playlistId, place: 'my-playlist' })} aria-label={`Opsi untuk ${track.title}`} className="icon-btn h-9 w-9">
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
        </button>
        <button type="button" onClick={onRemove} aria-label={`Hapus ${track.title} dari playlist`} className="icon-btn h-9 w-9 hover:text-danger">
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </li>
  )
}

/** Halaman satu playlist buatan sendiri: putar, ganti nama, atur urutan, hapus lagu, hapus playlist. */
export default function MyPlaylistPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { getPlaylist, renamePlaylist, deletePlaylist, removeTrack, moveTrack, saveDownloadedPlaylist, setPinned } = useMyPlaylists()
  const { removePlaylist: removeSaved } = useLibrary()
  const { showToast } = useTrackMenu()
  const player = useAudioPlayer()
  const playlist = getPlaylist(id)
  const builtIn = playlist ? isLikedId(playlist.id) : false
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [syncing, setSyncing] = useState(false)

  if (!playlist) {
    return (
      <div className="space-y-4">
        <Link to="/library" className="btn-secondary h-10 px-4 text-sm">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Koleksi
        </Link>
        <EmptyState icon={ListMusic} title="Playlist tidak ditemukan"  />
      </div>
    )
  }

  const { tracks } = playlist
  const activity = getRowActivity(player.status)
  const playingId = player.currentTrack?.id ?? null
  const fail = (reason: Parameters<typeof myPlaylistErrorText>[0]) => showToast(myPlaylistErrorText(reason))

  /** Playlist hasil "Unduh semua": ambil ulang playlist Spotify-nya, tambah lagu baru, lalu unduh yang belum terunduh. */
  const syncFromSpotify = async () => {
    if (!playlist.sourceId || syncing) return
    setSyncing(true)
    try {
      const remote = await fetchPlaylist(`https://open.spotify.com/playlist/${playlist.sourceId}`)
      const have = new Set(playlist.tracks.map((t) => trackKey(t)))
      const fresh = remote.tracks.filter((t) => !have.has(trackKey(t)))
      // Yang sudah terunduh atau sedang diproses dilewati otomatis; lagu lama yang dulu gagal ikut dicoba lagi.
      const result = downloadTracks(remote.tracks)
      if (result.unsupported) return showToast(bulkDownloadText(result))
      if (fresh.length > 0) {
        const saved = saveDownloadedPlaylist(playlist.sourceId, playlist.name, fresh)
        if (!saved.ok) return fail(saved.reason)
      }
      showToast(
        fresh.length === 0 && result.queued === 0
          ? 'Tidak ada lagu baru. Semua sudah diunduh.'
          : `${fresh.length} lagu baru di Spotify. Mengunduh ${result.queued} lagu.`,
      )
    } catch {
      showToast('Server sedang bermasalah. Coba lagi.')
    } finally {
      setSyncing(false)
    }
  }

  const submitRename = (event: FormEvent) => {
    event.preventDefault()
    const result = renamePlaylist(playlist.id, name)
    if (!result.ok) return fail(result.reason)
    setRenaming(false)
  }

  const playAt = (index: number) => {
    const track = tracks[index]
    if (player.currentTrack?.id === track.id && activity !== 'none') {
      player.selectTrack(track, index) // lagu aktif: jeda / lanjut
      return
    }
    player.playList(tracks, index)
  }

  return (
    <div className="space-y-6">
      <Link to="/library" className="btn-secondary h-10 px-4 text-sm">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Koleksi
      </Link>

      <header className="flex flex-wrap items-end gap-4">
        <div className="w-28 shrink-0 sm:w-36">
          <CoverArt cover={fallbackCover(playlist.name)} src={tracks[0]?.cover} />
        </div>
        <div className="min-w-0 flex-1 basis-56">
          <p className="text-sm font-medium text-ink-muted">{builtIn ? 'Playlist bawaan' : 'Playlist saya'}</p>
          {renaming ? (
            <form onSubmit={submitRename} className="mt-1 flex items-center gap-2">
              <label htmlFor="rename-playlist" className="sr-only">
                Nama playlist
              </label>
              <input
                id="rename-playlist"
                autoFocus
                value={name}
                maxLength={MAX_MY_PLAYLIST_NAME}
                onChange={(e) => setName(e.target.value)}
                className="h-11 min-w-0 flex-1 rounded-full bg-raised px-4 text-base text-ink focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <button type="submit" aria-label="Simpan nama" className="icon-btn bg-raised text-accent">
                <Check className="h-5 w-5" aria-hidden="true" />
              </button>
              <button type="button" onClick={() => setRenaming(false)} aria-label="Batal ganti nama" className="icon-btn bg-raised">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </form>
          ) : (
            <h1 className="mt-1 flex items-center gap-1 font-display text-2xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              <span className="min-w-0 break-words">{playlist.name}</span>
              {!builtIn && (
                <button
                  type="button"
                  onClick={() => {
                    setName(playlist.name)
                    setRenaming(true)
                  }}
                  aria-label="Ganti nama playlist"
                  className="icon-btn shrink-0"
                >
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </h1>
          )}
          <p className="mt-1 text-sm text-ink-muted">{tracks.length === 0 ? 'Belum ada lagu' : `${tracks.length} lagu`}</p>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => player.playList(tracks, 0)} disabled={tracks.length === 0} className="btn-primary">
          <Play className="h-4 w-4" aria-hidden="true" />
          Putar semua
        </button>
        {isNativeApp() && (
          <button
            type="button"
            onClick={() => showToast(bulkDownloadText(downloadTracks(tracks)))}
            disabled={tracks.length === 0}
            className="btn-secondary"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Unduh semua
          </button>
        )}
        {isNativeApp() && playlist.sourceId && (
          <button type="button" onClick={() => void syncFromSpotify()} disabled={syncing} className="btn-secondary">
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin motion-reduce:animate-none' : ''}`} aria-hidden="true" />
            Unduh yang baru
          </button>
        )}
        {!builtIn && (
          <button
            type="button"
            onClick={() => {
              const result = setPinned(playlist.id, !playlist.pinned)
              if (!result.ok) fail(result.reason)
              else showToast(result.value.pinned ? 'Playlist disematkan di atas' : 'Sematan dilepas')
            }}
            aria-pressed={playlist.pinned === true}
            aria-label={playlist.pinned ? 'Lepas sematan playlist' : 'Sematkan playlist'}
            title={playlist.pinned ? 'Lepas sematan' : 'Sematkan di atas'}
            className={`icon-btn bg-raised ${playlist.pinned ? 'text-accent' : ''}`}
          >
            {playlist.pinned ? <PinOff className="h-4 w-4" aria-hidden="true" /> : <Pin className="h-4 w-4" aria-hidden="true" />}
          </button>
        )}
        {builtIn ? null : confirmDelete ? (
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Konfirmasi hapus playlist">
            <span className="text-sm text-ink-muted">Hapus playlist ini?</span>
            <button type="button" onClick={() => setConfirmDelete(false)} className="btn-secondary px-4">
              Batal
            </button>
            <button
              type="button"
              onClick={() => {
                const result = deletePlaylist(playlist.id)
                if (!result.ok) return fail(result.reason)
                // Playlist hasil "Unduh semua": kartu Spotify-nya yang tadi disembunyikan ikut dilepas, supaya tidak muncul lagi.
                if (playlist.sourceId) removeSaved(playlist.sourceId)
                navigate('/library', { replace: true })
              }}
              className="btn-danger px-4"
            >
              Hapus
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmDelete(true)} aria-label="Hapus playlist" className="icon-btn bg-raised hover:text-danger">
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {tracks.length === 0 ? (
        <EmptyState
          compact
          icon={ListMusic}
          title="Playlist ini masih kosong"
        />
      ) : (
        <ul>
          {tracks.map((track, index) => (
            <TrackLine
              key={track.id}
              playlistId={playlist.id}
              track={track}
              index={index}
              last={index === tracks.length - 1}
              activity={track.id === playingId ? activity : 'none'}
              onPlay={() => playAt(index)}
              onRemove={() => {
                const result = removeTrack(playlist.id, track.id)
                if (!result.ok) fail(result.reason)
                else showToast('Dihapus dari playlist')
              }}
              onMove={(to) => {
                const result = moveTrack(playlist.id, index, to)
                if (!result.ok) fail(result.reason)
              }}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
