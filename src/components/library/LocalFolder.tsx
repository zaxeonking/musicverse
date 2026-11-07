import { ChevronDown, Loader2, Play, RotateCw, Smartphone } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import PauseLines from '../ui/PauseLines'
import CoverArt from '../ui/CoverArt'
import { usePlayerUiActions } from '../../context/PlayerUiContext'
import { useTrackMenu } from '../../context/TrackMenuContext'
import { useAudioPlayer } from '../../hooks/useAudioPlayer'
import { useLongPress } from '../../hooks/useLongPress'
import {
  getLocalState,
  localCoverSrc,
  refreshLocalMusic,
  toLocalPlaylistTrack,
  totalLocalBytes,
  useLocalMusic,
  useLocalMusicScan,
  type LocalTrack,
} from '../../native/localMusic'
import { MusicVerseNative } from '../../native/musicVerseNative'
import { trackKey } from '../../native/offline'
import type { RowActivity } from '../../types/player'
import type { PlaylistTrack } from '../../types/spotify'
import { fallbackCover } from '../../utils/fallbackCover'
import { formatBytes, formatTime } from '../../utils/formatTime'
import { getRowActivity } from '../../utils/playerStatus'

/** Baris yang ditampilkan sekaligus: daftar bisa ribuan lagu, jadi dibuka bertahap. */
const PAGE = 100
/** Ingat buka/tutup selama aplikasi hidup (komponen ini dibuat ulang tiap pindah tab). Default tertutup: daftar bisa panjang. */
let lastOpen = false

interface LocalRowProps {
  item: LocalTrack
  track: PlaylistTrack
  activity: RowActivity
  onPlay: () => void
  onToggle: () => void
}

function LocalRow({ item, track, activity, onPlay, onToggle }: LocalRowProps) {
  const [cover, setCover] = useState<string | undefined>(undefined)
  useEffect(() => {
    let cancelled = false
    void localCoverSrc(item.id).then((src) => {
      if (!cancelled) setCover(src)
    })
    return () => {
      cancelled = true
    }
  }, [item.id])
  const fallback = useMemo(() => fallbackCover(`${item.title}${item.album}`), [item.title, item.album])
  const { openTrackMenu } = useTrackMenu()
  const { openFullPlayer } = usePlayerUiActions()
  // Tahan lama: menu lagu yang sama dengan di tempat lain (antrean, tambah ke playlist). Tanpa opsi unduh/hapus: berkasnya bukan milik MusicVerse.
  const longPress = useLongPress(() => openTrackMenu(track, { fromSearch: true, place: 'downloads' }))
  const isCurrent = activity !== 'none'
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
        if (activity === 'none' || activity === 'error' || activity === 'ended') onPlay()
        openFullPlayer()
      }}
      {...longPress}
      className={`flex select-none cursor-pointer items-center gap-3 rounded-md px-2 py-2 transition-colors [-webkit-touch-callout:none] ${
        isCurrent ? 'bg-raised shadow-now' : 'hover:bg-card active:bg-raised'
      }`}
    >
      <span className="w-12 shrink-0">
        <CoverArt cover={fallback} src={cover} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-base font-medium ${isCurrent ? 'text-accent' : 'text-ink'}`}>{item.title}</span>
        <span className="block truncate text-sm text-ink-muted">
          {item.artists || 'Artis tidak diketahui'} · {formatTime(item.durationMs / 1000)}
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
          isCurrent ? 'text-accent' : 'text-ink-muted'
        }`}
      >
        <Icon
          className={`h-5 w-5 ${activity === 'loading' ? 'animate-spin motion-reduce:animate-none' : ''}`}
          fill={activity === 'loading' ? 'none' : 'currentColor'}
          aria-hidden="true"
        />
      </button>
    </li>
  )
}

/**
 * Folder "Lokal" di tab Unduhan: semua audio di HP kecuali unduhan MusicVerse sendiri (supaya tidak tercampur).
 * Selalu ada dan selalu paling atas; TIDAK punya tombol hapus (hanya segarkan), dan lagunya tidak bisa dihapus dari sini.
 */
