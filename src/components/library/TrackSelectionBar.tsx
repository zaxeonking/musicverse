import { ArrowRightLeft, Copy, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useOverlayHistory } from '../../hooks/useOverlayHistory'

interface TrackSelectionBarProps {
  count: number
  total: number
  onSelectAll: () => void
  onClear: () => void
  onCancel: () => void
  onCopy: () => void
  onMove: () => void
  onDelete: () => void
}

/**
 * Bilah mode pilih banyak untuk lagu di satu playlist: Salin, Pindahkan, Hapus. Hanya dirender selama mode aktif,
 * jadi Back (Android) cukup keluar dari mode ini. Hapus butuh konfirmasi di bilah ini juga.
 */
export default function TrackSelectionBar({ count, total, onSelectAll, onClear, onCancel, onCopy, onMove, onDelete }: TrackSelectionBarProps) {
  useOverlayHistory(true, onCancel)
  const [confirming, setConfirming] = useState(false)
  const allSelected = total > 0 && count >= total

  return (
    <div role="region" aria-label="Mode pilih lagu" className="mv-drop sticky top-0 z-10 -mx-4 bg-bg px-4 py-2 lg:-mx-8 lg:px-8">
      <div className="rounded-lg bg-card px-3 py-2">
        {confirming ? (
          <div role="group" aria-label={`Konfirmasi hapus ${count} lagu`}>
            <p className="text-sm text-ink">Hapus {count} lagu dari playlist ini?</p>
            <p className="mt-1 text-xs text-ink-muted">Lagunya tetap ada di playlist lain dan berkas yang sudah diunduh tidak ikut terhapus.</p>
            <div className="mt-3 flex gap-2">
              <button type="button" autoFocus onClick={() => setConfirming(false)} className="btn-secondary flex-1 px-4">
                Batal
              </button>
              <button type="button" onClick={onDelete} className="btn-danger flex-1 px-4">
                Hapus {count}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <p role="status" className="min-w-0 flex-1 basis-24 text-sm font-semibold text-ink">
              {count === 0 ? 'Pilih lagu' : `${count} dipilih`}
            </p>
            <button type="button" onClick={allSelected ? onClear : onSelectAll} className="btn-secondary h-10 px-4">
              {allSelected ? 'Batal pilih' : 'Pilih semua'}
            </button>
            <button type="button" onClick={onCancel} className="btn-secondary h-10 px-4">
              Selesai
            </button>
            <div className="flex basis-full items-center justify-end gap-2">
              <button type="button" disabled={count === 0} onClick={onCopy} aria-label="Salin ke playlist lain" title="Salin ke playlist lain" className="icon-btn h-10 w-10 bg-raised disabled:opacity-40">
                <Copy className="h-5 w-5" aria-hidden="true" />
              </button>
              <button type="button" disabled={count === 0} onClick={onMove} aria-label="Pindahkan ke playlist lain" title="Pindahkan ke playlist lain" className="icon-btn h-10 w-10 bg-raised disabled:opacity-40">
                <ArrowRightLeft className="h-5 w-5" aria-hidden="true" />
              </button>
              <button type="button" disabled={count === 0} onClick={() => setConfirming(true)} aria-label="Hapus dari playlist" title="Hapus dari playlist" className="icon-btn h-10 w-10 bg-raised text-danger disabled:opacity-40">
                <Trash2 className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
