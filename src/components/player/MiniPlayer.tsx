import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from 'react'
import { useTrackMenu } from '../../context/TrackMenuContext'
import { useAudioPlayer } from '../../hooks/useAudioPlayer'
import { useCoverGlow } from '../../hooks/useCoverGlow'
import { useKeyboardOpen } from '../../hooks/useKeyboardOpen'
import { useLongPress } from '../../hooks/useLongPress'
import { useMiniPlayerMode } from '../../hooks/useMiniPlayerMode'
import { useNowPlaying } from '../../hooks/useNowPlaying'
import { STATUS_TEXT } from '../../utils/playerStatus'
import { swallowNextClick } from '../../utils/swallowNextClick'
import CoverArt from '../ui/CoverArt'
import MarqueeText from '../ui/MarqueeText'
import { PlayerError, QueueButton, SpotifyLink, TransportControls } from './PlayerControls'
import LyricLine from './LyricLine'
import MiniBubble from './MiniBubble'
import SeekBar from './SeekBar'

/** Jarak seret ke bawah (px) yang cukup untuk memperkecil, dan awal gerakan dianggap seretan. */
const SHRINK_DISTANCE = 70
/** Jarak seret ke atas (px) yang membuka pemutar penuh. */
const OPEN_DISTANCE = 60
const DRAG_START_PX = 8

/**
 * Mini player. Anak flex AppShell tepat di atas BottomNav (bukan position: fixed), jadi konten
 * di atasnya otomatis berhenti di sini dan tidak pernah tertutup. Hanya membaca dari audio engine
 * lewat useAudioPlayer; tidak punya state playback sendiri.
 */
