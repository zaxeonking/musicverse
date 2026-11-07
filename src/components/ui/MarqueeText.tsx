import { useEffect, useRef } from 'react'

/** Jeda (ms) di awal teks dan setelah ujung teks terlihat, sebelum gulir berikutnya. */
const PAUSE_MS = 1600
/** Kecepatan gulir (px per detik). */
const SPEED_PX_S = 42
/** Lama kembali ke awal (ms). */
const RETURN_MS = 700

/**
 * Teks satu baris. Muat = diam. Kepanjangan (terpotong) = menggulir ke samping sampai ujung terlihat,
 * berhenti sebentar, kembali ke awal, berhenti sebentar, lalu menggulir lagi, berulang.
 * Pengguna dengan "kurangi gerakan" melihat teks terpotong biasa (elipsis).
 */
export default function MarqueeText({ text, className = '' }: { text: string; className?: string }) {
  const boxRef = useRef<HTMLSpanElement>(null)
  const textRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const box = boxRef.current
    const inner = textRef.current
    if (!box || !inner) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    let animation: Animation | null = null

    const apply = () => {
      animation?.cancel()
      animation = null
      const overflow = inner.scrollWidth - box.clientWidth
      box.style.textOverflow = overflow > 1 && reduce ? 'ellipsis' : 'clip'
      if (overflow <= 1 || reduce || typeof inner.animate !== 'function') return
      const scrollMs = (overflow / SPEED_PX_S) * 1000
      const total = PAUSE_MS + scrollMs + PAUSE_MS + RETURN_MS
      const at = (ms: number) => ms / total
      animation = inner.animate(
        [
          { transform: 'translateX(0)', offset: 0 },
          { transform: 'translateX(0)', offset: at(PAUSE_MS), easing: 'linear' },
          { transform: `translateX(${-overflow}px)`, offset: at(PAUSE_MS + scrollMs) },
          { transform: `translateX(${-overflow}px)`, offset: at(PAUSE_MS + scrollMs + PAUSE_MS), easing: 'ease-in-out' },
          { transform: 'translateX(0)', offset: 1 },
        ],
        { duration: total, iterations: Infinity },
      )
    }

    apply()
    const observer = new ResizeObserver(apply)
    observer.observe(box)
    observer.observe(inner)
    return () => {
      observer.disconnect()
      animation?.cancel()
    }
  }, [text])

  return (
    <span ref={boxRef} className={`block min-w-0 overflow-hidden whitespace-nowrap ${className}`} title={text}>
      <span ref={textRef} className="inline-block will-change-transform">
        {text}
      </span>
    </span>
  )
}
