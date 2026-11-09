
/**
 * Lambang MusicVerse: "orbit suara". Cincin tipis (semesta) dengan gelombang empat batang di tengahnya dan satu titik coral
 * yang mengorbit di tepinya. Warna mengikuti aksen tema; titiknya selalu coral (identitas merek).
 */
export function LogoMark({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={`shrink-0 ${className}`} aria-hidden="true">
      <circle cx="20" cy="20" r="17.5" fill="none" strokeWidth="1.5" style={{ stroke: 'rgb(var(--mv-accent, 139 92 246) / 0.45)' }} />
      <g style={{ fill: 'rgb(var(--mv-accent, 139 92 246))' }}>
        <rect x="11" y="17" width="3.6" height="6" rx="1.8" />
        <rect x="16.2" y="12" width="3.6" height="16" rx="1.8" />
        <rect x="21.4" y="15" width="3.6" height="10" rx="1.8" />
        <rect x="26.6" y="18.5" width="3.6" height="3" rx="1.5" />
      </g>
      <circle cx="33.4" cy="9.6" r="3.2" style={{ fill: 'rgb(var(--mv-coral, 255 118 87))' }} />
    </svg>
  )
}

export default function Logo() {
  return (
    <div className="flex items-center gap-2">
      <LogoMark />
      <span className="font-display text-[1.35rem] font-extrabold leading-none tracking-[-0.03em] text-ink">
        Music<span className="font-medium text-ink-muted">Verse</span>
      </span>
    </div>
  )
}
