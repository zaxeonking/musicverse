import type { ComponentType } from 'react'

interface Props {
  checked: boolean
  onChange: () => void
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>
  label: string
  hint: string
}

/** Baris pengaturan dengan tombol geser (role="switch"). */
export default function SettingSwitch({ checked, onChange, icon: Icon, label, hint }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className="flex w-full items-center gap-3 rounded-lg bg-card px-4 py-3 text-left text-sm text-ink focus-ring"
    >
      <Icon className={`h-4 w-4 shrink-0 ${checked ? 'text-accent' : 'text-ink-muted'}`} aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block">{label}</span>
        <span className="block text-xs text-ink-muted">{hint}</span>
      </span>
      <span aria-hidden="true" className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-white/20'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${checked ? 'left-[1.125rem]' : 'left-0.5'}`} />
      </span>
    </button>
  )
}
