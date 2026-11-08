import { readJson, writeJson } from './safeStorage'

/**
 * Tema aplikasi. Warna dipasang sebagai variabel CSS "r g b" di <html> (dibaca tailwind.config.js), jadi seluruh UI
 * berganti tanpa render ulang. Mendukung mode gelap, terang, dan otomatis (ikut sistem), warna aksen/latar sendiri,
 * bentuk sudut, serta aksen yang mengikuti sampul lagu.
 */
const KEY = 'musicverse:theme:v2'
const KEY_V1 = 'musicverse:theme:v1'

export type ThemeMode = 'dark' | 'light' | 'auto'
export type RadiusStyle = 'tajam' | 'normal' | 'bulat'
export type ResolvedMode = 'dark' | 'light'

export const RADIUS_FACTOR: Record<RadiusStyle, number> = { tajam: 0.3, normal: 1, bulat: 1.6 }

/** Gaya permukaan kartu/kolom: solid (bawaan), kaca (tembus pandang + garis cahaya), garis (kerangka tipis tanpa isi). Diterapkan lewat CSS `html[data-surface]`. */
export type SurfaceStyle = 'solid' | 'kaca' | 'garis'
/** Ukuran teks seluruh aplikasi (skala rem di <html>). */
export type TextScale = 'kecil' | 'normal' | 'besar'
export const TEXT_SCALE_PERCENT: Record<TextScale, number> = { kecil: 93.75, normal: 100, besar: 112.5 }
/** Kekuatan cahaya latar. */
export type GlowLevel = 'lembut' | 'sedang' | 'kuat'
/** Opasitas cahaya latar per tingkat: [mode gelap, mode terang]. */
export const GLOW_ALPHA: Record<GlowLevel, readonly [number, number]> = { lembut: [0.14, 0.09], sedang: [0.24, 0.16], kuat: [0.38, 0.26] }

export interface ThemePreset {
  id: string
  label: string
  /** Aksen di mode gelap. */
  accent: string
  /** Aksen di mode terang (lebih pekat supaya kontrasnya cukup di atas latar terang). */
  accentLight: string
  bgDark: string
  bgLight: string
}

export const THEME_PRESETS: readonly ThemePreset[] = [
  { id: 'hijau', label: 'Hijau', accent: '#1DB954', accentLight: '#148A3F', bgDark: '#121212', bgLight: '#ECEFEA' },
  { id: 'biru', label: 'Biru', accent: '#4F8CFF', accentLight: '#2F6FED', bgDark: '#0E1420', bgLight: '#EAEEF6' },
  { id: 'ungu', label: 'Ungu', accent: '#A78BFA', accentLight: '#7048E8', bgDark: '#15111F', bgLight: '#EFEDF7' },
  { id: 'mawar', label: 'Mawar', accent: '#FF5C8A', accentLight: '#E0336A', bgDark: '#1A1115', bgLight: '#F6ECEF' },
  { id: 'oranye', label: 'Oranye', accent: '#FF9A3C', accentLight: '#D9650B', bgDark: '#17120D', bgLight: '#F5EFE6' },
  { id: 'laut', label: 'Laut', accent: '#22D3EE', accentLight: '#0891B2', bgDark: '#0B1618', bgLight: '#E6F0F3' },
  { id: 'merah', label: 'Merah', accent: '#EF4444', accentLight: '#D32F2F', bgDark: '#160F0F', bgLight: '#F6ECEC' },
  // Id lama 'amoled' dipertahankan supaya pilihan tersimpan dari versi sebelumnya tetap berlaku.
  { id: 'hutan', label: 'Hutan', accent: '#9BC53D', accentLight: '#5C7F0F', bgDark: '#10150E', bgLight: '#EDF1E4' },
  { id: 'sakura', label: 'Sakura', accent: '#F9A8D4', accentLight: '#C2417A', bgDark: '#1A1217', bgLight: '#F7EDF1' },
  { id: 'kopi', label: 'Kopi', accent: '#D4A373', accentLight: '#8A5A2B', bgDark: '#16110D', bgLight: '#F1EAE2' },
  { id: 'neon', label: 'Neon', accent: '#D946EF', accentLight: '#A21CAF', bgDark: '#120A18', bgLight: '#F3EAF6' },
  { id: 'emas', label: 'Emas', accent: '#F5C542', accentLight: '#9A6B00', bgDark: '#14120A', bgLight: '#F4EFDF' },
  { id: 'malam', label: 'Malam', accent: '#818CF8', accentLight: '#4F46E5', bgDark: '#0C0E1C', bgLight: '#EBECF7' },
  { id: 'batu', label: 'Batu', accent: '#94A3B8', accentLight: '#475569', bgDark: '#0F1215', bgLight: '#E9ECEF' },
  { id: 'amoled', label: 'Mono', accent: '#FFFFFF', accentLight: '#111111', bgDark: '#000000', bgLight: '#EEEEEE' },
]

