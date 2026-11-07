import { Check, Gauge } from 'lucide-react'
import { useOverlayHistory } from '../../hooks/useOverlayHistory'
import { setPlaybackSpeed, SPEED_OPTIONS, speedLabel, usePlaybackSpeed } from '../../services/playbackSpeed'
import OverlayPortal from '../ui/OverlayPortal'
import Action from './SheetAction'

/** Menu bawah untuk memilih kecepatan putar (nada tetap). Tersimpan dan berlaku untuk semua lagu. */
export default function SpeedSheet({ onClose }: { onClose: () => void }) {
  const speed = usePlaybackSpeed()
  useOverlayHistory(true, onClose)
  return (
    <OverlayPortal>
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 animate-fade-in bg-black/60" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Kecepatan putar"
        onKeyDown={(event) => {
          event.stopPropagation()
          if (event.key === 'Escape') onClose()
        }}
        className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-md animate-sheet-up rounded-t-2xl border-t border-line bg-card pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] shadow-2xl shadow-black/60 lg:bottom-6 lg:rounded-2xl lg:border"
      >
        <div className="px-4 pb-3 pt-4">
          <p className="text-sm font-semibold text-ink">Kecepatan putar</p>
          <p role="status" className="mt-0.5 text-xs text-ink-muted">
            Nada suara tetap sama. Berlaku untuk semua lagu.
          </p>
        </div>
        <ul className="mv-list max-h-[60vh] overflow-y-auto border-t border-line px-2 pt-2">
          {SPEED_OPTIONS.map((option) => (
            <Action
              key={option}
              icon={option === speed ? Check : Gauge}
              label={option === 1 ? 'Normal (1x)' : speedLabel(option)}
              onClick={() => {
                setPlaybackSpeed(option)
                onClose()
              }}
            />
          ))}
        </ul>
      </div>
    </OverlayPortal>
  )
}
