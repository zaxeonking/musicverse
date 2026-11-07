import { lyricsTrackFor } from '../../utils/lyricsTrack'
import { AlertCircle, ChevronDown, ChevronUp, Heart, ListMusic, Mic2, MoreVertical } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type TouchEvent } from 'react'
import { useLibrary } from '../../context/LibraryContext'
import { myPlaylistErrorText, useMyPlaylists } from '../../context/MyPlaylistsContext'
import { useTrackMenu } from '../../context/TrackMenuContext'
import { useAudioPlayer } from '../../hooks/useAudioPlayer'
import { useCoverGlow } from '../../hooks/useCoverGlow'
import { useLongPress } from '../../hooks/useLongPress'
import { useLyrics } from '../../hooks/useLyrics'
import { useNowPlaying } from '../../hooks/useNowPlaying'
import { noticeMessage } from '../../utils/libraryNotice'
import { looksLikeSameTrack, STATUS_TEXT } from '../../utils/playerStatus'
import CoverArt from '../ui/CoverArt'
import MarqueeText from '../ui/MarqueeText'
import { PlayerError, RepeatButton, ShuffleButton, SpotifyLink, TransportControls } from './PlayerControls'
import LyricsPanel from './LyricsPanel'
import SeekBar from './SeekBar'
import CrossfadeSheet, { CrossfadeButton } from './CrossfadeSheet'
import { isNativeApp } from '../../native/platform'
import { takeFlyOrigin } from '../../services/flyOrigin'
import SleepTimerSheet, { SleepTimerButton } from './SleepTimerSheet'

/** Durasi & easing gerakan pemutar penuh <-> mini player (satu animasi berkelanjutan). */
const OPEN_MS = 560
const CLOSE_MS = 380
const EASE = 'cubic-bezier(0.4, 0, 0.2, 1)'
const EASE_HERO = 'cubic-bezier(0.45, 0, 0.15, 1)'
/** Buka: melesat dulu lalu mengendap pelan di posisi akhir (ease-out kuat), seperti sampul "ditarik" ke atas. */
const EASE_OPEN = 'cubic-bezier(0.22, 1, 0.36, 1)'
/** Tutup setelah diseret: gerak langsung cepat (melanjutkan seretan jari), lalu mengendap. */
const EASE_DRAG_CLOSE = 'cubic-bezier(0.32, 0.72, 0, 1)'

const prefersReducedMotion = () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
/** Jeda masuk bertahap (ms) untuk elemen pemutar penuh. */
const delay = (ms: number) => ({ '--fp-delay': `${ms}ms` }) as CSSProperties
/** Sampul kecil di mini player: titik awal/akhir terbang sampul. */
const miniCoverRect = () => {
  const rect = document.querySelector<HTMLElement>('[data-mini-cover]')?.getBoundingClientRect()
  return rect && rect.width > 0 ? rect : null
}

/** Radius sudut sampul mini player (px), dibatasi setengah lebarnya; cadangan 8 bila tak terbaca. */
const miniCoverRadius = (width: number) => {
  const root = document.querySelector<HTMLElement>('[data-mini-cover]')
  const target = root?.firstElementChild ?? root
  const r = target ? parseFloat(getComputedStyle(target).borderTopLeftRadius) : Number.NaN
  return Math.min(Number.isFinite(r) ? r : 8, width / 2)
}

const FLY_STEPS = 10
/** Kotak minimal yang dibutuhkan flyKeyframes (DOMRect atau hasil konversi koordinat). */
type Box = Pick<DOMRect, 'left' | 'top' | 'width'>

/**
 * Keyframe sampul terbang antara kotak kecil `from` dan kotak besar `to` (FLIP, asal sudut kiri atas).
 * Skala murni ikut mengecilkan radius sudut (28px x 0,15 ~ 4px), jadi sudut tampak melompat. Di sini radius tiap
 * langkah dihitung ulang supaya radius TAMPAK berubah mulus dari `rFrom` ke `rTo`. Bayangan sengaja TIDAK dianimasikan:
 * box-shadow besar digambar ulang tiap frame dan membuat gerak tersendat; bayangan statis di kelas sampul ikut diskalakan.
 * `reverse` = dari besar ke kecil (menutup); offset tetap menaik, hanya isinya yang dibalik.
 */
