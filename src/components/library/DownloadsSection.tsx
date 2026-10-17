import { AlertCircle, Download, Loader2, Play, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useAudioPlayer } from '../../hooks/useAudioPlayer'
import { cancelQueued, dismissTransferError } from '../../native/downloads'
import {
  coverSrcFor,
  removeDownload,
  toPlaylistTrack,
  totalBytes,
  useOffline,
  type DownloadedTrack,
  type Transfer,
} from '../../native/offline'
import { fallbackCover } from '../../utils/fallbackCover'
import CoverArt from '../ui/CoverArt'
import EmptyState from '../ui/EmptyState'
import SectionHeader from '../ui/SectionHeader'

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function transferLabel(transfer: Transfer): string {
  switch (transfer.status) {
    case 'queued':
      return 'Menunggu antrean'
    case 'resolving':
      return 'Menyiapkan…'
    case 'downloading':
      if (transfer.percent !== null) return `Mengunduh ${transfer.percent}%`
      return transfer.bytes ? `Mengunduh… ${formatBytes(transfer.bytes)}` : 'Mengunduh…'
    case 'error':
      return transfer.message ?? 'Unduhan gagal'
  }
}

function DownloadedRow({ item, onPlay }: { item: DownloadedTrack; onPlay: () => void }) {
  const [cover, setCover] = useState<string | undefined>(item.cover || undefined)
  useEffect(() => {
    let cancelled = false
    void coverSrcFor(item).then((src) => {
      if (!cancelled && src) setCover(src)
    })
    return () => {
      cancelled = true
    }
  }, [item])
  const fallback = useMemo(() => fallbackCover(`${item.title}${item.album}`), [item.title, item.album])
  return (
    <li className="flex items-center gap-3 rounded-md px-2 py-2">
      <button type="button" onClick={onPlay} aria-label={`Putar ${item.title}`} className="flex min-w-0 flex-1 items-center gap-3 text-left focus-ring">
        <span className="w-12 shrink-0">
          <CoverArt cover={fallback} src={cover} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-medium text-ink">{item.title}</span>
          <span className="block truncate text-sm text-ink-muted">
            {item.artists} · {formatBytes(item.bytes)}
          </span>
        </span>
        <Play className="h-5 w-5 shrink-0 text-ink-muted" aria-hidden="true" />
      </button>
      <button type="button" onClick={() => void removeDownload(item.key)} aria-label={`Hapus unduhan ${item.title}`} className="icon-btn shrink-0 text-ink-muted">
        <Trash2 className="h-5 w-5" aria-hidden="true" />
      </button>
    </li>
  )
}

/** Bagian "Unduhan" di Koleksi (hanya APK): lagu yang bisa diputar offline + progres unduhan. */
export default function DownloadsSection() {
  const { items, transfers } = useOffline()
  const player = useAudioPlayer()
  const tracks = useMemo(() => items.map(toPlaylistTrack), [items])
  const pending = [...transfers.values()]

  return (
    <section aria-label="Unduhan">
      <SectionHeader
        title="Unduhan"
        subtitle={items.length > 0 ? `${items.length} lagu · ${formatBytes(totalBytes(items))} · bisa diputar offline` : 'Lagu yang disimpan untuk diputar offline'}
      />

      {pending.length > 0 && (
        <ul className="mb-3 space-y-2">
          {pending.map((transfer) => {
            const name = transfer.title ?? tracks.find((t) => t.id === transfer.key)?.title
            const active = transfer.status === 'downloading' || transfer.status === 'resolving'
            return (
              <li key={transfer.key} className="flex items-center gap-3 rounded-lg bg-card px-4 py-3 text-sm text-ink">
                {transfer.status === 'error' ? (
                  <AlertCircle className="h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
                ) : (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-accent" aria-hidden="true" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{name ?? 'Lagu'}</span>
                  <span className={`block text-xs ${transfer.status === 'error' ? 'select-text break-words text-danger' : 'truncate text-ink-muted'}`}>
                    {transferLabel(transfer)}
                  </span>
                  {active && (
                    <span
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={transfer.percent ?? undefined}
                      className="mt-2 block h-1 overflow-hidden rounded-full bg-white/10"
                    >
                      <span
                        className={`block h-full rounded-full bg-accent ${transfer.percent === null ? 'w-1/3 animate-pulse' : 'transition-[width] duration-300'}`}
                        style={transfer.percent === null ? undefined : { width: `${transfer.percent}%` }}
                      />
                    </span>
                  )}
                </span>
                {(transfer.status === 'queued' || transfer.status === 'error') && (
                  <button
                    type="button"
                    aria-label="Tutup"
                    onClick={() => (transfer.status === 'queued' ? cancelQueued(transfer.key) : dismissTransferError(transfer.key))}
                    className="icon-btn -my-2 -mr-2"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {items.length === 0 ? (
        <EmptyState
          compact
          icon={Download}
          title="Belum ada unduhan"
          description="Tahan lama sebuah lagu, lalu pilih “Unduh untuk offline”. Berkasnya disimpan di Android/data/<nama aplikasi>/files/download."
        />
      ) : (
        <ul className="-mx-2">
          {items.map((item, index) => (
            <DownloadedRow key={item.key} item={item} onPlay={() => player.playList(tracks, index)} />
          ))}
        </ul>
      )}
    </section>
  )
}
