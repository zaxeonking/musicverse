import { useEffect, useRef } from 'react'
import { useOverlayHistory } from '../../hooks/useOverlayHistory'
import type { MyPlaylist } from '../../types/library'
import OverlayPortal from '../ui/OverlayPortal'
import PlaylistTransferPanel from './PlaylistTransferPanel'

interface TrackTransferSheetProps {
  source: MyPlaylist
  /** ID lagu terpilih di `source`. */
  trackIds: readonly string[]
  mode: 'copy' | 'move'
  onClose: () => void
  /** Transfer selesai (pesan hasil untuk toast). Sheet ditutup oleh pemanggil. */
  onDone: (message: string) => void
}

/** Sheet bawah untuk menyalin / memindahkan lagu terpilih ke playlist lain (memakai panel yang sama dengan menu lagu). */
export default function TrackTransferSheet({ source, trackIds, mode, onClose, onDone }: TrackTransferSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null)
  useOverlayHistory(true, onClose)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <OverlayPortal>
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 animate-fade-in bg-black/60" />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={mode === 'copy' ? 'Salin lagu terpilih' : 'Pindahkan lagu terpilih'}
        className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-md animate-sheet-up rounded-t-2xl border-t border-line bg-card pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl shadow-black/60 lg:bottom-6 lg:rounded-2xl lg:border"
      >
        <PlaylistTransferPanel source={source} trackIds={trackIds} mode={mode} onBack={onClose} onDone={onDone} />
      </div>
    </OverlayPortal>
  )
}
