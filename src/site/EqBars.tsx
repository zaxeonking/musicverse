/** Empat batang yang sama dengan logo, bergerak pelan. Statis bila pengguna meminta gerakan dikurangi (aturan global di index.css). */
export default function EqBars({ className = '', color = '#1DB954' }: { className?: string; color?: string }) {
  const bars = [
    { h: 'h-2', delay: '0s', dur: '1.1s' },
    { h: 'h-4', delay: '-0.4s', dur: '0.9s' },
    { h: 'h-5', delay: '-0.7s', dur: '1.3s' },
    { h: 'h-3', delay: '-0.2s', dur: '1s' },
  ]
  return (
    <span aria-hidden="true" className={`inline-flex h-5 items-end gap-[3px] ${className}`}>
      {bars.map((bar, index) => (
        <span
          key={index}
          className={`w-[3px] origin-bottom animate-eq rounded-full ${bar.h}`}
          style={{ backgroundColor: color, animationDelay: bar.delay, animationDuration: bar.dur }}
        />
      ))}
    </span>
  )
}
