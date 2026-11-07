import { isNativeApp } from '../../native/platform'
import { ArrowDownToLine, ArrowUpToLine, ExternalLink, MoreHorizontal, Play, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, type KeyboardEvent } from 'react'
import type { PlaylistTrack } from '../../types/spotify'
import { fallbackCover } from '../../utils/fallbackCover'
import { extractTrackId } from '../../utils/spotifyUrl'
import CoverArt from '../ui/CoverArt'
import { useOverlayHistory } from '../../hooks/useOverlayHistory'
import Action from './SheetAction'
import { useExitGhost } from '../../hooks/useExitGhost'

const FOCUS = 'focus-ring'

interface TrackActionSheetProps {
  track: PlaylistTrack
  /** Posisi di daftar \"Berikutnya\" (0 = berikutnya) dan jumlah lagu di daftar itu. */
  position: number
  count: number
  onPlayNow: () => void
  onPlayNext: () => void
  onMoveToEnd: () => void
  onRemove: () => void
  /** Membuka menu lagu umum (simpan ke playlist, unduh, ...) untuk lagu ini. Bila kosong, barisnya tidak tampil. */
  onMore?: () => void
  onClose: () => void
}

/**
 * Menu aksi untuk satu lagu di antrean, muncul saat barisnya ditahan lama (atau klik kanan).
 * Mobile: bottom sheet. Desktop (lg): selebar panel antrean di sisi kanan.
 */
export default function TrackActionSheet({
  track,
  position,
  count,
  onPlayNow,
  onPlayNext,
  onMoveToEnd,
  onRemove,
  onMore,
  onClose,
}: TrackActionSheetProps) {
  const exitRef = useExitGhost()
  useOverlayHistory(true, onClose)
  const sheetRef = useRef<HTMLDivElement>(null)
  const fallback = useMemo(() => fallbackCover(`${track.title}${track.album}`), [track.title, track.album])
  const href = !isNativeApp() && extractTrackId(track.url) ? track.url : undefined

  useEffect(() => {
    sheetRef.current?.querySelector<HTMLElement>('button:not([disabled])')?.focus()
  }, [])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      onClose()
      return
    }
    if (event.key !== 'Tab') return
    const items = Array.from(
      sheetRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? [],
    )
    if (items.length === 0) return
    const first = items[0]
    const last = items[items.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div ref={exitRef} className="absolute inset-0 z-10">
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 animate-fade-in bg-black/50" />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Opsi untuk ${track.title}`}
        onKeyDown={onKeyDown}
        className="absolute inset-x-0 bottom-0 animate-sheet-up rounded-t-2xl border-t border-line bg-card pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] shadow-2xl shadow-black/60 lg:left-auto lg:right-0 lg:w-[26rem]"
      >
        <div className="flex items-center gap-3 px-4 pb-3 pt-4">
          <span className="w-12 shrink-0">
            <CoverArt cover={fallback} src={track.cover} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-ink">{track.title}</span>
            <span className="block truncate text-xs text-ink-muted">{track.artists}</span>
          </span>
        </div>
        <ul className="mv-list border-t border-line px-2 pt-2">
          <Action icon={Play} label="Putar sekarang" onClick={onPlayNow} />
          <Action icon={ArrowUpToLine} label="Putar berikutnya" onClick={onPlayNext} disabled={position === 0} />
          <Action icon={ArrowDownToLine} label="Pindah ke akhir antrean" onClick={onMoveToEnd} disabled={position >= count - 1} />
          {href && (
            <li>
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onClose}
                className={`flex min-h-[3rem] w-full items-center gap-4 rounded-md px-3 text-sm font-medium text-ink tap-row hover:bg-raised active:bg-raised ${FOCUS}`}
              >
                <ExternalLink className="h-5 w-5 shrink-0" aria-hidden="true" />
                Buka di Spotify
              </a>
            </li>
          )}
          {onMore && <Action icon={MoreHorizontal} label="Opsi lainnya" hint="Simpan ke playlist, unduh, dan lainnya" onClick={onMore} />}
          <Action icon={Trash2} label="Hapus dari antrean" onClick={onRemove} danger />
        </ul>
      </div>
    </div>
  )
}
