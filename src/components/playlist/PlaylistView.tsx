import { useEffect, useRef, useState } from 'react'
import { AlertCircle, ListMusic, RotateCw } from 'lucide-react'
import { useLibrary } from '../../context/LibraryContext'
import { myPlaylistErrorText, useMyPlaylists } from '../../context/MyPlaylistsContext'
import { useTrackMenu } from '../../context/TrackMenuContext'
import { usePlaylist } from '../../context/PlaylistContext'
import { useAudioPlayer } from '../../hooks/useAudioPlayer'
import { NO_TRACKS, useTrackAvailability } from '../../hooks/useTrackAvailability'
import { usePlaylistPrefs } from '../../hooks/usePlaylistPrefs'
import { bulkDownloadText, downloadTracks } from '../../native/downloads'
import { isNativeApp } from '../../native/platform'
import type { PlaylistDetail, PlaylistTrack } from '../../types/spotify'
import { noticeMessage } from '../../utils/libraryNotice'
import { classifyImportInput } from '../../utils/spotifyUrl'
import { getRowActivity } from '../../utils/playerStatus'
import { QUEUE_RESULT_TEXT } from '../../utils/queueResultText'
import EmptyState from '../ui/EmptyState'
import ManualSearchSheet from '../library/ManualSearchSheet'
import AddToPlaylistSheet from './AddToPlaylistSheet'
import AvailabilityPanel from './AvailabilityPanel'
import PlaylistHeader from './PlaylistHeader'
import PlaylistSkeleton from './PlaylistSkeleton'
import TrackList from './TrackList'

/** Tombol ini benar-benar mengulang permintaan terakhir lewat context. */
function RetryButton() {
  const { retry } = usePlaylist()
  return (
    <button
      type="button"
      onClick={() => void retry()}
      className="btn-primary"
    >
      <RotateCw className="h-4 w-4" aria-hidden="true" />
      Coba lagi
    </button>
  )
}

