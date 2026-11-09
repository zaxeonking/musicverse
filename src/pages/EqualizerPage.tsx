import { ArrowLeft, SlidersHorizontal, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import SettingSwitch from '../components/ui/SettingSwitch'
import {
  EQ_FREQS,
  EQ_PRESETS,
  EQ_RANGE_DB,
  deleteUserPreset,
  MAX_PRESET_NAME,
  MAX_USER_PRESETS,
  saveUserPreset,
  setEqEnabled,
  setEqGain,
  setEqPreset,
  useEqState,
  useUserPresets,
} from '../services/equalizer'
import { isNativeApp } from '../native/platform'

function label(freq: number): string {
  return freq >= 1000 ? `${freq / 1000} kHz` : `${freq} Hz`
}

/** Equalizer 10-band (APK). Berlaku mulai lagu berikutnya setelah dinyalakan. */
export default function EqualizerPage() {
  const eq = useEqState()
  const userPresets = useUserPresets()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const selectedUser = userPresets.some((p) => p.name === eq.preset)
  const save = () => {
    const failure = saveUserPreset(name)
    setError(
      failure === 'empty'
        ? 'Beri nama dulu.'
        : failure === 'builtin'
          ? 'Nama itu dipakai preset bawaan.'
          : failure === 'full'
            ? `Maksimal ${MAX_USER_PRESETS} preset. Hapus salah satu dulu.`
            : null,
    )
    if (!failure) setName('')
  }
  if (!isNativeApp()) return <Navigate to="/" replace />
  return (
    <section aria-label="Equalizer" className="px-4 pb-8 pt-2">
      <Link to="/settings" className="back-glass focus-ring mb-2 inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Pengaturan
      </Link>
      <h1 className="mb-4 text-3xl font-extrabold text-ink">Equalizer</h1>

      <SettingSwitch
        checked={eq.enabled}
        onChange={() => setEqEnabled(!eq.enabled)}
        icon={SlidersHorizontal}
        label="Aktifkan equalizer"
        hint="Berlaku mulai lagu berikutnya."
      />

      <div className={eq.enabled ? '' : 'pointer-events-none opacity-50'} aria-disabled={!eq.enabled}>
        <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1" role="radiogroup" aria-label="Preset">
          {Object.keys(EQ_PRESETS).map((name) => (
            <button
              key={name}
              type="button"
              role="radio"
              aria-checked={eq.preset === name}
              onClick={() => setEqPreset(name)}
              className={`focus-ring h-9 shrink-0 rounded-full px-4 text-sm font-medium ${
                eq.preset === name ? 'bg-accent text-accent-on' : 'bg-raised text-ink'
              }`}
            >
              {name}
            </button>
          ))}
          {userPresets.map((p) => (
            <button
              key={p.name}
              type="button"
              role="radio"
              aria-checked={eq.preset === p.name}
              onClick={() => setEqPreset(p.name)}
              className={`focus-ring h-9 shrink-0 rounded-full px-4 text-sm font-medium ${
                eq.preset === p.name ? 'bg-accent text-accent-on' : 'bg-raised text-ink'
              }`}
            >
              {p.name}
            </button>
          ))}
          {eq.preset === 'Custom' && (
            <span className="inline-flex h-9 shrink-0 items-center rounded-full bg-raised px-4 text-sm text-ink-muted">Custom</span>
          )}
        </div>

        {eq.preset === 'Custom' && (
          <div className="mt-3 rounded-lg bg-card p-3">
            <label htmlFor="eq-preset-name" className="text-xs text-ink-muted">
              Simpan pengaturan ini sebagai preset
            </label>
            <div className="mt-1.5 flex gap-2">
              <input
                id="eq-preset-name"
                value={name}
                maxLength={MAX_PRESET_NAME}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && save()}
                placeholder="Nama preset"
                className="focus-ring h-10 min-w-0 flex-1 rounded-md bg-raised px-3 text-sm text-ink placeholder:text-ink-muted"
              />
              <button type="button" onClick={save} className="btn-secondary h-10 shrink-0 px-4">
                Simpan
              </button>
            </div>
            {error && (
              <p role="alert" className="mt-1.5 text-xs text-danger">
                {error}
              </p>
            )}
          </div>
        )}
        {selectedUser && (
          <button
            type="button"
            onClick={() => deleteUserPreset(eq.preset)}
            className="focus-ring mt-3 inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold text-danger"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            Hapus preset &ldquo;{eq.preset}&rdquo;
          </button>
        )}

        <ul className="mv-list mt-4 space-y-1 rounded-lg bg-card px-4 py-3">
          {EQ_FREQS.map((freq, i) => (
            <li key={freq} className="flex items-center gap-3">
              <span className="w-14 shrink-0 text-xs text-ink-muted">{label(freq)}</span>
              <input
                type="range"
                min={-EQ_RANGE_DB}
                max={EQ_RANGE_DB}
                step={0.5}
                value={eq.gains[i] ?? 0}
                onChange={(e) => setEqGain(i, Number(e.target.value))}
                aria-label={`Penguatan ${label(freq)}`}
                className="h-10 min-w-0 flex-1 accent-[#1db954]"
              />
              <span className="w-12 shrink-0 text-right text-xs tabular-nums text-ink">
                {(eq.gains[i] ?? 0) > 0 ? '+' : ''}
                {eq.gains[i] ?? 0} dB
              </span>
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-4 text-xs text-ink-muted">
        Equalizer hanya bekerja untuk lagu yang diputar lewat proxy lokal aplikasi dan lagu unduhan. Level umum diturunkan otomatis
        saat ada penguatan supaya suara tidak pecah.
      </p>
    </section>
  )
}
