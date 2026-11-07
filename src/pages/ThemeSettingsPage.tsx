import { ArrowLeft, Check, ClipboardPaste, Copy, Download, Home, Library, Moon, Play, RotateCcw, Search, Smartphone, Sparkles, Sun, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import ColorField from '../components/settings/ColorField'
import SettingSwitch from '../components/ui/SettingSwitch'
import { useTheme } from '../hooks/useTheme'
import { readClipboardText, writeClipboardText } from '../native/clipboard'
import { isNativeApp } from '../native/platform'
import {
  BG_LIMITS,
  CUSTOM_ID,
  clampBg,
  decodeTheme,
  deriveTokens,
  encodeTheme,
  resolveColors,
  resolveMode,
  THEME_PRESETS,
  type RadiusStyle,
  type ThemeMode,
  type ThemeTokens,
} from '../utils/theme'

const MODES: ReadonlyArray<{ id: ThemeMode; label: string; icon: LucideIcon }> = [
  { id: 'dark', label: 'Gelap', icon: Moon },
  { id: 'light', label: 'Terang', icon: Sun },
  { id: 'auto', label: 'Otomatis', icon: Smartphone },
]

const RADII: ReadonlyArray<{ id: RadiusStyle; label: string }> = [
  { id: 'tajam', label: 'Tajam' },
  { id: 'normal', label: 'Normal' },
  { id: 'bulat', label: 'Bulat' },
]

/** Warna aksen cepat untuk tema Kustom (tinggal ketuk; slider di bawahnya untuk yang lain). */
const QUICK_ACCENTS = ['#1DB954', '#22D3EE', '#4F8CFF', '#6366F1', '#A78BFA', '#E879F9', '#FF5C8A', '#EF4444', '#FF9A3C', '#FACC15', '#A3E635', '#14B8A6']

/** Tema (APK): mode gelap/terang, tema siap pakai atau warna sendiri, bentuk sudut, aksen ikut sampul, dan bagikan tema. */
export default function ThemeSettingsPage() {
  const [theme, setTheme] = useTheme()
  const [codeInput, setCodeInput] = useState('')
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  if (!isNativeApp()) return <Navigate to="/" replace />

  const mode = resolveMode(theme)
  const custom = theme.preset === CUSTOM_ID
  const current = resolveColors(theme, mode)
  const bgLimits = BG_LIMITS[mode]
  const bgKey = mode === 'light' ? 'customBgLight' : 'customBgDark'

  const say = (kind: 'ok' | 'error', text: string) => {
    setNotice({ kind, text })
    window.setTimeout(() => setNotice(null), 3500)
  }

  const copyCode = async () => {
    const ok = await writeClipboardText(encodeTheme(theme))
    say(ok ? 'ok' : 'error', ok ? 'Kode tema disalin. Kirim ke temanmu.' : 'Gagal menyalin. Salin manual dari kolom kode di bawah.')
  }

  const applyCode = (raw: string) => {
    const parsed = decodeTheme(raw)
    if (!parsed) {
      say('error', 'Kode tema tidak valid. Kode diawali "MVT1.".')
      return
    }
    setTheme(parsed)
    setCodeInput('')
    say('ok', 'Tema dari kode berhasil diterapkan.')
  }

  const pasteCode = async () => {
    const text = await readClipboardText()
    if (text === null || text.trim() === '') {
      say('error', 'Clipboard kosong atau tidak bisa dibaca. Tempel manual di kolom.')
      return
    }
    applyCode(text)
  }

  return (
    <section aria-label="Tema" className="px-4 pb-10 pt-2">
      <Link to="/settings" className="back-glass focus-ring mb-2 inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Pengaturan
      </Link>
      <h1 className="mb-4 text-3xl font-extrabold text-ink">Tema</h1>

      <LivePreview />

      <h2 className="mb-2 mt-6 text-sm font-semibold text-ink-muted">Mode</h2>
      <Segmented value={theme.mode} options={MODES} onChange={(id) => setTheme({ mode: id })} label="Mode tampilan" />
      {theme.mode === 'auto' && <p className="mt-1.5 px-1 text-xs text-ink-faint">Mengikuti pengaturan gelap/terang di HP-mu (sekarang: {mode === 'dark' ? 'gelap' : 'terang'}).</p>}

      <h2 className="mb-2 mt-6 text-sm font-semibold text-ink-muted">Tema</h2>
      <ul className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tema siap pakai">
        {THEME_PRESETS.map((preset) => {
          const colors = resolveColors({ ...theme, preset: preset.id }, mode)
          return (
            <li key={preset.id}>
              <PresetCard tokens={deriveTokens(colors.accent, colors.bg, mode)} label={preset.label} active={theme.preset === preset.id} onClick={() => setTheme({ preset: preset.id })} />
            </li>
          )
        })}
        <li>
          <PresetCard
            tokens={deriveTokens(theme.customAccent, mode === 'light' ? theme.customBgLight : theme.customBgDark, mode)}
            label="Kustom"
            active={custom}
            onClick={() => setTheme({ preset: CUSTOM_ID })}
          />
        </li>
      </ul>

      {custom ? (
        <div className="mt-4 space-y-2">
          <h2 className="text-sm font-semibold text-ink-muted">Warna sendiri</h2>
          <div className="rounded-lg bg-card px-4 py-3">
            <p className="mb-2 text-xs text-ink-muted">Aksen cepat</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_ACCENTS.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  aria-label={`Aksen ${hex}`}
                  aria-pressed={theme.customAccent.toUpperCase() === hex}
                  onClick={() => setTheme({ customAccent: hex })}
                  className={`focus-ring h-9 w-9 rounded-full border-2 ${theme.customAccent.toUpperCase() === hex ? 'border-ink' : 'border-veil/20'}`}
                  style={{ backgroundColor: hex }}
                />
              ))}
            </div>
          </div>
          <ColorField label="Warna aksen" value={theme.customAccent} onChange={(hex) => setTheme({ customAccent: hex })} minL={0.15} maxL={0.85} />
          <ColorField
            label={`Warna latar (${mode === 'light' ? 'terang' : 'gelap'})`}
            value={clampBg(theme[bgKey], mode)}
            onChange={(hex) => setTheme({ [bgKey]: hex })}
            minL={bgLimits.minL}
            maxL={bgLimits.maxL}
            maxS={bgLimits.maxS}
          />
          <p className="px-1 text-xs text-ink-faint">
            Latar punya rentang sendiri di tiap mode supaya teks tetap terbaca. Aksen yang kurang kontras otomatis disesuaikan. Latar gelap dan terang disimpan terpisah.
          </p>
        </div>
      ) : (
        <p className="mt-2 px-1 text-xs text-ink-faint">
          Sekarang: aksen {current.accent.toUpperCase()}, latar {current.bg.toUpperCase()}. Pilih Kustom untuk mengatur sendiri.
        </p>
      )}

      <h2 className="mb-2 mt-6 text-sm font-semibold text-ink-muted">Tampilan</h2>
      <div className="space-y-2">
        <div className="rounded-lg bg-card px-4 py-3">
          <p className="mb-2 text-sm text-ink">Bentuk sudut</p>
          <Segmented value={theme.radius} options={RADII} onChange={(id) => setTheme({ radius: id })} label="Bentuk sudut" />
        </div>
        <SettingSwitch
          checked={theme.dynamicAccent}
          onChange={() => setTheme({ dynamicAccent: !theme.dynamicAccent })}
          icon={Sparkles}
          label="Aksen ikut sampul lagu"
          hint="Warna aksen seluruh aplikasi berubah mengikuti sampul lagu yang diputar."
        />
      </div>

      <h2 className="mb-2 mt-6 text-sm font-semibold text-ink-muted">Bagikan tema</h2>
      <div className="space-y-2 rounded-lg bg-card px-4 py-3">
        <p className="text-xs text-ink-muted">Salin kode tema-mu untuk dikirim ke teman, atau tempel kode dari teman untuk memakai temanya.</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => void copyCode()} className="btn-secondary flex-1">
            <Copy className="h-4 w-4" aria-hidden="true" />
            Salin kode
          </button>
          <button type="button" onClick={() => void pasteCode()} className="btn-secondary flex-1">
            <ClipboardPaste className="h-4 w-4" aria-hidden="true" />
            Tempel & pakai
          </button>
        </div>
        <div className="flex gap-2">
          <input
            value={codeInput}
            onChange={(event) => setCodeInput(event.target.value)}
            placeholder="MVT1...."
            spellCheck={false}
            autoCapitalize="off"
            aria-label="Kode tema"
            className="focus-ring min-w-0 flex-1 rounded-full bg-raised px-4 font-mono text-xs text-ink placeholder:text-ink-faint"
          />
          <button type="button" disabled={codeInput.trim() === ''} onClick={() => applyCode(codeInput)} className="btn-primary h-11 px-5">
            Terapkan
          </button>
        </div>
        {notice && (
          <p role="status" className={`text-xs ${notice.kind === 'ok' ? 'text-accent' : 'text-danger'}`}>
            {notice.text}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => setTheme({ mode: 'dark', preset: 'hijau', radius: 'normal', dynamicAccent: false })}
        className="btn-secondary mt-6 w-full"
      >
        <RotateCcw className="h-4 w-4" aria-hidden="true" />
        Kembali ke tema bawaan
      </button>
    </section>
  )
}