export const CUSTOM_ID = 'kustom'

export interface ThemeState {
  mode: ThemeMode
  /** id preset, atau 'kustom' = pakai warna pilihan sendiri. */
  preset: string
  customAccent: string
  customBgDark: string
  customBgLight: string
  radius: RadiusStyle
  /** Aksen aplikasi mengikuti warna sampul lagu yang sedang diputar. */
  dynamicAccent: boolean
  /** Cahaya lembut warna aksen di bagian atas latar aplikasi. */
  glow: boolean
  /** Kekuatan cahaya latar (dipakai bila `glow` aktif). */
  glowLevel: GlowLevel
  surface: SurfaceStyle
  textScale: TextScale
}

const DEFAULT_STATE: ThemeState = {
  mode: 'dark',
  preset: 'hijau',
  customAccent: '#1DB954',
  customBgDark: '#121212',
  customBgLight: '#ECEFEA',
  radius: 'normal',
  dynamicAccent: false,
  glow: false,
  glowLevel: 'sedang',
  surface: 'solid',
  textScale: 'normal',
}

const HEX = /^#[0-9a-fA-F]{6}$/
const hexOr = (v: unknown, fallback: string) => (typeof v === 'string' && HEX.test(v) ? v.toUpperCase() : fallback)

function sanitize(raw: unknown): ThemeState | null {
  if (typeof raw !== 'object' || raw === null) return null
  const v = raw as Record<string, unknown>
  const preset = typeof v.preset === 'string' && (v.preset === CUSTOM_ID || THEME_PRESETS.some((p) => p.id === v.preset)) ? v.preset : DEFAULT_STATE.preset
  return {
    mode: v.mode === 'light' || v.mode === 'auto' ? v.mode : 'dark',
    preset,
    customAccent: hexOr(v.customAccent, DEFAULT_STATE.customAccent),
    // v1 menyimpan satu latar kustom (selalu gelap): dibaca sebagai latar gelap.
    customBgDark: hexOr(v.customBgDark ?? v.customBg, DEFAULT_STATE.customBgDark),
    customBgLight: hexOr(v.customBgLight, DEFAULT_STATE.customBgLight),
    radius: v.radius === 'tajam' || v.radius === 'bulat' ? v.radius : 'normal',
    dynamicAccent: v.dynamicAccent === true,
    glow: v.glow === true,
    glowLevel: v.glowLevel === 'lembut' || v.glowLevel === 'kuat' ? v.glowLevel : 'sedang',
    surface: v.surface === 'kaca' || v.surface === 'garis' ? v.surface : 'solid',
    textScale: v.textScale === 'kecil' || v.textScale === 'besar' ? v.textScale : 'normal',
  }
}

function load(): ThemeState {
  for (const key of [KEY, KEY_V1]) {
    const out = readJson(key)
    if (out.status !== 'ok') continue
    const parsed = sanitize(out.value)
    if (parsed) return parsed
  }
  return DEFAULT_STATE
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
  const next = sanitize({ ...getTheme(), ...patch }) ?? getTheme()
  state = next
  writeJson(KEY, next)
  applyTheme(next, true)
  for (const listener of [...listeners]) listener()
}

