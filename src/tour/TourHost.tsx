import { Check, ChevronLeft, Hand } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { usePlayerUi } from '../context/PlayerUiContext'
import { useAudioPlayer } from '../hooks/useAudioPlayer'
import { isNativeApp } from '../native/platform'
import DemoStage from './DemoStage'
import PracticeStage from './PracticeStage'
import { PAGE_TOURS, TOUR_STEPS, type PageTour, type PageTourId, type TourStep } from './steps'
import {
  autoStartTour,
  endTour,
  goToTourStep,
  isPageTourSeen,
  isTourDone,
  markPageTourSeen,
  startPageTour,
  startWhatsNew,
  unseenWhatsNewSteps,
  useTourState,
  whatsNewReady,
} from './tourStore'
import { prefersReducedMotion } from '../utils/motion'

const PAD = 6
const MARGIN = 12
const CARD_MAX_W = 352
const FIND_TIMEOUT_MS = 1600
const AUTO_START_DELAY_MS = 1500
const ACCENT = '29, 185, 84'
const PAGE_TOUR_DELAY_MS = 900
const WHATS_NEW_DELAY_MS = 2000
const PLAYER_CLOSE_MS = 350
const CONFETTI_COLORS = ['#1db954', '#ffffff', '#f5c542', '#ff6b81', '#5ac8fa']
const CONFETTI_COUNT = 28

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

const reducedMotion = () => prefersReducedMotion()

/** Elemen pertama dengan atribut `data-tour` itu yang benar-benar tampil (tab bawah dan sidebar sama-sama ada di DOM, satu disembunyikan). */
function findTarget(step: TourStep): HTMLElement | null {
  if (!step.target) return null
  const all = document.querySelectorAll<HTMLElement>(`[data-tour~="${step.target}"]`)
  for (const el of all) {
    const rect = el.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) continue
    if (step.pickChild !== undefined && el.children.length > 0) {
      const child = el.children[Math.min(step.pickChild, el.children.length - 1)]
      if (child instanceof HTMLElement) return child
    }
    return el
  }
  return null
}

/**
 * Coach marks: menyorot elemen asli di layar, kartu penjelasan di dekatnya, dan tombol Lanjut / Kembali / Lewati.
 * Lanjut membuka halaman langkah berikutnya sendiri; langkah yang menyorot tab bisa juga lanjut dengan mengetuk tab itu.
 * Bila elemen target tidak ada (mis. belum ada lagu), kartu tampil di tengah dengan penjelasan yang tetap berguna.
 * Dirender di dalam router (AppShell). Mulai otomatis sekali saat pertama dibuka; bisa diulang lewat `startTour()`.
 */
