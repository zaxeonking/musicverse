import { Layers, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { useAudioPlayer, usePlaybackTime } from '../../hooks/useAudioPlayer'
import type { LyricsState } from '../../hooks/useLyrics'
import type { LyricsResult } from '../../services/lyricsApi'
import { estimateActive, useLyricTiming, type LyricItem as Item } from '../../hooks/useLyricTiming'
import { useLyricDisplayPrefs } from '../../hooks/useLyricDisplayPrefs'
import { romanize } from '../../utils/romanize'
import { useLongPress } from '../../hooks/useLongPress'
import { OFFSET_STEP_S } from '../../utils/lyricOffset'
import { getLyricSourcePin, LYRIC_SOURCES, subscribeLyricSourcePins } from '../../utils/lyricSourcePins'
import type { PlaylistTrack } from '../../types/spotify'
import LyricSourceSheet from './LyricSourceSheet'
import KaraokeWords, { REST_COLOR, REST_COLOR_DIM, type SweepTiming } from './KaraokeWords'
import { prefersReducedMotion } from '../../utils/motion'

interface LyricsPanelProps {
  state: LyricsState
  onRetry: () => void
  /** Identitas lagu (judul|artis) untuk menyimpan penyelarasan manual per lagu. */
  trackKey?: string
  /** Lagu yang liriknya dicari; dipakai menu Sumber lirik. Tanpa ini menu tidak ditampilkan. */
  track?: PlaylistTrack | null
  /** Mode lirik layar penuh: daftar naik sampai ke bawah status bar. */
  fullscreen?: boolean
}

function Message({ children }: { children: ReactNode }) {
  return <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center text-sm text-ink-muted">{children}</div>
}

/** Pudar di tepi atas/bawah kotak supaya baris seolah muncul dan hilang saat bergulir naik. */
const FADE_MASK = {
  maskImage: 'linear-gradient(to bottom, transparent, #000 22%, #000 78%, transparent)',
  WebkitMaskImage: 'linear-gradient(to bottom, transparent, #000 22%, #000 78%, transparent)',
} as const

/**
 * Lirik di pemutar penuh. SELALU bergerak mengikuti lagu:
 *  - bertanda waktu + durasi cocok  → sorotan memakai waktu aslinya,
 *  - bertanda waktu + durasi agak beda → waktu diregangkan sesuai rasio durasi,
 *  - tanpa waktu / waktu tak bisa dipercaya → sorotan PERKIRAAN menurut progres lagu.
 * Ketuk baris (jika audio bisa di-seek) untuk loncat ke bagian itu, hanya pada mode berwaktu.
 */
export default function LyricsPanel({ track, ...props }: LyricsPanelProps) {
  const [sourceOpen, setSourceOpen] = useState(false)
  const pin = useSyncExternalStore(subscribeLyricSourcePins, () => (track ? getLyricSourcePin(track) : null))
  const pinLabel = pin ? LYRIC_SOURCES.find((s) => s.id === pin)?.label : undefined
  return (
    <div className="relative h-full">
      <LyricsBody {...props} pinLabel={pinLabel} />
      {track && (
        <button
          type="button"
          onClick={() => setSourceOpen(true)}
          aria-label={pinLabel ? `Sumber lirik: ${pinLabel}` : 'Sumber lirik'}
          className={`focus-ring absolute right-2 z-10 inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold ${
            props.fullscreen ? 'top-[max(0.25rem,var(--sat))]' : 'top-1'
          } ${pin ? 'bg-accent text-accent-on' : 'bg-raised/80 text-ink-muted'}`}
        >
          <Layers className="h-3.5 w-3.5" aria-hidden="true" />
          Sumber
        </button>
      )}
      {sourceOpen && track && <LyricSourceSheet track={track} onClose={() => setSourceOpen(false)} />}
    </div>
  )
}

function LyricsBody({ state, onRetry, trackKey, fullscreen = false, pinLabel }: Omit<LyricsPanelProps, 'track'> & { pinLabel?: string }) {
  if (state.status === 'idle' || state.status === 'loading') {
    return (
      <Message>
        <Loader2 className="h-6 w-6 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        <p role="status">Mencari lirik…</p>
      </Message>
    )
  }
  if (state.status === 'error') {
    return (
      <Message>
        <p role="alert">{state.message}</p>
        <button type="button" onClick={onRetry} className="btn-secondary h-10 px-5">
          Coba lagi
        </button>
      </Message>
    )
  }
  const { result } = state
  if (result.kind === 'none') return <Message>{pinLabel ? `Lirik tidak ditemukan di ${pinLabel}. Coba sumber lain lewat tombol Sumber.` : 'Lirik untuk lagu ini tidak ditemukan.'}</Message>
  if (result.kind === 'instrumental') return <Message>Lagu ini instrumental, tidak ada lirik.</Message>
  if (result.kind === 'plain') return <PlainLyrics lines={result.lines} fullscreen={fullscreen} />
  return <SyncedLyrics result={result} trackKey={trackKey} fullscreen={fullscreen} />
}

/** Info untuk efek karaoke (isi per baris): cara mengubah waktu audio menjadi waktu lirik. */
type FillTiming = SweepTiming

/** Baris isi terlama dianggap sepanjang ini bila baris berikutnya jauh (jeda instrumental). */
const FILL_MAX_S = 7

/**
 * Sorotan di pemutar penuh: per KATA (sapuan halus per huruf, sama dengan mini player) hanya bila sumber memberi waktu kata ASLI dan
 * waktu lirik cocok dengan audio (mode "exact"). Selain itu (lirik per baris, durasi beda, perkiraan) baris aktif disorot UTUH per kalimat.
 * Waktu kata TIDAK ditebak dari panjang huruf di sini: sapuan yang meleset lebih mengganggu daripada sorotan per kalimat.
 */

/** Satu baris lirik. Tahan lama = "baris ini yang sedang dinyanyikan sekarang" (penyelarasan manual). */
function Row({
  item,
  state,
  onSeek,
  onCalibrate,
  index,
  fill,
  side,
}: {
  item: Item
  state: 'active' | 'past' | 'next'
  onSeek?: (time: number) => void
  onCalibrate?: (item: Item) => void
  index: number
  /** Hanya untuk baris aktif bertext pada lirik berwaktu: isi karaoke. */
  fill?: { start: number; end: number; timing: FillTiming }
  /** Duet: 'left' penyanyi utama, 'right' penyanyi lain. Tanpa duet: tengah. */
  side: 'center' | 'left' | 'right'
}) {
  const handlers = useLongPress(() => {
    if (onCalibrate && item.time !== undefined) onCalibrate(item)
  })
  const bg = item.background === true
  const align = side === 'left' ? 'text-left origin-left' : side === 'right' ? 'text-right origin-right' : 'text-center origin-center'
  const size = bg ? 'text-base font-semibold py-0.5' : 'text-xl font-bold py-1.5'
  const tone = bg
    ? state === 'active' ? 'scale-[1.03] text-ink/80' : state === 'past' ? 'text-white/20' : 'text-white/35'
    : state === 'active' ? 'scale-105 text-ink' : state === 'past' ? 'text-white/30' : 'text-white/50'
  const className = `block w-full select-none rounded-md px-1 leading-snug transition-all duration-300 ${align} ${size} ${tone}`
  const text = item.text || '♪'
  // Waktu kata hanya dipercaya bila waktu lirik persis cocok dengan audio.
  const reliable = !!fill && fill.timing.mode === 'exact'
  const realWords = item.words && item.words.length > 0 && reliable ? item.words : null
  const sweepWords = state === 'active' && item.text ? realWords : null
  const content =
    sweepWords && fill ? (
      <KaraokeWords words={sweepWords} timing={fill.timing} rest={bg ? REST_COLOR_DIM : REST_COLOR} className="whitespace-pre-wrap" />
    ) : (
      text
    )
  // Romanisasi + terjemahan dari server (bila ada): kecil di bawah baris; vokal latar tidak diberi.
  const subs = !bg ? [item.transliteration, item.translation].filter((t): t is string => !!t) : []
  // Romanisasi dengan waktu kata dari server: pada baris aktif ikut terisi karaoke (sama seperti teks utama).
  const romanWords = state === 'active' && fill && fill.timing.mode === 'exact' && item.transliterationWords && item.transliterationWords.length > 0 ? item.transliterationWords : null
  const withSubs =
    subs.length > 0 ? (
      <>
        {content}
        {subs.map((t, i) => (
          <span key={i} className="mt-0.5 block text-sm font-normal leading-snug text-white/55">
            {romanWords && t === item.transliteration && fill ? <KaraokeWords words={romanWords} timing={fill.timing} rest={REST_COLOR_DIM} className="whitespace-pre-wrap" /> : t}
          </span>
        ))}
      </>
    ) : (
      content
    )
  const common = {
    'data-line': index,
    'data-bg': bg ? 'true' : undefined,
    'aria-current': state === 'active' ? ('true' as const) : undefined,
    ...(onCalibrate ? handlers : {}),
  }
  return onSeek && item.time !== undefined ? (
    <button type="button" {...common} onClick={() => onSeek(item.time as number)} className={`${className} focus-ring`}>
      {withSubs}
    </button>
  ) : (
    <p {...common} className={className}>
      {withSubs}
    </p>
  )
}

/** Daftar baris yang menggulir baris aktif ke tengah (selalu, setiap baris aktif berganti). */
function LineList({
  items,
  active,
  onSeek,
  onCalibrate,
  header,
  timing,
  credit,
  fullscreen = false,
}: {
  items: Item[]
  active: number
  onSeek?: (time: number) => void
  onCalibrate?: (item: Item) => void
  header?: ReactNode
  timing?: FillTiming
  credit?: string
  fullscreen?: boolean
}) {
  const containerRef = useRef<HTMLDivElement>(null)

  // Duet: bila ada >= 2 penyanyi berbeda, penyanyi pertama rata kiri dan yang lain rata kanan.
  const { duet, mainAgent } = useMemo(() => {
    const agents = new Set<string>()
    for (const item of items) if (item.agent) agents.add(item.agent)
    return { duet: agents.size >= 2, mainAgent: items.find((item) => item.agent)?.agent }
  }, [items])

  // Vokal latar menempel pada baris induknya: saat latar aktif, induk (baris utama sebelumnya) ikut menyala dan jadi jangkar gulir.
  const parent = useMemo(() => {
    if (active < 0 || !items[active]?.background) return -1
    for (let i = active - 1; i >= 0; i -= 1) if (!items[i].background) return i
    return -1
  }, [items, active])
  const anchor = parent >= 0 ? parent : active

  const centerAnchor = useCallback(
    (behavior: ScrollBehavior) => {
      const container = containerRef.current
      if (!container || anchor < 0) return
      const node = container.querySelector<HTMLElement>(`[data-line="${anchor}"]`)
      if (!node) return
      const reduce = prefersReducedMotion()
      container.scrollTo({
        top: node.offsetTop - container.clientHeight / 2 + node.clientHeight / 2,
        behavior: reduce ? 'auto' : behavior,
      })
    },
    [anchor],
  )

  useEffect(() => {
    centerAnchor('smooth')
  }, [centerAnchor, items])

  // Tinggi daftar berubah (masuk/keluar lirik layar penuh, animasinya berjalan ~0,5 dtk): baris aktif ikut tetap di tengah.
  useEffect(() => {
    const container = containerRef.current
    if (!container || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => centerAnchor('auto'))
    observer.observe(container)
    return () => observer.disconnect()
  }, [centerAnchor])

  return (
    <div className="flex h-full flex-col">
      {header && <div className={`shrink-0 px-14 text-center text-[11px] text-ink-faint ${fullscreen ? 'pt-[max(0.5rem,var(--sat))]' : 'pt-2'}`}>{header}</div>}
      <div
        ref={containerRef}
        style={FADE_MASK}
        className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-[18dvh] text-center [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item, i) => (
          <Row
            key={i}
            index={i}
            item={item}
            state={i === active || i === parent ? 'active' : i < active ? 'past' : 'next'}
            side={!duet ? 'center' : item.agent && item.agent !== mainAgent ? 'right' : 'left'}
            onSeek={onSeek}
            onCalibrate={onCalibrate}
            fill={
              timing && (i === active || i === parent) && item.time !== undefined
                ? { start: item.time, end: items[i + 1]?.time ?? item.time + FILL_MAX_S, timing }
                : undefined
            }
          />
        ))}
        <p className="pt-6 text-[11px] text-ink-faint">{credit ?? 'Lirik dari LRCLIB / NetEase'}</p>
      </div>
    </div>
  )
}