/** Mode yang benar-benar berlaku ('auto' mengikuti pengaturan gelap/terang sistem). */
export function resolveMode(s: ThemeState): ResolvedMode {
  if (s.mode !== 'auto') return s.mode
  const light = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: light)').matches
  return light ? 'light' : 'dark'
}

/** Warna (accent, bg) dasar untuk state dan mode ini. */
export function resolveColors(s: ThemeState, mode: ResolvedMode = resolveMode(s)): { accent: string; bg: string } {
  if (s.preset === CUSTOM_ID) return { accent: s.customAccent, bg: mode === 'light' ? s.customBgLight : s.customBgDark }
  const p = THEME_PRESETS.find((item) => item.id === s.preset) ?? THEME_PRESETS[0]
  return mode === 'light' ? { accent: p.accentLight, bg: p.bgLight } : { accent: p.accent, bg: p.bgDark }
}

// ---------- Warna ----------
export type RGB = [number, number, number]

export function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function rgbToHex([r, g, b]: RGB): string {
  return `#${[r, g, b].map((c) => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, '0')).join('')}`
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

/** Batas kecerahan HSL latar: gelap maks. 0,16; terang 0,86-0,95. Di luar itu teks tidak lagi terbaca atau terlalu menyilaukan. */
export const BG_LIMITS: Record<ResolvedMode, { minL: number; maxL: number; maxS: number }> = {
  dark: { minL: 0, maxL: 0.16, maxS: 0.5 },
  // Maks. 0,95: latar terang hampir putih menyilaukan; kartu/permukaan diberi warna LEBIH terang dari latar, bukan latar yang dibuat putih.
  light: { minL: 0.86, maxL: 0.95, maxS: 0.6 },
}

/** Latar dipaksa masuk rentang mode-nya, apa pun warna yang dipilih. */
export function clampBg(hex: string, mode: ResolvedMode = 'dark'): string {
  const { minL, maxL, maxS } = BG_LIMITS[mode]
  const [h, s, l] = rgbToHsl(hexToRgb(hex))
  if (l >= minL && l <= maxL && s <= maxS) return hex.toUpperCase()
  return rgbToHex(hslToRgb([h, Math.min(s, maxS), Math.min(maxL, Math.max(minL, l))])).toUpperCase()
}

const WHITE: RGB = [255, 255, 255]
const BLACK: RGB = [0, 0, 0]
// Bukan hitam pekat: hitam murni di atas latar terang membuat huruf "bergetar" dan melelahkan mata.
const INK_LIGHT_MODE: RGB = [30, 35, 33]
const triplet = (c: RGB) => c.map((v) => Math.round(Math.max(0, Math.min(255, v)))).join(' ')

export interface ThemeTokens {
  bg: string
  card: string
  raised: string
  raisedHover: string
  ink: string
  inkMuted: string
  inkFaint: string
  /** Warna lapisan transparan (hover/tekan/garis): putih di mode gelap, hitam di mode terang. */
  veil: string
  accent: string
  accentSoft: string
  accentDeep: string
  onAccent: string
  danger: string
  onDanger: string
  /** Hex latar, untuk meta theme-color. */
  bgHex: string
}

export function deriveTokens(accentHex: string, bgHex: string, mode: ResolvedMode = 'dark'): ThemeTokens {
  const bgFixed = clampBg(bgHex, mode)
  const bg = hexToRgb(bgFixed)
  let accent = hexToRgb(accentHex)
  if (mode === 'dark') {
    // Aksen terlalu gelap untuk latar ini (teks/ikon beraksen tak terbaca): diterangkan bertahap.
    for (let i = 0; i < 10 && contrast(accent, bg) < 3; i += 1) accent = mix(accent, WHITE, 0.12)
  } else {
    // Teks/ikon beraksen di atas latar terang butuh kontras lebih tinggi daripada di mode gelap (aksen pucat jadi "hilang").
    for (let i = 0; i < 10 && contrast(accent, bg) < 3.8; i += 1) accent = mix(accent, BLACK, 0.12)
  }
  const onAccent = contrast(accent, BLACK) >= contrast(accent, WHITE) ? BLACK : WHITE
  if (mode === 'dark') {
    return {
      bg: triplet(bg),
      card: triplet(mix(bg, WHITE, 0.025)),
      raised: triplet(mix(bg, WHITE, 0.077)),
      raisedHover: triplet(mix(bg, WHITE, 0.118)),
      ink: '255 255 255',
      inkMuted: triplet(mix(WHITE, bg, 0.37)),
      inkFaint: triplet(mix(WHITE, bg, 0.49)),
      veil: '255 255 255',
      accent: triplet(accent),
      accentSoft: triplet(mix(accent, WHITE, 0.15)),
      accentDeep: triplet(mix(accent, BLACK, 0.2)),
      onAccent: triplet(onAccent),
      danger: '255 107 107',
      onDanger: '0 0 0',
      bgHex: bgFixed,
    }
  }
  // Mode terang: latar sedikit redup, permukaan (kartu, sheet, kolom) LEBIH terang dari latar dan terpisah oleh garis tipis + bayangan lembut.
  // Dulu permukaan lebih gelap dari latar yang hampir putih, hasilnya abu-abu kusam dan tidak ada yang "mengambang".
  return {
    bg: triplet(bg),
    card: triplet(mix(bg, WHITE, 0.4)),
    raised: triplet(mix(bg, WHITE, 0.62)),
    raisedHover: triplet(mix(bg, WHITE, 0.3)),
    ink: triplet(INK_LIGHT_MODE),
    inkMuted: triplet(mix(INK_LIGHT_MODE, bg, 0.26)),
    inkFaint: triplet(mix(INK_LIGHT_MODE, bg, 0.33)),
    veil: '0 0 0',
    accent: triplet(accent),
    accentSoft: triplet(mix(accent, WHITE, 0.12)),
    accentDeep: triplet(mix(accent, BLACK, 0.2)),
    onAccent: triplet(onAccent),
    danger: '190 40 40',
    onDanger: '255 255 255',
    bgHex: bgFixed,
  }
}

// ---------- Memasang ke dokumen ----------
let dynamicAccent: string | null = null
let animTimer: number | undefined

export function applyTheme(s: ThemeState = getTheme(), animate = false): void {
  if (typeof document === 'undefined') return
  const mode = resolveMode(s)
  const base = resolveColors(s, mode)
  const t = deriveTokens(s.dynamicAccent && dynamicAccent ? dynamicAccent : base.accent, base.bg, mode)
  const root = document.documentElement
  if (animate) {
    root.classList.add('theme-anim')
    window.clearTimeout(animTimer)
    animTimer = window.setTimeout(() => root.classList.remove('theme-anim'), 450)
  }
  const set = (name: string, value: string) => root.style.setProperty(name, value)
  set('--mv-bg', t.bg)
  set('--mv-card', t.card)
  set('--mv-raised', t.raised)
  set('--mv-raised-hover', t.raisedHover)
  set('--mv-ink', t.ink)
  set('--mv-ink-muted', t.inkMuted)
  set('--mv-ink-faint', t.inkFaint)
  set('--mv-veil', t.veil)
  set('--mv-accent', t.accent)
  set('--mv-accent-soft', t.accentSoft)
  set('--mv-accent-deep', t.accentDeep)
  set('--mv-on-accent', t.onAccent)
  set('--mv-danger', t.danger)
  set('--mv-on-danger', t.onDanger)
  set('--mv-radius', String(RADIUS_FACTOR[s.radius]))
  set('--mv-glow-a', String(GLOW_ALPHA[s.glowLevel][mode === 'light' ? 1 : 0]))
  root.dataset.surface = s.surface
  root.style.fontSize = s.textScale === 'normal' ? '' : `${TEXT_SCALE_PERCENT[s.textScale]}%`
  root.style.colorScheme = mode
  root.dataset.theme = mode
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t.bgHex)
  document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', mode)
}

