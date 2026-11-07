import { useEffect, useState } from 'react'
import { hexToRgb, hslToRgb, rgbToHex, rgbToHsl } from '../../utils/theme'

interface Props {
  label: string
  value: string
  onChange: (hex: string) => void
  /** Batas kecerahan HSL (0..1). Latar dibatasi supaya tetap gelap. */
  minL?: number
  maxL?: number
  /** Batas kejenuhan HSL (0..1). */
  maxS?: number
}

const HEX = /^#[0-9a-fA-F]{6}$/
const hsl = (h: number, s: number, l: number) => `hsl(${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`

/**
 * Pemilih warna sendiri (HSL + kode hex). `<input type="color">` tidak tersedia di semua WebView Android,
 * jadi tiga slider ini yang dipakai.
 */
export default function ColorField({ label, value, onChange, minL = 0, maxL = 1, maxS = 1 }: Props) {
  const [h, s, l] = rgbToHsl(hexToRgb(value))
  const [text, setText] = useState(value.toUpperCase())
  useEffect(() => setText(value.toUpperCase()), [value])

  // Warna tak berkromatik (abu-abu) kehilangan hue; jaga hue terakhir supaya slider tidak melompat ke merah.
  const [hue, setHue] = useState(h)
  useEffect(() => {
    if (s > 0.02 && l > 0.02 && l < 0.98) setHue(h)
  }, [h, s, l])

  const commit = (nh: number, ns: number, nl: number) => {
    const sat = Math.min(maxS, Math.max(0, ns))
    const light = Math.min(maxL, Math.max(minL, nl))
    onChange(rgbToHex(hslToRgb([nh, sat, light])).toUpperCase())
  }

  return (
    <div className="rounded-lg bg-card px-4 py-3">
      <div className="mb-3 flex items-center gap-3">
        <span className="h-9 w-9 shrink-0 rounded-full border border-veil/20" style={{ backgroundColor: value }} aria-hidden="true" />
        <span className="min-w-0 flex-1 text-sm font-semibold text-ink">{label}</span>
        <input
          value={text}
          onChange={(event) => {
            const raw = event.target.value.startsWith('#') ? event.target.value : `#${event.target.value}`
            setText(raw)
            if (HEX.test(raw)) onChange(raw.toUpperCase())
          }}
          onBlur={() => setText(value.toUpperCase())}
          inputMode="text"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={7}
          aria-label={`${label}, kode hex`}
          className="focus-ring w-24 rounded-md bg-raised px-2 py-1.5 text-center font-mono text-xs text-ink"
        />
      </div>
      <div className="space-y-3">
        <Slider
          name="Rona"
          value={hue}
          max={1}
          onChange={(v) => {
            setHue(v)
            commit(v, s, l)
          }}
          track={`linear-gradient(90deg, ${[0, 1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6, 1].map((x) => hsl(x, 1, 0.5)).join(',')})`}
        />
        <Slider
          name="Kejenuhan"
          value={s}
          max={maxS}
          onChange={(v) => commit(hue, v, l)}
          track={`linear-gradient(90deg, ${hsl(hue, 0, l)}, ${hsl(hue, maxS, l)})`}
        />
        <Slider
          name="Kecerahan"
          value={l}
          min={minL}
          max={maxL}
          onChange={(v) => commit(hue, s, v)}
          track={`linear-gradient(90deg, ${hsl(hue, s, minL)}, ${hsl(hue, s, maxL)})`}
        />
      </div>
    </div>
  )
}

function Slider({ name, value, min = 0, max, onChange, track }: { name: string; value: number; min?: number; max: number; onChange: (v: number) => void; track: string }) {
  return (
    <label className="flex items-center gap-3 text-xs text-ink-muted">
      <span className="w-16 shrink-0">{name}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={0.002}
        value={Math.min(max, Math.max(min, value))}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mv-slider"
        style={{ background: track }}
      />
    </label>
  )
}
