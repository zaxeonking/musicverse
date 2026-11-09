import { ArrowLeft, BookmarkPlus, Check, ClipboardPaste, Copy, Dices, Download, Home, Library, Moon, Play, RotateCcw, Search, Smartphone, Sparkles, Sun, Sunrise, Wind, X, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import ColorField from '../components/settings/ColorField'
import SettingSwitch from '../components/ui/SettingSwitch'
import { useTheme } from '../hooks/useTheme'
import { useIconFollowsTheme } from '../native/appearance'
import { readClipboardText, writeClipboardText } from '../native/clipboard'
import { isNativeApp } from '../native/platform'
import { setReduceMotion, useReduceMotion } from '../utils/motion'
import {
  BG_LIMITS,
  CUSTOM_ID,
  clampBg,
  decodeTheme,
  deleteSavedTheme,
  deriveTokens,
  encodeTheme,
  getSavedThemes,
  MAX_SAVED_THEMES,
  randomThemePatch,
  resolveColors,
  resolveMode,
  saveCurrentTheme,
  THEME_PRESETS,
  type GlowLevel,
  type RadiusStyle,
  type SurfaceStyle,
  type TextScale,
  type ThemeMode,
  type ThemeState,
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

const SURFACES: ReadonlyArray<{ id: SurfaceStyle; label: string; hint: string }> = [
  { id: 'solid', label: 'Solid', hint: 'Kartu berisi penuh, bawaan.' },
  { id: 'kaca', label: 'Kaca', hint: 'Kartu tembus pandang dengan tepi bercahaya. Paling cantik bersama Cahaya latar.' },
  { id: 'garis', label: 'Garis', hint: 'Kartu hanya berupa kerangka tipis; tampilan paling ringan dan bersih.' },
]

const TEXT_SCALES: ReadonlyArray<{ id: TextScale; label: string }> = [
  { id: 'kecil', label: 'Kecil' },
  { id: 'normal', label: 'Normal' },
  { id: 'besar', label: 'Besar' },
]

const GLOW_LEVELS: ReadonlyArray<{ id: GlowLevel; label: string }> = [
  { id: 'lembut', label: 'Lembut' },
  { id: 'sedang', label: 'Sedang' },
  { id: 'kuat', label: 'Kuat' },
]

/** Warna aksen cepat untuk tema Kustom (tinggal ketuk; slider di bawahnya untuk yang lain). */
const QUICK_ACCENTS = ['#1DB954', '#22D3EE', '#4F8CFF', '#6366F1', '#A78BFA', '#E879F9', '#FF5C8A', '#EF4444', '#FF9A3C', '#FACC15', '#A3E635', '#14B8A6']

/** Tema (APK): mode gelap/terang, tema siap pakai atau warna sendiri, bentuk sudut, aksen ikut sampul, dan bagikan tema. */
export default function ThemeSettingsPage() {
  const [theme, setTheme] = useTheme()
  const [iconFollows, setIconFollows] = useIconFollowsTheme()
  const motion = useReduceMotion()
  const [codeInput, setCodeInput] = useState('')
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [saved, setSaved] = useState<ThemeState[]>(() => getSavedThemes())
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
      <h1 className="mb-3 text-3xl font-extrabold text-ink">Tema</h1>

      {/* Menempel di atas area scroll: perubahan terlihat langsung tanpa naik-turun halaman. */}
      <div className="sticky top-0 z-20 -mx-4 bg-bg/95 px-4 pb-2 pt-1">
        <LivePreview glow={theme.glow} />
      </div>

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

      <button type="button" onClick={() => setTheme(randomThemePatch())} className="btn-secondary mt-2 w-full">
        <Dices className="h-4 w-4" aria-hidden="true" />
        Acak tema
      </button>

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

      <h2 className="mb-2 mt-6 text-sm font-semibold text-ink-muted">Gaya</h2>
      <div className="space-y-2">
        <div className="rounded-lg bg-card px-4 py-3">
          <p className="mb-2 text-sm text-ink">Gaya permukaan</p>
          <Segmented value={theme.surface} options={SURFACES.map(({ id, label }) => ({ id, label }))} onChange={(id) => setTheme({ surface: id })} label="Gaya permukaan" />
          <p className="mt-1.5 text-xs text-ink-faint">{SURFACES.find((x) => x.id === theme.surface)?.hint}</p>
        </div>
        <div className="rounded-lg bg-card px-4 py-3">
          <p className="mb-2 text-sm text-ink">Bentuk sudut</p>
          <Segmented value={theme.radius} options={RADII} onChange={(id) => setTheme({ radius: id })} label="Bentuk sudut" />
        </div>
        <div className="rounded-lg bg-card px-4 py-3">
          <p className="mb-2 text-sm text-ink">Ukuran teks</p>
          <Segmented value={theme.textScale} options={TEXT_SCALES} onChange={(id) => setTheme({ textScale: id })} label="Ukuran teks" />
        </div>
      </div>

      <h2 className="mb-2 mt-6 text-sm font-semibold text-ink-muted">Warna dinamis</h2>
      <div className="space-y-2">
        <SettingSwitch
          checked={theme.dynamicAccent}
          onChange={() => setTheme({ dynamicAccent: !theme.dynamicAccent })}
          icon={Sparkles}
          label="Aksen ikut sampul lagu"
          hint="Warna aksen seluruh aplikasi berubah mengikuti sampul lagu yang diputar."
        />
        <SettingSwitch
          checked={theme.glow}
          onChange={() => setTheme({ glow: !theme.glow })}
          icon={Sunrise}
          label="Cahaya latar"
          hint="Semburat lembut warna aksen di bagian atas layar."
        />
        {theme.glow && (
          <div className="rounded-lg bg-card px-4 py-3">
            <p className="mb-2 text-sm text-ink">Kekuatan cahaya</p>
            <Segmented value={theme.glowLevel} options={GLOW_LEVELS} onChange={(id) => setTheme({ glowLevel: id })} label="Kekuatan cahaya latar" />
          </div>
        )}
      </div>

      <h2 className="mb-2 mt-6 text-sm font-semibold text-ink-muted">Gerakan</h2>
      <div className="space-y-2">
        <SettingSwitch
          checked={motion.on}
          onChange={() => {
            if (!motion.locked) setReduceMotion(!motion.on)
          }}
          icon={Wind}
          label="Kurangi gerakan"
          hint={
            motion.locked
              ? 'Menyala karena pengaturan sistem (Hapus animasi / Kurangi gerakan) aktif. Matikan di pengaturan sistem untuk memakai animasi lagi.'
              : 'Menghilangkan animasi besar: transisi halaman, sheet dan pemutar yang meluncur, gelembung, banner geser, efek pegas, dan putaran piringan. Penanda kecil seperti pemuatan tetap berjalan seperlunya.'
          }
        />
      </div>

      <h2 className="mb-2 mt-6 text-sm font-semibold text-ink-muted">Layar pembuka &amp; ikon</h2>
      <div className="space-y-2">
        <p className="rounded-lg bg-card px-4 py-3 text-xs text-ink-muted">
          Animasi saat aplikasi dibuka (logo dan nama) otomatis memakai warna tema. Aksen yang mengikuti sampul lagu tidak dipakai di sini.
        </p>
        <SettingSwitch
          checked={iconFollows}
          onChange={() => setIconFollows(!iconFollows)}
          icon={Smartphone}
          label="Ikon aplikasi ikut tema"
          hint="Ikon di layar utama berganti warna mengikuti tema (tema Kustom memakai warna siap pakai yang paling mirip). Bisa butuh beberapa detik, dan sebagian peluncur melepas pintasan yang sudah ditempel."
        />
      </div>

      <div className="mb-2 mt-6 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink-muted">Tema tersimpan</h2>
        <button
          type="button"
          disabled={saved.length >= MAX_SAVED_THEMES && saved.some((t) => encodeTheme(t) === encodeTheme(theme)) === false}
          onClick={() => {
            setSaved(saveCurrentTheme())
            say('ok', 'Tema saat ini disimpan.')
          }}
          className="focus-ring flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-accent disabled:opacity-40"
        >
          <BookmarkPlus className="h-4 w-4" aria-hidden="true" />
          Simpan tema ini
        </button>
      </div>
      {saved.length === 0 ? (
        <p className="px-1 text-xs text-ink-faint">Belum ada. Atur tema sesukamu, lalu simpan supaya bisa dipakai lagi kapan saja (maks. {MAX_SAVED_THEMES}).</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2" aria-label="Tema tersimpan">
          {saved.map((item, index) => {
            const m = resolveMode(item)
            const c = resolveColors(item, m)
            const t = deriveTokens(c.accent, c.bg, m)
            const active = encodeTheme(item) === encodeTheme(theme)
            return (
              <li key={`${encodeTheme(item)}-${index}`} className="relative">
                <button
                  type="button"
                  aria-label={`Pakai tema tersimpan ${index + 1}`}
                  aria-pressed={active}
                  onClick={() => setTheme(item)}
                  className="focus-ring block h-14 w-full overflow-hidden rounded-xl border-2"
                  style={{ backgroundColor: `rgb(${t.bg})`, borderColor: active ? `rgb(${t.accent})` : `rgb(${t.veil} / 0.14)` }}
                >
                  <span className="flex h-full items-end gap-1 p-1.5">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: `rgb(${t.accent})` }} />
                    <span className="h-2 flex-1 rounded-full" style={{ backgroundColor: `rgb(${t.raised})` }} />
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={`Hapus tema tersimpan ${index + 1}`}
                  onClick={() => setSaved(deleteSavedTheme(index))}
                  className="focus-ring absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-raised text-ink-muted"
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              </li>
            )
          })}
        </ul>
      )}

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
        onClick={() => setTheme({ mode: 'dark', preset: 'hijau', radius: 'normal', dynamicAccent: false, glow: false, glowLevel: 'sedang', surface: 'solid', textScale: 'normal' })}
        className="btn-secondary mt-6 w-full"
      >
        <RotateCcw className="h-4 w-4" aria-hidden="true" />
        Kembali ke tema bawaan
      </button>
    </section>
  )
}

