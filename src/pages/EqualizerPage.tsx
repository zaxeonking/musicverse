import { ArrowLeft, SlidersHorizontal } from 'lucide-react'
import { Link, Navigate } from 'react-router-dom'
import SettingSwitch from '../components/ui/SettingSwitch'
import {
  EQ_FREQS,
  EQ_PRESETS,
  EQ_RANGE_DB,
  setEqEnabled,
  setEqGain,
  setEqPreset,
  useEqState,
} from '../services/equalizer'
import { isNativeApp } from '../native/platform'

function label(freq: number): string {
  return freq >= 1000 ? `${freq / 1000} kHz` : `${freq} Hz`
}

/** Equalizer 10-band (APK). Berlaku mulai lagu berikutnya setelah dinyalakan. */
export default function EqualizerPage() {
  const eq = useEqState()
  if (!isNativeApp()) return <Navigate to="/" replace />
  return (
    <section aria-label="Equalizer" className="px-4 pb-8 pt-2">
      <Link to="/settings" className="focus-ring -ml-1 mb-2 inline-flex items-center gap-1 rounded-md p-1 text-sm text-ink-muted">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Pengaturan
      </Link>
      <h1 className="mb-4 text-3xl font-extrabold text-ink">Equalizer</h1>

      <SettingSwitch
        checked={eq.enabled}
        onChange={() => setEqEnabled(!eq.enabled)}
        icon={SlidersHorizontal}
        label="Aktifkan equalizer"
        hint="Mulai berlaku di lagu berikutnya. Lagu yang sedang berjalan tidak berubah."
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
                eq.preset === name ? 'bg-accent text-black' : 'bg-raised text-ink'
              }`}
            >
              {name}
            </button>
          ))}
          {eq.preset === 'Custom' && (
            <span className="inline-flex h-9 shrink-0 items-center rounded-full bg-raised px-4 text-sm text-ink-muted">Custom</span>
          )}
        </div>

        <ul className="mt-4 space-y-1 rounded-lg bg-card px-4 py-3">
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