function flyKeyframes(from: Box, to: Box, rFrom: number, rTo: number, reverse = false): Keyframe[] {
  const s0 = from.width / to.width
  const frames: Keyframe[] = []
  for (let i = 0; i <= FLY_STEPS; i += 1) {
    const offset = i / FLY_STEPS
    const p = reverse ? 1 - offset : offset
    const scale = s0 + (1 - s0) * p
    const visual = rFrom + (rTo - rFrom) * p
    frames.push({
      offset,
      transform: `translate3d(${(from.left - to.left) * (1 - p)}px, ${(from.top - to.top) * (1 - p)}px, 0) scale(${scale})`,
      borderRadius: `${visual / scale}px`,
    })
  }
  return frames
}

/** Ikon hati: outline <-> terisi berganti halus, plus membal kecil saat baru disukai. */
function LikeHeart({ liked }: { liked: boolean }) {
  const first = useRef(true)
  const [changed, setChanged] = useState(false)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    setChanged(true)
  }, [liked])
  return (
    <span className="relative block h-7 w-7">
      <Heart
        className={`absolute inset-0 h-7 w-7 transition-[opacity,transform] duration-200 ease-in-out ${liked ? 'scale-50 opacity-0' : 'scale-100 opacity-100'}`}
        fill="none"
        aria-hidden="true"
      />
      <span
        className="absolute inset-0 block"
        style={changed && liked ? { animation: 'heart-pop 420ms var(--ease-spring) both' } : undefined}
      >
        <Heart
          className={`h-7 w-7 transition-[opacity,transform] duration-200 ease-in-out ${liked ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`}
          fill="currentColor"
          aria-hidden="true"
        />
      </span>
    </span>
  )
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Pemutar penuh (dialog modal). Memakai state dan aksi yang sama dengan MiniPlayer,
 * sehingga keduanya selalu sinkron. Esc / tombol turun menutupnya.
 */
