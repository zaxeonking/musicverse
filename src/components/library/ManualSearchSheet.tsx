import { AlertCircle, Loader2, Music2, RotateCw } from 'lucide-react'
import { Component, useEffect, useState, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useOverlayHistory } from '../../hooks/useOverlayHistory'
import { downloadWithPick, findManualCandidates } from '../../native/downloads'
import { setManualPin } from '../../plugins/manualPins'
import { searchManualCandidates } from '../../plugins/registry'
import type { ManualCandidate } from '../../plugins/types'
import { formatTime } from '../../utils/formatTime'
import Action from '../player/SheetAction'
import { useExitGhost } from '../../hooks/useExitGhost'
import { useSheetDrag } from '../../hooks/useSheetDrag'

interface ManualSearchSheetProps {
  /** Kunci unduhan yang gagal (mode Unduhan). Kosongkan dan isi `track` untuk memilih sumber lagu di playlist. */
  transferKey?: string
  /** Mode playlist: lagu yang tidak ditemukan. Pilihan disimpan (dipakai lagi saat diputar/diunduh) tanpa mengunduh. */
  track?: { title: string; artists?: string }
  /** Dipanggil setelah pilihan tersimpan (mode playlist). */
  onPicked?: () => void
  title: string
  onClose: () => void
  onToast: (message: string) => void
}

/** Galat saat menampilkan hasil muncul DI DALAM sheet (bukan layar gelap tanpa isi), lengkap dengan tombol tutup. */
class SheetBoundary extends Component<{ children: ReactNode; onClose: () => void }, { message: string | null }> {
  state: { message: string | null } = { message: null }

  static getDerivedStateFromError(error: unknown): { message: string } {
    return { message: error instanceof Error ? error.message : String(error) }
  }

  componentDidCatch(error: unknown): void {
    console.error('[MusicVerse] Cari manual gagal ditampilkan:', error)
  }

  render(): ReactNode {
    if (this.state.message === null) return this.props.children
    return (
      <div className="px-4 py-4">
        <p className="flex items-start gap-2 text-sm text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          Terjadi galat: {this.state.message}
        </p>
        <button type="button" onClick={this.props.onClose} className="btn-secondary mt-3 h-11 w-full text-sm">
          Tutup
        </button>
      </div>
    )
  }
}

type SearchState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; results: ManualCandidate[] }

/**
 * Pilih manual saat pencarian otomatis gagal: sampai 5 hasil YouTube Music / YouTube dengan judul, artis, dan durasi.
 * Pengguna yang menentukan mana yang benar; audionya tetap diperiksa (terbaca, bukan cuplikan, durasi sesuai pilihan).
 */
export default function ManualSearchSheet({ transferKey, track, onPicked, title, onClose, onToast }: ManualSearchSheetProps) {
  const exitRef = useExitGhost()
  useSheetDrag(exitRef)
  useOverlayHistory(true, onClose)
  const [state, setState] = useState<SearchState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    const search = track ? searchManualCandidates(track) : transferKey ? findManualCandidates(transferKey) : Promise.resolve([] as ManualCandidate[])
    search.then(
      (results) => {
        if (!cancelled) setState({ status: 'ready', results })
      },
      (error: unknown) => {
        if (!cancelled) setState({ status: 'error', message: error instanceof Error ? error.message : 'Pencarian gagal.' })
      },
    )
    return () => {
      cancelled = true
    }
  }, [transferKey, track, attempt])

  const choose = (pick: ManualCandidate): void => {
    if (track) {
      // Mode playlist: simpan pilihan untuk lagu ini. Audionya diperiksa saat lagu diputar atau diunduh.
      if (setManualPin(track, pick)) {
        onToast(`Disimpan: “${pick.title}” dipakai untuk lagu ini`)
        onPicked?.()
      } else onToast('Pilihan tidak bisa disimpan (penyimpanan penuh atau tidak bisa diakses).')
    } else if (transferKey && downloadWithPick(transferKey, pick)) onToast(`Mengunduh “${pick.title}”`)
    else onToast('Tidak bisa memulai unduhan ini. Coba lagi dari daftar gagal.')
    onClose()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      onClose()
    }
  }

  // Portal ke <body>: lepas dari wadah halaman (transform / overflow) yang bisa menyembunyikan sheet di luar layar.
  return createPortal(
    <div ref={exitRef} className="fixed inset-0 z-[80]" style={{ position: 'fixed', inset: 0 }}>
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-black/60" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Cari manual untuk ${title}`}
        onKeyDown={onKeyDown}
        className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-md rounded-t-2xl border-t border-line bg-card pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] shadow-2xl shadow-black/60 lg:bottom-6 lg:rounded-2xl lg:border"
      >
        <div className="px-4 pb-3 pt-4">
          <p className="text-sm font-semibold text-ink">Pilih sumber yang benar</p>
          <p className="truncate text-xs text-ink-muted">{title}</p>
        </div>
        <div className="border-t border-line">
          <SheetBoundary onClose={onClose}>
          {state.status === 'loading' && (
            <p className="flex items-center gap-3 px-4 py-5 text-sm text-ink-muted">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Mencari di YouTube Music dan YouTube…
            </p>
          )}
          {state.status === 'error' && (
            <div className="px-4 py-4">
              <p className="flex items-start gap-2 text-sm text-danger">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                {state.message}
              </p>
              <button type="button" onClick={() => setAttempt((n) => n + 1)} className="btn-secondary mt-3 h-11 w-full text-sm">
                <RotateCw className="h-4 w-4" aria-hidden="true" />
                Coba lagi
              </button>
            </div>
          )}
          {state.status === 'ready' && state.results.length === 0 && (
            <p className="px-4 py-5 text-sm text-ink-muted">Tidak ada hasil. Lagu ini mungkin memang tidak ada di YouTube Music maupun YouTube.</p>
          )}
          {state.status === 'ready' && state.results.length > 0 && (
            <>
              <ul className="mv-list max-h-[50dvh] overflow-y-auto px-2 pt-2">
                {state.results.map((hit) => (
                  <Action
                    key={`${hit.pluginId}:${hit.id}`}
                    icon={Music2}
                    label={hit.title}
                    hint={[hit.artist, hit.durationSec !== null ? formatTime(hit.durationSec) : 'durasi ?', hit.pluginName].filter(Boolean).join(' · ')}
                    onClick={() => choose(hit)}
                  />
                ))}
              </ul>
              <p className="px-4 pb-1 pt-3 text-xs text-ink-muted">
                Pilih yang durasinya paling sesuai. Audionya tetap diperiksa saat diputar atau diunduh; yang cuplikan atau bukan audio ditolak.
              </p>
            </>
          )}
          </SheetBoundary>
        </div>
      </div>
    </div>,
    document.body,
  )
}