const SOURCE_NAMES: Record<string, string> = { lyricsplus: 'LyricsPlus', betterlyrics: 'BetterLyrics', ytmusic: 'YouTube Music', lrclib: 'LRCLIB', netease: 'NetEase', ovh: 'lyrics.ovh' }

/** Keterangan sumber di ujung daftar. Tanpa `source` (hasil cache lama) teks bawaan dipakai. */
function creditFor(source: string | undefined, wordSynced: boolean | undefined): string | undefined {
  if (!source) return undefined
  const name = SOURCE_NAMES[source] ?? source
  return wordSynced ? `Lirik per kata dari ${name}` : `Lirik dari ${name}`
}

const ESTIMATE_NOTE = 'Waktu lirik tidak tersedia, sorotan hanya perkiraan.'

function PlainLyrics({ lines, fullscreen }: { lines: string[]; fullscreen?: boolean }) {
  const { currentTime, duration } = usePlaybackTime()
  const display = useLyricDisplayPrefs()
  // Lirik polos tidak punya terjemahan server, tetapi romanisasi lokal tetap bisa (kana / Hangul / Hindi / Sirilik).
  const items = useMemo<Item[]>(() => lines.map((text) => ({ text, ...(display.romanization ? { transliteration: romanize(text) } : {}) })), [lines, display])
  const active = estimateActive(items, currentTime, duration)
  return <LineList items={items} active={active} header={ESTIMATE_NOTE} fullscreen={fullscreen} />
}

