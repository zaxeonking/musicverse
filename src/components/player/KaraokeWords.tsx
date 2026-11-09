import { useEffect, useRef } from 'react'
import { useAudioPlayer } from '../../hooks/useAudioPlayer'
import { LEAD_S } from '../../hooks/useLyricTiming'
import { audioEngine } from '../../services/audioEngine'
import type { LyricWord } from '../../utils/lrc'
import { activeWordIndex, sweepGradient, wordFill } from '../../utils/wordSync'
import { prefersReducedMotion } from '../../utils/motion'

/** Cara mengubah waktu audio menjadi waktu lirik (sama dengan hasil `useLyricTiming`). */
export interface SweepTiming {
  mode: 'exact' | 'scaled' | 'estimated'
  ratio: number
  offset: number
}

/** Warna kata yang belum dinyanyikan. */
export const REST_COLOR = 'rgba(255,255,255,0.45)'
export const REST_COLOR_DIM = 'rgba(255,255,255,0.35)'

/**
 * Teks lirik dengan sorotan menyapu halus: tiap kata terisi dari kiri ke kanan (per huruf, tepi lembut) mengikuti
 * posisi audio. Dipakai bersama oleh pemutar penuh dan mini player, jadi sorotan di kedua tempat selalu sama.
 *
 * Isi dihitung dari posisi audio langsung tiap frame dan ditulis ke variabel CSS `--p` tiap kata, tanpa render ulang
 * React. `onIndex` (opsional) dipanggil hanya saat kata yang sedang dinyanyikan berganti. Gerak dikurangi: kata menyala
 * utuh saat gilirannya, tanpa sapuan bertahap.
 */
export default function KaraokeWords({
  words,
  timing,
  rest = REST_COLOR,
  className = '',
  onIndex,
}: {
  words: LyricWord[]
  timing: SweepTiming
  rest?: string
  className?: string
  onIndex?: (index: number) => void
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const { status } = useAudioPlayer()
  const playing = status === 'playing'
  const onIndexRef = useRef(onIndex)
  onIndexRef.current = onIndex

  useEffect(() => {
    const node = ref.current
    if (!node) return undefined
    const reduce = prefersReducedMotion()
    const nodes = Array.from(node.children) as HTMLElement[]
    const written: string[] = []
    let lastIndex = -2
    const paint = () => {
      const live = audioEngine.getLiveTime()
      if (live === null) return
      const t = (timing.mode === 'scaled' ? live / timing.ratio : live) + timing.offset + LEAD_S
      for (let i = 0; i < words.length; i += 1) {
        const f = wordFill(words[i], t)
        const value = (reduce ? (f > 0 ? 1 : 0) : f).toFixed(3)
        if (written[i] !== value) {
          written[i] = value
          nodes[i]?.style.setProperty('--p', value)
        }
      }
      const index = Math.max(0, activeWordIndex(words, t))
      if (index !== lastIndex) {
        lastIndex = index
        onIndexRef.current?.(index)
      }
    }
    paint()
    if (!playing) return undefined
    let frame = 0
    const tick = () => {
      paint()
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [words, playing, timing.mode, timing.ratio, timing.offset])

  const backgroundImage = sweepGradient(rest)
  return (
    <span ref={ref} className={className}>
      {words.map((w, i) => (
        <span
          key={i}
          style={{
            backgroundImage,
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            boxDecorationBreak: 'clone',
            WebkitBoxDecorationBreak: 'clone',
          }}
        >
          {w.text}
        </span>
      ))}
    </span>
  )
}
