import { ArrowRightLeft, Copy, ListMusic } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOverlayHistory } from '../../hooks/useOverlayHistory'
import type { MyPlaylist } from '../../types/library'
import { fallbackCover } from '../../utils/fallbackCover'
import Action from '../player/SheetAction'
import CoverArt from '../ui/CoverArt'
import PlaylistTransferPanel from './PlaylistTransferPanel'
import OverlayPortal from '../ui/OverlayPortal'

interface PlaylistMenuSheetProps {
  playlist: MyPlaylist
  onClose: () => void
  onToast: (message: string) => void
}

/** Menu kecil satu playlist buatanmu (tahan lama pada kartunya): buka, salin semua lagu, pindahkan semua lagu. */
export default function PlaylistMenuSheet({ playlist, onClose, onToast }: PlaylistMenuSheetProps) {
  useOverlayHistory(true, onClose)
  const navigate = useNavigate()
  const sheetRef = useRef<HTMLDivElement>(null)
  const [mode, setMode] = useState<'copy' | 'move' | null>(null)
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

        {mode ? (
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
          </ul>
        )}
      </div>
    </OverlayPortal>
  )
}