function SyncedLyrics({ result, trackKey, fullscreen }: { result: Extract<LyricsResult, { kind: 'synced' }>; trackKey?: string; fullscreen?: boolean }) {
  const { items, active, mode, offset, setOffset, ratio, lyricTime, lyricsDuration, audioDuration, seekable } = useLyricTiming(result, trackKey)
  const { seekTo } = useAudioPlayer()

  const modeNote =
    mode === 'estimated'
      ? `Durasi audio (${Math.round(audioDuration ?? 0)} dtk) jauh beda dari versi lirik (${Math.round(lyricsDuration ?? 0)} dtk), sorotan hanya perkiraan.`
      : mode === 'scaled'
        ? 'Durasi audio agak beda dari versi lirik, waktu disesuaikan.'
        : null

  // Tahan baris yang SEDANG terdengar dinyanyikan -> lirik diselaraskan ke titik itu.
  // Dikurangi ±0,75 dtk: waktu tahan (0,45 dtk) + waktu reaksi, karena baris itu sudah mulai sebelum jari menahan.
  const onCalibrate =
    mode === 'estimated'
      ? undefined
      : (item: Item) => {
          if (item.time === undefined) return
          setOffset(item.time + 0.75 - lyricTime)
        }
  const resetOffset = () => setOffset(0)
  const nudge = (delta: number) => setOffset(offset + delta)

  const nudgeBtn = 'focus-ring inline-flex h-8 items-center rounded-full bg-raised px-3 text-xs font-semibold text-ink active:opacity-70'
  const header: ReactNode =
    mode === 'estimated' ? (
      modeNote
    ) : (
      <>
        <span className="block">{modeNote ?? 'Lirik tidak pas? Geser waktunya, atau tahan baris yang sedang dinyanyikan.'}</span>
        <span className="mt-1.5 flex items-center justify-center gap-2" role="group" aria-label="Penyelarasan waktu lirik">
          <button type="button" onClick={() => nudge(-OFFSET_STEP_S)} aria-label={`Lirik lebih lambat ${OFFSET_STEP_S.toString().replace('.', ',')} detik`} className={nudgeBtn}>
            − Lambat
          </button>
          <span role="status" className="min-w-[4.5rem] text-center text-[11px] tabular-nums text-ink-muted">
            {offset === 0 ? 'Pas' : `${offset > 0 ? '+' : '−'}${Math.abs(offset).toFixed(1).replace('.', ',')} dtk`}
          </span>
          <button type="button" onClick={() => nudge(OFFSET_STEP_S)} aria-label={`Lirik lebih cepat ${OFFSET_STEP_S.toString().replace('.', ',')} detik`} className={nudgeBtn}>
            Cepat +
          </button>
          {offset !== 0 && (
            <button type="button" onClick={resetOffset} className="focus-ring text-xs font-semibold text-accent underline">
              Reset
            </button>
          )}
        </span>
      </>
    )

  // Loncat ke baris hanya akurat pada mode berwaktu; waktu lirik dikonversi balik ke waktu audio.
  const onSeek = seekable && mode !== 'estimated' ? (time: number) => seekTo(Math.max(0, (time - offset) * (mode === 'scaled' ? ratio : 1))) : undefined

  return <LineList
      items={items}
      active={active}
      onSeek={onSeek}
      onCalibrate={onCalibrate}
      header={header}
      timing={{ mode, ratio, offset }}
      credit={creditFor(result.source, result.wordSynced)}
      fullscreen={fullscreen}
    />
}
