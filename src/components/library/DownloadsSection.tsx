import { AlertCircle, Download, Loader2, Pause, Play, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { usePlayerUiActions } from '../../context/PlayerUiContext'
import { useTrackMenu } from '../../context/TrackMenuContext'
import { useAudioPlayer } from '../../hooks/useAudioPlayer'
import { useLongPress } from '../../hooks/useLongPress'
import { cancelQueued, dismissTransferError } from '../../native/downloads'
import {
  coverSrcFor,
  removeDownload,
  toPlaylistTrack,
  totalBytes,
  trackKey,
  useOffline,
  type DownloadedTrack,
  type Transfer,
} from '../../native/offline'
import { fallbackCover } from '../../utils/fallbackCover'
import { getRowActivity } from '../../utils/playerStatus'
import type { RowActivity } from '../../types/player'
import type { PlaylistTrack } from '../../types/spotify'
import CoverArt from '../ui/CoverArt'
import EmptyState from '../ui/EmptyState'

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

interface DownloadedRowProps {
  item: DownloadedTrack
  track: PlaylistTrack
  selected: boolean
  /** Status playback jika ini lagu aktif di pemutar; 'none' untuk lagu lain. */
  activity: RowActivity
  onSelect: () => void
  /** Memutar lagu ini dari daftar unduhan. */
  onPlay: () => void
  /** Jeda / lanjutkan lagu aktif. */
  onToggle: () => void
}

function DownloadedRow({ item, track, selected, activity, onSelect, onPlay, onToggle }: DownloadedRowProps) {
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
  const { openTrackMenu } = useTrackMenu()
  const { openFullPlayer } = usePlayerUiActions()
  // Tahan lama: menu lagu yang sama dengan di playlist (tambah ke playlist, antrean, hapus unduhan, dst.).
  // Lagu unduhan berdiri sendiri, jadi boleh dimasukkan ke antrean mana pun (seperti hasil Cari).
  const longPress = useLongPress(() => openTrackMenu(track, { fromSearch: true }))
  const isCurrent = activity !== 'none'
  const highlighted = selected || isCurrent
  const Icon = activity === 'playing' ? Pause : activity === 'loading' ? Loader2 : Play
  const playLabel =
    activity === 'playing'
      ? `Jeda ${item.title}`
      : activity === 'loading'
        ? `Memuat ${item.title}`
        : activity === 'paused'
          ? `Lanjutkan ${item.title}`
          : `Putar ${item.title}`

  return (
    <li
      aria-current={isCurrent ? 'true' : undefined}
      onClick={() => {
        onSelect()
        // Ketuk biasa: putar lagu (kecuali sudah aktif) lalu buka pemutar penuh, sama seperti baris playlist.
        if (activity === 'none' || activity === 'error' || activity === 'ended') onPlay()
        openFullPlayer()
      }}
      {...longPress}
      className={`flex select-none cursor-pointer items-center gap-3 rounded-md px-2 py-2 transition-colors [-webkit-touch-callout:none] ${
        highlighted ? 'bg-raised shadow-now' : 'hover:bg-card active:bg-raised'
      }`}
    >
      <span className="w-12 shrink-0">
        <CoverArt cover={fallback} src={cover} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-base font-medium ${highlighted ? 'text-accent' : 'text-ink'}`}>{item.title}</span>
        <span className="block truncate text-sm text-ink-muted">
          {item.artists} · {formatBytes(item.bytes)}
          {activity === 'error' && <span className="text-danger"> · Gagal diputar</span>}
        </span>
      </span>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          if (activity === 'playing' || activity === 'loading' || activity === 'paused') onToggle()
          else onPlay()
        }}
        aria-label={playLabel}
        aria-busy={activity === 'loading'}
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-white/10 active:bg-white/15 focus-ring ${
          highlighted ? 'text-accent' : 'text-ink-muted'
        }`}
      >
        <Icon
          className={`h-5 w-5 ${activity === 'loading' ? 'animate-spin motion-reduce:animate-none' : ''}`}
          fill={activity === 'loading' ? 'none' : 'currentColor'}
          aria-hidden="true"
        />
      </button>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          void removeDownload(item.key)
        }}
        aria-label={`Hapus unduhan ${item.title}`}
        className="icon-btn shrink-0 text-ink-muted"
      >
        <Trash2 className="h-5 w-5" aria-hidden="true" />
      </button>
    </li>
  )
}

/** Isi halaman Unduhan (hanya APK): lagu yang bisa diputar offline + progres unduhan. */
export default function DownloadsSection() {
  const { items, transfers } = useOffline()
  const player = useAudioPlayer()
  const tracks = useMemo(() => items.map(toPlaylistTrack), [items])
  const pending = [...transfers.values()]
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  // Lagu yang sedang diputar dikenali lewat kunci yang sama dengan unduhan (juga bila diputar dari playlist lain).
  const currentKey = player.currentTrack ? trackKey(player.currentTrack) : null
  const currentActivity = getRowActivity(player.status)

  return (
    <section aria-label="Unduhan">
      <header className="mb-4">
        <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Unduhan</h1>
        <p className="mt-1 text-ink-muted">
          {items.length > 0 ? `${items.length} lagu · ${formatBytes(totalBytes(items))} · bisa diputar offline` : 'Lagu yang disimpan untuk diputar offline'}
        </p>
      </header>

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
            <DownloadedRow
              key={item.key}
              item={item}
              track={tracks[index]}
              selected={selectedKey === item.key}
              activity={currentKey === item.key ? currentActivity : 'none'}
              onSelect={() => setSelectedKey(item.key)}
              onPlay={() => {
                setSelectedKey(item.key)
                player.playList(tracks, index)
              }}
              onToggle={player.togglePlayPause}
            />
          ))}
        </ul>
      )}

    </section>
  )
}