/** Warna sampul lagu aktif ("r,g,b" atau null) untuk mode aksen dinamis. Tanpa animasi (jalan tiap ganti lagu). */
export function setDynamicAccent(rgb: string | null): void {
  const hex = rgb ? rgbToHex(rgb.split(',').map(Number) as RGB) : null
  if (hex === dynamicAccent) return
  dynamicAccent = hex
  if (getTheme().dynamicAccent || hex === null) applyTheme(getTheme())
}

let mediaBound = false

/** Panggil sekali saat start (APK), setelah penyimpanan dimuat dan sebelum render pertama. */
export function initTheme(): void {
  applyTheme(getTheme())
  if (mediaBound || typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
  mediaBound = true
  const query = window.matchMedia('(prefers-color-scheme: light)')
  const onChange = () => {
    if (getTheme().mode === 'auto') {
      applyTheme(getTheme(), true)
      for (const listener of [...listeners]) listener()
    }
  }
  if (typeof query.addEventListener === 'function') query.addEventListener('change', onChange)
}

// ---------- Bagikan tema ----------
const CODE_PREFIX = 'MVT1.'

export function encodeTheme(s: ThemeState): string {
  const json = JSON.stringify({ m: s.mode, p: s.preset, a: s.customAccent, d: s.customBgDark, l: s.customBgLight, r: s.radius, y: s.dynamicAccent, g: s.glow, v: s.glowLevel, s: s.surface, t: s.textScale })
  return CODE_PREFIX + btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Kode tema -> state; null bila bukan kode tema yang sah. */
export function decodeTheme(code: string): ThemeState | null {
  const text = code.trim()
  if (!text.startsWith(CODE_PREFIX)) return null
  try {
    const b64 = text.slice(CODE_PREFIX.length).replace(/-/g, '+').replace(/_/g, '/')
    const v = JSON.parse(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))) as Record<string, unknown>
    return sanitize({ mode: v.m, preset: v.p, customAccent: v.a, customBgDark: v.d, customBgLight: v.l, radius: v.r, dynamicAccent: v.y, glow: v.g, glowLevel: v.v, surface: v.s, textScale: v.t })
  } catch {
    return null
  }
}

