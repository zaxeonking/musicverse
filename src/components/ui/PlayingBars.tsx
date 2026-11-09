/**
 * Indikator equalizer untuk lagu aktif: tiga batang naik-turun saat `playing`, membeku di tempat saat jeda.
 * Hanya `transform: scaleY` (GPU, tanpa layout ulang); ukuran kotaknya tetap, jadi tidak menggeser baris.
 * Animasi `eq` sudah ada di tailwind.config.js; `motion-reduce` = batang diam.
 */
export default function PlayingBars({ playing, className = '' }: { playing: boolean; className?: string }) {
  // Fase dan durasi tiap batang dibedakan supaya geraknya tidak serempak.
  const bars = [
    { delay: '0ms', duration: '900ms' },
    { delay: '-300ms', duration: '1100ms' },
    { delay: '-600ms', duration: '1000ms' },
  ]
  return (
    <span aria-hidden="true" className={`inline-flex h-3.5 items-end justify-center gap-[2px] ${className}`}>
      {bars.map((bar, i) => (
        <span
          key={i}
          className="h-full w-[3px] origin-bottom animate-eq rounded-full bg-current motion-reduce:animate-none"
          style={{
            // Hanya durasi dan fase yang inline; nama animasinya dari kelas, supaya `motion-reduce:animate-none` tetap menang.
            animationDuration: bar.duration,
            animationDelay: bar.delay,
            animationPlayState: playing ? 'running' : 'paused',
            // Saat jeda batang berhenti di tinggi sedang, bukan di titik terendah/tertinggi acak.
            transform: 'scaleY(0.6)',
            willChange: playing ? 'transform' : undefined,
          }}
        />
      ))}
    </span>
  )
}

/**
 * Penanda lagu aktif di atas sampul untuk baris yang tidak punya kolom nomor (Unduhan, Lokal, Riwayat, Playlist saya).
 * `absolute inset-0` di dalam pembungkus `relative`: tidak menambah ukuran sehingga baris tidak bergeser. Hanya tampil saat
 * lagunya aktif (playing/paused); batang bergerak saat playing dan diam saat jeda.
 */
export function CoverPlayingBadge({ activity, className = 'rounded-md' }: { activity: string; className?: string }) {
  if (activity !== 'playing' && activity !== 'paused') return null
  return (
    <span className={`mv-in pointer-events-none absolute inset-0 flex items-center justify-center bg-black/45 text-white ${className}`} aria-hidden="true">
      <PlayingBars playing={activity === 'playing'} />
    </span>
  )
}