/** Menampilkan playlist dari API: kosong, memuat, gagal, atau daftar lagu. */
export default function PlaylistView() {
  const { status, playlist, error, fromCache, canRetry, loadPlaylist, requestedUrl } = usePlaylist()
  const wasSearch = requestedUrl !== null && ['search', 'track'].includes(classifyImportInput(requestedUrl).kind)
  const player = useAudioPlayer()
  const { notice, dismissNotice } = useLibrary()
  const { showToast } = useTrackMenu()
  const { playlists: mine, saveDownloadedPlaylist } = useMyPlaylists()
  const [prefs] = usePlaylistPrefs()

  const [picking, setPicking] = useState(false)
  const [manualFor, setManualFor] = useState<PlaylistTrack | null>(null)

  // Cek ketersediaan audio semua lagu playlist (bukan hasil cari lagu satuan). Hook ini harus sebelum return di bawah.
  const checkable = status === 'success' && playlist !== null && playlist.source !== 'search'
  const availability = useTrackAvailability(playlist?.tracks ?? NO_TRACKS, checkable)
  // Selama pengecekan, lagu yang BELUM dicek dikunci (tidak bisa diputar); terbuka satu per satu begitu hasilnya keluar.
  const checking = checkable && availability.running
  const isLocked = (track: PlaylistTrack): boolean => checking && availability.results[track.id] === undefined

  // Playlist Spotify TIDAK masuk tab Playlist sendiri; hanya bila pengguna menekan tombolnya, atau menyalakan
  // "Tambah otomatis" di Pengaturan > Playlist. Playlist yang hanya dipulihkan dari penyimpanan tidak diproses.
  const autoAddedRef = useRef<PlaylistDetail | null>(null)
  useEffect(() => {
    if (!prefs.autoAddOpened || !playlist || status !== 'success' || fromCache || playlist.source === 'search') return
    if (autoAddedRef.current === playlist) return
    autoAddedRef.current = playlist
    const result = saveDownloadedPlaylist(playlist.id, playlist.title, playlist.tracks)
    showToast(
      result.ok
        ? `Playlist “${result.value.playlist.name}” ditambahkan (${result.value.added} lagu baru)`
        : myPlaylistErrorText(result.reason),
    )
  }, [prefs.autoAddOpened, playlist, status, fromCache, saveDownloadedPlaylist, showToast])

  if (status === 'loading') return <PlaylistSkeleton />

  if (!playlist) {
    if (status === 'error') {
      return (
        <EmptyState
          icon={AlertCircle}
          tone="error"
          title={wasSearch ? 'Lagu tidak ditemukan' : 'Playlist gagal dimuat'}
          action={canRetry ? <RetryButton /> : undefined}
        />
      )
    }
    return (
      <EmptyState
        icon={ListMusic}
        title="Belum ada lagu atau playlist"
      />
    )
  }

  // Satu playlist Spotify = satu playlist di tab Playlist (dikenali lewat sourceId). Menekan lagi menambah lagu yang baru saja.
  const existing = playlist.source === 'search' ? undefined : mine.find((item) => item.sourceId === playlist.id)
  const handleAddAsPlaylist = () => {
    const result = saveDownloadedPlaylist(playlist.id, playlist.title, playlist.tracks)
    if (!result.ok) return showToast(myPlaylistErrorText(result.reason))
    const { playlist: made, added } = result.value
    if (!existing) showToast(`Playlist “${made.name}” ditambahkan (${added} lagu)`)
    else showToast(added > 0 ? `${added} lagu baru ditambahkan ke “${made.name}”` : `“${made.name}” sudah punya semua lagu ini`)
  }

  // Hanya hasil cari judul / tautan lagu (lagu satuan) yang boleh dicampur ke antrean. Tautan playlist tidak.
  const isSingleSearch = playlist.source === 'search'
  const handleAddToQueue = () => {
    const track = playlist.tracks[0]
    if (!track) return
    showToast(QUEUE_RESULT_TEXT[player.addToQueue(track, { fromSearch: true })])
  }

  // Unduh per playlist: lagunya langsung masuk ke satu playlist di "Playlist saya" (nama sama dengan playlist asal).
  // Unduh satu lagu lewat menu lagu TIDAK masuk playlist mana pun; nanti bisa dipindahkan dari tab Unduhan.
  const handleDownloadAll = () => {
    const result = downloadTracks(playlist.tracks)
    const text = bulkDownloadText(result)
    if (result.unsupported) {
      showToast(text)
      return
    }
    const saved = saveDownloadedPlaylist(playlist.id, playlist.title, playlist.tracks)
    showToast(saved.ok ? `${text}. Masuk ke playlist “${saved.value.playlist.name}”` : `${text}. ${myPlaylistErrorText(saved.reason)}`)
  }

  return (
    <section aria-label={`Playlist ${playlist.title}`} className="space-y-6">
      {notice && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg bg-card px-4 py-3 text-sm text-ink"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
          <p className="min-w-0 flex-1">{noticeMessage(notice)}</p>
          <button type="button" onClick={dismissNotice} className="btn-secondary h-9 px-3">
            Tutup
          </button>
        </div>
      )}

      {status === 'error' && error && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-lg bg-card px-4 py-3 text-sm text-ink sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
            <span>
              {error} <span className="text-ink-muted">Playlist sebelumnya tetap ditampilkan.</span>
            </span>
          </p>
          {canRetry && <RetryButton />}
        </div>
      )}

      <PlaylistHeader
        title={playlist.title}
        cover={playlist.cover}
        trackCount={playlist.tracks.length}
        tracks={playlist.tracks}
        fromCache={fromCache}
        onPlayAll={() => player.playAll(playlist.tracks)}
        playAllDisabled={checking}
        onReload={() => void loadPlaylist(playlist.url)}
        // Lagu satuan (hasil cari judul / tautan lagu) memakai "Tambah ke playlist" di bawah (satu lagu, pilih playlist).
        addedAsPlaylist={existing !== undefined}
        onAddAsPlaylist={playlist.source === 'search' ? undefined : handleAddAsPlaylist}
        // Unduh offline hanya di APK dan hanya untuk playlist (lagu satuan punya menu Unduh sendiri).
        onDownloadAll={isNativeApp() && playlist.source !== 'search' ? handleDownloadAll : undefined}
        onAddToPlaylist={playlist.source === 'search' && playlist.tracks.length > 0 ? () => setPicking(true) : undefined}
        onAddToQueue={isSingleSearch && playlist.tracks.length > 0 ? handleAddToQueue : undefined}
      />

      {playlist.source !== 'search' && <AvailabilityPanel availability={availability} onManual={setManualFor} />}

      {manualFor && (
        <ManualSearchSheet
          track={manualFor}
          title={manualFor.title}
          onPicked={() => availability.recheckOne(manualFor)}
          onClose={() => setManualFor(null)}
          onToast={showToast}
        />
      )}

      {picking && playlist.tracks[0] && (
        <AddToPlaylistSheet
          track={playlist.tracks[0]}
          onClose={() => setPicking(false)}
          onDone={showToast}
        />
      )}

      <TrackList
        key={playlist.id}
        tracks={playlist.tracks}
        onPlay={player.selectTrack}
        playingTrackId={player.currentTrack?.id ?? null}
        playbackActivity={getRowActivity(player.status)}
        // Lagu satuan dari pencarian boleh masuk antrean lewat menu lagu; playlist tetap tidak dicampur.
        searchable={isSingleSearch}
        isLocked={checking ? isLocked : undefined}
      />
    </section>
  )
}
