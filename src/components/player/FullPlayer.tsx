import { lyricsTrackFor } from '../../utils/lyricsTrack'
import { AlertCircle, ChevronDown, ChevronUp, Heart, ListMusic, Mic2, MoreVertical } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type TouchEvent } from 'react'
import { useLibrary } from '../../context/LibraryContext'
import { myPlaylistErrorText, useMyPlaylists } from '../../context/MyPlaylistsContext'
import { useTrackMenu } from '../../context/TrackMenuContext'
import { useAudioPlayer } from '../../hooks/useAudioPlayer'
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
import SleepTimerSheet, { SleepTimerButton } from './SleepTimerSheet'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Pemutar penuh (dialog modal). Memakai state dan aksi yang sama dengan MiniPlayer,
 * sehingga keduanya selalu sinkron. Esc / tombol turun menutupnya.
 */
export default function FullPlayer({ onClose, onOpenQueue }: { onClose: () => void; onOpenQueue: () => void }) {
  const { status, currentTrack, playbackInfo } = useAudioPlayer()
  const now = useNowPlaying()
  const { notice, dismissNotice } = useLibrary()
  const { openTrackMenu, showToast } = useTrackMenu()
  const { isLiked, toggleLike } = useMyPlaylists()
  // Tahan lama pada sampul atau judul = menu lagu yang sedang diputar.
  const press = useLongPress(() => {
    if (currentTrack) openTrackMenu(currentTrack, { place: 'player' })
  })
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
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

  useEffect(() => {
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

  // Tutup dengan animasi: pemutar meluncur turun ke mini player, baru riwayat dimundurkan.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])
  const closingRef = useRef(false)
  const animateClose = useCallback(() => {
    const el = dialogRef.current
    if (closingRef.current) return
    closingRef.current = true
    if (!el) {
      onCloseRef.current()
      return
    }
    el.style.animation = 'none'
    el.style.transformOrigin = 'top center'
    el.style.transition = 'transform 280ms cubic-bezier(0.5,0,0.75,0), border-radius 280ms, opacity 240ms ease-in 60ms'
    el.style.borderRadius = '28px'
    el.style.transform = `translate3d(0, ${window.innerHeight}px, 0) scale(0.92)`
    el.style.opacity = '0.6'
    window.setTimeout(() => onCloseRef.current(), 250)
  }, [])

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
      el.style.transform = `translate3d(0, ${pull}px, 0) scale(${1 - p * 0.07})`
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
    'flex h-12 w-12 items-center justify-center rounded-full transition-colors active:bg-white/10 focus-ring'

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Pemutar penuh"
      onKeyDown={onKeyDown}
      className="fixed inset-0 z-50 flex animate-sheet-expand flex-col overflow-hidden bg-bg"
      style={{ backgroundImage: `linear-gradient(180deg, ${now.cover.from}55 0%, #0b080c 62%, #0b080c 100%)` }}
    >
      {/* Petunjuk: seret ke bawah untuk kembali ke mini player. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[max(0.375rem,env(safe-area-inset-top))] h-1 w-10 -translate-x-1/2 rounded-full bg-white/25"
      />
      <div className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col pb-2 pl-[max(1.5rem,env(safe-area-inset-left))] pr-[max(1.5rem,env(safe-area-inset-right))] pt-[max(0.75rem,env(safe-area-inset-top))]">
        <header className="grid grid-cols-[3rem_1fr_3rem] items-center">
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
              {...press}
              style={{ width: coverSize, height: coverSize }}
              className="shrink-0 select-none overflow-hidden rounded-[1.75rem] shadow-2xl shadow-black/60 [-webkit-touch-callout:none]"
            >
              <CoverArt cover={now.cover} src={now.coverSrc} />
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-start gap-3">
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
              <Heart className={`h-7 w-7 transition-transform duration-200 ${liked ? 'scale-110' : ''}`} fill={liked ? 'currentColor' : 'none'} aria-hidden="true" />
            </button>
          </div>

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

          {/* Baris 1: timer · sebelumnya · putar · berikutnya · acak. */}
          <TransportControls
            size="xl"
            className="!justify-between"
            leading={<SleepTimerButton variant="icon" onClick={() => setTimerOpen(true)} />}
            trailing={<ShuffleButton size="lg" className="flex" />}
          />

          {/* Baris 2. Di APK (tanpa tautan Spotify) cuma tiga tombol: ulang kiri, lirik tepat di tengah (sejajar tombol
              putar), crossfade kanan. Di web: ulang · lirik di kiri; crossfade · buka di Spotify di kanan. */}
          {(() => {
            const lyricsBtn = (
              <button
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
              Audio yang ditemukan server berbeda dari lagu yang dipilih: {playbackInfo.title}
              {playbackInfo.artist ? ` — ${playbackInfo.artist}` : ''}.
            </p>
          )}
        </div>
      </div>

      {/* Bar "Berikutnya": membuka antrean (seperti handle sheet di pemutar referensi). */}
      <button
        type="button"
        onClick={onOpenQueue}
        aria-label="Buka antrean"
        className="mt-1 flex w-full shrink-0 items-center justify-center gap-3 rounded-t-[2rem] border-t border-white/10 bg-black/60 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 text-base font-semibold text-ink-muted backdrop-blur-xl transition-colors hover:text-ink active:bg-white/5 focus-ring"
      >
        <ListMusic className="h-5 w-5" aria-hidden="true" />
        Berikutnya
        <ChevronUp className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  )
}