export default function LocalFolder() {
  useLocalMusicScan()
  const { status, tracks } = useLocalMusic()
  const player = useAudioPlayer()
  const [open, setOpen] = useState(lastOpen)
  const [shown, setShown] = useState(PAGE)
  /** Dialog izin sudah ditampilkan dari tombol di sesi ini: bila masih ditolak, arahkan ke pengaturan sistem. */
  const [askedNow, setAskedNow] = useState(false)

  const list = useMemo(() => tracks.map(toLocalPlaylistTrack), [tracks])
  const currentKey = player.currentTrack ? trackKey(player.currentTrack) : null
  const currentActivity = getRowActivity(player.status)

  const toggle = () => {
    const next = !open
    lastOpen = next
    setOpen(next)
    if (!next) setShown(PAGE)
  }

  const askPermission = async () => {
    await refreshLocalMusic({ ask: true })
    if (getLocalState().status === 'denied') setAskedNow(true)
  }

  const scanning = status === 'scanning' || status === 'idle'
  const summary =
    tracks.length > 0
      ? `${tracks.length} lagu · ${formatBytes(totalLocalBytes(tracks))}${status === 'scanning' ? ' · memperbarui…' : ''}`
      : status === 'denied'
        ? 'Perlu izin akses audio'
        : status === 'unsupported'
          ? 'Butuh APK terbaru'
          : status === 'error'
            ? 'Gagal memindai'
            : scanning
              ? 'Memindai…'
              : 'Audio di HP, di luar unduhan MusicVerse'

  return (
    <section aria-label="Lokal">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1 text-left focus-ring"
        >
          <Smartphone className="h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-display text-lg font-bold text-ink">Lokal</span>
            <span className="block text-xs text-ink-muted">{summary}</span>
          </span>
          <ChevronDown className={`h-5 w-5 shrink-0 text-ink-muted transition-transform ${open ? '' : '-rotate-90'}`} aria-hidden="true" />
        </button>
        {/* Sengaja tanpa tombol hapus: folder ini tetap ada. Yang tersedia hanya memindai ulang. */}
        <button
          type="button"
          onClick={() => void refreshLocalMusic()}
          disabled={status === 'denied' || status === 'unsupported'}
          aria-label="Pindai ulang lagu di HP"
          className="icon-btn shrink-0 text-ink-muted disabled:opacity-40"
        >
          <RotateCw className={`h-5 w-5 ${status === 'scanning' ? 'animate-spin motion-reduce:animate-none' : ''}`} aria-hidden="true" />
        </button>
      </div>

      {open && (
        <div className="mv-in mt-1">
          {status === 'denied' && (
            <div className="rounded-lg bg-card px-4 py-3 text-sm text-ink">
              <p>
                {askedNow
                  ? 'Izin ditolak. Buka pengaturan aplikasi, pilih Izin, lalu izinkan akses Musik dan audio.'
                  : 'Izinkan akses audio supaya lagu di HP-mu tampil di sini. Unduhan MusicVerse tidak ikut dicampur.'}
              </p>
              <button
                type="button"
                onClick={() => (askedNow ? void MusicVerseNative.openAppSettings().catch(() => undefined) : void askPermission())}
                className="btn-secondary mt-2 h-9 px-4"
              >
                {askedNow ? 'Buka pengaturan' : 'Izinkan akses'}
              </button>
            </div>
          )}
          {status === 'unsupported' && (
            <p className="rounded-lg bg-card px-4 py-3 text-sm text-ink-muted">
              Fitur ini butuh APK MusicVerse versi terbaru. Pasang APK barunya, lalu buka lagi.
            </p>
          )}
          {status === 'error' && (
            <div className="rounded-lg bg-card px-4 py-3 text-sm text-ink">
              <p>Gagal memindai audio di HP.</p>
              <button type="button" onClick={() => void refreshLocalMusic()} className="btn-secondary mt-2 h-9 px-4">
                Coba lagi
              </button>
            </div>
          )}
          {scanning && tracks.length === 0 && (
            <p className="flex items-center gap-2 px-1 py-2 text-sm text-ink-muted">
              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              Memindai lagu di HP…
            </p>
          )}
          {status === 'ready' && tracks.length === 0 && (
            <p className="px-1 py-2 text-sm text-ink-muted">Tidak ada audio lain di HP (di luar unduhan MusicVerse).</p>
          )}
          {tracks.length > 0 && (
            <>
              <ul className="mv-list -mx-2">
                {tracks.slice(0, shown).map((item, index) => (
                  <LocalRow
                    key={item.id}
                    item={item}
                    track={list[index]}
                    activity={currentKey === `lc-${item.id}` ? currentActivity : 'none'}
                    onPlay={() => player.playList(list, index)}
                    onToggle={player.togglePlayPause}
                  />
                ))}
              </ul>
              {shown < tracks.length && (
                <button
                  type="button"
                  onClick={() => setShown((n) => n + PAGE)}
                  className="btn-secondary mt-2 h-9 w-full px-4 text-sm"
                >
                  Tampilkan {Math.min(PAGE, tracks.length - shown)} lagu lagi ({tracks.length - shown} tersisa)
                </button>
              )}
            </>
          )}
        </div>
      )}
    </section>
  )
}
