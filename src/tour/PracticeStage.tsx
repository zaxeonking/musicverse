import { Check, Download, FolderPlus, ListEnd } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import CoverArt from '../components/ui/CoverArt'
import { useLongPress } from '../hooks/useLongPress'
import { useSwipeSelect, type SwipeHint } from '../hooks/useSwipeSelect'
import { fallbackCover } from '../utils/fallbackCover'
import type { PracticeKind } from './steps'

interface PracticeStageProps {
  kind: PracticeKind
  /** Dipanggil sekali saat latihan selesai. */
  onComplete: () => void
}

const SAMPLE = 'Lagu Contoh'

function Cover({ name }: { name: string }) {
  return (
    <span className="w-12 shrink-0">
      <CoverArt cover={fallbackCover(name)} src={undefined} />
    </span>
  )
}

function TaskChip({ done, children }: { done: boolean; children: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${done ? 'bg-accent/15 text-accent' : 'bg-raised text-ink-muted'}`}>
      {done && <Check className="h-3.5 w-3.5 animate-pop" strokeWidth={3} aria-hidden="true" />}
      {children}
    </span>
  )
}

/** Memanggil `onComplete` terbaru tanpa membuat efek bergantung pada identitasnya. */
function useLatest<T>(value: T) {
  const ref = useRef(value)
  ref.current = value
  return ref
}

/** Geser kanan (antrean) lalu kiri (suka) pada baris contoh; memakai hook geser yang sama dengan daftar lagu. */
function SwipeTrackPractice({ onComplete }: { onComplete: () => void }) {
  const [right, setRight] = useState(false)
  const [left, setLeft] = useState(false)
  const [message, setMessage] = useState('')
  const complete = useLatest(onComplete)
  const handlers = useSwipeSelect(
    (_index, direction) => {
      if (direction > 0) {
        setRight(true)
        setMessage('Ditambahkan ke antrean (contoh)')
      } else {
        setLeft(true)
        setMessage('Ditambahkan ke Lagu Disukai (contoh)')
      }
    },
    (_index, direction): SwipeHint => (direction > 0 ? { icon: 'queue', label: 'Antrean' } : { icon: 'like', label: 'Suka' }),
  )
  useEffect(() => {
    if (right && left) complete.current()
  }, [right, left, complete])

  return (
    <div className="mt-3">
      <ul {...handlers} className="touch-pan-y">
        <li className="flex select-none items-center gap-3 rounded-xl bg-raised px-2 py-2">
          <Cover name={SAMPLE} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-ink">{SAMPLE}</span>
            <span className="block truncate text-xs text-ink-muted">Artis Contoh</span>
          </span>
        </li>
      </ul>
      <div className="mt-2 flex flex-wrap gap-2">
        <TaskChip done={right}>Kanan: antrean</TaskChip>
        <TaskChip done={left}>Kiri: suka</TaskChip>
      </div>
      <p aria-live="polite" className="mt-2 min-h-[1rem] text-xs text-ink-muted">
        {message}
      </p>
    </div>
  )
}

/** Tahan baris contoh: menu contoh muncul sebentar, lalu latihan dianggap selesai. */
function PressTrackPractice({ onComplete }: { onComplete: () => void }) {
  const [menu, setMenu] = useState(false)
  const [tapped, setTapped] = useState(false)
  const complete = useLatest(onComplete)
  const timer = useRef<number | null>(null)
  const press = useLongPress(() => {
    setMenu(true)
    if (timer.current === null) timer.current = window.setTimeout(() => complete.current(), 1400)
  })
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    },
    [],
  )

  return (
    <div className="mt-3">
      <ul>
        <li
          {...press}
          onClick={() => setTapped(true)}
          className="flex select-none items-center gap-3 rounded-xl bg-raised px-2 py-2 [-webkit-touch-callout:none] active:bg-card"
        >
          <Cover name={SAMPLE} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-ink">{SAMPLE}</span>
            <span className="block truncate text-xs text-ink-muted">Artis Contoh</span>
          </span>
        </li>
      </ul>
      {menu ? (
        <ul className="mt-2 animate-fade-in space-y-0.5 rounded-xl bg-bg px-2 py-2 text-sm text-ink">
          <li className="flex items-center gap-3 px-2 py-1.5">
            <ListEnd className="h-4 w-4 text-accent" aria-hidden="true" />
            Putar berikutnya
          </li>
          <li className="flex items-center gap-3 px-2 py-1.5">
            <FolderPlus className="h-4 w-4 text-accent" aria-hidden="true" />
            Simpan ke playlist saya
          </li>
          <li className="flex items-center gap-3 px-2 py-1.5">
            <Download className="h-4 w-4 text-accent" aria-hidden="true" />
            Unduh untuk offline
          </li>
        </ul>
      ) : (
        <p aria-live="polite" className="mt-2 min-h-[1rem] text-xs text-ink-muted">
          {tapped ? 'Ketukan biasa memutar lagu. Tahan lebih lama untuk membuka menu.' : ''}
        </p>
      )}
    </div>
  )
}

/** Geser kartu playlist contoh ke kanan atau kiri: terpilih (centang), seperti memulai mode pilih banyak. */
function SwipePlaylistPractice({ onComplete }: { onComplete: () => void }) {
  const [selected, setSelected] = useState(false)
  const complete = useLatest(onComplete)
  const handlers = useSwipeSelect(
    () => setSelected((prev) => !prev),
    () => ({ icon: selected ? 'unselect' : 'select', label: selected ? 'Batal' : 'Pilih' }),
  )
  useEffect(() => {
    if (selected) complete.current()
  }, [selected, complete])

  return (
    <div className="mt-3">
      <ul {...handlers} className="touch-pan-y">
        <li className={`flex select-none items-center gap-3 rounded-xl px-2 py-2 transition-colors ${selected ? 'bg-accent/10 ring-2 ring-accent' : 'bg-raised'}`}>
          <span
            aria-hidden="true"
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
              selected ? 'animate-pop border-accent bg-accent text-black' : 'border-ink-muted text-transparent'
            }`}
          >
            <Check className="h-4 w-4" strokeWidth={3} />
          </span>
          <Cover name="Playlist Contoh" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-ink">Playlist Contoh</span>
            <span className="block truncate text-xs text-ink-muted">Buatanmu · 12 lagu</span>
          </span>
        </li>
      </ul>
      <p aria-live="polite" className="mt-2 min-h-[1rem] text-xs text-ink-muted">
        {selected ? '1 dipilih. Geser lagi untuk batal pilih.' : ''}
      </p>
    </div>
  )
}

/** Area latihan di dalam kartu tutorial: baris contoh yang benar-benar bisa digeser / ditahan (data pengguna tidak tersentuh). */
export default function PracticeStage({ kind, onComplete }: PracticeStageProps) {
  if (kind === 'swipe-track') return <SwipeTrackPractice onComplete={onComplete} />
  if (kind === 'press-track') return <PressTrackPractice onComplete={onComplete} />
  return <SwipePlaylistPractice onComplete={onComplete} />
}