export default function FullPlayer({
  onClose,
  onOpenQueue,
  closing = false,
  onClosed,
}: {
  onClose: () => void
  onOpenQueue: () => void
  /** Riwayat sudah mundur (tombol tutup, seret, atau tombol Kembali): jalankan animasi kembali ke mini player. */
  closing?: boolean
  /** Animasi tutup selesai: PlayerDock boleh melepas komponen ini. */
  onClosed?: () => void
}) {
  const { status, currentTrack, playbackInfo } = useAudioPlayer()
  const now = useNowPlaying()
  const { notice, dismissNotice } = useLibrary()
  const { openTrackMenu, showToast } = useTrackMenu()
  const { isLiked, toggleLike } = useMyPlaylists()
  // Warna aksen dari sampul lagu ("r,g,b"); dipakai untuk latar dan semua elemen `accent` di dalam pemutar penuh.
  const coverColor = useCoverGlow(now?.coverSrc, now?.cover.from)
  // Tahan lama pada sampul atau judul = menu lagu yang sedang diputar.
  const press = useLongPress(() => {
    if (currentTrack) openTrackMenu(currentTrack, { place: 'player' })
  })
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const coverRef = useRef<HTMLDivElement>(null)
  const bgRef = useRef<HTMLDivElement>(null)
  const openedRef = useRef(false)
  const [bgFailed, setBgFailed] = useState(false)
  // Tampilan tengah: sampul atau lirik. Lirik baru diminta ke server saat tampilannya dibuka.
  const [showLyrics, setShowLyrics] = useState(false)
  // Ukuran sampul diukur dari ruang yang tersisa di slot tengah supaya seluruh pemutar muat satu layar tanpa scroll.
  const slotRef = useRef<HTMLDivElement>(null)
  const hasTrack = Boolean(now && currentTrack)
  const [coverSize, setCoverSize] = useState(0)
  const [timerOpen, setTimerOpen] = useState(false)
  const [crossfadeOpen, setCrossfadeOpen] = useState(false)
  // Geser di area sampul/lirik: sampul digeser ke atas atau samping -> lirik; di lirik, geser samping -> kembali ke sampul.
  const swipeStart = useRef<{ x: number; y: number } | null>(null)

  useLayoutEffect(() => {
    const el = slotRef.current
    if (!el) return
    const measure = () => {
      const cs = getComputedStyle(el)
      const w = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
      const h = el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)
      setCoverSize(Math.max(0, Math.floor(Math.min(w, h, 416))))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [hasTrack])
  // Sampul mini player disembunyikan selama pemutar penuh terbuka (sampul pemutar penuh "terbang" dari/ke posisinya).
  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-fp-open', '')
    return () => document.documentElement.removeAttribute('data-fp-open')
  }, [])

  // Buka: sampul membesar bertahap dari posisi sampul di mini player (FLIP). Dijalankan sekali, setelah ukuran sampul diukur.
  useLayoutEffect(() => {
    const el = coverRef.current
    if (!el || openedRef.current || coverSize === 0) return
    openedRef.current = true
    if (prefersReducedMotion()) return
    const to = el.getBoundingClientRect()
    // Asal terbang: posisi sampul mini TEPAT saat dilepas (dicatat MiniPlayer), bukan posisi saat kartunya bergerak kembali.
    const from = takeFlyOrigin() ?? miniCoverRect()
    if (from && to.width > 0) {
      el.style.transformOrigin = 'top left'
      el.style.willChange = 'transform'
      const rTo = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 28
      const anim = el.animate(flyKeyframes(from, to, miniCoverRadius(from.width), rTo), { duration: OPEN_MS, easing: EASE_OPEN })
      anim.onfinish = () => {
        el.style.willChange = ''
      }
    } else {
      // Mini player berupa gelembung / belum ada: sampul naik pelan dari bawah.
      el.animate(
        [
          { opacity: 0, transform: 'translate3d(0, 36px, 0) scale(0.9)' },
          { opacity: 1, transform: 'none' },
        ],
        { duration: OPEN_MS, easing: EASE },
      )
    }
  }, [coverSize])

  const onSwipeStart = (event: TouchEvent) => {
    const t = event.touches[0]
    swipeStart.current = t ? { x: t.clientX, y: t.clientY } : null
  }
  const onSwipeEnd = (event: TouchEvent) => {
    const start = swipeStart.current
    swipeStart.current = null
    const t = event.changedTouches[0]
    if (!start || !t) return
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    const horizontal = Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5
    const up = dy < -50 && Math.abs(dy) > Math.abs(dx) * 1.5
    if (horizontal) setShowLyrics((value) => !value)
    else if (up && !showLyrics) setShowLyrics(true)
  }
  // Lirik dicari untuk lagu yang BENAR-BENAR terdengar: jika server memberi audio lagu lain, pakai datanya.
  const lyricsTrack = useMemo(() => lyricsTrackFor(currentTrack, playbackInfo, looksLikeSameTrack), [currentTrack, playbackInfo])
  const { state: lyrics, retry: retryLyrics } = useLyrics(lyricsTrack, showLyrics)

  // Menutup = mundurkan riwayat segera; animasi kembali ke mini player dijalankan oleh efek `closing` di bawah
  // (jadi tombol Kembali Android, tombol turun, Esc, dan seret ke bawah semuanya memakai animasi yang sama).
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])
  const onClosedRef = useRef(onClosed)
  useEffect(() => {
    onClosedRef.current = onClosed
  }, [onClosed])
  const closingRef = useRef(false)
  // Seretan turun yang sedang berlangsung (px turun + skala kartu): dipakai animasi tutup agar melanjutkan dari posisi jari.
  const dragRef = useRef({ pull: 0, scale: 1 })
  const animateClose = useCallback(() => {
    if (closingRef.current) return
    closingRef.current = true
    onCloseRef.current()
  }, [])

  // Tutup: animasi berjalan terbalik. Sampul mengecil kembali ke posisi mini player, info & kontrol memudar,
  // lalu latar memudar membuka Beranda (yang tidak pernah dilepas, jadi posisi scroll-nya tetap).
  useEffect(() => {
    if (!closing) return
    closingRef.current = true
    const el = dialogRef.current
    if (!el) {
      onClosedRef.current?.()
      return
    }
    el.dataset.closing = 'true'
    const ms = prefersReducedMotion() ? 0 : CLOSE_MS
    const cover = coverRef.current
    const mini = miniCoverRect()
    // Setelah diseret, kartu masih turun + mengecil (sisa seretan). JANGAN dikembalikan ke posisi penuh (itu yang dulu membuat
    // kartu "membalik" naik lalu menghilang): kartu dibiarkan di tempatnya dan hanya memudar, sementara sampul terbang dari
    // posisi tampaknya sekarang ke sampul mini. Koordinat target dikonversi ke ruang lokal kartu (kebalikan dari transformnya).
    const { pull, scale: s } = dragRef.current
    const dragged = pull > 0
    let natural = cover?.getBoundingClientRect() ?? null
    if (dragged && cover) {
      const keep = el.style.transform
      el.style.transition = 'none'
      el.style.transform = ''
      natural = cover.getBoundingClientRect() // posisi alami (kartu memenuhi layar, jadi sama dengan koordinat lokal)
      el.style.transform = keep
    }
    const cx = el.clientWidth / 2
    const toLocal = (r: DOMRect): Box & { height: number } =>
      dragged
        ? { left: cx + (r.left - cx) / s, top: (r.top - pull) / s, width: r.width / s, height: r.height / s }
        : r
    if (cover && natural) {
      cover.style.transformOrigin = 'top left'
      cover.style.willChange = 'transform'
      const rFull = parseFloat(getComputedStyle(cover).borderTopLeftRadius) || 28
      const target: Keyframe[] =
        mini && natural.width > 0
          ? flyKeyframes(toLocal(mini), natural, miniCoverRadius(mini.width) / (dragged ? s : 1), rFull, true)
          : [
              { opacity: 1, transform: 'none' },
              { opacity: 0, transform: 'translate3d(0, 28px, 0) scale(0.92)' },
            ]
      cover.animate(target, { duration: ms, easing: dragged ? EASE_DRAG_CLOSE : EASE_HERO, fill: 'forwards' })
    } else {
      slotRef.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms * 0.5, easing: EASE, fill: 'forwards' })
    }
    // Latar memudar searah sampul; setelah diseret mulai lebih awal karena kartu sudah bergerak.
    bgRef.current?.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: ms * (dragged ? 0.8 : 0.75),
      delay: ms * (dragged ? 0.1 : 0.3),
      easing: EASE,
      fill: 'forwards',
    })
    const timer = window.setTimeout(() => onClosedRef.current?.(), ms + 40)
    return () => window.clearTimeout(timer)
  }, [closing])

  // Seret ke bawah dari mana saja (selama konten di posisi paling atas) = tutup. Pakai event sentuh
  // native karena touchmove harus bisa di-preventDefault agar halaman tidak ikut tergulung.
  const ready = now !== null && currentTrack !== null
  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    const CLOSE_PX = 120
    let startX = 0
    let startY = 0
    let lastY = 0
    let lastT = 0
    let velocity = 0
    let tracking = false
    let dragging = false
    let crossed = false

    const blocked = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false
      // Sheet/dialog bersarang (timer, crossfade) punya gesturnya sendiri.
      const nested = target.closest('[role="dialog"]')
      if (nested && nested !== el) return true
      let node: HTMLElement | null = target
      while (node) {
        if (node.matches('input[type="range"]')) return true
        if (node.scrollTop > 0) {
          const oy = getComputedStyle(node).overflowY
          if (oy === 'auto' || oy === 'scroll') return true
        }
        if (node === el) break
        node = node.parentElement
      }
      return false
    }

    const springBack = () => {
      dragRef.current = { pull: 0, scale: 1 }
      el.style.transition = 'transform 380ms cubic-bezier(0.34,1.56,0.64,1), border-radius 380ms, opacity 200ms'
      el.style.transform = ''
      el.style.borderRadius = ''
      el.style.opacity = ''
    }

    const onStart = (event: globalThis.TouchEvent) => {
      const t = event.touches[0]
      tracking = event.touches.length === 1 && !!t && !closingRef.current && !blocked(event.target)
      dragging = false
      crossed = false
      if (!tracking || !t) return
      startX = t.clientX
      startY = t.clientY
      lastY = t.clientY
      lastT = event.timeStamp
      velocity = 0
    }

    const onMove = (event: globalThis.TouchEvent) => {
      const t = event.touches[0]
      if (!tracking || !t) return
      const dx = t.clientX - startX
      const dy = t.clientY - startY
      if (!dragging) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
        // Hanya gerakan ke bawah yang dominan vertikal; selain itu biarkan scroll/gestur lain.
        if (dy < 0 || Math.abs(dx) > Math.abs(dy) || el.scrollTop > 0) {
          tracking = false
          return
        }
        dragging = true
        el.style.animation = 'none'
        el.style.transformOrigin = 'top center'
      }
      if (event.cancelable) event.preventDefault()
      const dt = event.timeStamp - lastT
      if (dt > 0) velocity = (t.clientY - lastY) / dt
      lastY = t.clientY
      lastT = event.timeStamp
      const pull = Math.max(0, dy - 8)
      const p = Math.min(pull / 320, 1)
      el.style.transition = 'none'
      const scale = 1 - p * 0.07
      dragRef.current = { pull, scale }
      el.style.transform = `translate3d(0, ${pull}px, 0) scale(${scale})`
      el.style.borderRadius = `${Math.min(pull / 4, 28)}px`
      const over = pull > CLOSE_PX
      if (over !== crossed) {
        crossed = over
        if (over) navigator.vibrate?.(10)
      }
    }

    const onEnd = (event: globalThis.TouchEvent, cancelled: boolean) => {
      if (!tracking || !dragging) {
        tracking = false
        return
      }
      tracking = false
      dragging = false
      const t = event.changedTouches[0]
      const pull = t ? t.clientY - startY - 8 : 0
      if (!cancelled && (pull > CLOSE_PX || (velocity > 0.7 && pull > 40))) animateClose()
      else springBack()
    }
    const onTouchEnd = (event: globalThis.TouchEvent) => onEnd(event, false)
    const onTouchCancel = (event: globalThis.TouchEvent) => onEnd(event, true)

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd)
    el.addEventListener('touchcancel', onTouchCancel)
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchCancel)
    }
  }, [ready, animateClose])

  // Fokus masuk ke dialog, scroll halaman dikunci, fokus dikembalikan saat ditutup.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    return () => {
      document.body.style.overflow = overflow
      previous?.focus?.()
    }
  }, [])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      animateClose()
      return
    }
    if (event.key !== 'Tab') return
    const items = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])
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

  if (!now || !currentTrack) return null
  const liked = isLiked(currentTrack)
  const isError = status === 'error'
  const mismatch = playbackInfo !== null && !looksLikeSameTrack(currentTrack, playbackInfo)
  const iconBtn =
    'press flex h-12 w-12 items-center justify-center rounded-full active:bg-white/10 focus-ring'

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Pemutar penuh"
      onKeyDown={onKeyDown}
      className={`fixed inset-0 z-50 isolate flex flex-col overflow-hidden ${closing ? 'pointer-events-none' : ''}`}
      style={{ '--mv-accent': coverColor.replace(/,/g, ' ') } as CSSProperties}
    >
      {/* Latar: artwork diburamkan + gradient gelap. Memudar masuk/keluar sebagai satu lapisan (di atas Beranda). */}
      <div ref={bgRef} aria-hidden="true" className="fp-bg pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-[#0b080c]">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(180deg, rgba(${coverColor},0.38) 0%, #0b080c 62%, #0b080c 100%)`,
            transition: 'background-image 400ms ease',
          }}
        />
        {now.coverSrc && !bgFailed && (
          <img
            src={now.coverSrc}
            alt=""
            onError={() => setBgFailed(true)}
            className="absolute inset-0 h-full w-full scale-150 object-cover opacity-60"
            style={{ filter: 'blur(36px) saturate(1.3)' }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/55 to-[#0b080c]" />
      </div>
      {/* Petunjuk: seret ke bawah untuk kembali ke mini player. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[max(0.375rem,env(safe-area-inset-top))] h-1 w-10 -translate-x-1/2 rounded-full bg-white/25"
      />
      <div className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col pb-2 pl-[max(1.5rem,env(safe-area-inset-left))] pr-[max(1.5rem,env(safe-area-inset-right))] pt-[max(0.75rem,env(safe-area-inset-top))]">
        <header style={delay(60)} className="fp-item grid grid-cols-[3rem_1fr_3rem] items-center">
          <button
            ref={closeRef}
            type="button"
            onClick={animateClose}
            aria-label="Tutup pemutar penuh"
            className={`-ml-2 text-ink hover:bg-white/10 ${iconBtn}`}
          >
            <ChevronDown className="h-8 w-8" aria-hidden="true" />
          </button>
          <div className="min-w-0 px-2 text-center leading-tight">
            <p className="truncate text-sm font-semibold text-ink">Sedang diputar</p>
            <p className="truncate text-sm text-ink-muted">{now.album || now.artists}</p>
          </div>
          <button
            type="button"
            onClick={() => openTrackMenu(currentTrack, { place: 'player' })}
            aria-haspopup="dialog"
            aria-label="Menu lagu"
            className={`-mr-2 justify-self-end text-ink hover:bg-white/10 ${iconBtn}`}
          >
            <MoreVertical className="h-6 w-6" aria-hidden="true" />
          </button>
        </header>

        {/* Slot tengah: sampul, atau (saat lirik dibuka) lirik tanpa latar, lebih lebar dan tinggi. */}
        <div ref={slotRef} onTouchStart={onSwipeStart} onTouchEnd={onSwipeEnd} className="flex min-h-0 flex-1 items-center justify-center py-2">
          {showLyrics ? (
            <div className="h-full min-h-0 w-full animate-lyrics-up">
              <LyricsPanel state={lyrics} onRetry={retryLyrics} trackKey={`${currentTrack.title}|${currentTrack.artists}`} />
            </div>
          ) : (
            <div
              ref={coverRef}
              {...press}
              style={{ width: coverSize, height: coverSize }}
              className="shrink-0 select-none overflow-hidden rounded-[1.75rem] shadow-2xl shadow-black/60 [-webkit-touch-callout:none]"
            >
              <CoverArt cover={now.cover} src={now.coverSrc} />
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div style={delay(240)} className="fp-item flex items-start gap-3">
            <div {...press} className="min-w-0 flex-1 select-none [-webkit-touch-callout:none]">
              <h2 title={now.title} className="line-clamp-2 break-words font-display text-[1.65rem] font-bold leading-tight text-ink">
                {now.title}
              </h2>
              <MarqueeText text={now.artists} className="mt-1 text-base font-medium uppercase tracking-wide text-ink-muted" />
            </div>
            <button
              type="button"
              onClick={() => {
                const result = toggleLike(currentTrack)
                if (!result.ok) showToast(myPlaylistErrorText(result.reason))
                else showToast(result.value.liked ? 'Ditambahkan ke Lagu Disukai' : 'Dihapus dari Lagu Disukai')
              }}
              aria-pressed={liked}
              aria-label={liked ? 'Hapus dari Lagu Disukai' : 'Sukai lagu ini'}
              title={liked ? 'Hapus dari Lagu Disukai' : 'Tambahkan ke Lagu Disukai'}
              className={`-mr-1 mt-0.5 ${iconBtn} ${liked ? 'text-accent' : 'text-ink hover:text-accent'}`}
            >
              <LikeHeart liked={liked} />
            </button>
          </div>

          <div style={delay(290)} className="fp-item">
            {isError ? (
              <PlayerError />
            ) : (
              <>
                <SeekBar stacked />
                <p role="status" className="min-h-4 text-center text-xs text-ink-muted" aria-live="polite">
                  {status === 'playing' ? '' : STATUS_TEXT[status]}
                </p>
              </>
            )}
          </div>

          {/* Baris 1: timer · sebelumnya · putar · berikutnya · acak. */}
          <div style={delay(340)} className="fp-item">
            <TransportControls
              size="xl"
              className="!justify-between"
              leading={
                <span data-tour="sleep-timer" className="flex">
                  <SleepTimerButton variant="icon" onClick={() => setTimerOpen(true)} />
                </span>
              }
              trailing={<ShuffleButton size="lg" className="flex" />}
            />
          </div>

          {/* Baris 2. Di APK (tanpa tautan Spotify) cuma tiga tombol: ulang kiri, lirik tepat di tengah (sejajar tombol
              putar), crossfade kanan. Di web: ulang · lirik di kiri; crossfade · buka di Spotify di kanan. */}
          <div style={delay(390)} className="fp-item">
          {(() => {
            const lyricsBtn = (
              <button
                data-tour="lyrics-btn"
                type="button"
                onClick={() => setShowLyrics((value) => !value)}
                aria-pressed={showLyrics}
                aria-label={showLyrics ? 'Sembunyikan lirik' : 'Tampilkan lirik'}
                title="Lirik"
                className={`${iconBtn} ${showLyrics ? 'text-accent' : 'text-ink hover:text-accent'}`}
              >
                <Mic2 className="h-6 w-6" aria-hidden="true" />
              </button>
            )
            return isNativeApp() ? (
              <div className="grid grid-cols-3 items-center">
                <div className="flex justify-start">
                  <RepeatButton size="lg" className="flex" />
                </div>
                <div className="flex justify-center">{lyricsBtn}</div>
                <div className="flex justify-end">
                  <CrossfadeButton variant="icon" onClick={() => setCrossfadeOpen(true)} />
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <RepeatButton size="lg" className="flex" />
                  {lyricsBtn}
                </div>
                <div className="flex items-center gap-4">
                  <CrossfadeButton variant="icon" onClick={() => setCrossfadeOpen(true)} />
                  <SpotifyLink url={now.spotifyUrl} variant="icon" className="!h-12 !w-12 !text-ink" />
                </div>
              </div>
            )
          })()}
          </div>
          {timerOpen && <SleepTimerSheet onClose={() => setTimerOpen(false)} />}
          {crossfadeOpen && <CrossfadeSheet onClose={() => setCrossfadeOpen(false)} />}

          {notice && (
            <div role="alert" className="flex items-start gap-2 rounded-lg bg-card/80 px-3 py-2 text-xs text-ink">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
              <p className="min-w-0 flex-1">{noticeMessage(notice)}</p>
              <button type="button" onClick={dismissNotice} className="btn-secondary h-8 px-3 text-xs">
                Tutup
              </button>
            </div>
          )}

          {mismatch && playbackInfo && (
            <p className="text-center text-xs text-ink-muted">
              {playbackInfo.manualPick ? 'Memutar pilihan manualmu' : 'Audio yang ditemukan server berbeda dari lagu yang dipilih'}: {playbackInfo.title}
              {playbackInfo.artist ? ` — ${playbackInfo.artist}` : ''}.
            </p>
          )}
        </div>
      </div>

      {/* Bar "Berikutnya": membuka antrean (seperti handle sheet di pemutar referensi). */}
      <button
        type="button"
        data-tour="queue-bar"
        onClick={onOpenQueue}
        aria-label="Buka antrean"
        style={delay(430)}
        className="fp-item mt-1 flex w-full shrink-0 items-center justify-center gap-3 rounded-t-[2rem] border-t border-white/10 bg-black/60 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 text-base font-semibold text-ink-muted backdrop-blur-xl transition-colors hover:text-ink active:bg-white/5 focus-ring"
      >
        <ListMusic className="h-5 w-5" aria-hidden="true" />
        Berikutnya
        <ChevronUp className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  )
}
