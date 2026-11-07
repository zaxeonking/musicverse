import { ArrowRightLeft, Copy, ListMusic, Pencil, Pin, PinOff, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLibrary } from '../../context/LibraryContext'
import { myPlaylistErrorText, useMyPlaylists } from '../../context/MyPlaylistsContext'
import { useOverlayHistory } from '../../hooks/useOverlayHistory'
import type { ToastAction } from '../../context/TrackMenuContext'
import type { MyPlaylist } from '../../types/library'
import { fallbackCover } from '../../utils/fallbackCover'
import { isLikedId } from '../../utils/myPlaylistStorage'
import Action from '../player/SheetAction'
import CoverArt from '../ui/CoverArt'
import NewPlaylistForm from './NewPlaylistForm'
import PlaylistTransferPanel from './PlaylistTransferPanel'
import OverlayPortal from '../ui/OverlayPortal'

interface PlaylistMenuSheetProps {
  playlist: MyPlaylist
  onClose: () => void
  onToast: (message: string, action?: ToastAction) => void
}

/** Menu kecil satu playlist buatanmu (tahan lama pada kartunya): buka, ganti nama, sematkan, salin/pindahkan semua lagu, hapus playlist. */
export default function PlaylistMenuSheet({ playlist, onClose, onToast }: PlaylistMenuSheetProps) {
  useOverlayHistory(true, onClose)
  const navigate = useNavigate()
  const { setPinned, renamePlaylist, deletePlaylist, restorePlaylist } = useMyPlaylists()
  const { removePlaylist: removeSaved } = useLibrary()
  const sheetRef = useRef<HTMLDivElement>(null)
  const [mode, setMode] = useState<'copy' | 'move' | 'delete' | 'rename' | null>(null)
  const fallback = useMemo(() => fallbackCover(playlist.name), [playlist.name])
  const count = playlist.tracks.length

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    return () => previous?.focus?.()
  }, [])
  useEffect(() => {
    sheetRef.current?.querySelector<HTMLElement>('input, button:not([disabled])')?.focus()
  }, [mode])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      onClose()
    }
  }

  return (
    <OverlayPortal>
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 animate-fade-in bg-black/60" />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Opsi untuk playlist ${playlist.name}`}
        onKeyDown={onKeyDown}
        className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-md animate-sheet-up rounded-t-2xl border-t border-line bg-card pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] shadow-2xl shadow-black/60 lg:bottom-6 lg:rounded-2xl lg:border"
      >
        <div className="flex items-center gap-3 px-4 pb-3 pt-4">
          <span className="w-12 shrink-0">
            <CoverArt cover={fallback} src={playlist.tracks[0]?.cover} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-ink">{playlist.name}</span>
            <span className="block truncate text-xs text-ink-muted">{count === 0 ? 'Kosong' : `${count} lagu`}</span>
          </span>
        </div>

        {mode === 'rename' ? (
          <div className="border-t border-line px-4 pb-2 pt-4">
            <NewPlaylistForm
              initialValue={playlist.name}
              submitLabel="Simpan"
              onCancel={() => setMode(null)}
              onCreate={(name) => {
                const result = renamePlaylist(playlist.id, name)
                if (!result.ok) return myPlaylistErrorText(result.reason)
                onToast(`Nama playlist diganti jadi "${result.value.name}"`)
                onClose()
                return null
              }}
            />
          </div>
        ) : mode === 'delete' ? (
          <div className="border-t border-line px-4 pb-2 pt-4" role="group" aria-label={`Konfirmasi hapus ${playlist.name}`}>
            <p className="text-sm text-ink">Hapus playlist ini?</p>
            <p className="mt-1 text-xs text-ink-muted">
              {count === 0 ? 'Playlist kosong ini akan dihapus.' : `${count} lagu di playlist ini ikut terhapus dari daftar.`} Berkas lagu yang sudah diunduh tidak ikut dihapus.
            </p>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setMode(null)} className="btn-secondary flex-1 px-4">
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  const result = deletePlaylist(playlist.id)
                  if (!result.ok) {
                    onToast(myPlaylistErrorText(result.reason))
                    return onClose()
                  }
                  // Playlist hasil "Unduh semua": kartu Spotify-nya yang tadi disembunyikan ikut dilepas, supaya tidak muncul lagi.
                  if (playlist.sourceId) removeSaved(playlist.sourceId)
                  onToast(`Playlist "${playlist.name}" dihapus`, {
                    label: 'Urungkan',
                    onClick: () => {
                      const restored = restorePlaylist(playlist)
                      onToast(restored.ok ? `Playlist "${playlist.name}" dikembalikan` : myPlaylistErrorText(restored.reason))
                    },
                  })
                  onClose()
                }}
                className="btn-danger flex-1 px-4"
              >
                Hapus
              </button>
            </div>
          </div>
        ) : mode ? (
          <PlaylistTransferPanel
            source={playlist}
            trackIds={null}
            mode={mode}
            onBack={() => setMode(null)}
            onDone={(message) => {
              onToast(message)
              onClose()
            }}
          />
        ) : (
          <ul className="border-t border-line px-2 pt-2">
            <Action
              icon={ListMusic}
              label="Buka playlist"
              onClick={() => {
                onClose()
                navigate(`/my/${playlist.id}`)
              }}
            />
            {!isLikedId(playlist.id) && <Action icon={Pencil} label="Ganti nama" onClick={() => setMode('rename')} />}
            {!isLikedId(playlist.id) && (
              <Action
                icon={playlist.pinned ? PinOff : Pin}
                label={playlist.pinned ? 'Lepas sematan' : 'Sematkan di atas'}
                hint="Disematkan tampil tepat di bawah Lagu Disukai"
                onClick={() => {
                  const result = setPinned(playlist.id, !playlist.pinned)
                  onToast(result.ok ? (result.value.pinned ? 'Playlist disematkan di atas' : 'Sematan dilepas') : myPlaylistErrorText(result.reason))
                  onClose()
                }}
              />
            )}
            <Action
              icon={Copy}
              label="Salin semua lagu ke playlist lain"
              hint="Lagu tetap ada di playlist ini"
              onClick={() => setMode('copy')}
              disabled={count === 0}
            />
            <Action
              icon={ArrowRightLeft}
              label="Pindahkan semua lagu ke playlist lain"
              hint="Lagu dihapus dari playlist ini"
              onClick={() => setMode('move')}
              disabled={count === 0}
            />
            {!isLikedId(playlist.id) && (
              <Action icon={Trash2} label="Hapus playlist" hint="Hanya menghapus daftarnya, bukan berkas unduhan" danger onClick={() => setMode('delete')} />
            )}
          </ul>
        )}
      </div>
    </OverlayPortal>
  )
}
