import { useSyncExternalStore } from 'react'
import { readJson, writeJson } from '../utils/safeStorage'
import { CUSTOM_ID, THEME_PRESETS, deriveTokens, getTheme, hexToRgb, resolveColors, resolveMode, subscribeTheme, type ThemeState } from '../utils/theme'
import { MusicVerseNative } from './musicVerseNative'
import { isNativeApp } from './platform'

/**
 * Tampilan di luar layar aplikasi yang ikut tema (APK):
 *  1. Layar pembuka (splash di index.html): warna latar, batang logo, dan nama mengikuti tema. Splash tampil sebelum
 *     bundel JS dimuat, jadi warnanya dibaca dari cache kecil di localStorage ("musicverse:splash:v1") yang ditulis di sini.
 *  2. Latar jendela native (MainActivity) supaya tidak ada kedipan gelap saat tema terang.
 *  3. Ikon peluncur (opsional): satu activity-alias per tema siap pakai; tema Kustom memakai tema siap pakai yang aksennya paling dekat.
 * Aksen dinamis (ikut sampul lagu) sengaja diabaikan di sini: splash dan ikon tidak boleh berubah tiap ganti lagu.
 */
const SPLASH_KEY = 'musicverse:splash:v1'
const ICON_PREF_KEY = 'musicverse:appearance:v1'
const ICON_DEFAULT_ID = 'hijau'
/** Ikon diganti setelah tema "tenang" sebentar: mengganti alias membuat peluncur memuat ulang ikon. */
const ICON_DEBOUNCE_MS = 1500

export interface SplashColors {
  bg: string
  accent: string
  ink: string
}

const tripletToHex = (t: string): string => `#${t.split(' ').map((v) => Number(v).toString(16).padStart(2, '0')).join('').toUpperCase()}`

/** Warna splash untuk tema ini (aksen sudah disesuaikan kontrasnya dengan latar, sama seperti di aplikasi). */
export function splashColorsFor(theme: ThemeState): SplashColors {
  const mode = resolveMode(theme)
  const base = resolveColors(theme, mode)
  const tokens = deriveTokens(base.accent, base.bg, mode)
  return { bg: tokens.bgHex, accent: tripletToHex(tokens.accent), ink: tripletToHex(tokens.ink) }
}

/** Id ikon untuk tema ini: preset sendiri, atau preset dengan aksen terdekat untuk tema Kustom. */
export function iconIdFor(theme: ThemeState): string {
  if (theme.preset !== CUSTOM_ID) return THEME_PRESETS.some((p) => p.id === theme.preset) ? theme.preset : ICON_DEFAULT_ID
  const target = hexToRgb(theme.customAccent)
  let best = ICON_DEFAULT_ID
  let bestDist = Number.POSITIVE_INFINITY
  for (const p of THEME_PRESETS) {
    const c = hexToRgb(p.accent)
    // Jarak berbobot (mata lebih peka pada hijau) cukup untuk memilih warna terdekat.
    const d = 2 * (c[0] - target[0]) ** 2 + 4 * (c[1] - target[1]) ** 2 + 3 * (c[2] - target[2]) ** 2
    if (d < bestDist) {
      bestDist = d
      best = p.id
    }
  }
  return best
}

// ---------- Pilihan "ikon ikut tema" (terpisah dari ThemeState supaya kode tema yang dibagikan tidak menimpanya) ----------
let iconFollows: boolean | null = null
const iconListeners = new Set<() => void>()

export function getIconFollowsTheme(): boolean {
  if (iconFollows === null) {
    const out = readJson(ICON_PREF_KEY)
    iconFollows = out.status === 'ok' && typeof out.value === 'object' && out.value !== null && (out.value as { icon?: unknown }).icon === true
  }
  return iconFollows
}

export function setIconFollowsTheme(on: boolean): void {
  iconFollows = on
  writeJson(ICON_PREF_KEY, { icon: on })
  for (const l of [...iconListeners]) l()
  pushAppearance(true)
}

function subscribeIcon(listener: () => void): () => void {
  iconListeners.add(listener)
  return () => iconListeners.delete(listener)
}

export function useIconFollowsTheme(): readonly [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(subscribeIcon, getIconFollowsTheme, getIconFollowsTheme)
  return [on, setIconFollowsTheme] as const
}

// ---------- Mengirim ke splash (cache) dan native ----------
let lastSplash = ''
let lastSent = ''
let iconTimer: number | undefined

function pushAppearance(immediateIcon = false): void {
  if (!isNativeApp()) return
  const theme = getTheme()
  const colors = splashColorsFor(theme)
  const splash = JSON.stringify(colors)
  if (splash !== lastSplash) {
    lastSplash = splash
    writeJson(SPLASH_KEY, colors)
  }
  window.clearTimeout(iconTimer)
  const send = () => {
    const icon = getIconFollowsTheme() ? iconIdFor(theme) : ICON_DEFAULT_ID
    const key = `${colors.bg}|${icon}`
    if (key === lastSent) return
    lastSent = key
    // APK lama (tanpa fungsi ini) menolak dengan UNIMPLEMENTED: tidak apa-apa, splash web tetap ikut tema.
    MusicVerseNative.setAppearance({ bg: colors.bg, icon }).catch(() => {
      lastSent = ''
    })
  }
  if (immediateIcon) send()
  else iconTimer = window.setTimeout(send, ICON_DEBOUNCE_MS)
}

/** Panggil sekali saat start (APK), sesudah initTheme(). */
export function initAppearance(): void {
  if (!isNativeApp()) return
  pushAppearance(false)
  subscribeTheme(() => pushAppearance(false))
}
