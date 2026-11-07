import { Check, Lock } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useOverlayHistory } from '../../hooks/useOverlayHistory'
import type { LibraryView } from '../../types/library'
import { fallbackCover } from '../../utils/fallbackCover'
import CoverArt from '../ui/CoverArt'

interface SelectableCardProps {
  title: string
  subtitle: string
  cover?: string
  layout: LibraryView
  selected: boolean
  /** Tidak bisa dipilih (mis. "Lagu Disukai" bawaan). */
  locked?: boolean
  onToggle: () => void
}

/** Kartu playlist saat mode pilih banyak: ketuk = pilih / batal pilih (tidak membuka playlist, tidak ada menu tahan lama). */
export function SelectableCard({ title, subtitle, cover, layout, selected, locked = false, onToggle }: SelectableCardProps) {
  const fallback = useMemo(() => fallbackCover(title), [title])
  const box = (
    <span
      aria-hidden="true"
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
        locked ? 'border-line text-ink-muted' : selected ? 'animate-pop border-accent bg-accent text-black' : 'border-ink-muted text-transparent'
      }`}
    >
      {locked ? <Lock className="h-3 w-3" /> : <Check className="h-4 w-4" strokeWidth={3} />}
    </span>
  )
  const state = locked ? 'Bawaan, tidak bisa dipilih' : selected ? 'Dipilih' : 'Belum dipilih'

  if (layout === 'list') {
    return (
      <li>
        <button
          type="button"
          role="checkbox"
          aria-checked={selected}
          aria-disabled={locked}
          aria-label={`${title}. ${state}`}
          onClick={locked ? undefined : onToggle}
          className={`flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors focus-ring ${
            locked ? 'opacity-50' : selected ? 'bg-accent/10' : 'hover:bg-raised'
          }`}
        >
          <span className="mv-slide-x flex shrink-0">{box}</span>
          <span className="w-14 shrink-0">
            <CoverArt cover={fallback} src={cover} />
          </span>
          <span className="min-w-0 flex-1">
            <span title={title} className="block truncate font-medium text-ink">{title}</span>
            <span className="block truncate text-sm text-ink-muted">{subtitle}</span>
          </span>
        </button>
      </li>
    )
  }

  return (
    <li>
      <button
        type="button"
        role="checkbox"
        aria-checked={selected}
        aria-disabled={locked}
        aria-label={`${title}. ${state}`}
        onClick={locked ? undefined : onToggle}
        className={`relative flex h-full w-full flex-col rounded-lg p-3 text-left transition-colors focus-ring ${
          locked ? 'bg-card opacity-50' : selected ? 'bg-accent/15 ring-2 ring-accent' : 'bg-card hover:bg-raised'
        }`}
      >
        <span className="mv-pop absolute right-4 top-4 z-10">{box}</span>
        <span className="mb-3 block">
          <CoverArt cover={fallback} src={cover} className="shadow-lg shadow-black/40" />
        </span>
        <span title={title} className="line-clamp-2 break-words font-display text-base font-bold leading-snug text-ink">{title}</span>
        <span className="mt-1 line-clamp-2 break-words text-sm text-ink-muted">{subtitle}</span>
      </button>
    </li>
  )
}

interface SelectionBarProps {
  count: number
  total: number
  onSelectAll: () => void
  onClear: () => void
  onCancel: () => void
  onDelete: () => void
}

/**
 * Bilah mode pilih banyak. Hanya dirender selama mode aktif, jadi Back (Android) cukup keluar dari mode ini.
 * Menghapus butuh konfirmasi di bilah ini juga, supaya ketukan yang tidak sengaja tidak langsung menghapus.
 */
export function SelectionBar({ count, total, onSelectAll, onClear, onCancel, onDelete }: SelectionBarProps) {
  useOverlayHistory(true, onCancel)
  const [confirming, setConfirming] = useState(false)
  const allSelected = total > 0 && count >= total

  return (
    <div
      role="region"
      aria-label="Mode pilih playlist"
      className="mv-drop sticky top-0 z-10 -mx-4 bg-bg px-4 py-2 lg:-mx-8 lg:px-8"
    >
      <div className="rounded-lg bg-card px-3 py-2">
        {confirming ? (
          <div role="group" aria-label={`Konfirmasi hapus ${count} playlist`}>
            <p className="text-sm text-ink">Hapus {count} playlist?</p>
            <p className="mt-1 text-xs text-ink-muted">Hanya daftarnya yang dihapus. Berkas lagu yang sudah diunduh tidak ikut terhapus.</p>
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
              {count === 0 ? 'Pilih playlist' : `${count} dipilih`}
            </p>
            <button type="button" onClick={allSelected ? onClear : onSelectAll} className="btn-secondary h-10 px-4">
              {allSelected ? 'Batal pilih' : 'Pilih semua'}
            </button>
            <button type="button" disabled={count === 0} onClick={() => setConfirming(true)} className="btn-danger h-10 px-4">
              Hapus
            </button>
            <button type="button" onClick={onCancel} className="btn-secondary h-10 px-4">
              Selesai
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
