import { ArrowLeft, Check, RotateCcw } from 'lucide-react'
import { Link, Navigate } from 'react-router-dom'
import ColorField from '../components/settings/ColorField'
import { useTheme } from '../hooks/useTheme'
import { isNativeApp } from '../native/platform'
import { clampBg, CUSTOM_ID, resolveColors, THEME_PRESETS } from '../utils/theme'

/** Tema (APK): pilih tema siap pakai, atau atur sendiri warna aksen dan latar. Berlaku langsung ke seluruh aplikasi. */
export default function ThemeSettingsPage() {
  const [theme, setTheme] = useTheme()
  if (!isNativeApp()) return <Navigate to="/" replace />
  const custom = theme.preset === CUSTOM_ID
  const current = resolveColors(theme)

  return (
    <section aria-label="Tema" className="px-4 pb-8 pt-2">
      <Link to="/settings" className="back-glass focus-ring mb-2 inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Pengaturan
      </Link>
      <h1 className="mb-4 text-3xl font-extrabold text-ink">Tema</h1>

      <div className="mb-4 rounded-lg bg-card p-4">
        <p className="mb-3 text-xs font-semibold text-ink-muted">Pratinjau</p>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn-primary">
            Putar
          </button>
          <button type="button" className="btn-secondary">
            Acak
          </button>
          <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-on">Chip</span>
          <span className="rounded-full bg-raised px-3 py-1 text-xs text-ink">Chip</span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-raised">
          <div className="h-full w-2/5 rounded-full bg-accent" />
        </div>
        <p className="mt-3 text-sm text-ink">
          Teks utama <span className="text-ink-muted">· teks sekunder</span> <span className="text-accent">· aksen</span>
        </p>
      </div>

      <h2 className="mb-2 text-sm font-semibold text-ink-muted">Tema siap pakai</h2>
      <ul className="mb-4 grid grid-cols-4 gap-2" role="radiogroup" aria-label="Tema siap pakai">
        {THEME_PRESETS.map((preset) => {
          const active = theme.preset === preset.id
          return (
            <li key={preset.id}>
              <button
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setTheme({ preset: preset.id })}
                className="focus-ring flex w-full flex-col items-center gap-1.5 rounded-lg bg-card px-1 py-3"
              >
                <Swatch bg={preset.bg} accent={preset.accent} active={active} />
                <span className={`text-[11px] ${active ? 'font-semibold text-ink' : 'text-ink-muted'}`}>{preset.label}</span>
              </button>
            </li>
          )
        })}
        <li>
          <button
            type="button"
            role="radio"
            aria-checked={custom}
            onClick={() => setTheme({ preset: CUSTOM_ID })}
            className="focus-ring flex w-full flex-col items-center gap-1.5 rounded-lg bg-card px-1 py-3"
          >
            <Swatch bg={clampBg(theme.customBg)} accent={theme.customAccent} active={custom} />
            <span className={`text-[11px] ${custom ? 'font-semibold text-ink' : 'text-ink-muted'}`}>Kustom</span>
          </button>
        </li>
      </ul>

      {custom ? (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-ink-muted">Warna sendiri</h2>
          <ColorField label="Warna aksen" value={theme.customAccent} onChange={(hex) => setTheme({ customAccent: hex })} minL={0.2} maxL={0.8} />
          <ColorField label="Warna latar" value={clampBg(theme.customBg)} onChange={(hex) => setTheme({ customBg: hex })} maxL={0.16} maxS={0.5} />
          <p className="px-1 text-xs text-ink-faint">Latar dibatasi tetap gelap supaya teks putih tetap terbaca. Aksen yang terlalu gelap otomatis diterangkan.</p>
        </div>
      ) : (
        <p className="px-1 text-xs text-ink-faint">
          Pilih Kustom untuk mengatur warna aksen dan latar sendiri (sekarang: aksen {current.accent.toUpperCase()}, latar {current.bg.toUpperCase()}).
        </p>
      )}

      <button
        type="button"
        onClick={() => setTheme({ preset: 'hijau' })}
        disabled={theme.preset === 'hijau'}
        className="btn-secondary mt-6 w-full"
      >
        <RotateCcw className="h-4 w-4" aria-hidden="true" />
        Kembali ke tema bawaan
      </button>
    </section>
  )
}

function Swatch({ bg, accent, active }: { bg: string; accent: string; active: boolean }) {
  return (
    <span
      className={`relative flex h-11 w-11 items-center justify-center rounded-full border ${active ? 'border-white ring-2 ring-white/60' : 'border-white/20'}`}
      style={{ background: `linear-gradient(135deg, ${bg} 50%, ${accent} 50%)` }}
      aria-hidden="true"
    >
      {active && <Check className="h-5 w-5 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" />}
    </span>
  )
}
