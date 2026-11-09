import { Loader2, Play } from 'lucide-react'
import { useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { useAudioPlayer, usePlaybackTime } from '../../hooks/useAudioPlayer'
import type { MiniSide } from '../../hooks/useMiniPlayerMode'
import type { NowPlaying } from '../../hooks/useNowPlaying'
import { parseDuration } from '../../utils/formatTime'
import { swallowNextClick } from '../../utils/swallowNextClick'
import CoverArt from '../ui/CoverArt'

const SIZE = 72 // px (h-[72px] w-[72px]); sama dengan BUBBLE_PX di MiniPlayer
const RING_R = 26
const CIRC = 2 * Math.PI * RING_R
const TAP_SLOP = 8
const HOLD_MS = 450
const FLICK_UP_PX = 48

/** Cincin progres: komponen terpisah supaya hanya ia yang render ulang tiap tick waktu. */
function ProgressRing({ error, loading }: { error: boolean; loading: boolean }) {
  const { currentTime, duration: engineDuration } = usePlaybackTime()
  const { playbackInfo, currentTrack } = useAudioPlayer()
  const duration = engineDuration ?? parseDuration(playbackInfo?.duration) ?? parseDuration(currentTrack?.duration)
  const fraction = duration && duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0
  if (loading) {
    // Jeda antar lagu / buffering: busur berputar (bukan cincin posisi yang diam).
    return (
      <svg viewBox="0 0 56 56" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
        <circle cx="28" cy="28" r={RING_R} fill="none" style={{ stroke: 'rgb(var(--mv-veil, 255 255 255) / 0.14)' }} strokeWidth="3" />
        <g className="origin-center animate-spin motion-reduce:animate-pulse" style={{ transformOrigin: '28px 28px' }}>
          <circle
            cx="28"
            cy="28"
            r={RING_R}
            fill="none"
            style={{ stroke: 'rgb(var(--mv-accent, 29 185 84))' }}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${CIRC * 0.28} ${CIRC}`}
          />
        </g>
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 56 56" className="pointer-events-none absolute inset-0 h-full w-full -rotate-90" aria-hidden="true">
      <circle cx="28" cy="28" r={RING_R} fill="none" style={{ stroke: 'rgb(var(--mv-veil, 255 255 255) / 0.14)' }} strokeWidth="3" />
      <circle
        cx="28"
        cy="28"
        r={RING_R}
        fill="none"
        style={{ stroke: error ? 'rgb(var(--mv-danger, 255 107 107))' : 'rgb(var(--mv-accent, 29 185 84))' }}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={CIRC}
        strokeDashoffset={CIRC * (1 - fraction)}
      />
    </svg>
  )
}

interface MiniBubbleProps {
  now: NowPlaying
  side: MiniSide
  /** Lebar area dock (px), untuk menghitung posisi kiri/kanan. */
  width: number
  onExpand: () => void
  onSideChange: (side: MiniSide) => void
  /** Muncul dengan animasi naik (setelah keyboard selesai naik), bukan animasi membesar bawaan. */
  rise?: boolean
  /** Hanya bersama `rise`: jarak (px) disc mulai di bawah posisi akhirnya, yaitu tempat kartu tadi di belakang keyboard. */
  riseFrom?: number
  /** Muncul menyatu di bawah kartu yang sedang menutup jadi disc (lihat MiniPlayer.flyToBubble), bukan membesar dari kecil. */
  morph?: boolean
  /** Menggantikan disc pratinjau geser samping: dipasang langsung di tempatnya tanpa animasi masuk (pratinjau yang memudar). */
  handoff?: boolean
}

/**
 * Mini player versi gelembung: piringan hitam berputar dengan cincin progres.
 *  - ketuk / geser ke atas  = kembali membesar,
 *  - seret ke kiri/kanan    = pindah sisi layar (menempel otomatis, ada getar kecil),
 *  - tahan                  = putar / jeda.
 */
export default function MiniBubble({ now, side, width, onExpand, onSideChange, rise = false, riseFrom = 0, morph = false, handoff = false }: MiniBubbleProps) {
  // Dikunci saat dipasang: `morph` kembali false setelah kartu hantu hilang, dan itu tidak boleh memutar ulang animasi masuk.
  const [morphEntry] = useState(morph)
  const [handoffEntry] = useState(handoff)
  const { status, togglePlayPause } = useAudioPlayer()
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null)
  const gesture = useRef({ id: -1, x: 0, y: 0, moved: false, held: false, timer: 0 })

  const maxX = Math.max(0, width - SIZE)
  const baseX = side === 'right' ? maxX : 0
  const playing = status === 'playing'
  const loading = status === 'resolving' || status === 'loading' || status === 'buffering'
  const paused = status === 'paused' || status === 'ended'
  const error = status === 'error'

  const clearTimer = () => {
    window.clearTimeout(gesture.current.timer)
  }

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    const g = gesture.current
    g.id = event.pointerId
    g.x = event.clientX
    g.y = event.clientY
    g.moved = false
    g.held = false
    clearTimer()
    g.timer = window.setTimeout(() => {
      if (g.moved || g.id === -1) return
      g.held = true
      navigator.vibrate?.(20)
      togglePlayPause()
    }, HOLD_MS)
  }

  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const g = gesture.current
    if (event.pointerId !== g.id) return
    const dx = event.clientX - g.x
    const dy = event.clientY - g.y
    if (!g.moved) {
      if (Math.hypot(dx, dy) < TAP_SLOP) return
      g.moved = true
      clearTimer()
      event.currentTarget.setPointerCapture(event.pointerId)
    }
    setDrag({ x: dx, y: Math.min(12, dy) })
  }

  const finish = (event: PointerEvent<HTMLButtonElement>, cancelled: boolean) => {
    const g = gesture.current
    if (event.pointerId !== g.id) return
    clearTimer()
    g.id = -1
    const dx = event.clientX - g.x
    const dy = event.clientY - g.y
    setDrag(null)
    if (cancelled) return
    // Klik susulan setelah jari diangkat tidak boleh tembus ke elemen di belakang gelembung.
    swallowNextClick()
    if (g.held) return
    if (!g.moved) {
      onExpand()
      return
    }
    if (dy < -FLICK_UP_PX && Math.abs(dy) > Math.abs(dx)) {
      navigator.vibrate?.(10)
      onExpand()
      return
    }
    const center = baseX + dx + SIZE / 2
    const target: MiniSide = center < width / 2 ? 'left' : 'right'
    if (target !== side) {
      navigator.vibrate?.(10)
      onSideChange(target)
    }
  }

  const x = baseX + (drag?.x ?? 0)
  const y = drag?.y ?? 0

  return (
    <div
      style={rise && riseFrom > 0 ? ({ '--rise-from': `${Math.round(riseFrom)}px` } as CSSProperties) : undefined}
      className={`pointer-events-none relative h-[72px] ${rise ? 'animate-bubble-rise' : handoffEntry ? '' : morphEntry ? 'animate-bubble-morph' : 'animate-bubble-in'} motion-reduce:animate-none ${
        side === 'right' ? 'origin-bottom-right' : 'origin-bottom-left'
      }`}
    >
      <button
        type="button"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => finish(e, false)}
        onPointerCancel={(e) => finish(e, true)}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') onSideChange('left')
          else if (e.key === 'ArrowRight') onSideChange('right')
          else if (e.key === 'ArrowUp') onExpand()
        }}
        data-mini-disc=""
        aria-label={`Perbesar pemutar: ${now.title}${now.artists ? `, ${now.artists}` : ''}. Tahan untuk ${playing ? 'jeda' : 'putar'}`}
        style={{
          transform: `translate3d(${x}px, ${y}px, 0) scale(${drag ? 1.08 : 1})`,
          transition: drag ? 'none' : 'transform 360ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
        className="pointer-events-auto absolute left-0 top-0 h-[72px] w-[72px] touch-none select-none rounded-full bg-raised/95 shadow-[0_8px_24px_rgba(0,0,0,0.55),inset_0_1px_0_rgb(var(--mv-veil,255_255_255)/0.12)] focus-ring"
      >
        {/* Piringan: berputar saat playing, berhenti di posisi terakhir saat jeda. */}
        <span
          aria-hidden="true"
          className="absolute inset-[6px] animate-disc overflow-hidden rounded-full motion-reduce:animate-none"
          style={{ animationPlayState: playing && !loading ? 'running' : 'paused', opacity: loading ? 0.55 : 1 }}
        >
          <CoverArt cover={now.cover} src={now.coverSrc} round instant />
          <span className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,rgb(var(--mv-veil,255_255_255)/0.14),transparent_25%,rgb(var(--mv-veil,255_255_255)/0.1)_50%,transparent_75%,rgb(var(--mv-veil,255_255_255)/0.14))]" />
        </span>
        <ProgressRing error={error} loading={loading} />
        {/* Riak halus sekali saat kartu selesai jadi disc (seperti contoh animasi disc). */}
        {(morphEntry || handoffEntry) && (
          <span aria-hidden="true" className="pointer-events-none absolute -inset-px animate-disc-halo rounded-full border-2 border-veil/40 motion-reduce:animate-none" />
        )}
        {/* Lubang tengah piringan; berubah jadi ikon play saat jeda. */}
        <span
          aria-hidden="true"
          className={`absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-veil/25 bg-bg transition-all ${
            paused || loading ? 'h-8 w-8 bg-black/70' : 'h-4 w-4'
          }`}
        >
          {paused && <Play className="h-4 w-4 text-ink" fill="currentColor" />}
          {loading && <Loader2 className="h-4 w-4 animate-spin text-ink motion-reduce:animate-pulse" />}
        </span>
      </button>
    </div>
  )
}
