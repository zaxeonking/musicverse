import { Music2 } from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { usePlaybackTime } from '../../hooks/useAudioPlayer'
import { estimateActive, LEAD_S, useLyricTiming } from '../../hooks/useLyricTiming'
import { useLyrics } from '../../hooks/useLyrics'
import { useAudioPlayer } from '../../hooks/useAudioPlayer'
import { audioEngine } from '../../services/audioEngine'
import type { LyricsResult } from '../../services/lyricsApi'
import { looksLikeSameTrack } from '../../utils/playerStatus'
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
 * Baris lirik dengan sorotan per kata: kata yang sudah/sedang dinyanyikan terang, sisanya redup.
 * Baris yang lebih lebar dari strip digeser supaya kata aktif tetap di tengah. Komponen ini dipasang
 * ulang (key) tiap baris baru, jadi posisi awalnya selalu di kata pertama tanpa animasi mundur.
 */
function WordStrip({ words, wordIdx }: { words: string[]; wordIdx: number }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLSpanElement>(null)
  const wordRefs = useRef<Array<HTMLSpanElement | null>>([])
  const [shift, setShift] = useState(0)

  const recalc = () => {
    const box = boxRef.current
    const inner = innerRef.current
    if (!box || !inner) return
    const overflow = inner.scrollWidth - box.clientWidth
    if (overflow <= 1) return setShift(0)
    const el = wordRefs.current[Math.max(0, wordIdx)]
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
          {words.map((word, i) => (
            <span key={i}>
              {i > 0 && ' '}
              <span
                ref={(el) => {
                  wordRefs.current[i] = el
                }}
                className={`transition-colors duration-150 ${i <= wordIdx ? 'text-ink' : 'text-ink-muted'}`}
              >
                {word}
              </span>
            </span>
          ))}
        </span>
      </div>
    </Frame>
  )
}

/** Lama (detik) menyanyikan satu baris: dibatasi jarak ke baris berikutnya dan perkiraan dari panjang teks. */
function singingSpan(chars: number, gap: number): number {
  return Math.min(gap, Math.max(2, chars * 0.14))
}

/** Indeks kata yang sedang dinyanyikan; kata dibobot menurut panjangnya (LRC hanya punya waktu per baris). */
function wordAt(words: readonly string[], fraction: number): number {
  const weights = words.map((w) => w.length + 1)
  const total = weights.reduce((a, b) => a + b, 0)
  let acc = 0
  for (let i = 0; i < words.length; i += 1) {
    acc += weights[i]
    if (fraction < acc / total) return i
  }
  return words.length - 1
}

function SyncedLine({ result, trackKey }: { result: Extract<LyricsResult, { kind: 'synced' }>; trackKey: string }) {
  const { items, active, mode, offset, ratio } = useLyricTiming(result, trackKey)
  const { status } = useAudioPlayer()
  const playing = status === 'playing'
  const text = active >= 0 ? items[active]?.text.trim() ?? '' : ''
  const words = useMemo(() => (text ? text.split(/\s+/) : []), [text])
  // Mode "estimated" tidak punya waktu baris yang bisa dipercaya, jadi tidak ada sorotan per kata.
  const timed = mode !== 'estimated' && active >= 0 && words.length > 0

  const start = timed ? items[active].time ?? 0 : 0
  let gap = 6
  if (timed) {
    for (let i = active + 1; i < items.length; i += 1) {
      const t = items[i].time
      if (t !== undefined && t > start) {
        gap = t - start
        break
      }
    }
  }
  const span = singingSpan(text.length, gap)

  const [wordIdx, setWordIdx] = useState(0)
  useEffect(() => {
    if (!timed) return
    let frame = 0
    let last = -2
    const tick = () => {
      const t = audioEngine.getLiveTime()
      if (t !== null) {
        const lyricTime = (mode === 'scaled' ? t / ratio : t) + offset + LEAD_S
        const idx = wordAt(words, Math.max(0, (lyricTime - start) / span))
        if (idx !== last) {
          last = idx
          setWordIdx(idx)
        }
      }
      if (playing) frame = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(frame)
  }, [timed, playing, words, mode, ratio, offset, start, span])

  if (!text) return <Strip text="♪" dim />
  if (!timed) return <Strip text={text} />
  return <WordStrip key={`${active}|${text}`} words={words} wordIdx={Math.min(wordIdx, words.length - 1)} />
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
  const track = useMemo(() => {
    if (!currentTrack) return null
    if (playbackInfo && !looksLikeSameTrack(currentTrack, playbackInfo)) {
      return { ...currentTrack, title: playbackInfo.title, artists: playbackInfo.artist, album: playbackInfo.album, duration: playbackInfo.duration }
    }
    return currentTrack
  }, [currentTrack, playbackInfo])
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
