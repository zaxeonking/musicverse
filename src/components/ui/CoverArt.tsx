import { useCallback, useEffect, useId, useState } from 'react'
import type { Cover } from '../../types'
import { isSafeHttpUrl } from '../../utils/spotifyUrl'

interface CoverArtProps {
  cover: Cover
  /** Gambar dari API. Jika kosong atau gagal dimuat, gradient `cover` dipakai. */
  src?: string
  round?: boolean
  className?: string
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

export default function CoverArt({ cover, src, round = false, className = '' }: CoverArtProps) {
  const gradientId = useId()
  const [failed, setFailed] = useState(false)
  // Gambar memudar masuk (dan mengendap dari sedikit lebih besar) begitu selesai dimuat, bukan muncul mendadak.
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setFailed(false)
    setLoaded(false)
  }, [src])

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
      {showImage ? (
        <img
          ref={imgRef}
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
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
