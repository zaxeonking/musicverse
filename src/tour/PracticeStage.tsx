import { ArrowRightLeft, Check, Copy, Download, FolderPlus, Heart, ListEnd, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import CoverArt from '../components/ui/CoverArt'
import { useLongPress } from '../hooks/useLongPress'
import { useSwipeSelect, type SwipeHint } from '../hooks/useSwipeSelect'
import { fallbackCover } from '../utils/fallbackCover'
import type { PracticeKind } from './steps'
import { markQuizPassed } from './tourStore'

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
              selected ? 'animate-pop border-accent bg-accent text-accent-on' : 'border-ink-muted text-transparent'
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

/** Tahan baris contoh, pilih "Simpan ke playlist saya", lalu pilih playlist tujuan: alur yang sama dengan menu lagu asli. */
function SaveTrackPractice({ onComplete }: { onComplete: () => void }) {
  const [stage, setStage] = useState<'idle' | 'menu' | 'picker' | 'saved'>('idle')
  const complete = useLatest(onComplete)
  const press = useLongPress(() => setStage((prev) => (prev === 'idle' ? 'menu' : prev)))

  function save() {
    setStage('saved')
    complete.current()
  }

  return (
    <div className="mt-3">
      <ul>
        <li
          {...press}
          className="flex select-none items-center gap-3 rounded-xl bg-raised px-2 py-2 [-webkit-touch-callout:none] active:bg-card"
        >
          <Cover name={SAMPLE} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-ink">{SAMPLE}</span>
            <span className="block truncate text-xs text-ink-muted">Artis Contoh</span>
          </span>
        </li>
      </ul>
      {stage === 'menu' && (
        <ul className="mt-2 animate-fade-in space-y-0.5 rounded-xl bg-bg px-2 py-2 text-sm text-ink">
          <li className="flex items-center gap-3 px-2 py-1.5 text-ink-muted">
            <ListEnd className="h-4 w-4" aria-hidden="true" />
            Putar berikutnya
          </li>
          <li>
            <button
              type="button"
              onClick={() => setStage('picker')}
              className="flex w-full items-center gap-3 rounded-lg bg-accent/15 px-2 py-1.5 text-left font-semibold text-accent"
            >
              <FolderPlus className="h-4 w-4" aria-hidden="true" />
              Simpan ke playlist saya
            </button>
          </li>
          <li className="flex items-center gap-3 px-2 py-1.5 text-ink-muted">
            <Download className="h-4 w-4" aria-hidden="true" />
            Unduh untuk offline
          </li>
        </ul>
      )}
      {stage === 'picker' && (
        <div className="mt-2 animate-fade-in rounded-xl bg-bg px-2 py-2 text-sm text-ink">
          <p className="px-2 pb-1 text-xs font-semibold text-ink-muted">Simpan ke…</p>
          <button
            type="button"
            onClick={save}
            className="flex w-full items-center gap-3 rounded-lg bg-accent/15 px-2 py-1.5 text-left font-semibold text-accent"
          >
            <FolderPlus className="h-4 w-4" aria-hidden="true" />
            Playlist Contoh · 12 lagu
          </button>
        </div>
      )}
      <p aria-live="polite" className="mt-2 min-h-[1rem] text-xs text-ink-muted">
        {stage === 'saved' ? 'Tersimpan ke Playlist Contoh (contoh)' : stage === 'idle' ? 'Tahan baris contoh sampai menu muncul.' : ''}
      </p>
    </div>
  )
}

/** Ketuk hati pada pemutar contoh: lagu masuk ke Lagu Disukai (contoh, data asli tidak berubah). */
function LikeTrackPractice({ onComplete }: { onComplete: () => void }) {
  const [liked, setLiked] = useState(false)
  const complete = useLatest(onComplete)

  return (
    <div className="mt-3">
      <div className="flex select-none items-center gap-3 rounded-xl bg-raised px-2 py-2">
        <Cover name={SAMPLE} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-ink">{SAMPLE}</span>
          <span className="block truncate text-xs text-ink-muted">Artis Contoh</span>
        </span>
        <button
          type="button"
          aria-pressed={liked}
          aria-label={liked ? 'Hapus dari Lagu Disukai (contoh)' : 'Sukai lagu contoh'}
          onClick={() => {
            const next = !liked
            setLiked(next)
            if (next) complete.current()
          }}
          className={`flex h-11 w-11 items-center justify-center rounded-full active:bg-veil/10 ${liked ? 'text-accent' : 'text-ink'}`}
        >
          <Heart className={`h-6 w-6 transition-transform duration-200 ${liked ? 'scale-110' : ''}`} fill={liked ? 'currentColor' : 'none'} aria-hidden="true" />
        </button>
      </div>
      <p aria-live="polite" className="mt-2 min-h-[1rem] text-xs text-ink-muted">
        {liked ? 'Ditambahkan ke Lagu Disukai (contoh)' : ''}
      </p>
    </div>
  )
}

const SELECT_SAMPLES = [
  { title: 'Lagu Contoh 1', artist: 'Artis Contoh' },
  { title: 'Lagu Contoh 2', artist: 'Artis Contoh' },
  { title: 'Lagu Contoh 3', artist: 'Artis Lain' },
] as const

/** Mode pilih banyak lagu seperti di dalam playlist: tombol Pilih lagu, centang beberapa, lalu Salin / Pindahkan / Hapus (contoh). */
function SelectTracksPractice({ onComplete }: { onComplete: () => void }) {
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set<number>())
  const [message, setMessage] = useState('')
  const complete = useLatest(onComplete)
  const count = selected.size
  const allSelected = count === SELECT_SAMPLES.length

  function toggle(index: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  function act(text: string, finish: boolean) {
    setMessage(text)
    if (finish) complete.current()
  }

  return (
    <div className="mt-3">
      {selecting ? (
        <div role="region" aria-label="Mode pilih lagu (contoh)" className="rounded-lg bg-bg px-3 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <p role="status" className="min-w-0 flex-1 basis-20 text-sm font-semibold text-ink">
              {count === 0 ? 'Pilih lagu' : `${count} dipilih`}
            </p>
            <button
              type="button"
              onClick={() => setSelected(allSelected ? new Set<number>() : new Set<number>(SELECT_SAMPLES.map((_, i) => i)))}
              className="btn-secondary h-9 px-3 text-xs"
            >
              {allSelected ? 'Batal pilih' : 'Pilih semua'}
            </button>
            <div className="flex basis-full items-center justify-end gap-2">
              <button
                type="button"
                disabled={count === 0}
                onClick={() => act(`${count} lagu disalin (contoh)`, true)}
                aria-label="Salin ke playlist lain"
                className="icon-btn h-10 w-10 bg-raised disabled:opacity-40"
              >
                <Copy className="h-5 w-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                disabled={count === 0}
                onClick={() => act(`${count} lagu dipindahkan (contoh)`, true)}
                aria-label="Pindahkan ke playlist lain"
                className="icon-btn h-10 w-10 bg-raised disabled:opacity-40"
              >
                <ArrowRightLeft className="h-5 w-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                disabled={count === 0}
                onClick={() => act('Menghapus selalu minta konfirmasi dulu, jadi aman.', false)}
                aria-label="Hapus dari playlist"
                className="icon-btn h-10 w-10 bg-raised text-danger disabled:opacity-40"
              >
                <Trash2 className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setSelecting(true)} className="btn-secondary h-10 px-4 text-sm">
          Pilih lagu
        </button>
      )}
      <ul className="mt-2 space-y-1">
        {SELECT_SAMPLES.map((item, index) => {
          const on = selected.has(index)
          return (
            <li key={item.title}>
              <button
                type="button"
                disabled={!selecting}
                aria-pressed={selecting ? on : undefined}
                onClick={() => toggle(index)}
                className={`flex w-full select-none items-center gap-3 rounded-xl px-2 py-1.5 text-left transition-colors ${on ? 'bg-accent/10 ring-2 ring-accent' : 'bg-raised'}`}
              >
                {selecting && (
                  <span
                    aria-hidden="true"
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                      on ? 'animate-pop border-accent bg-accent text-accent-on' : 'border-ink-muted text-transparent'
                    }`}
                  >
                    <Check className="h-4 w-4" strokeWidth={3} />
                  </span>
                )}
                <Cover name={item.title} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">{item.title}</span>
                  <span className="block truncate text-xs text-ink-muted">{item.artist}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      <p aria-live="polite" className="mt-2 min-h-[1rem] text-xs text-ink-muted">
        {message || (selecting ? 'Ketuk lagu untuk mencentang.' : 'Ketuk Pilih lagu untuk mulai.')}
      </p>
    </div>
  )
}

interface QuizQuestion {
  question: string
  options: readonly string[]
  /** Indeks jawaban benar. */
  answer: number
  /** Penjelasan singkat setelah dijawab benar. */
  explain: string
}

const QUIZ: readonly QuizQuestion[] = [
  {
    question: 'Menggeser lagu ke kanan artinya?',
    options: ['Tambah ke antrean', 'Sukai lagu', 'Hapus lagu'],
    answer: 0,
    explain: 'Kanan untuk antrean, kiri untuk suka.',
  },
  {
    question: 'Bagaimana membuka menu sebuah lagu?',
    options: ['Ketuk sekali', 'Tahan lama', 'Geser ke atas'],
    answer: 1,
    explain: 'Menahan lagu membuka menu di mana pun lagunya muncul.',
  },
  {
    question: 'Lagu yang kamu sukai tersimpan di mana?',
    options: ['Tab Unduhan', 'Riwayat putar', 'Lagu Disukai, di tab Playlist'],
    answer: 2,
    explain: 'Lagu Disukai selalu jadi kartu pertama di tab Playlist.',
  },
  {
    question: 'Bagaimana mengecilkan pemutar mini jadi disc?',
    options: ['Geser ke samping', 'Geser ke bawah', 'Ketuk dua kali'],
    answer: 0,
    explain: 'Geser samping = jadi disc. Geser ke bawah menutup musik.',
  },
]

/** Empat pertanyaan pilihan ganda. Jawaban salah boleh dicoba lagi; lulus = lencana di Pengaturan. */
function QuizPractice({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0)
  const [wrong, setWrong] = useState<ReadonlySet<number>>(new Set<number>())
  const [correct, setCorrect] = useState(false)
  const complete = useLatest(onComplete)
  const timer = useRef<number | null>(null)
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    },
    [],
  )
  const item = QUIZ[Math.min(step, QUIZ.length - 1)]

  function choose(index: number) {
    if (correct) return
    if (index !== item.answer) {
      setWrong((prev) => new Set(prev).add(index))
      return
    }
    setCorrect(true)
    timer.current = window.setTimeout(() => {
      timer.current = null
      if (step + 1 < QUIZ.length) {
        setStep(step + 1)
        setWrong(new Set<number>())
        setCorrect(false)
      } else {
        markQuizPassed()
        complete.current()
      }
    }, 1100)
  }

  return (
    <div className="mt-3">
      <p className="text-xs font-semibold text-ink-muted">
        Pertanyaan {Math.min(step + 1, QUIZ.length)} / {QUIZ.length}
      </p>
      <p className="mt-1 text-sm font-semibold text-ink">{item.question}</p>
      <ul className="mt-2 space-y-1.5">
        {item.options.map((option, index) => {
          const isWrong = wrong.has(index)
          const isRight = correct && index === item.answer
          return (
            <li key={option}>
              <button
                type="button"
                disabled={isWrong || correct}
                onClick={() => choose(index)}
                className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors ${
                  isRight ? 'bg-accent/15 text-accent' : isWrong ? 'bg-raised text-ink-faint line-through' : 'bg-raised text-ink active:bg-card'
                }`}
              >
                {isRight && <Check className="h-4 w-4 animate-pop" strokeWidth={3} aria-hidden="true" />}
                {option}
              </button>
            </li>
          )
        })}
      </ul>
      <p aria-live="polite" className="mt-2 min-h-[1rem] text-xs text-ink-muted">
        {correct ? `Benar! ${item.explain}` : wrong.size > 0 ? 'Belum tepat, coba pilihan lain.' : ''}
      </p>
    </div>
  )
}

