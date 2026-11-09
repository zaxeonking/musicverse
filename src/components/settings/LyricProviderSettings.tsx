import { ArrowDown, ArrowUp, Languages, Mic2, RotateCcw, Type } from 'lucide-react'
import { useState } from 'react'
import SettingSwitch from '../ui/SettingSwitch'
import { useLyricDisplayPrefs } from '../../hooks/useLyricDisplayPrefs'
import { saveDisplayPrefs } from '../../utils/lyricDisplayPrefs'
import {
  DEFAULT_PREFS,
  LYRIC_PRIORITIES,
  loadProviderPrefs,
  saveProviderPrefs,
  WORD_PROVIDERS,
  type LyricProviderPrefs,
  type WordProviderId,
} from '../../utils/lyricProviderPrefs'

const labelOf = (id: WordProviderId) => WORD_PROVIDERS.find((p) => p.id === id)?.label ?? id

/** Pengaturan sumber lirik per kata: saklar utama, urutan provider, dan matikan per provider. Tersimpan langsung. */
export default function LyricProviderSettings() {
  const [prefs, setPrefs] = useState<LyricProviderPrefs>(loadProviderPrefs)
  const display = useLyricDisplayPrefs()

  const update = (next: LyricProviderPrefs) => {
    setPrefs(next)
    saveProviderPrefs(next)
  }
  const move = (index: number, delta: -1 | 1) => {
    const order = [...prefs.order]
    const to = index + delta
    if (to < 0 || to >= order.length) return
    ;[order[index], order[to]] = [order[to], order[index]]
    update({ ...prefs, order })
  }
  const toggle = (id: WordProviderId) =>
    update({ ...prefs, disabled: prefs.disabled.includes(id) ? prefs.disabled.filter((d) => d !== id) : [...prefs.disabled, id] })
  const isDefault =
    prefs.priority === DEFAULT_PREFS.priority &&
    prefs.wordSync === DEFAULT_PREFS.wordSync && prefs.disabled.length === 0 && prefs.order.every((id, i) => id === DEFAULT_PREFS.order[i])

  return (
    <div className="mt-6">
      <h2 className="mb-2 text-lg font-bold text-ink">Lirik</h2>
      <p id="lyric-priority-label" className="text-sm font-medium text-ink">
        Utamakan lirik dari
      </p>
      <div role="radiogroup" aria-labelledby="lyric-priority-label" className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1">
        {LYRIC_PRIORITIES.map((item) => (
          <button
            key={item.id}
            type="button"
            role="radio"
            aria-checked={prefs.priority === item.id}
            onClick={() => update({ ...prefs, priority: item.id })}
            className={`focus-ring h-9 shrink-0 rounded-full px-4 text-sm font-medium ${prefs.priority === item.id ? 'bg-accent text-accent-on' : 'bg-raised text-ink'}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <p className="mb-3 mt-1.5 text-xs text-ink-muted">
        {LYRIC_PRIORITIES.find((p) => p.id === prefs.priority)?.hint}. Sumber lain hanya dipakai bila yang diutamakan tidak punya lirik. Per lagu bisa diganti lewat tombol Sumber di panel lirik. Berlaku untuk lagu berikutnya.
      </p>
      <SettingSwitch
        checked={prefs.wordSync}
        onChange={() => update({ ...prefs, wordSync: !prefs.wordSync })}
        icon={Mic2}
        label="Lirik per kata"
        hint="Sorot lirik kata demi kata, lengkap dengan duet dan vokal latar bila tersedia. Mati = hanya lirik per baris (LRCLIB / NetEase). Berlaku untuk lagu berikutnya."
      />
      <div className="mt-2 space-y-2">
        <SettingSwitch
          checked={display.translation}
          onChange={() => saveDisplayPrefs({ ...display, translation: !display.translation })}
          icon={Languages}
          label="Tampilkan terjemahan"
          hint="Terjemahan di bawah baris lirik bila server menyediakannya. Berlaku seketika."
        />
        <SettingSwitch
          checked={display.romanization}
          onChange={() => saveDisplayPrefs({ ...display, romanization: !display.romanization })}
          icon={Type}
          label="Tampilkan romanisasi"
          hint="Cara baca huruf Latin untuk lirik Jepang (kana), Korea, Hindi, dan Rusia, dari server atau dibuat di perangkat. Baris dengan kanji / hanzi tidak diromanisasi."
        />
      </div>
      {prefs.wordSync && (
        <ul aria-label="Urutan sumber lirik per kata" className="mt-2 space-y-2">
          {prefs.order.map((id, i) => {
            const off = prefs.disabled.includes(id)
            return (
              <li key={id} className="flex items-center gap-2 rounded-lg bg-card px-3 py-2 text-sm text-ink">
                <span className="min-w-0 flex-1">
                  <span className={`block ${off ? 'text-ink-muted line-through' : ''}`}>{labelOf(id)}</span>
                  <span className="block text-xs text-ink-muted">{off ? 'Dimatikan' : `Dicoba ke-${prefs.order.filter((o) => !prefs.disabled.includes(o)).indexOf(id) + 1}`}</span>
                </span>
                <button
                  type="button"
                  onClick={() => toggle(id)}
                  className="focus-ring rounded-md px-2 py-1 text-xs font-semibold text-accent"
                  aria-label={`${off ? 'Nyalakan' : 'Matikan'} ${labelOf(id)}`}
                >
                  {off ? 'Nyalakan' : 'Matikan'}
                </button>
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Naikkan ${labelOf(id)}`} className="focus-ring rounded-md p-1.5 text-ink-muted disabled:opacity-30">
                  <ArrowUp className="h-4 w-4" aria-hidden="true" />
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === prefs.order.length - 1} aria-label={`Turunkan ${labelOf(id)}`} className="focus-ring rounded-md p-1.5 text-ink-muted disabled:opacity-30">
                  <ArrowDown className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {!isDefault && (
        <button type="button" onClick={() => update({ ...DEFAULT_PREFS, order: [...DEFAULT_PREFS.order], disabled: [] })} className="focus-ring mt-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold text-accent">
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          Reset ke bawaan
        </button>
      )}
    </div>
  )
}
