/**
 * Gelombang audio kecil (batang naik-turun). Hanya `transform: scaleY` (jalur compositor, ringan di Android);
 * kotaknya berukuran tetap sehingga tidak menggeser tata letak. Saat `playing` salah, batang diam di tinggi
 * berbeda-beda (tetap terbaca sebagai gelombang). `motion-reduce` = batang diam.
 */
const HEIGHTS = [0.45, 0.8, 0.55, 1, 0.65, 0.9, 0.5, 0.75]

export default function Waveform({
  playing = true,
  bars = 5,
  className = '',
  barClassName = 'bg-current',
}: {
  playing?: boolean
  bars?: number
  className?: string
  barClassName?: string
}) {
  return (
    <span aria-hidden="true" className={`inline-flex h-4 items-center gap-[2px] ${className}`}>
      {Array.from({ length: bars }, (_, i) => {
        const base = HEIGHTS[i % HEIGHTS.length]
        return (
          <span
            key={i}
            className={`h-full w-[2.5px] origin-center rounded-full motion-reduce:animate-none ${playing ? 'animate-eq' : ''} ${barClassName}`}
            style={{
              animationDuration: `${820 + ((i * 137) % 5) * 130}ms`,
              animationDelay: `${-(i * 173) % 700}ms`,
              transform: `scaleY(${base})`,
            }}
          />
        )
      })}
    </span>
  )
}
