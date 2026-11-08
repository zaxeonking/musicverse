import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { Cover } from '../../types'
import { isSafeHttpUrl } from '../../utils/spotifyUrl'

interface CoverArtProps {
  cover: Cover
  /** Gambar dari API. Jika kosong atau gagal dimuat, gradient `cover` dipakai. */
  src?: string
  round?: boolean
  className?: string
  /**
   * Gambar tampil utuh sejak frame pertama (tanpa memudar masuk dari transparan). Untuk salinan sampul yang menggantikan
   * tampilan yang sama di tengah transisi (disc <-> kartu): sampulnya sudah termuat di kartu, jadi tidak boleh tampil kosong dulu.
   * Ganti lagu tetap memudar masuk seperti biasa.
   */
  instant?: boolean
  /**
   * Ganti lagu = sampul baru memudar masuk DI ATAS sampul lama (yang tetap tampil sampai yang baru siap), lalu yang lama dibuang.
   * Tanpa ini gambar lama langsung hilang dan latar kosong terlihat selama gambar baru dimuat.
   */
  crossfade?: boolean
}

interface Layer {
  id: number
  src: string
  ready: boolean
}

/** Tumpukan sampul untuk `crossfade`. Hanya opacity + transform (tanpa layout ulang). */
function FadeStack({ src, onError }: { src: string; onError: () => void }) {
  const [layers, setLayers] = useState<Layer[]>(() => [{ id: 0, src, ready: false }])
  const nextId = useRef(1)

  useEffect(() => {
    setLayers((prev) => (prev[prev.length - 1].src === src ? prev : [...prev, { id: nextId.current++, src, ready: false }]))
  }, [src])

  // Idempoten: dipanggil dari ref callback tiap render, tidak boleh memicu render ulang bila sudah siap.
  const markReady = useCallback((id: number) => {
    setLayers((prev) => (prev.some((l) => l.id === id && !l.ready) ? prev.map((l) => (l.id === id ? { ...l, ready: true } : l)) : prev))
  }, [])

  // Sampul terbaru sudah menutup penuh: lapisan lama dibuang setelah transisinya selesai.
  const newestReady = layers[layers.length - 1].ready
  const count = layers.length
  useEffect(() => {
    if (count < 2 || !newestReady) return
    const timer = window.setTimeout(() => setLayers((prev) => prev.slice(-1)), 560)
    return () => window.clearTimeout(timer)
  }, [count, newestReady])

  return (
    <>
      {layers.map((layer, i) => {
        const newest = i === layers.length - 1
        // Lapisan lama tetap buram penuh di bawah: yang baru memudar di atasnya (tanpa titik tengah yang meredup).
        const visible = !newest || layer.ready
        return (
          <img
            key={layer.id}
            ref={(img) => {
              if (img?.complete && img.naturalWidth > 0) markReady(layer.id)
            }}
            src={layer.src}
            alt=""
            decoding="async"
            referrerPolicy="no-referrer"
            onLoad={() => markReady(layer.id)}
            onError={() => {
              if (newest) onError()
            }}
            className={`absolute inset-0 h-full w-full object-cover transition-[opacity,transform] duration-500 ease-out motion-reduce:transition-none ${
              visible ? 'scale-100 opacity-100' : 'scale-[1.04] opacity-0'
            }`}
          />
        )
      })}
    </>
  )
}

function Shape({ shape }: { shape: Cover['shape'] }) {
  switch (shape) {
    case 'rings':
      return (
        <g fill="none" stroke="#fff" strokeOpacity="0.28" strokeWidth="2">
          <circle cx="72" cy="30" r="12" />
          <circle cx="72" cy="30" r="26" />
          <circle cx="72" cy="30" r="40" />
          <circle cx="72" cy="30" r="54" />
        </g>
      )
    case 'bars':
      return (
        <g fill="#fff" fillOpacity="0.28">
          {[22, 38, 58, 44, 70, 50, 30].map((h, i) => (
            <rect key={i} x={10 + i * 12} y={100 - h} width="7" height={h} rx="3.5" />
          ))}
        </g>
      )
    case 'sun':
      return (
        <g fill="#fff" fillOpacity="0.24">
          <circle cx="50" cy="66" r="30" />
          <circle cx="50" cy="66" r="42" fillOpacity="0.1" />
        </g>
      )
    case 'dots':
      return (
        <g fill="#fff" fillOpacity="0.3">
          {[0, 1, 2, 3].flatMap((r) =>
            [0, 1, 2, 3].map((c) => (
              <circle key={`${r}-${c}`} cx={20 + c * 20} cy={20 + r * 20} r={r === c ? 5 : 2.5} />
            )),
          )}
        </g>
      )
  }
}

export default function CoverArt({ cover, src, round = false, className = '', instant = false, crossfade = false }: CoverArtProps) {
  const gradientId = useId()
  const [failed, setFailed] = useState(false)
  // Gambar memudar masuk (dan mengendap dari sedikit lebih besar) begitu selesai dimuat, bukan muncul mendadak.
  const [loaded, setLoaded] = useState(instant)
  const firstSrc = useRef(src)

  useEffect(() => {
    setFailed(false)
    // Efek ini juga jalan saat dipasang. Untuk `instant` jangan sembunyikan gambar yang sudah tampil pada src pertama.
    if (instant && src === firstSrc.current) return
    setLoaded(false)
  }, [src, instant])

  // Gambar dari cache bisa sudah selesai sebelum onLoad terpasang.
  const imgRef = useCallback((img: HTMLImageElement | null) => {
    if (img?.complete && img.naturalWidth > 0) setLoaded(true)
  }, [])

  const showImage = isSafeHttpUrl(src) && !failed
  return (
    <div
      className={`relative aspect-square w-full overflow-hidden bg-raised ${
        round ? 'rounded-full' : 'rounded-md'
      } ${className}`}
      aria-hidden="true"
    >
      {showImage && crossfade ? (
        <FadeStack src={src as string} onError={() => setFailed(true)} />
      ) : showImage ? (
        <img
          ref={imgRef}
          src={src}
          alt=""
          loading={instant ? 'eager' : 'lazy'}
          decoding={instant ? 'sync' : 'async'}
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={`absolute inset-0 h-full w-full object-cover transition-[opacity,transform] duration-500 ease-out motion-reduce:transition-none ${
            loaded ? 'scale-100 opacity-100' : 'scale-[1.04] opacity-0'
          }`}
        />
      ) : (
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={cover.from} />
            <stop offset="1" stopColor={cover.to} />
          </linearGradient>
        </defs>
        <rect width="100" height="100" fill={`url(#${gradientId})`} />
        <Shape shape={cover.shape} />
      </svg>
      )}
    </div>
  )
}
