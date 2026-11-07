import { readJson, writeJson } from './safeStorage'

/**
 * Tema aplikasi. Warna dipasang sebagai variabel CSS "r g b" di <html> (dibaca tailwind.config.js), jadi seluruh UI
 * berganti tanpa render ulang. Tema selalu gelap: latar dibatasi supaya teks putih dan lapisan putih transparan
 * (bg-white/10 dst.) tetap terbaca.
 */
const KEY = 'musicverse:theme:v1'

export interface ThemePreset {
  id: string
  label: string
  accent: string
  bg: string
}

export const THEME_PRESETS: readonly ThemePreset[] = [
  { id: 'hijau', label: 'Hijau', accent: '#1DB954', bg: '#121212' },
  { id: 'biru', label: 'Biru Malam', accent: '#4F8CFF', bg: '#0E1420' },
  { id: 'ungu', label: 'Ungu', accent: '#A78BFA', bg: '#15111F' },
  { id: 'mawar', label: 'Mawar', accent: '#FF5C8A', bg: '#1A1115' },
  { id: 'oranye', label: 'Oranye', accent: '#FF9A3C', bg: '#17120D' },
  { id: 'laut', label: 'Laut', accent: '#22D3EE', bg: '#0B1618' },
  { id: 'merah', label: 'Merah', accent: '#EF4444', bg: '#160F0F' },
  { id: 'amoled', label: 'AMOLED', accent: '#FFFFFF', bg: '#000000' },
]

export const CUSTOM_ID = 'kustom'

export interface ThemeState {
  /** id preset, atau 'kustom' = pakai warna pilihan sendiri. */
  preset: string
  customAccent: string
  customBg: string
}

const DEFAULT_STATE: ThemeState = { preset: 'hijau', customAccent: '#1DB954', customBg: '#121212' }

const HEX = /^#[0-9a-fA-F]{6}$/

function load(): ThemeState {
  const out = readJson(KEY)
  if (out.status !== 'ok' || typeof out.value !== 'object' || out.value === null) return DEFAULT_STATE
  const v = out.value as Record<string, unknown>
  const preset = typeof v.preset === 'string' && (v.preset === CUSTOM_ID || THEME_PRESETS.some((p) => p.id === v.preset)) ? v.preset : DEFAULT_STATE.preset
  return {
    preset,
    customAccent: typeof v.customAccent === 'string' && HEX.test(v.customAccent) ? v.customAccent : DEFAULT_STATE.customAccent,
    customBg: typeof v.customBg === 'string' && HEX.test(v.customBg) ? v.customBg : DEFAULT_STATE.customBg,
  }
}

// Dibaca malas: localStorage baru terisi setelah initNativeStorage() selesai.
let state: ThemeState | null = null
const listeners = new Set<() => void>()

export function getTheme(): ThemeState {
  if (state === null) state = load()
  return state
}

export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function setTheme(patch: Partial<ThemeState>): void {
  const next = { ...getTheme(), ...patch }
  if (next.customAccent && !HEX.test(next.customAccent)) next.customAccent = getTheme().customAccent
  if (next.customBg && !HEX.test(next.customBg)) next.customBg = getTheme().customBg
  state = next
  writeJson(KEY, next)
  applyTheme(next)
  for (const listener of [...listeners]) listener()
}

/** Warna (accent, bg) yang berlaku untuk state ini. */
export function resolveColors(s: ThemeState): { accent: string; bg: string } {
  if (s.preset === CUSTOM_ID) return { accent: s.customAccent, bg: s.customBg }
  const p = THEME_PRESETS.find((item) => item.id === s.preset) ?? THEME_PRESETS[0]
  return { accent: p.accent, bg: p.bg }
}

// ---------- Warna ----------
type RGB = [number, number, number]