export default function TourHost() {
  const { active, index, tour } = useTourState()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const steps = useMemo(
    () => (tour === 'main' ? TOUR_STEPS : tour === 'whatsnew' ? unseenWhatsNewSteps() : PAGE_TOURS[tour].steps).filter((item) => !item.nativeOnly || isNativeApp()),
    [tour],
  )
  const { fullPlayerOpen, openFullPlayer, closeFullPlayer } = usePlayerUi()
  const { status, currentTrack } = useAudioPlayer()
  const playerActive = status !== 'idle' && currentTrack !== null
  const playerRef = useRef({ open: fullPlayerOpen, active: playerActive, openFullPlayer, closeFullPlayer })
  playerRef.current = { open: fullPlayerOpen, active: playerActive, openFullPlayer, closeFullPlayer }
  /** Pemutar penuh dibuka oleh tutorial (bukan oleh pengguna), jadi tutorial juga yang menutupnya. */
  const openedByTour = useRef(false)
  const confettiRef = useRef<HTMLDivElement>(null)
  const step: TourStep | undefined = active ? steps[index] : undefined
  const pathRef = useRef(pathname)
  pathRef.current = pathname

  const [target, setTarget] = useState<HTMLElement | null>(null)
  const [searching, setSearching] = useState(false)
  const [rect, setRect] = useState<Rect | null>(null)
  const [cardH, setCardH] = useState(220)
  const [done, setDone] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)
  const dotRef = useRef<HTMLSpanElement>(null)

  // Mulai otomatis sekali, di Beranda, setelah layar tenang sebentar. Kalau sempat terhenti di tengah, lanjut dari langkah terakhir.
  useEffect(() => {
    if (active || pathname !== '/' || isTourDone()) return
    const timer = window.setTimeout(autoStartTour, AUTO_START_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [active, pathname])

  // "Yang baru": sekali di Beranda untuk pengguna yang sudah menamatkan (atau melewati, di sesi sebelumnya) tutorial utama.
  useEffect(() => {
    if (active || pathname !== '/' || !isTourDone() || !whatsNewReady()) return
    const timer = window.setTimeout(() => {
      if (unseenWhatsNewSteps().some((item) => !item.nativeOnly || isNativeApp())) startWhatsNew()
    }, WHATS_NEW_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [active, pathname])

  // Tur kecil per halaman: sekali saja saat halamannya pertama dibuka, setelah tutorial utama selesai atau dilewati.
  useEffect(() => {
    if (active || !isTourDone()) return
    const entry = (Object.entries(PAGE_TOURS) as [PageTourId, PageTour][]).find(([, item]) => item.route === pathname)
    if (!entry) return
    const [id, item] = entry
    if ((item.nativeOnly && !isNativeApp()) || isPageTourSeen(id)) return
    const timer = window.setTimeout(() => startPageTour(id), PAGE_TOUR_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [active, pathname])

  // Pindah ke halaman langkah ini, lalu tunggu elemen targetnya muncul (halaman baru butuh waktu merender).
  const stepId = step?.id
  useEffect(() => {
    // Pemutar penuh: dibuka untuk langkah yang memerlukannya, ditutup lagi (oleh tutorial) saat tidak diperlukan.
    let delay = 0
    const player = playerRef.current
    if (step?.openPlayer) {
      if (player.active && !player.open) {
        player.openFullPlayer()
        openedByTour.current = true
      }
    } else if (openedByTour.current) {
      openedByTour.current = false
      if (player.open) {
        player.closeFullPlayer()
        delay = PLAYER_CLOSE_MS
      }
    }
    setDone(false)
    setTarget(null)
    setRect(null)
    if (!step) return
    // Menyelesaikan kunjungan ke halaman ini lewat tutorial utama = tur kecil halamannya tidak perlu muncul lagi.
    if (tour === 'main' && step.route) {
      const seen = (Object.entries(PAGE_TOURS) as [PageTourId, PageTour][]).find(([, item]) => item.route === step.route)
      if (seen) markPageTourSeen(seen[0])
    }
    const needsRoute = step.route !== undefined && pathRef.current !== step.route
    // Pindah halaman menunggu pemutar penuh selesai menutup, supaya riwayat tidak kacau.
    const routeTimer = window.setTimeout(() => {
      if (step.route && pathRef.current !== step.route) navigate(step.route)
    }, delay)
    let cancelled = false
    let tries = 0
    setSearching(step.target !== undefined)
    const tick = () => {
      if (cancelled) return
      const el = findTarget(step)
      if (el) {
        setTarget(el)
        setSearching(false)
        el.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' })
        return
      }
      tries += 1
      if (!step.target || tries * 100 >= FIND_TIMEOUT_MS) {
        setSearching(false)
        return
      }
      window.setTimeout(tick, 100)
    }
    const timer = window.setTimeout(tick, delay + (needsRoute ? 250 : 0))
    return () => {
      cancelled = true
      window.clearTimeout(timer)
      window.clearTimeout(routeTimer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepId, tour, navigate])

  // Ikuti posisi elemen (scroll, perubahan ukuran, animasi halaman) selama langkah berjalan.
  useEffect(() => {
    if (!target) return
    let raf = 0
    const loop = () => {
      if (!target.isConnected) {
        setTarget(null)
        setRect(null)
        return
      }
      const r = target.getBoundingClientRect()
      setRect((prev) =>
        prev && Math.abs(prev.x - r.left) < 0.5 && Math.abs(prev.y - r.top) < 0.5 && Math.abs(prev.w - r.width) < 0.5 && Math.abs(prev.h - r.height) < 0.5
          ? prev
          : { x: r.left, y: r.top, w: r.width, h: r.height },
      )
      const height = cardRef.current?.offsetHeight
      if (height) setCardH((prev) => (prev === height ? prev : height))
      raf = requestAnimationFrame(loop)
    }
    loop()
    return () => cancelAnimationFrame(raf)
  }, [target])

  // Latihan selesai: tampilkan "Berhasil" sebentar, lalu lanjut otomatis ke langkah berikutnya.
  useEffect(() => {
    if (!done) return
    const timer = window.setTimeout(() => (index + 1 < steps.length ? goToTourStep(index + 1) : endTour(true)), 1100)
    return () => window.clearTimeout(timer)
  }, [done, index, steps.length])

  // Mengetuk elemen yang disorot (langkah tab) = lanjut otomatis.
  useEffect(() => {
    if (!target || !step?.advanceOnTargetClick) return
    const onClick = () => window.setTimeout(() => (index + 1 < steps.length ? goToTourStep(index + 1) : endTour(true)), 250)
    target.addEventListener('click', onClick, { capture: true })
    return () => target.removeEventListener('click', onClick, { capture: true })
  }, [target, step, index, steps.length])

  // Langkah yang boleh dicoba langsung: bila ketukan membuka pemutar penuh, tutorial yang menutupnya lagi di langkah berikutnya.
  useEffect(() => {
    if (!target || !step?.tryTarget) return
    let timer = 0
    const onClick = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        if (playerRef.current.open && !step.openPlayer) openedByTour.current = true
      }, 450)
    }
    target.addEventListener('click', onClick, { capture: true })
    return () => {
      window.clearTimeout(timer)
      target.removeEventListener('click', onClick, { capture: true })
    }
  }, [target, step])

  // Escape = lewati. Fokus ke tombol Lanjut tiap ganti langkah.
  useEffect(() => {
    if (!active) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') endTour()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active])
  useEffect(() => {
    if (step) nextRef.current?.focus({ preventScroll: true })
  }, [stepId, step])

  // Peragaan jari: titik beraksen yang bergeser (geser), berdenyut (tekan lama), atau beriak (ketuk).
  useEffect(() => {
    const dot = dotRef.current
    if (!dot || !rect || !step?.animate || reducedMotion()) return
    const reach = Math.max(24, Math.min(rect.w * 0.32, 120))
    const drop = Math.max(24, Math.min(rect.h * 0.9, 90))
    const frames: Keyframe[] =
      step.animate === 'swipe'
        ? [
            { transform: 'translateX(0) scale(1)', opacity: 0 },
            { transform: 'translateX(0) scale(1)', opacity: 1, offset: 0.1 },
            { transform: `translateX(${reach}px) scale(1.1)`, opacity: 1, offset: 0.35 },
            { transform: 'translateX(0) scale(1)', opacity: 1, offset: 0.55 },
            { transform: `translateX(${-reach}px) scale(1.1)`, opacity: 1, offset: 0.8 },
            { transform: 'translateX(0) scale(1)', opacity: 0 },
          ]
        : step.animate === 'roll'
          ? [
              // Geser samping jadi disc: ke kanan, lalu ke kiri (kartu menjadi disc di sisi arah geser).
              { transform: 'translateX(0) scale(1)', opacity: 0 },
              { transform: 'translateX(0) scale(1)', opacity: 1, offset: 0.08 },
              { transform: `translateX(${reach * 1.4}px) scale(1.1)`, opacity: 1, offset: 0.3, easing: 'cubic-bezier(0.32, 0.72, 0, 1)' },
              { transform: `translateX(${reach * 1.4}px) scale(1)`, opacity: 0, offset: 0.38 },
              { transform: 'translateX(0) scale(1)', opacity: 0, offset: 0.5 },
              { transform: 'translateX(0) scale(1)', opacity: 1, offset: 0.58 },
              { transform: `translateX(${-reach * 1.4}px) scale(1.1)`, opacity: 1, offset: 0.8, easing: 'cubic-bezier(0.32, 0.72, 0, 1)' },
              { transform: `translateX(${-reach * 1.4}px) scale(1)`, opacity: 0, offset: 0.88 },
              { transform: 'translateX(0) scale(1)', opacity: 0 },
            ]
          : step.animate === 'down'
            ? [
                // Geser bawah: kartu tenggelam, musik ditutup.
                { transform: 'translateY(0) scale(1)', opacity: 0 },
                { transform: 'translateY(0) scale(1)', opacity: 1, offset: 0.12 },
                { transform: `translateY(${drop}px) scale(1.1)`, opacity: 1, offset: 0.6, easing: 'cubic-bezier(0.32, 0.72, 0, 1)' },
                { transform: `translateY(${drop}px) scale(1)`, opacity: 0, offset: 0.72 },
                { transform: 'translateY(0) scale(1)', opacity: 0 },
              ]
            : step.animate === 'press'
              ? [
                  { transform: 'scale(0.6)', opacity: 0 },
                  { transform: 'scale(1)', opacity: 1, offset: 0.2 },
                  { transform: 'scale(1.35)', opacity: 1, offset: 0.7 },
                  { transform: 'scale(1.5)', opacity: 0 },
                ]
              : [
                  { transform: 'scale(0.6)', opacity: 0 },
                  { transform: 'scale(1)', opacity: 1, offset: 0.3 },
                  { transform: 'scale(1.6)', opacity: 0 },
                ]
    const duration = step.animate === 'swipe' ? 3200 : step.animate === 'roll' ? 4200 : step.animate === 'down' ? 2800 : step.animate === 'press' ? 1800 : 1300
    const animation = dot.animate(frames, { duration, iterations: Infinity, easing: 'ease-in-out' })
    return () => animation.cancel()
  }, [rect, step])

  // Langkah terakhir: konfeti kecil yang jatuh dari atas layar.
  useEffect(() => {
    const box = confettiRef.current
    if (!box || reducedMotion()) return
    const animations = Array.from(box.children).map((piece, i) => {
      const drift = (Math.random() - 0.5) * 160
      const spin = (Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 540)
      return (piece as HTMLElement).animate(
        [
          { transform: 'translate(0, 0) rotate(0deg)', opacity: 1 },
          { transform: `translate(${drift}px, ${window.innerHeight * 0.9}px) rotate(${spin}deg)`, opacity: 0.9, offset: 0.8 },
          { transform: `translate(${drift * 1.2}px, ${window.innerHeight}px) rotate(${spin * 1.1}deg)`, opacity: 0 },
        ],
        { duration: 1800 + Math.random() * 1400, delay: i * 40, easing: 'ease-in', fill: 'forwards' },
      )
    })
    return () => animations.forEach((animation) => animation.cancel())
  }, [stepId])

  if (!step) return null

  const last = index >= steps.length - 1
  const hasTarget = rect !== null && target !== null
  const interactive = step.advanceOnTargetClick === true || step.tryTarget === true
  const vw = window.innerWidth
  const vh = window.innerHeight
  const cardW = Math.min(CARD_MAX_W, vw - MARGIN * 2)
  const text = hasTarget || searching ? step.body : (step.missing ?? step.body)

  const hole = hasTarget ? { x: rect.x - PAD, y: rect.y - PAD, w: rect.w + PAD * 2, h: rect.h + PAD * 2 } : null
  let cardStyle: CSSProperties
  if (hole) {
    const below = vh - (hole.y + hole.h) >= cardH + MARGIN * 2
    const above = hole.y >= cardH + MARGIN * 2
    const top = below ? hole.y + hole.h + MARGIN : above ? hole.y - cardH - MARGIN : vh - cardH - MARGIN
    const left = Math.min(Math.max(hole.x + hole.w / 2 - cardW / 2, MARGIN), vw - cardW - MARGIN)
    cardStyle = { position: 'fixed', top: Math.max(MARGIN, top), left, width: cardW }
  } else {
    cardStyle = { position: 'fixed', top: '50%', left: '50%', width: cardW, transform: 'translate(-50%, -50%)' }
  }

  const move = reducedMotion() ? 'none' : 'top 260ms ease, left 260ms ease, width 260ms ease, height 260ms ease'

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[100]" role="presentation">
      {/* Penghalang sentuhan: seluruh layar, atau empat potongan di sekeliling lubang bila elemen boleh diketuk. */}
      {hole && interactive ? (
        <>
          <div style={{ position: 'fixed', left: 0, top: 0, width: '100%', height: Math.max(0, hole.y), pointerEvents: 'auto' }} />
          <div style={{ position: 'fixed', left: 0, top: hole.y + hole.h, width: '100%', bottom: 0, pointerEvents: 'auto' }} />
          <div style={{ position: 'fixed', left: 0, top: hole.y, width: Math.max(0, hole.x), height: hole.h, pointerEvents: 'auto' }} />
          <div style={{ position: 'fixed', left: hole.x + hole.w, top: hole.y, right: 0, height: hole.h, pointerEvents: 'auto' }} />
        </>
      ) : (
        <div className="pointer-events-auto absolute inset-0" />
      )}

      {hole ? (
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            left: hole.x,
            top: hole.y,
            width: hole.w,
            height: hole.h,
            borderRadius: 14,
            pointerEvents: 'none',
            boxShadow: `0 0 0 2px rgb(${ACCENT}), 0 0 0 9999px rgba(0, 0, 0, 0.74)`,
            transition: move,
          }}
        >
          {step.animate && (
            <span
              ref={dotRef}
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: 28,
                height: 28,
                marginLeft: -14,
                marginTop: -14,
                borderRadius: 9999,
                background: `rgba(${ACCENT}, 0.55)`,
                border: `2px solid rgb(${ACCENT})`,
                opacity: 0,
              }}
            />
          )}
        </div>
      ) : (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-black/75" />
      )}

      {step.id === 'finish' && (
        <div ref={confettiRef} aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          {Array.from({ length: CONFETTI_COUNT }, (_, i) => (
            <span
              key={i}
              style={{
                position: 'absolute',
                top: -16,
                left: `${(i * 37 + 7) % 100}%`,
                width: 8,
                height: 12,
                borderRadius: 2,
                background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                opacity: 0,
              }}
            />
          ))}
        </div>
      )}

      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-live="polite"
        aria-label={`Tutorial, langkah ${index + 1} dari ${steps.length}: ${step.title}`}
        style={{ ...cardStyle, transition: move }}
        className="pointer-events-auto rounded-2xl border border-line bg-card p-4 shadow-2xl shadow-black/60"
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold text-ink-muted">
            {index + 1} / {steps.length}
          </p>
          <div className="flex items-center gap-1" aria-hidden="true">
            {steps.map((item, i) => (
              <span key={item.id} className={`h-1.5 rounded-full transition-[width,background-color] ${i === index ? 'w-4 bg-accent' : i < index ? 'w-1.5 bg-accent/60' : 'w-1.5 bg-raised'}`} />
            ))}
          </div>
        </div>
        <h2 className="mt-2 font-display text-lg font-bold leading-snug text-ink">{step.title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-ink-muted">{text}</p>
        {step.task && (!step.tryTarget || hasTarget) && (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent">
            <Hand className="h-3.5 w-3.5" aria-hidden="true" />
            Coba: {step.task}
          </p>
        )}
        {step.demo && <DemoStage key={step.id} kind={step.demo} />}
        {step.practice && <PracticeStage key={step.id} kind={step.practice} onComplete={() => setDone(true)} />}
        {done && (
          <p role="status" className="mt-2 flex animate-pop items-center gap-1.5 text-sm font-semibold text-accent">
            <Check className="h-4 w-4" strokeWidth={3} aria-hidden="true" />
            Berhasil! Lanjut otomatis…
          </p>
        )}
        <div className="mt-4 flex items-center gap-2">
          {last ? (
            <span className="flex-1" />
          ) : (
            <button type="button" onClick={() => endTour()} className="btn-secondary h-10 flex-1 px-3 text-sm">
              Lewati
            </button>
          )}
          {index > 0 && (
            <button type="button" onClick={() => goToTourStep(index - 1)} aria-label="Langkah sebelumnya" className="icon-btn h-10 w-10 bg-raised">
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
          <button ref={nextRef} type="button" onClick={() => (last ? endTour(true) : goToTourStep(index + 1))} className="btn-primary h-10 flex-1 px-4 text-sm">
            {last ? 'Selesai' : index === 0 && tour === 'main' ? 'Mulai' : 'Lanjut'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