/** Pratinjau langsung: layar mini yang memakai kelas aplikasi asli, jadi selalu persis seperti hasilnya. */
function LivePreview() {
  return (
    <div className="overflow-hidden rounded-2xl border border-veil/10 bg-bg" aria-label="Pratinjau tema" role="img">
      <div className="px-3 pt-3">
        <p className="font-display text-base font-extrabold text-ink">Beranda</p>
        <div className="mt-2 flex gap-1.5">
          <span className="rounded-full bg-accent px-3 py-1 text-[11px] font-semibold text-accent-on">Semua</span>
          <span className="rounded-full bg-raised px-3 py-1 text-[11px] text-ink">Disukai</span>
          <span className="rounded-full bg-raised px-3 py-1 text-[11px] text-ink">Unduhan</span>
        </div>
      </div>
      <ul className="mt-2 space-y-1 px-2">
        {[
          { t: 'Lagu yang sedang diputar', a: 'Artis Favorit', now: true },
          { t: 'Judul lagu kedua', a: 'Nama Artis', now: false },
          { t: 'Judul lagu ketiga', a: 'Nama Artis', now: false },
        ].map((row, i) => (
          <li key={i} className={`flex items-center gap-2.5 rounded-lg bg-card px-2 py-1.5 ${row.now ? 'shadow-now' : ''}`}>
            <span className="h-9 w-9 shrink-0 rounded-md bg-raised" style={row.now ? { backgroundImage: 'linear-gradient(135deg, rgb(var(--mv-accent)) 0%, rgb(var(--mv-accent-deep)) 100%)' } : undefined} />
            <span className="min-w-0 flex-1">
              <span className={`block truncate text-xs font-semibold ${row.now ? 'text-accent' : 'text-ink'}`}>{row.t}</span>
              <span className="block truncate text-[11px] text-ink-muted">{row.a}</span>
            </span>
            <span className="text-[11px] text-ink-faint">3:24</span>
          </li>
        ))}
      </ul>
      <div className="mx-2 mt-2 rounded-xl bg-raised p-2">
        <div className="flex items-center gap-2">
          <span className="h-8 w-8 shrink-0 rounded-md bg-accent/30" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-semibold text-ink">Lagu yang sedang diputar</span>
            <span className="block truncate text-[11px] text-ink-muted">Artis Favorit</span>
          </span>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-bg">
            <Play className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true" />
          </span>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-veil/15">
          <div className="h-full w-2/5 rounded-full bg-accent" />
        </div>
      </div>
      <div className="m-2 flex justify-around rounded-full border border-veil/10 bg-card py-2">
        {[Home, Search, Library, Download].map((Icon, i) => (
          <Icon key={i} className={`h-4 w-4 ${i === 0 ? 'text-accent' : 'text-ink-muted'}`} aria-hidden="true" />
        ))}
      </div>
    </div>
  )
}

