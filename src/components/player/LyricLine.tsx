import { lyricsTrackFor } from '../../utils/lyricsTrack'
import { Music2 } from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { usePlaybackTime } from '../../hooks/useAudioPlayer'
import { estimateActive, useLyricTiming } from '../../hooks/useLyricTiming'
import { useLyrics } from '../../hooks/useLyrics'
import { useAudioPlayer } from '../../hooks/useAudioPlayer'
import type { LyricsResult } from '../../services/lyricsApi'
import { looksLikeSameTrack } from '../../utils/playerStatus'
import type { LyricWord } from '../../utils/lrc'
import { wordsFor } from '../../utils/wordSync'
import KaraokeWords, { type SweepTiming } from './KaraokeWords'
import MarqueeText from '../ui/MarqueeText'

/** Bingkai strip lirik: WAJIB satu baris, tidak membungkus. */
function Frame({ children }: { children: ReactNode }) {
  return (
    <div aria-live="off" className="flex h-9 items-center gap-2 overflow-hidden px-4">
      <Music2 className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
      <div className="min-w-0 flex-1 text-center text-sm">{children}</div>
    </div>
  )
}

/** Satu baris teks biasa. Kepanjangan menggulir ke samping (berhenti sebentar tiap gulir). */
function Strip({ text, dim }: { text: string; dim?: boolean }) {
  return (
    <Frame>
      <MarqueeText text={text} className={dim ? 'text-ink-muted' : 'font-medium text-ink'} />
    </Frame>
  )
}

/**
 * Baris lirik dengan sorotan menyapu halus (per huruf, tepi lembut), sama dengan pemutar penuh lewat `KaraokeWords`.
 * Teks tiap kata membawa spasinya sendiri ("kata "), supaya suku kata asli dari sumber ("Hel" + "lo") tidak terpisah.
 * Baris yang lebih lebar dari strip digeser supaya kata aktif tetap di tengah. Komponen ini dipasang
 * ulang (key) tiap baris baru, jadi posisi awalnya selalu di kata pertama tanpa animasi mundur.
 */
function WordStrip({ words, timing }: { words: LyricWord[]; timing: SweepTiming }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLSpanElement>(null)
  const [wordIdx, setWordIdx] = useState(0)
  const [shift, setShift] = useState(0)

  const recalc = () => {
    const box = boxRef.current
    const inner = innerRef.current
    if (!box || !inner) return
    const overflow = inner.scrollWidth - box.clientWidth
    if (overflow <= 1) return setShift(0)
    // inner > KaraokeWords > kata-kata
    const el = inner.firstElementChild?.children[Math.max(0, wordIdx)] as HTMLElement | undefined
    if (!el) return
    const center = el.offsetLeft + el.offsetWidth / 2
    setShift(Math.min(0, Math.max(-overflow, box.clientWidth / 2 - center)))
  }

  useLayoutEffect(recalc, [wordIdx, words])
  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    const observer = new ResizeObserver(recalc)
    observer.observe(box)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wordIdx, words])

  return (
    <Frame>
      <div ref={boxRef} className="overflow-hidden whitespace-nowrap font-medium">
        <span
          ref={innerRef}
          className="relative inline-block transition-transform duration-300 ease-out will-change-transform motion-reduce:transition-none"
          style={{ transform: `translateX(${shift}px)` }}
        >
          <KaraokeWords words={words} timing={timing} onIndex={setWordIdx} />
        </span>
      </div>
    </Frame>
  )
}

function SyncedLine({ result, trackKey }: { result: Extract<LyricsResult, { kind: 'synced' }>; trackKey: string }) {
  const { items, active, mode, offset, ratio } = useLyricTiming(result, trackKey)
  const text = active >= 0 ? items[active]?.text.trim() ?? '' : ''
  // Mode "estimated" tidak punya waktu baris yang bisa dipercaya, jadi tidak ada sorotan per kata.
  const timed = mode !== 'estimated' && active >= 0 && text !== ''

  const start = timed ? items[active].time ?? 0 : 0
  let nextTime: number | undefined
  if (timed) {
    for (let i = active + 1; i < items.length; i += 1) {
      const t = items[i].time
      if (t !== undefined && t > start) {
        nextTime = t
        break
      }
    }
  }
  // Waktu kata ASLI bila sumber memberinya (eLRC / TTML / LyricsPlus); kalau tidak, perkiraan dari panjang kata (seperti sebelumnya).
  const activeWords = timed ? items[active].words : undefined
  const timedWords = useMemo(
    () => (timed ? wordsFor({ time: start, text, words: activeWords }, nextTime).words : []),
    [timed, start, text, activeWords, nextTime],
  )
  const timing = useMemo<SweepTiming>(() => ({ mode, ratio, offset }), [mode, ratio, offset])

  if (!text) return <Strip text="♪" dim />
  if (!timed || timedWords.length === 0) return <Strip text={text} />
  return <WordStrip key={`${active}|${text}`} words={timedWords} timing={timing} />
}

function PlainLine({ lines }: { lines: string[] }) {
  const { currentTime, duration } = usePlaybackTime()
  const items = useMemo(() => lines.map((text) => ({ text })), [lines])
  const active = estimateActive(items, currentTime, duration)
  const text = active >= 0 ? items[active]?.text.trim() : ''
  return <Strip text={text || '♪'} dim={!text} />
}

/**
 * Strip lirik berjalan di bagian atas kartu mini player (menyatu dengan kartu, latar solid).
 * Mengambil lirik sendiri lewat useLyrics (cache dipakai bersama pemutar penuh) dan memakai
 * logika waktu yang sama dengan pemutar penuh, jadi baris yang tampil selalu sama.
 */
export default function LyricLine() {
  const { currentTrack, playbackInfo } = useAudioPlayer()
  // Lirik dicari untuk lagu yang BENAR-BENAR terdengar (sama seperti pemutar penuh).
  const track = useMemo(() => lyricsTrackFor(currentTrack, playbackInfo, looksLikeSameTrack), [currentTrack, playbackInfo])
  const { state } = useLyrics(track, track !== null)

  if (!currentTrack) return null
  if (state.status === 'idle' || state.status === 'loading') return <Strip text="Mencari lirik…" dim />
  if (state.status === 'error') return <Strip text="Lirik gagal dimuat" dim />
  const { result } = state
  if (result.kind === 'none') return <Strip text="Lirik tidak ditemukan" dim />
  if (result.kind === 'instrumental') return <Strip text="Instrumental" dim />
  if (result.kind === 'plain') return <PlainLine lines={result.lines} />
  return <SyncedLine result={result} trackKey={`${currentTrack.title}|${currentTrack.artists}`} />
}
