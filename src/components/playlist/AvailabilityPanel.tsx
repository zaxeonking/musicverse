import { AlertTriangle, CheckCircle2, ChevronDown, Loader2, RotateCw, Search, WifiOff } from 'lucide-react'
import { useState } from 'react'
import type { TrackAvailabilityState } from '../../hooks/useTrackAvailability'
import type { PlaylistTrack } from '../../types/spotify'

interface AvailabilityPanelProps {
  availability: TrackAvailabilityState
  /** Buka Cari manual untuk lagu yang tidak ditemukan. */
  onManual: (track: PlaylistTrack) => void
}

/** Ringkasan pengecekan ketersediaan audio playlist, dengan daftar lagu yang tidak ditemukan dan tombol Cari manual. */
export default function AvailabilityPanel({ availability, onManual }: AvailabilityPanelProps) {
  const { running, offline, done, total, missing, unknownCount, rerun } = availability
  const [open, setOpen] = useState(false)

  if (total === 0) return null

  if (offline) {
    return (
      <div role="status" className="flex items-center gap-3 rounded-lg bg-card px-4 py-3 text-sm text-ink-muted">
        <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
        Offline. Pengecekan audio dilanjutkan saat ada koneksi.
      </div>
    )
  }

  if (running) {
    const percent = Math.round((done / total) * 100)
    return (
      <div role="status" className="rounded-lg bg-card px-4 py-3 text-sm text-ink">
        <p className="flex items-center gap-3">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          <span className="min-w-0 flex-1">Memeriksa audio lagu… {done}/{total}</span>
        </p>
        <p className="mt-1 pl-7 text-xs text-ink-muted">Lagu bisa diputar setelah selesai dicek.</p>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-raised" aria-hidden="true">
          <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${percent}%` }} />
        </div>
      </div>
    )
  }

  if (missing.length === 0 && unknownCount === 0) {
    return (
      <div role="status" className="flex items-center gap-3 rounded-lg bg-card px-4 py-3 text-sm text-ink-muted">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
        <span className="min-w-0 flex-1">Audio ditemukan untuk semua {total} lagu.</span>
        <button type="button" onClick={rerun} className="btn-secondary h-9 px-3">
          <RotateCw className="h-4 w-4" aria-hidden="true" />
          Cek ulang
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-lg bg-card text-sm text-ink">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <AlertTriangle className="h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
        <p className="min-w-0 flex-1">
          {missing.length > 0 && <span>{missing.length} lagu tidak ditemukan. </span>}
          {unknownCount > 0 && <span className="text-ink-muted">{unknownCount} lagu belum bisa dicek (sinyal atau server). </span>}
        </p>
        {missing.length > 0 && (
          <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="btn-secondary h-9 px-3">
            {open ? 'Tutup' : 'Lihat'}
            <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
        )}
        <button type="button" onClick={rerun} className="btn-secondary h-9 px-3">
          <RotateCw className="h-4 w-4" aria-hidden="true" />
          Cek ulang
        </button>
      </div>
      {open && missing.length > 0 && (
        <ul className="mv-list border-t border-line">
          {missing.map((track) => (
            <li key={track.id} className="flex items-center gap-3 px-4 py-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{track.title}</span>
                <span className="block truncate text-xs text-ink-muted">{track.artists}</span>
              </span>
              <button type="button" onClick={() => onManual(track)} className="btn-secondary h-9 shrink-0 px-3">
                <Search className="h-4 w-4" aria-hidden="true" />
                Cari manual
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
