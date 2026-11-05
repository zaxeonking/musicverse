import { AlertCircle, Battery, ChevronDown, Download, FolderInput, ListMusic, Loader2, Music2, Play, RotateCw, Settings, Trash2, WifiOff, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PauseLines from '../ui/PauseLines'
import { usePlayerUiActions } from '../../context/PlayerUiContext'
import { useMyPlaylists } from '../../context/MyPlaylistsContext'
import { useTrackMenu } from '../../context/TrackMenuContext'
import { useAudioPlayer } from '../../hooks/useAudioPlayer'
import { useLongPress } from '../../hooks/useLongPress'
import { cancelQueued, dismissTransferError, pauseDownloads, resumeDownloads, retryAllFailed, retryDownload, holdDownload, resumeHeld } from '../../native/downloads'
import {
  coverSrcFor,
  removeDownload,
  removeDownloads,
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
import MoveDownloadSheet from './MoveDownloadSheet'

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function transferLabel(transfer: Transfer, paused: boolean, heldText: string | null): string {
  if (transfer.held && transfer.status === 'queued') return 'Ditahan'
  if (transfer.held && transfer.status === 'resolving') return 'Menyiapkan… lalu ditahan'
  switch (transfer.status) {
    case 'queued':
      return paused ? 'Dijeda' : heldText ? `Menunggu ${heldText}` : 'Menunggu antrean'
    case 'resolving':
      if (paused && !transfer.forced) return 'Menyiapkan… lalu dijeda'
      return transfer.message ? `Menyiapkan… ${transfer.message}` : 'Menyiapkan…'
    case 'downloading': {
      const note = paused && !transfer.forced ? ' · dijeda setelah lagu ini' : ''
      if (transfer.percent !== null) return `Mengunduh ${transfer.percent}%${note}`
      return `${transfer.bytes ? `Mengunduh… ${formatBytes(transfer.bytes)}` : 'Mengunduh…'}${note}`
    }
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
  /** Membuka pilihan playlist untuk memindahkan lagu ini. */
  onMove: () => void
}

function DownloadedRow({ item, track, selected, activity, onSelect, onPlay, onToggle, onMove }: DownloadedRowProps) {
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
  const Icon = activity === 'playing' ? PauseLines : activity === 'loading' ? Loader2 : Play
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
          onMove()
        }}
        aria-label={`Pindahkan ${item.title} ke playlist`}
        className="icon-btn shrink-0 text-ink-muted"
      >
        <FolderInput className="h-5 w-5" aria-hidden="true" />
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
  const { items, transfers, paused, wifiOnly, cellular, chargingOnly, unplugged, restored } = useOffline()
  const heldWifi = wifiOnly && cellular
  const heldCharge = chargingOnly && unplugged
  const blocked = heldWifi || heldCharge
  const heldText = !blocked ? null : heldWifi && heldCharge ? 'Wi-Fi dan cas' : heldWifi ? 'Wi-Fi' : 'cas'
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)
  const player = useAudioPlayer()
  const tracks = useMemo(() => items.map(toPlaylistTrack), [items])
  const pending = [...transfers.values()]
  const failed = pending.filter((t) => t.status === 'error').length
  const waiting = pending.filter((t) => t.status === 'queued' && !t.held).length
  const working = pending.some((t) => t.status === 'resolving' || t.status === 'downloading')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  // Lagu yang sedang diputar dikenali lewat kunci yang sama dengan unduhan (juga bila diputar dari playlist lain).
  const currentKey = player.currentTrack ? trackKey(player.currentTrack) : null
  const currentActivity = getRowActivity(player.status)
  const { playlists } = useMyPlaylists()
  const { showToast } = useTrackMenu()
  const [moving, setMoving] = useState<{ track: PlaylistTrack; fromPlaylistId?: string } | null>(null)
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set())
  const toggleGroup = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  // Pengelompokan: setiap playlist (hasil "Unduh semua" atau buatan sendiri) memuat lagunya yang sudah terunduh;
  // lagu yang tidak ada di playlist mana pun = "Lagu satuan" (unduhan satu per satu).
  const { groups, singles } = useMemo(() => {
    const byKey = new Map(items.map((item) => [item.key, item]))
    const inPlaylist = new Set<string>()
    const built: Array<{ id: string; name: string; rows: DownloadedTrack[] }> = []
    for (const playlist of playlists) {
      const seen = new Set<string>()
      const rows: DownloadedTrack[] = []
      for (const t of playlist.tracks) {
        const key = trackKey(t)
        const item = byKey.get(key)
        if (!item || seen.has(key)) continue
        seen.add(key)
        inPlaylist.add(key)
        rows.push(item)
      }
      if (rows.length > 0) built.push({ id: playlist.id, name: playlist.name, rows })
    }
    return { groups: built, singles: items.filter((item) => !inPlaylist.has(item.key)) }
  }, [items, playlists])

  const renderRows = (rows: readonly DownloadedTrack[], fromPlaylistId?: string) => {
    const list = rows.map(toPlaylistTrack)
    return (
      <ul className="-mx-2">
        {rows.map((item, index) => (
          <DownloadedRow
            key={`${fromPlaylistId ?? 'single'}-${item.key}`}
            item={item}
            track={list[index]}
            selected={selectedKey === item.key}
            activity={currentKey === item.key ? currentActivity : 'none'}
            onSelect={() => setSelectedKey(item.key)}
            onPlay={() => {
              setSelectedKey(item.key)
              player.playList(list, index)
            }}
            onToggle={player.togglePlayPause}
            onMove={() => setMoving({ track: list[index], fromPlaylistId })}
          />
        ))}
      </ul>
    )
  }

  /** Konfirmasi hapus semua unduhan satu kelompok: playlist-nya tetap ada, hanya berkas lagu yang dihapus. */
  const renderRemoveConfirm = (name: string, rows: readonly DownloadedTrack[], groupId: string) => {
    const keys = new Set(rows.map((row) => row.key))
    // Berkas lagu dipakai bersama: lagu yang juga ada di playlist lain ikut hilang dari sana.
    const shared = new Set<string>()
    for (const other of groups) {
      if (other.id === groupId) continue
      for (const row of other.rows) if (keys.has(row.key)) shared.add(row.key)
    }
    const bytes = totalBytes(rows)
    return (
      <div role="group" aria-label={`Konfirmasi hapus unduhan ${name}`} className="mt-1 rounded-lg bg-card px-4 py-3 text-sm text-ink">
        <p>
          Hapus {rows.length} lagu ({formatBytes(bytes)}) dari perangkat?{' '}
          {groupId === '__single' ? '' : `Playlist “${name}” tetap ada dan lagunya bisa diunduh lagi. `}
          {shared.size > 0 && `${shared.size} lagu juga ada di playlist lain dan ikut terhapus dari sana.`}
        </p>
        <div className="mt-2 flex gap-2">
          <button type="button" onClick={() => setConfirmRemove(null)} className="btn-secondary h-9 px-4">
            Batal
          </button>
          <button
            type="button"
            onClick={() => {
              setConfirmRemove(null)
              void removeDownloads([...keys]).then((n) => showToast(`${n} unduhan dihapus, ${formatBytes(bytes)} dibebaskan`))
            }}
            className="btn-danger h-9 px-4"
          >
            Hapus
          </button>
        </div>
      </div>
    )
  }

  return (
    <section aria-label="Unduhan">
      <header className="mb-4">
        <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Unduhan</h1>
        <p className="mt-1 text-ink-muted">
          {items.length > 0 ? `${items.length} lagu · ${formatBytes(totalBytes(items))} · bisa diputar offline` : 'Lagu yang disimpan untuk diputar offline'}
        </p>
      </header>

      <Link to="/settings/downloads" className="mb-3 flex items-center gap-2 rounded-lg bg-card px-4 py-2.5 text-xs text-ink-muted focus-ring">
        <Settings className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">
          Pengaturan unduhan: {wifiOnly || chargingOnly ? [wifiOnly && 'hanya Wi-Fi', chargingOnly && 'hanya saat dicas'].filter(Boolean).join(', ') : 'tanpa syarat'}
        </span>
      </Link>

      {(waiting > 0 || failed > 0) && (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {waiting > 0 && (
            <button
              type="button"
              onClick={paused ? resumeDownloads : pauseDownloads}
              className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-xs font-semibold text-ink focus-ring"
            >
              {paused ? <Play className="h-3.5 w-3.5" aria-hidden="true" /> : <PauseLines className="h-3.5 w-3.5" aria-hidden="true" />}
              {paused ? 'Lanjutkan unduhan' : 'Jeda unduhan'}
            </button>
          )}
          {failed > 0 && (
            <button
              type="button"
              onClick={() => {
                const n = retryAllFailed()
                showToast(n > 0 ? `Mencoba ulang ${n} lagu` : 'Tidak ada yang bisa dicoba ulang')
              }}
              className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-xs font-semibold text-ink focus-ring"
            >
              <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
              Coba ulang yang gagal ({failed})
            </button>
          )}
          {paused ? (
            <span className="text-xs text-ink-muted">
              {restored > 0
                ? `Antrean dipulihkan (${restored} lagu). Tekan Lanjutkan untuk mulai.`
                : working
                  ? 'Dijeda setelah lagu yang berjalan selesai'
                  : 'Dijeda'}
            </span>
          ) : (
            blocked && <span className="text-xs text-ink-muted">Menunggu {heldText}. Lanjut otomatis saat syaratnya terpenuhi.</span>
          )}
        </div>
      )}

      {pending.length > 0 && (
        <ul className="mb-3 space-y-2">
          {pending.map((transfer) => {
            const name = transfer.title ?? tracks.find((t) => t.id === transfer.key)?.title
            const active = transfer.status === 'downloading' || transfer.status === 'resolving'
            return (
              <li key={transfer.key} className="flex items-center gap-3 rounded-lg bg-card px-4 py-3 text-sm text-ink">
                {transfer.status === 'error' ? (
                  <AlertCircle className="h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
                ) : transfer.status === 'queued' || transfer.status === 'resolving' ? (
                  // Ikon status di kiri sekaligus tombol jeda/lanjut untuk lagu ini.
                  <button
                    type="button"
                    aria-label={transfer.held ? 'Lanjutkan lagu ini' : 'Jeda lagu ini'}
                    title={transfer.held ? 'Lanjutkan lagu ini' : 'Jeda lagu ini (yang lain jalan terus)'}
                    onClick={() => (transfer.held ? resumeHeld(transfer.key) : holdDownload(transfer.key))}
                    className="icon-btn -my-2 -ml-2 shrink-0"
                  >
                    {transfer.held ? (
                      <Play className="h-5 w-5 text-ink" aria-hidden="true" />
                    ) : transfer.status === 'queued' && paused ? (
                      <PauseLines className="h-5 w-5 text-ink-muted" aria-hidden="true" />
                    ) : transfer.status === 'queued' && blocked ? (
                      heldWifi ? (
                        <WifiOff className="h-5 w-5 text-ink-muted" aria-hidden="true" />
                      ) : (
                        <Battery className="h-5 w-5 text-ink-muted" aria-hidden="true" />
                      )
                    ) : (
                      <span className="relative flex h-6 w-6 items-center justify-center">
                        <Loader2 className="absolute h-6 w-6 animate-spin text-accent" aria-hidden="true" />
                        <PauseLines className="h-3 w-3 text-ink" aria-hidden="true" />
                      </span>
                    )}
                  </button>
                ) : (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-accent" aria-hidden="true" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{name ?? 'Lagu'}</span>
                  <span className={`block text-xs ${transfer.status === 'error' ? 'select-text break-words text-danger' : 'truncate text-ink-muted'}`}>
                    {transferLabel(transfer, paused, heldText)}
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
                {transfer.status === 'error' && (
                  <button
                    type="button"
                    aria-label="Coba lagi"
                    onClick={() => {
                      if (!retryDownload(transfer.key)) showToast('Tidak bisa dicoba ulang. Unduh lagi dari playlistnya.')
                    }}
                    className="icon-btn -my-2"
                  >
                    <RotateCw className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
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
          description="Tombol “Unduh semua” di playlist menyimpan lagunya langsung ke playlist itu. Unduh satu lagu (tahan lama, lalu “Unduh untuk offline”) jadi lagu satuan, dan bisa dipindah ke playlist mana pun. Berkas disimpan di Android/data/<nama aplikasi>/files/download."
        />
      ) : (
        <div className="space-y-5">
          {groups.map((group) => {
            const open = !collapsed.has(group.id)
            return (
              <section key={group.id} aria-label={`Playlist ${group.name}`}>
                <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  aria-expanded={open}
                  className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1 text-left focus-ring"
                >
                  <ListMusic className="h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-lg font-bold text-ink">{group.name}</span>
                    <span className="block text-xs text-ink-muted">
                      {group.rows.length} lagu · {formatBytes(totalBytes(group.rows))}
                    </span>
                  </span>
                  <ChevronDown className={`h-5 w-5 shrink-0 text-ink-muted transition-transform ${open ? '' : '-rotate-90'}`} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmRemove(confirmRemove === group.id ? null : group.id)}
                  aria-label={`Hapus unduhan playlist ${group.name}`}
                  className="icon-btn shrink-0 text-ink-muted"
                >
                  <Trash2 className="h-5 w-5" aria-hidden="true" />
                </button>
                </div>
                {confirmRemove === group.id && renderRemoveConfirm(group.name, group.rows, group.id)}
                {open && <div className="mt-1">{renderRows(group.rows, group.id)}</div>}
              </section>
            )
          })}
          {singles.length > 0 && (
            <section aria-label="Lagu satuan">
              <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => toggleGroup('__single')}
                aria-expanded={!collapsed.has('__single')}
                className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1 text-left focus-ring"
              >
                <Music2 className="h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-lg font-bold text-ink">Lagu satuan</span>
                  <span className="block text-xs text-ink-muted">
                    {singles.length} lagu · {formatBytes(totalBytes(singles))}
                  </span>
                </span>
                <ChevronDown className={`h-5 w-5 shrink-0 text-ink-muted transition-transform ${collapsed.has('__single') ? '-rotate-90' : ''}`} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setConfirmRemove(confirmRemove === '__single' ? null : '__single')}
                aria-label="Hapus semua lagu satuan"
                className="icon-btn shrink-0 text-ink-muted"
              >
                <Trash2 className="h-5 w-5" aria-hidden="true" />
              </button>
              </div>
              {confirmRemove === '__single' && renderRemoveConfirm('Lagu satuan', singles, '__single')}
              {!collapsed.has('__single') && <div className="mt-1">{renderRows(singles)}</div>}
            </section>
          )}
        </div>
      )}

      {moving && (
        <MoveDownloadSheet
          track={moving.track}
          fromPlaylistId={moving.fromPlaylistId}
          onClose={() => setMoving(null)}
          onToast={showToast}
        />
      )}
    </section>
  )
}
