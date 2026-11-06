import { ListMusic, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useOverlayHistory } from '../../hooks/useOverlayHistory'
import type { SavedPlaylist } from '../../types/library'
import { fallbackCover } from '../../utils/fallbackCover'
import Action from '../player/SheetAction'
import CoverArt from '../ui/CoverArt'
import OverlayPortal from '../ui/OverlayPortal'

interface SavedPlaylistMenuSheetProps {
  playlist: SavedPlaylist
  onClose: () => void
  onOpen: (playlist: SavedPlaylist) => void
  onRemove: (playlist: SavedPlaylist) => void
}

/** Menu kecil satu playlist tersimpan (tahan lama pada kartunya): buka, hapus dari Koleksi. */
export default function SavedPlaylistMenuSheet({ playlist, onClose, onOpen, onRemove }: SavedPlaylistMenuSheetProps) {
  useOverlayHistory(true, onClose)
  const sheetRef = useRef<HTMLDivElement>(null)
  const [confirming, setConfirming] = useState(false)
  const fallback = useMemo(() => fallbackCover(playlist.title), [playlist.title])
  const count = playlist.tracks.length

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    return () => previous?.focus?.()
  }, [])
  useEffect(() => {
    sheetRef.current?.querySelector<HTMLElement>('button:not([disabled])')?.focus()
  }, [confirming])

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
        aria-label={`Opsi untuk playlist ${playlist.title}`}
        onKeyDown={onKeyDown}
        className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-md animate-sheet-up rounded-t-2xl border-t border-line bg-card pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] shadow-2xl shadow-black/60 lg:bottom-6 lg:rounded-2xl lg:border"
      >
        <div className="flex items-center gap-3 px-4 pb-3 pt-4">
          <span className="w-12 shrink-0">
            <CoverArt cover={fallback} src={playlist.cover} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-ink">{playlist.title}</span>
            <span className="block truncate text-xs text-ink-muted">Tersimpan · {count} lagu</span>
          </span>
        </div>

        {confirming ? (
          <div className="border-t border-line px-4 pb-2 pt-4" role="group" aria-label={`Konfirmasi hapus ${playlist.title}`}>
            <p className="text-sm text-ink">Hapus dari Koleksi?</p>
            <p className="mt-1 text-xs text-ink-muted">Yang dihapus hanya salinan di Koleksi. Playlist aslinya tidak berubah.</p>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setConfirming(false)} className="btn-secondary flex-1 px-4">
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  onRemove(playlist)
                  onClose()
                }}
                className="btn-danger flex-1 px-4"
              >
                Hapus
              </button>
            </div>
          </div>
        ) : (
          <ul className="border-t border-line px-2 pt-2">
            <Action
              icon={ListMusic}
              label="Buka playlist"
              onClick={() => {
                onClose()
                onOpen(playlist)
              }}
            />
            <Action icon={Trash2} label="Hapus dari Koleksi" hint="Hanya salinan di Koleksi" danger onClick={() => setConfirming(true)} />
          </ul>
        )}
      </div>
    </OverlayPortal>
  )
}