/** Seret disc ke sisi lain (menempel ke tepi) lalu tahan untuk putar / jeda: sama dengan gerakan disc di pemutar mini. */
function DiscDragPractice({ onComplete }: { onComplete: () => void }) {
  const DISC = 48
  const box = useRef<HTMLDivElement>(null)
  const [x, setX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [side, setSide] = useState<'left' | 'right'>('left')
  const [moved, setMoved] = useState(false)
  const [held, setHeld] = useState(false)
  const [playing, setPlaying] = useState(true)
  const complete = useLatest(onComplete)
  const start = useRef({ px: 0, x: 0, travelled: 0 })
  const holdTimer = useRef<number | null>(null)
  const maxX = () => Math.max(0, (box.current?.clientWidth ?? 300) - DISC - 24)

  const clearHold = () => {
    if (holdTimer.current !== null) window.clearTimeout(holdTimer.current)
    holdTimer.current = null
  }
  useEffect(() => clearHold, [])
  useEffect(() => {
    if (moved && held) complete.current()
  }, [moved, held, complete])

  const onDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    start.current = { px: event.clientX, x, travelled: 0 }
    setDragging(true)
    clearHold()
    holdTimer.current = window.setTimeout(() => {
      if (start.current.travelled > 10) return
      navigator.vibrate?.(15)
      setPlaying((value) => !value)
      setHeld(true)
    }, 450)
  }
  const onMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return
    const dx = event.clientX - start.current.px
    start.current.travelled = Math.max(start.current.travelled, Math.abs(dx))
    if (Math.abs(dx) > 10) clearHold()
    setX(Math.min(maxX(), Math.max(0, start.current.x + dx)))
  }
  const onUp = () => {
    if (!dragging) return
    clearHold()
    setDragging(false)
    if (start.current.travelled <= 10) return
    const next = x > maxX() / 2 ? 'right' : 'left'
    setX(next === 'right' ? maxX() : 0)
    navigator.vibrate?.(10)
    if (next !== side) setMoved(true)
    setSide(next)
  }

  return (
    <div className="mt-3">
      <div ref={box} className="relative h-[72px] overflow-hidden rounded-xl bg-bg">
        <div
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          style={{
            width: DISC,
            height: DISC,
            transform: `translateX(${x + 12}px) scale(${dragging ? 1.08 : 1})`,
            transition: dragging ? 'none' : 'transform 320ms cubic-bezier(0.34, 1.56, 0.64, 1)',
            touchAction: 'none',
          }}
          className="absolute bottom-3 left-0 flex select-none items-center justify-center rounded-full border-[3px] border-accent/70 bg-raised shadow-lg"
        >
          <span style={{ animationDuration: '3s' }} className={`flex h-8 w-8 items-center justify-center rounded-full bg-accent/35 ${playing ? 'animate-spin' : ''}`}>
            <span className="h-2 w-2 rounded-full bg-bg" />
            <span className="absolute h-3 w-0.5 -translate-y-2.5 rounded-full bg-accent" />
          </span>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <TaskChip done={moved}>Seret ke sisi lain</TaskChip>
        <TaskChip done={held}>Tahan: putar / jeda</TaskChip>
      </div>
      <p aria-live="polite" className="mt-2 min-h-[1rem] text-xs text-ink-muted">
        {held ? (playing ? 'Disc berputar lagi (contoh)' : 'Disc dijeda (contoh)') : ''}
      </p>
    </div>
  )
}

/** Area latihan di dalam kartu tutorial: baris contoh yang benar-benar bisa digeser / ditahan (data pengguna tidak tersentuh). */
export default function PracticeStage({ kind, onComplete }: PracticeStageProps) {
  if (kind === 'swipe-track') return <SwipeTrackPractice onComplete={onComplete} />
  if (kind === 'press-track') return <PressTrackPractice onComplete={onComplete} />
  if (kind === 'save-track') return <SaveTrackPractice onComplete={onComplete} />
  if (kind === 'like-track') return <LikeTrackPractice onComplete={onComplete} />
  if (kind === 'select-tracks') return <SelectTracksPractice onComplete={onComplete} />
  if (kind === 'disc-drag') return <DiscDragPractice onComplete={onComplete} />
  if (kind === 'quiz') return <QuizPractice onComplete={onComplete} />
  return <SwipePlaylistPractice onComplete={onComplete} />
}
