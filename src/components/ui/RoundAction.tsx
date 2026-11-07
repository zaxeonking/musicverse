import type { LucideIcon } from 'lucide-react'

interface RoundActionProps {
  icon: LucideIcon
  /** Hanya untuk pembaca layar dan tooltip desktop; tidak tampil sebagai teks. */
  label: string
  onClick: () => void
  /** Tombol utama (Putar semua): lebih besar dan hijau. */
  primary?: boolean
  disabled?: boolean
  haspopup?: boolean
  iconClassName?: string
  fill?: boolean
  /** Menjadi merah saat disorot (mis. hapus). */
  danger?: boolean
  pressed?: boolean
}

/** Tombol aksi bulat tanpa teks (ikon saja). Dipakai deret aksi di kepala playlist dan halaman artis/album. */
export default function RoundAction({ icon: Icon, label, onClick, primary = false, disabled, haspopup, iconClassName, fill, danger, pressed }: RoundActionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      aria-haspopup={haspopup ? 'dialog' : undefined}
      aria-pressed={pressed}
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-full transition-[background-color,transform,opacity] duration-150 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 ${
        primary
          ? 'h-14 w-14 bg-accent text-accent-on hover:bg-accent-soft active:bg-accent-deep focus-visible:ring-ink'
          : `h-11 w-11 bg-raised hover:bg-raised-hover active:bg-raised focus-visible:ring-accent ${danger ? 'text-ink hover:text-danger' : 'text-ink'}`
      }`}
    >
      <Icon className={`${primary ? 'h-6 w-6' : 'h-5 w-5'} ${iconClassName ?? ''}`} fill={fill ? 'currentColor' : 'none'} aria-hidden="true" />
    </button>
  )
}
