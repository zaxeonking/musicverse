import { Download, RefreshCw } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useOverlayHistory } from '../../hooks/useOverlayHistory'
import Action from '../player/SheetAction'
import OverlayPortal from '../ui/OverlayPortal'

interface RefreshChoiceSheetProps {
  onClose: () => void
  /** Ambil ulang playlist Spotify asalnya dan tambahkan lagu baru (tanpa mengunduh). */
  onRefresh: () => void
  /** Ambil lagu baru lalu unduh yang belum terunduh. */
  onSync: () => void
}

/** Sheet bawah kecil: satu tombol pembaruan di halaman playlist, pilihannya di sini (muat data terbaru atau unduh yang baru). */
export default function RefreshChoiceSheet({ onClose, onRefresh, onSync }: RefreshChoiceSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null)
  useOverlayHistory(true, onClose)

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    sheetRef.current?.querySelector<HTMLElement>('button')?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      previous?.focus?.()
    }
  }, [onClose])

  const choose = (run: () => void) => () => {
    onClose()
    run()
  }

  return (
    <OverlayPortal>
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 animate-fade-in bg-black/60" />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label="Perbarui playlist"
        className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-md animate-sheet-up rounded-t-2xl border-t border-line bg-card pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-2xl shadow-black/60 lg:bottom-6 lg:rounded-2xl lg:border"
      >
        <p className="px-4 pb-3 pt-4 text-sm font-semibold text-ink">Perbarui playlist</p>
        <ul className="mv-list border-t border-line px-2 pt-2">
          <Action icon={RefreshCw} label="Muat data terbaru" hint="Tambahkan lagu baru dari Spotify, tanpa mengunduh" onClick={choose(onRefresh)} />
          <Action icon={Download} label="Unduh yang baru" hint="Tambahkan lagu baru dan unduh yang belum terunduh" onClick={choose(onSync)} />
        </ul>
      </div>
    </OverlayPortal>
  )
}