/** Kartu tema: layar mini berwarna dari token tema itu sendiri (bukan tema yang sedang aktif). */
function PresetCard({ tokens: t, label, active, onClick }: { tokens: ThemeTokens; label: string; active: boolean; onClick: () => void }) {
  const rgb = (v: string) => `rgb(${v})`
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className="focus-ring block w-full overflow-hidden rounded-xl border-2 p-2.5 text-left"
      style={{ backgroundColor: rgb(t.bg), borderColor: active ? rgb(t.accent) : `rgb(${t.veil} / 0.14)` }}
    >
      <span className="flex items-center gap-1.5">
        <span className="h-4 w-4 rounded-md" style={{ backgroundColor: rgb(t.accent) }} />
        <span className="h-1.5 flex-1 rounded-full" style={{ backgroundColor: rgb(t.inkMuted) }} />
        <span className="h-1.5 w-4 rounded-full" style={{ backgroundColor: rgb(t.inkFaint) }} />
      </span>
      <span className="mt-2 block space-y-1">
        <span className="block h-5 rounded-md" style={{ backgroundColor: rgb(t.card) }} />
        <span className="block h-5 rounded-md" style={{ backgroundColor: rgb(t.raised) }} />
      </span>
      <span className="mt-2 flex items-center justify-between">
        <span className="text-xs font-semibold" style={{ color: rgb(t.ink) }}>
          {label}
        </span>
        {active ? (
          <span className="flex h-4 w-4 items-center justify-center rounded-full" style={{ backgroundColor: rgb(t.accent), color: rgb(t.onAccent) }}>
            <Check className="h-3 w-3" aria-hidden="true" />
          </span>
        ) : (
          <span className="h-2 w-6 rounded-full" style={{ backgroundColor: rgb(t.accent) }} />
        )}
      </span>
    </button>
  )
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: ReadonlyArray<{ id: T; label: string; icon?: LucideIcon }>
  onChange: (id: T) => void
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1 rounded-full bg-raised p-1">
      {options.map(({ id, label: text, icon: Icon }) => {
        const active = value === id
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(id)}
            className={`focus-ring flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full text-xs font-semibold transition-colors ${active ? 'bg-accent text-accent-on' : 'text-ink-muted'}`}
          >
            {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
            {text}
          </button>
        )
      })}
    </div>
  )
}

