import { Play } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import type { DemoKind } from './steps'

const reducedMotion = () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Satu putaran peragaan (ms). */
const LOOP_MS = 4600
const DISC = 44
const CARD_H = 64
/** Bentuk kartu penuh dan bentuk lingkaran disc di pojok kanan bawah (sama dengan gerakan asli di MiniPlayer). */
const CLIP_FULL = 'inset(-8px -8px -8px -8px round 16px)'
const CLIP_DISC = `inset(${CARD_H - DISC}px 0px 0px calc(100% - ${DISC}px) round ${DISC / 2}px)`

type Frame = Keyframe & { offset: number }

/** Animasi berulang pada satu elemen; dibatalkan otomatis saat peragaan berganti / hilang. */
function useLoop(ref: RefObject<HTMLElement | null>, frames: () => Frame[], deps: readonly unknown[] = []) {
  useEffect(() => {
    const el = ref.current
    if (!el || reducedMotion() || typeof el.animate !== 'function') return
    const animation = el.animate(frames(), { duration: LOOP_MS, iterations: Infinity, easing: 'linear' })
    return () => animation.cancel()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

/** Titik jari beraksen, sama dengan peragaan jari di atas sorotan. */
function Finger({ innerRef, className = '' }: { innerRef: RefObject<HTMLSpanElement>; className?: string }) {
  return (
    <span
      ref={innerRef}
      aria-hidden="true"
      style={{ opacity: 0 }}
      className={`pointer-events-none absolute z-20 h-7 w-7 rounded-full border-2 border-accent bg-accent/50 ${className}`}
    />
  )
}

function CardFace() {
  return (
    <div className="flex h-full items-center gap-2.5 rounded-2xl border border-line bg-raised px-2.5">
      <span className="h-10 w-10 shrink-0 rounded-lg bg-accent/40" />
      <span className="min-w-0 flex-1 space-y-1.5">
        <span className="block h-2 w-3/5 rounded-full bg-ink/70" />
        <span className="block h-1.5 w-2/5 rounded-full bg-ink/30" />
      </span>
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-bg">
        <Play className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true" />
      </span>
    </div>
  )
}

function Disc({ innerRef, className = '' }: { innerRef?: RefObject<HTMLDivElement>; className?: string }) {
  return (
    <div
      ref={innerRef}
      aria-hidden="true"
      style={{ width: DISC, height: DISC }}
      className={`flex items-center justify-center rounded-full border-[3px] border-accent/70 bg-raised shadow-lg ${className}`}
    >
      <span className="h-6 w-6 rounded-full bg-accent/35" />
      <span className="absolute h-2 w-2 rounded-full bg-bg" />
    </div>
  )
}

/** Geser samping: kartu mengerut jadi disc di pojok, lalu ketukan membesarkannya lagi. */
function MiniRoll() {
  const box = useRef<HTMLDivElement>(null)
  const card = useRef<HTMLDivElement>(null)
  const disc = useRef<HTMLDivElement>(null)
  const swipe = useRef<HTMLSpanElement>(null)
  const tap = useRef<HTMLSpanElement>(null)
  const reach = () => Math.max(70, Math.min((box.current?.offsetWidth ?? 300) * 0.4, 140))
  const ease = 'cubic-bezier(0.32, 0.72, 0, 1)'

  useLoop(card, () => [
    { offset: 0, clipPath: CLIP_FULL, opacity: 1, easing: 'linear' },
    { offset: 0.12, clipPath: CLIP_FULL, opacity: 1, easing: ease },
    { offset: 0.42, clipPath: CLIP_DISC, opacity: 0, easing: 'linear' },
    { offset: 0.7, clipPath: CLIP_DISC, opacity: 0, easing: ease },
    { offset: 0.9, clipPath: CLIP_FULL, opacity: 1 },
    { offset: 1, clipPath: CLIP_FULL, opacity: 1 },
  ])
  useLoop(disc, () => [
    { offset: 0, opacity: 0, transform: 'rotate(0deg) scale(0.6)', easing: 'linear' },
    { offset: 0.2, opacity: 0, transform: 'rotate(0deg) scale(0.6)', easing: ease },
    { offset: 0.42, opacity: 1, transform: 'rotate(360deg) scale(1)', easing: 'linear' },
    { offset: 0.7, opacity: 1, transform: 'rotate(360deg) scale(1)', easing: 'ease-out' },
    { offset: 0.84, opacity: 0, transform: 'rotate(360deg) scale(0.9)' },
    { offset: 1, opacity: 0, transform: 'rotate(360deg) scale(0.9)' },
  ])
  useLoop(swipe, () => {
    const x = reach()
    return [
      { offset: 0, opacity: 0, transform: 'translateX(0) scale(1)', easing: 'ease-out' },
      { offset: 0.07, opacity: 1, transform: 'translateX(0) scale(1)', easing: ease },
      { offset: 0.4, opacity: 1, transform: `translateX(${x}px) scale(1.1)`, easing: 'ease-out' },
      { offset: 0.46, opacity: 0, transform: `translateX(${x}px) scale(1)` },
      { offset: 1, opacity: 0, transform: `translateX(${x}px) scale(1)` },
    ]
  })
  useLoop(tap, () => [
    { offset: 0, opacity: 0, transform: 'scale(0.6)' },
    { offset: 0.6, opacity: 0, transform: 'scale(0.6)', easing: 'ease-out' },
    { offset: 0.64, opacity: 1, transform: 'scale(1)', easing: 'ease-out' },
    { offset: 0.74, opacity: 0, transform: 'scale(1.7)' },
    { offset: 1, opacity: 0, transform: 'scale(1.7)' },
  ])

  return (
    <div ref={box} className="relative h-24 overflow-hidden rounded-xl bg-bg px-3">
      <div ref={card} style={{ height: CARD_H }} className="absolute inset-x-3 bottom-3">
        <CardFace />
      </div>
      <Disc innerRef={disc} className="absolute bottom-3 right-3" />
      <Finger innerRef={swipe} className="bottom-[30px] left-1/2 -ml-3.5" />
      <Finger innerRef={tap} className="bottom-[20px] right-[20px]" />
    </div>
  )
}

/** Geser bawah: kartu tenggelam ke belakang nav lalu hilang (musik ditutup). */
function MiniClose() {
  const card = useRef<HTMLDivElement>(null)
  const finger = useRef<HTMLSpanElement>(null)
  const ease = 'cubic-bezier(0.32, 0.72, 0, 1)'

  useLoop(card, () => [
    { offset: 0, transform: 'translateY(0) scale(1)', opacity: 1, easing: 'linear' },
    { offset: 0.12, transform: 'translateY(0) scale(1)', opacity: 1, easing: ease },
    { offset: 0.42, transform: 'translateY(46px) scale(0.88)', opacity: 0, easing: 'linear' },
    { offset: 0.74, transform: 'translateY(46px) scale(0.88)', opacity: 0, easing: 'ease-out' },
    { offset: 0.9, transform: 'translateY(0) scale(1)', opacity: 1 },
    { offset: 1, transform: 'translateY(0) scale(1)', opacity: 1 },
  ])
  useLoop(finger, () => [
    { offset: 0, opacity: 0, transform: 'translateY(0) scale(1)', easing: 'ease-out' },
    { offset: 0.07, opacity: 1, transform: 'translateY(0) scale(1)', easing: ease },
    { offset: 0.38, opacity: 1, transform: 'translateY(34px) scale(1.1)', easing: 'ease-out' },
    { offset: 0.44, opacity: 0, transform: 'translateY(34px) scale(1)' },
    { offset: 1, opacity: 0, transform: 'translateY(34px) scale(1)' },
  ])

  return (
    <div className="relative h-28 overflow-hidden rounded-xl bg-bg px-3">
      <div ref={card} style={{ height: CARD_H }} className="absolute inset-x-3 top-3">
        <CardFace />
      </div>
      <Finger innerRef={finger} className="left-1/2 top-[30px] -ml-3.5" />
      {/* Nav di depan kartu: kartu masuk ke belakangnya saat tenggelam. */}
      <div aria-hidden="true" className="absolute inset-x-3 bottom-2 z-10 flex h-9 items-center justify-around rounded-2xl border border-line bg-card">
        <span className="h-1.5 w-8 rounded-full bg-accent" />
        <span className="h-1.5 w-8 rounded-full bg-ink/25" />
        <span className="h-1.5 w-8 rounded-full bg-ink/25" />
      </div>
    </div>
  )
}

/** Disc: seret ke sisi lain, menempel dengan sedikit membal. */
function DiscSide() {
  const box = useRef<HTMLDivElement>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const finger = useRef<HTMLSpanElement>(null)
  const dist = () => Math.max(60, (box.current?.offsetWidth ?? 300) - 24 - DISC)
  const settle = 'cubic-bezier(0.34, 1.56, 0.64, 1)'

  useLoop(wrap, () => {
    const x = dist()
    return [
      { offset: 0, transform: 'translateX(0) scale(1)', easing: 'ease-out' },
      { offset: 0.1, transform: 'translateX(0) scale(1.08)', easing: 'ease-in-out' },
      { offset: 0.3, transform: `translateX(${x}px) scale(1.08)`, easing: settle },
      { offset: 0.4, transform: `translateX(${x}px) scale(1)`, easing: 'linear' },
      { offset: 0.58, transform: `translateX(${x}px) scale(1)`, easing: 'ease-out' },
      { offset: 0.62, transform: `translateX(${x}px) scale(1.08)`, easing: 'ease-in-out' },
      { offset: 0.8, transform: 'translateX(0) scale(1.08)', easing: settle },
      { offset: 0.9, transform: 'translateX(0) scale(1)' },
      { offset: 1, transform: 'translateX(0) scale(1)' },
    ]
  })
  useLoop(finger, () => [
    { offset: 0, opacity: 0, easing: 'ease-out' },
    { offset: 0.06, opacity: 1 },
    { offset: 0.32, opacity: 1, easing: 'ease-out' },
    { offset: 0.38, opacity: 0 },
    { offset: 0.58, opacity: 0, easing: 'ease-out' },
    { offset: 0.62, opacity: 1 },
    { offset: 0.82, opacity: 1, easing: 'ease-out' },
    { offset: 0.88, opacity: 0 },
    { offset: 1, opacity: 0 },
  ])

  return (
    <div ref={box} className="relative h-[72px] overflow-hidden rounded-xl bg-bg px-3">
      <div ref={wrap} className="absolute bottom-3 left-3" style={{ width: DISC, height: DISC }}>
        <Disc className="relative" />
        <Finger innerRef={finger} className="left-1/2 top-1/2 -ml-3.5 -mt-3.5" />
      </div>
    </div>
  )
}

const SURFACES = [
  { name: 'Solid', card: 'border-transparent bg-raised', glow: false },
  { name: 'Kaca', card: 'border-white/25 bg-white/10 shadow-[0_0_18px_rgb(var(--mv-accent)/0.35)] backdrop-blur', glow: true },
  { name: 'Garis', card: 'border-ink/40 bg-transparent', glow: false },
] as const
const ACCENTS = ['29 185 84', '90 140 255', '255 107 129'] as const

/** Tema: gaya permukaan (Solid, Kaca, Garis), warna aksen, dan cahaya latar bergantian. */
function ThemeDemo() {
  const [step, setStep] = useState(0)
  useEffect(() => {
    if (reducedMotion()) return
    const timer = window.setInterval(() => setStep((value) => value + 1), 1500)
    return () => window.clearInterval(timer)
  }, [])
  const surface = SURFACES[step % SURFACES.length]
  const accent = ACCENTS[step % ACCENTS.length]
  return (
    <div>
      <div
        style={{ '--mv-accent': accent } as CSSProperties}
        className="relative h-24 overflow-hidden rounded-xl bg-bg px-3 pt-3 transition-colors duration-500"
      >
        <span
          aria-hidden="true"
          style={{ opacity: surface.glow ? 1 : 0, background: 'radial-gradient(60% 100% at 50% 0%, rgb(var(--mv-accent) / 0.45), transparent)' }}
          className="pointer-events-none absolute inset-x-0 top-0 h-14 transition-opacity duration-500"
        />
        <div className={`relative flex h-14 items-center gap-2.5 rounded-2xl border px-2.5 transition-all duration-500 ${surface.card}`}>
          <span className="h-9 w-9 shrink-0 rounded-lg bg-accent/50 transition-colors duration-500" />
          <span className="min-w-0 flex-1 space-y-1.5">
            <span className="block h-2 w-3/5 rounded-full bg-ink/70" />
            <span className="block h-1.5 w-2/5 rounded-full bg-accent transition-colors duration-500" />
          </span>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-accent-on transition-colors duration-500">
            <Play className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true" />
          </span>
        </div>
      </div>
      <p aria-hidden="true" className="mt-1.5 text-center text-xs font-semibold text-accent" style={{ '--mv-accent': accent } as CSSProperties}>
        Gaya: {surface.name}
        {surface.glow ? ' + cahaya latar' : ''}
      </p>
    </div>
  )
}

/** Peragaan animasi kecil di dalam kartu tutorial: gerakan baru ditunjukkan tanpa harus ada lagu yang diputar. */
export default function DemoStage({ kind }: { kind: DemoKind }) {
  return (
    <div className="mt-3" role="img" aria-label="Peragaan animasi">
      {kind === 'mini-roll' && <MiniRoll />}
      {kind === 'mini-close' && <MiniClose />}
      {kind === 'disc-side' && <DiscSide />}
      {kind === 'theme' && <ThemeDemo />}
    </div>
  )
}