export default function MiniPlayer({ onOpen, onOpenQueue }: { onOpen: () => void; onOpenQueue: () => void }) {
  const { status, currentTrack } = useAudioPlayer()
  const { openTrackMenu } = useTrackMenu()
  const now = useNowPlaying()
  const glowColor = useCoverGlow(now?.coverSrc, now?.cover.from)
  const { collapsed, side, setCollapsed, setSide } = useMiniPlayerMode()
  const keyboardOpen = useKeyboardOpen()
  // Gelembung SEMENTARA karena keyboard terbuka. Tidak disimpan: pilihan pengguna (collapsed) tetap seperti semula,
  // jadi saat keyboard hilang kartu kembali kalau memang itu pilihannya.
  const [kbBubble, setKbBubble] = useState(false)
  const kbTimer = useRef(0)
  const prevKeyboard = useRef(false)
  // Pengguna mengetuk gelembung saat keyboard terbuka: keyboard ditutup dulu, kartu membesar sesudahnya.
  const pendingExpand = useRef(false)
  const showBubble = collapsed || kbBubble
  const dockRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const [dockWidth, setDockWidth] = useState(0)
  // Dari sisi mana kartu baru saja membesar (untuk animasi keluar dari gelembung).
  const [growFrom, setGrowFrom] = useState<'left' | 'right' | null>(null)
  const drag = useRef({ id: -1, x: 0, y: 0, active: false, crossed: false, lastY: 0, lastT: 0, velocity: 0 })
  const swallowClick = useRef(false)
  // Tahan lama pada info lagu = menu lagu yang sedang diputar. Tidak jalan bila sedang menyeret kartu.
  const press = useLongPress(() => {
    if (drag.current.active || !currentTrack) return
    openTrackMenu(currentTrack, { place: 'player' })
  })
  const collapseTimer = useRef(0)
  const resetTimer = useRef(0)

  useLayoutEffect(() => {
    const el = dockRef.current
    if (!el) return
    const measure = () => setDockWidth(el.clientWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useLayoutEffect(
    () => () => {
      window.clearTimeout(collapseTimer.current)
      window.clearTimeout(resetTimer.current)
      window.clearTimeout(kbTimer.current)
    },
    [],
  )

  /** Posisikan kartu mengikuti jari: ke bawah = turun + mengecil + memudar; ke atas = naik + sedikit membesar. */
  const applyDrag = (dy: number, animate: boolean) => {
    const el = cardRef.current
    if (!el) return
    el.style.transition = animate ? 'transform 320ms cubic-bezier(0.34,1.56,0.64,1), opacity 200ms' : 'none'
    if (dy === 0) {
      el.style.transform = ''
      el.style.opacity = ''
      return
    }
    if (dy > 0) {
      const p = Math.min(dy / (SHRINK_DISTANCE * 1.6), 1)
      el.style.transform = `translate3d(0, ${dy}px, 0) scale(${1 - p * 0.14})`
      el.style.opacity = String(1 - p * 0.35)
    } else {
      const p = Math.min(-dy / (OPEN_DISTANCE * 1.6), 1)
      el.style.transform = `translate3d(0, ${dy * 0.7}px, 0) scale(${1 + p * 0.05})`
      el.style.opacity = ''
    }
  }

  const springBack = () => {
    applyDrag(0, true)
    window.setTimeout(() => {
      if (cardRef.current) cardRef.current.style.transition = ''
    }, 340)
  }

  /**
   * Kartu "terbang" mengecil ke pojok tempat gelembung, lalu diganti gelembung. `persist` = pilihan pengguna (disimpan);
   * false = sementara karena keyboard (tidak disimpan).
   */
  const flyToBubble = (persist: boolean) => {
    const el = cardRef.current
    if (!el) {
      if (persist) setCollapsed(true)
      else setKbBubble(true)
      return
    }
    const travel = Math.max(0, el.clientWidth / 2 - 28) * (side === 'right' ? 1 : -1)
    el.style.transition = 'transform 220ms cubic-bezier(0.5,0,0.75,0), opacity 200ms ease-in'
    el.style.transform = `translate3d(${travel}px, 0, 0) scale(0.16)`
    el.style.opacity = '0'
    const timer = persist ? collapseTimer : kbTimer
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      setGrowFrom(null)
      if (persist) setCollapsed(true)
      else setKbBubble(true)
    }, 200)
  }

  const shrink = () => flyToBubble(true)

  const expand = () => {
    if (keyboardOpen) {
      pendingExpand.current = true
      const active = document.activeElement
      if (active instanceof HTMLElement) active.blur()
      return
    }
    setGrowFrom(side)
    setCollapsed(false)
  }

  // Keyboard muncul -> kartu mengecil jadi piringan; keyboard hilang -> piringan membesar jadi kartu lagi.
  // Tanpa daftar dependensi: badan efek hanya bekerja saat keyboardOpen BERUBAH (dijaga prevKeyboard), jadi aman dan selalu
  // memakai nilai terbaru (collapsed, side, kbBubble).
  useEffect(() => {
    const was = prevKeyboard.current
    prevKeyboard.current = keyboardOpen
    if (keyboardOpen === was) return
    if (keyboardOpen) {
      if (!collapsed && !kbBubble) flyToBubble(false)
      return
    }
    window.clearTimeout(kbTimer.current)
    if (!kbBubble) {
      // Sempat mulai mengecil tetapi keyboard keburu menutup: kartu kembali ke tempatnya dengan animasi.
      const el = cardRef.current
      if (el) {
        el.style.transition = 'transform 260ms cubic-bezier(0.22,1,0.36,1), opacity 200ms'
        el.style.transform = ''
        el.style.opacity = ''
      }
    }
    if (pendingExpand.current) {
      pendingExpand.current = false
      if (collapsed) {
        setGrowFrom(side)
        setCollapsed(false)
      }
    }
    if (kbBubble) {
      setGrowFrom(side)
      setKbBubble(false)
    }
  })

  /** Kartu meluncur ke atas sambil memudar, bersamaan dengan pemutar penuh yang naik menutupinya. */
  const openFull = () => {
    const el = cardRef.current
    if (el) {
      el.style.transition = 'transform 260ms cubic-bezier(0.22,1,0.36,1), opacity 220ms ease-in'
      el.style.transform = 'translate3d(0, -48px, 0) scale(1.06)'
      el.style.opacity = '0'
      window.clearTimeout(resetTimer.current)
      // Setelah pemutar penuh menutupi layar, kembalikan kartu agar muncul lagi saat pemutar ditutup.
      resetTimer.current = window.setTimeout(() => {
        if (!cardRef.current) return
        cardRef.current.style.transition = 'none'
        cardRef.current.style.transform = ''
        cardRef.current.style.opacity = ''
      }, 600)
    }
    onOpen()
  }

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    // Seek bar punya geseran sendiri (horizontal): jangan dibajak.
    if ((event.target as HTMLElement).closest('input[type="range"], [role="progressbar"]')) return
    const d = drag.current
    d.id = event.pointerId
    d.x = event.clientX
    d.y = event.clientY
    d.active = false
    d.crossed = false
    d.lastY = event.clientY
    d.lastT = event.timeStamp
    d.velocity = 0
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (event.pointerId !== d.id) return
    const dx = event.clientX - d.x
    const dy = event.clientY - d.y
    if (!d.active) {
      if (Math.abs(dx) < DRAG_START_PX && Math.abs(dy) < DRAG_START_PX) return
      // Gerakan dominan horizontal bukan untuk kita.
      if (Math.abs(dx) > Math.abs(dy)) {
        d.id = -1
        return
      }
      d.active = true
      event.currentTarget.setPointerCapture(event.pointerId)
    }
    const dt = event.timeStamp - d.lastT
    if (dt > 0) d.velocity = (event.clientY - d.lastY) / dt
    d.lastY = event.clientY
    d.lastT = event.timeStamp
    // Getar kecil saat melewati titik "lepas sekarang = mengecil".
    const crossed = dy > SHRINK_DISTANCE || dy < -OPEN_DISTANCE
    if (crossed !== d.crossed) {
      d.crossed = crossed
      if (crossed) navigator.vibrate?.(10)
    }
    applyDrag(dy, false)
  }

  const endDrag = (event: PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const d = drag.current
    if (event.pointerId !== d.id) return
    d.id = -1
    if (!d.active) return
    d.active = false
    // Klik yang menyusul pelepasan jari setelah seretan tidak boleh menekan tombol di bawah jari.
    swallowClick.current = true
    swallowNextClick()
    window.setTimeout(() => {
      swallowClick.current = false
    }, 120)
    const dy = event.clientY - d.y
    if (!cancelled && (dy > SHRINK_DISTANCE || (d.velocity > 0.6 && dy > 24))) shrink()
    else if (!cancelled && (dy < -OPEN_DISTANCE || (d.velocity < -0.6 && dy < -24))) openFull()
    else springBack()
  }

  if (!now) return null
  const isError = status === 'error'
  const statusText = STATUS_TEXT[status]
  // Saat bukan playing/paused, tampilkan status nyata menggantikan nama artis.
  const subtitle = status === 'resolving' || status === 'loading' || status === 'buffering' ? statusText : now.artists

  const cardAnimation =
    growFrom === 'right'
      ? 'animate-grow-right motion-reduce:animate-none'
      : growFrom === 'left'
        ? 'animate-grow-left motion-reduce:animate-none'
        : 'animate-player-up'

  return (
    <div className="pointer-events-none relative z-40 h-0 shrink-0">
    <div ref={dockRef} className="absolute inset-x-0 bottom-0 mb-[calc(var(--dock-offset,0px)+1rem)] transition-[margin-bottom] duration-300 ease-out motion-reduce:transition-none ml-[max(0.75rem,env(safe-area-inset-left))] mr-[max(0.75rem,env(safe-area-inset-right))] lg:mx-6 lg:mb-6">
    {showBubble ? (
      <MiniBubble now={now} side={side} width={dockWidth} onExpand={expand} onSideChange={setSide} />
    ) : (
    <div className={`flex origin-bottom flex-col ${cardAnimation}`}>
    {/* Grup yang ikut bergerak saat diseret: glow (di belakang) + kartu. */}
    <div ref={cardRef} className="pointer-events-none relative origin-bottom">
    {/* Glow warna sampul: hanya di belakang kartu mini player (bukan overlay layar), condong ke atas dan samping
        supaya tidak menyentuh navbar. Berdenyut sekali tiap ganti lagu, lalu redup menetap; lebih redup saat jeda. */}
    <span
      key={currentTrack?.id ?? 'none'}
      aria-hidden="true"
      style={{
        boxShadow: `0 -10px 32px -6px rgba(${glowColor},0.6), 0 -2px 16px -2px rgba(${glowColor},0.4)`,
        transition: 'box-shadow 600ms ease, opacity 400ms ease',
      }}
      className={`pointer-events-none absolute inset-0 rounded-3xl animate-glow-pulse motion-reduce:animate-none ${
        status === 'paused' ? 'opacity-30' : 'opacity-60'
      }`}
    />
    <div
      role="region"
      aria-label="Pemutar musik"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => endDrag(e, false)}
      onPointerCancel={(e) => endDrag(e, true)}
      onClickCapture={(e) => {
        if (swallowClick.current) {
          swallowClick.current = false
          e.preventDefault()
          e.stopPropagation()
        }
      }}
      className="pointer-events-auto relative touch-none overflow-hidden rounded-3xl border border-white/10 bg-[#242424]/95 shadow-[0_8px_32px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-3xl backdrop-saturate-150 [-webkit-backdrop-filter:blur(40px)_saturate(150%)]"
    >
      {/* Pegangan: seret kartu ke bawah untuk memperkecil jadi gelembung. Ketuk = cadangan untuk keyboard/pembaca layar. */}
      <button
        type="button"
        onClick={() => shrink()}
        aria-label="Perkecil pemutar jadi gelembung"
        title="Seret ke bawah untuk memperkecil"
        className="absolute left-1/2 top-0 z-10 flex h-4 w-20 -translate-x-1/2 items-start justify-center pt-1 focus-ring"
      >
        <span aria-hidden="true" className="h-1 w-9 rounded-full bg-white/25" />
      </button>
      {/* Lirik menyatu dengan kartu: satu kaca blur yang sama, hanya dipisah garis tipis. */}
      <div className="border-b border-white/10">
        <LyricLine />
      </div>
      <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-0.5 px-4 pb-2.5 pt-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)] lg:gap-x-6 lg:px-6 lg:py-2">
        <button
          type="button"
          {...press}
          onClick={onOpen}
          aria-haspopup="dialog"
          aria-label={`Buka pemutar penuh (tahan lama untuk opsi lagu): ${now.title}${now.artists ? `, ${now.artists}` : ''}`}
          className="flex min-w-0 items-center gap-3 rounded-md text-left transition-opacity active:opacity-80 focus-ring lg:row-span-2"
        >
          <div className="w-11 shrink-0 lg:w-14">
            <CoverArt cover={now.cover} src={now.coverSrc} />
          </div>
          <span className="min-w-0">
            <MarqueeText text={now.title} className="text-sm font-semibold text-ink" />
            <MarqueeText
              text={isError ? STATUS_TEXT.error : subtitle}
              className={`text-xs ${status === 'error' ? 'text-danger' : 'text-ink-muted'}`}
            />
          </span>
        </button>

        <div className="flex items-center justify-end lg:col-start-2 lg:justify-center">
          <TransportControls />
          {/* Layar sempit: antrean dibuka dari full player (ruang mini player terbatas). */}
          <QueueButton onClick={onOpenQueue} className="hidden sm:flex lg:hidden" />
          {/* Layar sempit: tautan Spotify ada di full player; ruang mini player dipakai untuk judul + kontrol. */}
          <SpotifyLink url={now.spotifyUrl} variant="icon" className="hidden sm:flex lg:hidden" />
        </div>

        <div className="col-span-2 lg:col-span-1 lg:col-start-2 lg:row-start-2">
          {isError ? <PlayerError compact className="py-0.5" /> : <SeekBar size="sm" />}
        </div>

        <div className="hidden items-center justify-end gap-1 lg:col-start-3 lg:row-span-2 lg:row-start-1 lg:flex">
          <QueueButton onClick={onOpenQueue} className="flex" />
          <SpotifyLink url={now.spotifyUrl} variant="icon" />
        </div>
      </div>
      {/* Pembaca layar: status playback diumumkan tanpa menunggu fokus. */}
      <p className="sr-only" aria-live="polite">
        {statusText}
      </p>
    </div>
    </div>
    </div>
    )}
    </div>
    </div>
  )
}
