import { readJson, writeJson } from '../utils/safeStorage'
import { MusicVerseNative } from './musicVerseNative'
import { isNativeApp } from './platform'

const KEY = 'musicverse:engine:v1'

interface EngineSettings {
  /** Putar lagi otomatis setelah terhenti karena gangguan (panggilan / app lain), selama apa pun. Default menyala. */
  autoResume: boolean
  /** ExoPlayer mengambil dari sumber langsung (satu koneksi panjang). Mati = lewat StreamProxy (potongan 1 MB, sudah teruji). */
  direct: boolean
}

function load(): EngineSettings {
  const out = readJson(KEY)
  if (out.status !== 'ok' || typeof out.value !== 'object' || out.value === null) return { direct: false, autoResume: true }
  const value = out.value as Record<string, unknown>
  return { direct: value.direct === true, autoResume: value.autoResume !== false }
}

let settings = load()

export function getDirectMode(): boolean {
  return settings.direct
}

export function setDirectMode(direct: boolean): void {
  settings = { ...settings, direct }
  writeJson(KEY, settings)
}

export function getAutoResume(): boolean {
  return settings.autoResume
}

/** Mengubah "Putar otomatis setelah gangguan" dan langsung memberi tahu service native yang sedang berjalan. */
export function setAutoResume(autoResume: boolean): void {
  settings = { ...settings, autoResume }
  writeJson(KEY, settings)
  if (isNativeApp()) void MusicVerseNative.engineSetAutoResume({ enabled: autoResume }).catch(() => {})
}
