import { ArrowDown, ArrowLeft, ArrowUp, Check, Download, ListChecks, ListMusic, Loader2, MoreHorizontal, Pause, Pencil, Pin, PinOff, Play, RefreshCw, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import CoverArt from '../components/ui/CoverArt'
import RefreshChoiceSheet from '../components/library/RefreshChoiceSheet'
import TrackSelectionBar from '../components/library/TrackSelectionBar'
import TrackTransferSheet from '../components/library/TrackTransferSheet'
import EmptyState from '../components/ui/EmptyState'
import RoundAction from '../components/ui/RoundAction'
import { useLibrary } from '../context/LibraryContext'
import { myPlaylistErrorText, useMyPlaylists } from '../context/MyPlaylistsContext'
import { useTrackMenu } from '../context/TrackMenuContext'
import { useAudioPlayer } from '../hooks/useAudioPlayer'
import { usePlaylistPlayback } from '../hooks/usePlaylistPlayback'
import { useLongPress } from '../hooks/useLongPress'
import { OFFLINE_BLOCK_TEXT, useOfflineBlock } from '../hooks/useOfflineBlock'
import { useTrackSwipe } from '../hooks/useTrackSwipe'
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
  selecting,
  selected,
  onToggle,
  offlineBlocked,
}: {
  playlistId: string
  track: PlaylistTrack
  index: number
  last: boolean
  activity: ReturnType<typeof getRowActivity>
  onPlay: () => void
  onRemove: () => void
  onMove: (to: number) => void
  /** Mode pilih banyak: ketuk = pilih / batal pilih, tombol baris disembunyikan. */
  selecting: boolean
  selected: boolean
  onToggle: () => void
  /** Offline dan belum diunduh: redup, ketukan hanya memberi tahu. */
  offlineBlocked: boolean
}) {
  const { openTrackMenu, showToast } = useTrackMenu()
  // Tahan lama pada baris = menu lagu dengan opsi salin / pindahkan ke playlist lain.
  const press = useLongPress(() => openTrackMenu(track, { fromPlaylistId: playlistId, place: 'my-playlist' }))
  const fallback = useMemo(() => fallbackCover(`${track.title}${track.album}`), [track.title, track.album])
  const Icon = activity === 'playing' ? Pause : activity === 'loading' ? Loader2 : Play
  const current = activity !== 'none'
  const play = () => {
    if (offlineBlocked) return showToast(OFFLINE_BLOCK_TEXT)
    onPlay()
  }

  if (selecting) {
    return (
      <li>
        <button
          type="button"
          role="checkbox"
          aria-checked={selected}
          aria-label={`${track.title}. ${selected ? 'Dipilih' : 'Belum dipilih'}`}
          onClick={onToggle}
          className={`flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors focus-ring ${selected ? 'bg-accent/10' : 'hover:bg-raised'}`}
        >
          <span className="mv-slide-x flex shrink-0">
            <span
              aria-hidden="true"
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                selected ? 'animate-pop border-accent bg-accent text-black' : 'border-ink-muted text-transparent'
              }`}
            >
              <Check className="h-4 w-4" strokeWidth={3} />
            </span>
          </span>
          <span className="w-12 shrink-0">
            <CoverArt cover={fallback} src={track.cover} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-ink">{track.title}</span>
            <span className="block truncate text-xs text-ink-muted">{track.artists}</span>
          </span>
        </button>
      </li>
    )
  }

  return (
    <li
      {...press}
      aria-disabled={offlineBlocked || undefined}
      className={`flex items-center gap-2 rounded-md px-2 py-2 tap-row hover:bg-raised ${current ? 'bg-raised' : ''} ${offlineBlocked ? 'opacity-50' : ''}`}
    >
      <button
        type="button"
        onClick={play}
        aria-label={`${activity === 'playing' ? 'Jeda' : 'Putar'} ${track.title}`}
        className="relative w-12 shrink-0 rounded-md focus-ring"
      >
        <CoverArt cover={fallback} src={track.cover} />
        <span className="absolute inset-0 flex items-center justify-center rounded-md bg-black/40 text-white">
          <Icon className={`h-5 w-5 ${activity === 'loading' ? 'animate-spin' : ''}`} aria-hidden="true" />
        </span>
      </button>
      <button type="button" onClick={play} className="min-w-0 flex-1 text-left focus-ring rounded-md">
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
  const { getPlaylist, renamePlaylist, deletePlaylist, restorePlaylist, removeTrack, removeTracks, moveTrack, saveDownloadedPlaylist, setPinned } = useMyPlaylists()
  const { removePlaylist: removeSaved } = useLibrary()
  const { showToast } = useTrackMenu()
  const player = useAudioPlayer()
  const playback = usePlaylistPlayback(getPlaylist(id)?.tracks ?? [])
  const playlist = getPlaylist(id)
  const builtIn = playlist ? isLikedId(playlist.id) : false
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshMenu, setRefreshMenu] = useState(false)
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [transfer, setTransfer] = useState<'copy' | 'move' | null>(null)
  const offlineBlocked = useOfflineBlock()

  const exitSelecting = () => {
    setSelecting(false)
    setSelected(new Set())
    setTransfer(null)
  }
  const toggleSelected = (trackId: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(trackId)) next.delete(trackId)
      else next.add(trackId)
      return next
    })

  // Geser kanan = tambah ke antrean, kiri = suka. Dalam mode pilih: geser memilih / batal pilih lagu.
  const swipeHandlers = useTrackSwipe((index) => playlist?.tracks[index], {
    selecting,
    onToggleSelect: (track) => toggleSelected(track.id),
    selectedIds: selected,
  })

  // Lagu yang dipilih lalu hilang (mis. dari tab lain): buang dari pilihan; kalau playlist kosong, keluar dari mode pilih.
  const trackIdsKey = playlist ? playlist.tracks.map((t) => t.id).join('|') : ''
  useEffect(() => {
    if (!selecting) return
    const alive = new Set(trackIdsKey === '' ? [] : trackIdsKey.split('|'))
    if (alive.size === 0) {
      setSelecting(false)
      setSelected(new Set())
      setTransfer(null)
      return
    }
    setSelected((prev) => {
      const next = new Set([...prev].filter((id) => alive.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [selecting, trackIdsKey])

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

  /** Ambil ulang playlist Spotify asalnya dan tambahkan lagu baru ke playlist ini. Tidak mengunduh apa pun (jalan di web dan APK). */
  const refreshFromSpotify = async () => {
    if (!playlist.sourceId || refreshing || syncing) return
    setRefreshing(true)
    try {
      const remote = await fetchPlaylist(`https://open.spotify.com/playlist/${playlist.sourceId}`)
      const have = new Set(playlist.tracks.map((t) => trackKey(t)))
      const fresh = remote.tracks.filter((t) => !have.has(trackKey(t)))
      if (fresh.length === 0) return showToast(`Sudah yang terbaru (${remote.tracks.length} lagu di Spotify).`)
      const saved = saveDownloadedPlaylist(playlist.sourceId, playlist.name, fresh)
      if (!saved.ok) return fail(saved.reason)
      showToast(`${fresh.length} lagu baru ditambahkan dari Spotify.`)
    } catch {
      showToast('Server sedang bermasalah. Coba lagi.')
    } finally {
      setRefreshing(false)
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
          <CoverArt cover={fallbackCover(playlist.name)} src={tracks[0]?.cover} className="shadow-xl shadow-black/50" />
        </div>
        <div className="min-w-0 flex-1 basis-56">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{builtIn ? 'Playlist bawaan' : 'Playlist saya'}</p>
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
        <RoundAction primary fill icon={playback.icon} label={playback.label} onClick={() => playback.onPress(() => player.playList(tracks, 0))} disabled={tracks.length === 0} />
        {isNativeApp() && (
          <RoundAction
            icon={Download}
            label="Unduh semua"
            onClick={() => showToast(bulkDownloadText(downloadTracks(tracks)))}
            disabled={tracks.length === 0}
          />
        )}
        {playlist.sourceId && (
          <RoundAction
            icon={RefreshCw}
            iconClassName={refreshing || syncing ? 'animate-spin motion-reduce:animate-none' : undefined}
            label={isNativeApp() ? 'Perbarui playlist' : 'Muat data terbaru'}
            haspopup={isNativeApp()}
            disabled={refreshing || syncing}
            // Di APK ada dua pilihan (muat data / unduh yang baru), jadi tanya dulu; di web hanya satu, langsung jalan.
            onClick={() => (isNativeApp() ? setRefreshMenu(true) : void refreshFromSpotify())}
          />
        )}
        <RoundAction
          icon={ListChecks}
          label="Pilih lagu"
          pressed={selecting}
          onClick={() => (selecting ? exitSelecting() : setSelecting(true))}
          disabled={tracks.length === 0}
        />
        {!builtIn && (
          <RoundAction
            icon={playlist.pinned ? PinOff : Pin}
            iconClassName={playlist.pinned ? 'text-accent' : undefined}
            label={playlist.pinned ? 'Lepas sematan playlist' : 'Sematkan playlist'}
            pressed={playlist.pinned === true}
            onClick={() => {
              const result = setPinned(playlist.id, !playlist.pinned)
              if (!result.ok) fail(result.reason)
              else showToast(result.value.pinned ? 'Playlist disematkan di atas' : 'Sematan dilepas')
            }}
          />
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
                const deleted = playlist
                showToast(`Playlist "${deleted.name}" dihapus`, {
                  label: 'Urungkan',
                  onClick: () => {
                    const restored = restorePlaylist(deleted)
                    showToast(restored.ok ? `Playlist "${deleted.name}" dikembalikan` : myPlaylistErrorText(restored.reason))
                  },
                })
                navigate('/library', { replace: true })
              }}
              className="btn-danger px-4"
            >
              Hapus
            </button>
          </div>
        ) : (
          <RoundAction danger icon={Trash2} label="Hapus playlist" onClick={() => setConfirmDelete(true)} />
        )}
      </div>

      {refreshMenu && (
        <RefreshChoiceSheet
          onClose={() => setRefreshMenu(false)}
          onRefresh={() => void refreshFromSpotify()}
          onSync={() => void syncFromSpotify()}
        />
      )}

      {selecting && (
        <TrackSelectionBar
          count={selected.size}
          total={tracks.length}
          onSelectAll={() => setSelected(new Set(tracks.map((t) => t.id)))}
          onClear={() => setSelected(new Set())}
          onCancel={exitSelecting}
          onCopy={() => setTransfer('copy')}
          onMove={() => setTransfer('move')}
          onDelete={() => {
            const result = removeTracks(playlist.id, [...selected])
            if (!result.ok) return fail(result.reason)
            showToast(`${result.value} lagu dihapus dari playlist`)
            exitSelecting()
          }}
        />
      )}

      {selecting && transfer && (
        <TrackTransferSheet
          source={playlist}
          trackIds={[...selected]}
          mode={transfer}
          onClose={() => setTransfer(null)}
          onDone={(message) => {
            showToast(message)
            exitSelecting()
          }}
        />
      )}

      {tracks.length === 0 ? (
        <EmptyState
          compact
          icon={ListMusic}
          title="Playlist ini masih kosong"
        />
      ) : (
        <ul {...swipeHandlers} className="mv-list touch-pan-y">
          {tracks.map((track, index) => (
            <TrackLine
              key={track.id}
              playlistId={playlist.id}
              track={track}
              index={index}
              last={index === tracks.length - 1}
              activity={track.id === playingId ? activity : 'none'}
              onPlay={() => playAt(index)}
              selecting={selecting}
              selected={selected.has(track.id)}
              onToggle={() => toggleSelected(track.id)}
              offlineBlocked={offlineBlocked(track)}
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
