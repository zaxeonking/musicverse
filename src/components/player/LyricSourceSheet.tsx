import { Check, Circle, Sparkles } from 'lucide-react'
import { useSyncExternalStore } from 'react'
import { markLyricsSourceChange } from '../../hooks/useLyrics'
import { useOverlayHistory } from '../../hooks/useOverlayHistory'
import type { PlaylistTrack } from '../../types/spotify'
import { getLyricSourcePin, LYRIC_SOURCES, setLyricSourcePin, subscribeLyricSourcePins, type LyricSourceId } from '../../utils/lyricSourcePins'
import OverlayPortal from '../ui/OverlayPortal'
import Action from './SheetAction'

/** Menu bawah "Sumber lirik": pilih sumber lirik untuk lagu ini saja (diingat), atau kembali ke otomatis. */
export default function LyricSourceSheet({ track, onClose }: { track: PlaylistTrack; onClose: () => void }) {
  const pin = useSyncExternalStore(subscribeLyricSourcePins, () => getLyricSourcePin(track))
  useOverlayHistory(true, onClose)

  const choose = (source: LyricSourceId | null) => {
    if (source !== pin) {
      markLyricsSourceChange(track)
      setLyricSourcePin(track, source)
    }
    onClose()
  }

  return (
    <OverlayPortal>
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 animate-fade-in bg-black/60" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Sumber lirik"
        onKeyDown={(event) => {
          event.stopPropagation()
          if (event.key === 'Escape') onClose()
        }}
        className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-md animate-sheet-up rounded-t-2xl border-t border-line bg-card pb-[max(0.75rem,var(--sab))] pl-[var(--sal)] pr-[var(--sar)] shadow-2xl shadow-black/60 lg:bottom-6 lg:rounded-2xl lg:border"
      >
        <div className="px-4 pb-3 pt-4">
          <p className="text-sm font-semibold text-ink">Sumber lirik</p>
          <p role="status" className="mt-0.5 text-xs text-ink-muted">
            Lirik tiap sumber bisa berbeda. Pilihanmu berlaku untuk lagu ini saja dan diingat.
          </p>
        </div>
        <ul className="mv-list max-h-[60vh] overflow-y-auto border-t border-line px-2 pt-2">
          <Action
            icon={pin === null ? Check : Sparkles}
            label="Otomatis"
            hint="Ikuti prioritas di Pengaturan > Pemutaran"
            onClick={() => choose(null)}
          />
          {LYRIC_SOURCES.map((source) => (
            <Action key={source.id} icon={pin === source.id ? Check : Circle} label={source.label} hint={source.hint} onClick={() => choose(source.id)} />
          ))}
        </ul>
      </div>
    </OverlayPortal>
  )
}
