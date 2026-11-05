import { useSyncExternalStore } from 'react'
import { readJson, writeJson } from '../utils/safeStorage'

/**
 * Equalizer 10-band (Web Audio API), hanya dipakai di APK dan hanya jika dinyalakan pengguna.
 *
 * Elemen <audio> sengaja dibuat TANPA `crossOrigin` (lihat audioEngine.ts) supaya audio dari host mana pun
 * bisa diputar. Web Audio butuh audio yang lolos CORS; kalau tidak, keluarannya senyap. Karena itu:
 * - elemen hanya disambungkan ke grafik untuk sumber yang aman (satu origin, data:/blob:, atau proxy lokal
 *   127.0.0.1 yang mengirim header CORS), dan
 * - saat EQ mati dan belum pernah disambungkan, perilaku pemutar sama persis dengan sebelumnya.
 * Setelah sebuah elemen disambungkan, ia tidak bisa dilepas; audioEngine menggantinya dengan elemen baru
 * bila sumber berikutnya tidak aman.
 */

const KEY = 'musicverse:eq:v1'

export const EQ_FREQS = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const
export const EQ_RANGE_DB = 12

export const EQ_PRESETS: Record<string, readonly number[]> = {
  Flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  'Bass Boost': [6, 5, 4, 2, 0, 0, 0, 0, 0, 0],
  'Bass Reducer': [-6, -5, -4, -2, 0, 0, 0, 0, 0, 0],
  'Treble Boost': [0, 0, 0, 0, 0, 1, 2, 4, 5, 6],
  Vokal: [-2, -2, -1, 1, 3, 4, 3, 1, 0, -1],
  Pop: [-1, 1, 3, 4, 3, 0, -1, -1, 1, 2],
  Rock: [4, 3, 2, 0, -1, -1, 1, 3, 4, 4],
  Elektronik: [5, 4, 1, 0, -2, 2, 1, 2, 4, 5],
  Klasik: [0, 0, 0, 0, 0, 0, -2, -2, -2, -4],
}

export interface EqState {
  enabled: boolean
  preset: string
  gains: number[]
}

const DEFAULT_STATE: EqState = { enabled: false, preset: 'Flat', gains: [...EQ_PRESETS.Flat] }

function clampGain(value: unknown): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : 0
  return Math.max(-EQ_RANGE_DB, Math.min(EQ_RANGE_DB, Math.round(n * 2) / 2))
}

function load(): EqState {
  const out = readJson(KEY)
  if (out.status !== 'ok' || typeof out.value !== 'object' || out.value === null) return DEFAULT_STATE
  const raw = out.value as Record<string, unknown>
  const gains = Array.isArray(raw.gains) && raw.gains.length === EQ_FREQS.length ? raw.gains.map(clampGain) : DEFAULT_STATE.gains
  return {
    enabled: raw.enabled === true,
    preset: typeof raw.preset === 'string' ? raw.preset : 'Custom',
    gains,
  }
}

let state: EqState = load()
const listeners = new Set<() => void>()

function commit(next: EqState): void {
  state = next
  writeJson(KEY, next)
  applyToGraph()
  for (const l of [...listeners]) l()
}

export function getEqState(): EqState {
  return state
}

/** Berlangganan perubahan EQ (dipakai mesin audio native untuk meneruskan ke Equalizer Android). */
export function subscribeEq(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

export function useEqState(): EqState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => state,
  )
}

export function setEqEnabled(enabled: boolean): void {
  commit({ ...state, enabled })
}

export function setEqPreset(name: string): void {
  const gains = EQ_PRESETS[name]
  if (gains) commit({ ...state, preset: name, gains: [...gains] })
}

export function setEqGain(index: number, value: number): void {
  if (index < 0 || index >= EQ_FREQS.length) return
  const gains = [...state.gains]
  gains[index] = clampGain(value)
  const match = Object.entries(EQ_PRESETS).find(([, g]) => g.every((v, i) => v === gains[i]))
  commit({ ...state, gains, preset: match ? match[0] : 'Custom' })
}

/* ---------------- grafik Web Audio ---------------- */

interface Graph {
  ctx: AudioContext
  input: GainNode
  preamp: GainNode
  filters: BiquadFilterNode[]
}

let graph: Graph | null = null
const bound = new WeakSet<HTMLAudioElement>()

/** Sumber yang aman dipakai Web Audio tanpa menjadi senyap karena CORS. */
export function isCorsSafe(url: string): boolean {
  if (url.startsWith('data:') || url.startsWith('blob:')) return true
  try {
    const u = new URL(url, window.location.href)
    return u.origin === window.location.origin || u.hostname === '127.0.0.1'
  } catch {
    return false
  }
}

function ensureGraph(): Graph | null {
  if (graph) return graph
  try {
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    const ctx = new Ctor()
    const input = ctx.createGain()
    const preamp = ctx.createGain()
    const filters = EQ_FREQS.map((freq, i) => {
      const f = ctx.createBiquadFilter()
      f.type = i === 0 ? 'lowshelf' : i === EQ_FREQS.length - 1 ? 'highshelf' : 'peaking'
      f.frequency.value = freq
      f.Q.value = 1.1
      f.gain.value = 0
      return f
    })
    input.connect(preamp)
    let prev: AudioNode = preamp
    for (const f of filters) {
      prev.connect(f)
      prev = f
    }
    prev.connect(ctx.destination)
    graph = { ctx, input, preamp, filters }
    applyToGraph()
    return graph
  } catch {
    return null
  }
}

function applyToGraph(): void {
  if (!graph) return
  const { ctx, preamp, filters } = graph
  const gains = state.enabled ? state.gains : state.gains.map(() => 0)
  const peak = Math.max(0, ...gains)
  const t = ctx.currentTime
  filters.forEach((f, i) => f.gain.setTargetAtTime(gains[i] ?? 0, t, 0.03))
  // Turunkan level umum sebesar penguatan tertinggi supaya tidak pecah (clipping).
  preamp.gain.setTargetAtTime(Math.pow(10, -peak / 20), t, 0.03)
}

export function isEqBound(audio: HTMLAudioElement): boolean {
  return bound.has(audio)
}

/** Menyambungkan elemen ke grafik EQ. Hanya jika AudioContext sudah berjalan, supaya audio tidak pernah senyap. */
export function bindEqElement(audio: HTMLAudioElement): void {
  if (bound.has(audio)) {
    void graph?.ctx.resume().catch(() => {})
    return
  }
  const g = ensureGraph()
  if (!g) return
  const doBind = () => {
    if (g.ctx.state !== 'running' || bound.has(audio)) return
    try {
      g.ctx.createMediaElementSource(audio).connect(g.input)
      bound.add(audio)
    } catch {
      // Sudah tersambung atau tidak didukung: biarkan elemen memutar seperti biasa.
    }
  }
  if (g.ctx.state === 'running') doBind()
  else void g.ctx.resume().then(doBind).catch(() => {})
}