export function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function rgbToHex([r, g, b]: RGB): string {
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

function luminance([r, g, b]: RGB): number {
  const f = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

function contrast(a: RGB, b: RGB): number {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

export function rgbToHsl([r, g, b]: RGB): [number, number, number] {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0)
  else if (max === gn) h = (bn - rn) / d + 2
  else h = (rn - gn) / d + 4
  return [h / 6, s, l]
}

export function hslToRgb([h, s, l]: [number, number, number]): RGB {
  if (s === 0) return [l * 255, l * 255, l * 255]
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const hue = (t: number) => {
    let x = t
    if (x < 0) x += 1
    if (x > 1) x -= 1
    if (x < 1 / 6) return p + (q - p) * 6 * x
    if (x < 1 / 2) return q
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6
    return p
  }
  return [hue(h + 1 / 3) * 255, hue(h) * 255, hue(h - 1 / 3) * 255]
}

/** Latar dipaksa tetap gelap (kecerahan HSL maks. 0,16), apa pun warna yang dipilih. */
export function clampBg(hex: string): string {
  const [h, s, l] = rgbToHsl(hexToRgb(hex))
  if (l <= 0.16) return hex
  return rgbToHex(hslToRgb([h, Math.min(s, 0.5), 0.16]))
}

const WHITE: RGB = [255, 255, 255]
const BLACK: RGB = [0, 0, 0]
const triplet = (c: RGB) => c.map((v) => Math.round(Math.max(0, Math.min(255, v)))).join(' ')

export interface ThemeTokens {
  bg: string
  card: string
  raised: string
  raisedHover: string
  inkMuted: string
  inkFaint: string
  accent: string
  accentSoft: string
  accentDeep: string
  onAccent: string
  /** Hex latar, untuk meta theme-color. */
  bgHex: string
}

export function deriveTokens(accentHex: string, bgHex: string): ThemeTokens {
  const bgFixed = clampBg(bgHex)
  const bg = hexToRgb(bgFixed)
  // Aksen terlalu gelap untuk latar ini (teks/ikon beraksen jadi tak terbaca): diterangkan bertahap.
  let accent = hexToRgb(accentHex)
  for (let i = 0; i < 10 && contrast(accent, bg) < 3; i += 1) accent = mix(accent, WHITE, 0.12)
  const onAccent = contrast(accent, BLACK) >= contrast(accent, WHITE) ? BLACK : WHITE
  return {
    bg: triplet(bg),
    card: triplet(mix(bg, WHITE, 0.025)),
    raised: triplet(mix(bg, WHITE, 0.077)),
    raisedHover: triplet(mix(bg, WHITE, 0.118)),
    inkMuted: triplet(mix(WHITE, bg, 0.37)),
    inkFaint: triplet(mix(WHITE, bg, 0.49)),
    accent: triplet(accent),
    accentSoft: triplet(mix(accent, WHITE, 0.15)),
    accentDeep: triplet(mix(accent, BLACK, 0.2)),
    onAccent: triplet(onAccent),
    bgHex: bgFixed,
  }
}

export function applyTheme(s: ThemeState = getTheme()): void {
  if (typeof document === 'undefined') return
  const { accent, bg } = resolveColors(s)
  const t = deriveTokens(accent, bg)
  const root = document.documentElement
  root.style.setProperty('--mv-bg', t.bg)
  root.style.setProperty('--mv-card', t.card)
  root.style.setProperty('--mv-raised', t.raised)
  root.style.setProperty('--mv-raised-hover', t.raisedHover)
  root.style.setProperty('--mv-ink-muted', t.inkMuted)
  root.style.setProperty('--mv-ink-faint', t.inkFaint)
  root.style.setProperty('--mv-accent', t.accent)
  root.style.setProperty('--mv-accent-soft', t.accentSoft)
  root.style.setProperty('--mv-accent-deep', t.accentDeep)
  root.style.setProperty('--mv-on-accent', t.onAccent)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t.bgHex)
}

/** Panggil sekali saat start (APK), setelah penyimpanan dimuat dan sebelum render pertama. */
export function initTheme(): void {
  applyTheme(getTheme())
}