/** Pratinjau langsung (ringkas): layar mini yang memakai kelas aplikasi asli, jadi selalu persis seperti hasilnya. */
function LivePreview({ glow }: { glow: boolean }) {
  const rows = [
    { t: 'Lagu yang sedang diputar', a: 'Artis Favorit', now: true },
    { t: 'Judul lagu kedua', a: 'Nama Artis', now: false },
  ]
  return (
    <div className={`overflow-hidden rounded-xl border border-veil/10 bg-bg shadow-lg shadow-black/20 ${glow ? 'mv-glow' : ''}`} aria-label="Pratinjau tema" role="img">
      <div className="flex items-center gap-2 px-2.5 pt-2">
        <p className="font-display text-sm font-extrabold text-ink">Beranda</p>
        <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-accent-on">Semua</span>
        <span className="rounded-full bg-raised px-2 py-0.5 text-[10px] text-ink">Disukai</span>
      </div>
      <ul className="mt-1.5 space-y-1 px-2">
        {rows.map((row) => (
          <li key={row.t} className={`flex items-center gap-2 rounded-lg bg-card px-1.5 py-1 ${row.now ? 'shadow-now' : ''}`}>
            <span className="h-6 w-6 shrink-0 rounded-md bg-raised" style={row.now ? { backgroundImage: 'linear-gradient(135deg, rgb(var(--mv-accent)) 0%, rgb(var(--mv-accent-deep)) 100%)' } : undefined} />
            <span className="min-w-0 flex-1">
              <span className={`block truncate text-[11px] font-semibold leading-tight ${row.now ? 'text-accent' : 'text-ink'}`}>{row.t}</span>
              <span className="block truncate text-[10px] leading-tight text-ink-muted">{row.a}</span>
            </span>
            <span className="text-[10px] text-ink-faint">3:24</span>
          </li>
        ))}
      </ul>
      <div className="mx-2 mt-1.5 rounded-lg bg-raised px-2 py-1.5">
        <div className="flex items-center gap-2">
          <span className="h-6 w-6 shrink-0 rounded-md bg-accent/30" />
          <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-ink">Lagu yang sedang diputar</span>
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink text-bg">
            <Play className="h-3 w-3" fill="currentColor" aria-hidden="true" />
          </span>
        </div>
        <div className="mt-1.5 h-0.5 overflow-hidden rounded-full bg-veil/15">
          <div className="h-full w-2/5 rounded-full bg-accent" />
        </div>
      </div>
      <div className="m-2 mt-1.5 flex justify-around rounded-full border border-veil/10 bg-card py-1.5">
        {[Home, Search, Library, Download].map((Icon, i) => (
          <Icon key={i} className={`h-3.5 w-3.5 ${i === 0 ? 'text-accent' : 'text-ink-muted'}`} aria-hidden="true" />
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