// ---------- Tema acak ----------
const rand = (min: number, max: number) => min + Math.random() * (max - min)

/** Tema kustom acak yang serasi: satu rona untuk aksen dan latar (kejenuhan & kecerahan dijaga supaya teks tetap terbaca). */
export function randomThemePatch(): Partial<ThemeState> {
  const hue = Math.random()
  const hex = (s: number, l: number) => rgbToHex(hslToRgb([hue, s, l])).toUpperCase()
  return {
    preset: CUSTOM_ID,
    customAccent: hex(rand(0.6, 0.9), rand(0.5, 0.62)),
    customBgDark: clampBg(hex(rand(0.2, 0.4), rand(0.06, 0.1)), 'dark'),
    customBgLight: clampBg(hex(rand(0.2, 0.4), rand(0.91, 0.94)), 'light'),
  }
}

// ---------- Tema tersimpan ----------
const SAVED_KEY = 'musicverse:theme:saved:v1'
export const MAX_SAVED_THEMES = 6

/** Tema yang disimpan pengguna, terbaru di depan. Disimpan sebagai kode tema (MVT1.…), jadi ringkas dan tervalidasi saat dibaca. */
export function getSavedThemes(): ThemeState[] {
  const out = readJson(SAVED_KEY)
  if (out.status !== 'ok' || !Array.isArray(out.value)) return []
  const themes: ThemeState[] = []
  for (const code of out.value) {
    const parsed = typeof code === 'string' ? decodeTheme(code) : null
    if (parsed) themes.push(parsed)
  }
  return themes.slice(0, MAX_SAVED_THEMES)
}

function writeSaved(themes: readonly ThemeState[]): void {
  writeJson(SAVED_KEY, themes.map(encodeTheme))
}

/** Simpan tema aktif; tema yang persis sama tidak digandakan, melainkan dipindah ke depan. */
export function saveCurrentTheme(): ThemeState[] {
  const current = getTheme()
  const code = encodeTheme(current)
  const next = [current, ...getSavedThemes().filter((t) => encodeTheme(t) !== code)].slice(0, MAX_SAVED_THEMES)
  writeSaved(next)
  return next
}

export function deleteSavedTheme(index: number): ThemeState[] {
  const next = getSavedThemes().filter((_, i) => i !== index)
  writeSaved(next)
  return next
}
