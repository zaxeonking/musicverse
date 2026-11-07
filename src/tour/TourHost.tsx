import { ChevronLeft } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { isNativeApp } from '../native/platform'
import { TOUR_STEPS, type TourStep } from './steps'
import { endTour, goToTourStep, isTourDone, startTour, useTourState } from './tourStore'

const PAD = 6
const MARGIN = 12
const CARD_MAX_W = 352
const FIND_TIMEOUT_MS = 1600
const AUTO_START_DELAY_MS = 1500
const ACCENT = '29, 185, 84'

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

const reducedMotion = () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Elemen pertama dengan atribut `data-tour` itu yang benar-benar tampil (tab bawah dan sidebar sama-sama ada di DOM, satu disembunyikan). */
function findTarget(step: TourStep): HTMLElement | null {
  if (!step.target) return null
  const all = document.querySelectorAll<HTMLElement>(`[data-tour="${step.target}"]`)
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
  const { active, index } = useTourState()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const steps = useMemo(() => TOUR_STEPS.filter((item) => !item.nativeOnly || isNativeApp()), [])
  const step: TourStep | undefined = active ? steps[index] : undefined
  const pathRef = useRef(pathname)
  pathRef.current = pathname

  const [target, setTarget] = useState<HTMLElement | null>(null)
  const [searching, setSearching] = useState(false)
  const [rect, setRect] = useState<Rect | null>(null)
  const [cardH, setCardH] = useState(220)
  const cardRef = useRef<HTMLDivElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)
  const dotRef = useRef<HTMLSpanElement>(null)

  // Mulai otomatis sekali, di Beranda, setelah layar tenang sebentar.
  useEffect(() => {
    if (active || pathname !== '/' || isTourDone()) return
    const timer = window.setTimeout(startTour, AUTO_START_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [active, pathname])

  // Pindah ke halaman langkah ini, lalu tunggu elemen targetnya muncul (halaman baru butuh waktu merender).
  const stepId = step?.id
  useEffect(() => {
    setTarget(null)
    setRect(null)
    if (!step) return
    if (step.route && pathRef.current !== step.route) navigate(step.route)
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
    const timer = window.setTimeout(tick, step.route && pathRef.current !== step.route ? 250 : 0)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepId, navigate])

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

  // Mengetuk elemen yang disorot (langkah tab) = lanjut otomatis.
  useEffect(() => {
    if (!target || !step?.advanceOnTargetClick) return
    const onClick = () => window.setTimeout(() => (index + 1 < steps.length ? goToTourStep(index + 1) : endTour()), 250)
    target.addEventListener('click', onClick, { capture: true })
    return () => target.removeEventListener('click', onClick, { capture: true })
  }, [target, step, index, steps.length])

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
    const animation = dot.animate(frames, { duration: step.animate === 'swipe' ? 3200 : step.animate === 'press' ? 1800 : 1300, iterations: Infinity, easing: 'ease-in-out' })
    return () => animation.cancel()
  }, [rect, step])

  if (!step) return null

  const last = index >= steps.length - 1
  const hasTarget = rect !== null && target !== null
  const interactive = step.advanceOnTargetClick === true
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
    <div className="fixed inset-0 z-[100]" role="presentation">
      {/* Penghalang sentuhan: seluruh layar, atau empat potongan di sekeliling lubang bila elemen boleh diketuk. */}
      {hole && interactive ? (
        <>
          <div style={{ position: 'fixed', left: 0, top: 0, width: '100%', height: Math.max(0, hole.y) }} />
          <div style={{ position: 'fixed', left: 0, top: hole.y + hole.h, width: '100%', bottom: 0 }} />
          <div style={{ position: 'fixed', left: 0, top: hole.y, width: Math.max(0, hole.x), height: hole.h }} />
          <div style={{ position: 'fixed', left: hole.x + hole.w, top: hole.y, right: 0, height: hole.h }} />
        </>
      ) : (
        <div className="absolute inset-0" />
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

      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-live="polite"
        aria-label={`Tutorial, langkah ${index + 1} dari ${steps.length}: ${step.title}`}
        style={{ ...cardStyle, transition: move }}
        className="rounded-2xl border border-line bg-card p-4 shadow-2xl shadow-black/60"
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold text-ink-muted">
            {index + 1} / {steps.length}
          </p>
          <div className="flex items-center gap-1" aria-hidden="true">
            {steps.map((item, i) => (
              <span key={item.id} className={`h-1.5 rounded-full transition-all ${i === index ? 'w-4 bg-accent' : i < index ? 'w-1.5 bg-accent/60' : 'w-1.5 bg-raised'}`} />
            ))}
          </div>
        </div>
        <h2 className="mt-2 font-display text-lg font-bold leading-snug text-ink">{step.title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-ink-muted">{text}</p>
        <div className="mt-4 flex items-center gap-2">
          {last ? (
            <span className="flex-1" />
          ) : (
            <button type="button" onClick={endTour} className="btn-secondary h-10 flex-1 px-3 text-sm">
              Lewati
            </button>
          )}
          {index > 0 && (
            <button type="button" onClick={() => goToTourStep(index - 1)} aria-label="Langkah sebelumnya" className="icon-btn h-10 w-10 bg-raised">
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
          <button ref={nextRef} type="button" onClick={() => (last ? endTour() : goToTourStep(index + 1))} className="btn-primary h-10 flex-1 px-4 text-sm">
            {last ? 'Selesai' : index === 0 ? 'Mulai' : 'Lanjut'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
