import { readJson, writeJson } from './safeStorage'

/** Provider lirik per kata. Urutan di sini = urutan dicoba (yang pertama menghasilkan lirik berwaktu kata dipakai). */
export type WordProviderId = 'lyricsplus' | 'betterlyrics'

export const WORD_PROVIDERS: ReadonlyArray<{ id: WordProviderId; label: string }> = [
  { id: 'lyricsplus', label: 'LyricsPlus' },
  { id: 'betterlyrics', label: 'BetterLyrics' },
]

/**
 * Sumber lirik yang diutamakan untuk lagu tanpa pilihan manual:
 *  - ytmusic : lirik YouTube Music (bawaan); tidak ditimpa provider kata,
 *  - word    : lirik per kata (LyricsPlus / BetterLyrics) bila lebih lengkap, selain itu YT Music dst.,
 *  - lrclib  : LRCLIB / NetEase dulu, YouTube Music hanya cadangan.
 */
export type LyricPriority = 'ytmusic' | 'word' | 'lrclib'

export const LYRIC_PRIORITIES: ReadonlyArray<{ id: LyricPriority; label: string; hint: string }> = [
  { id: 'ytmusic', label: 'YouTube Music', hint: 'Teks sama seperti di YT Music' },
  { id: 'word', label: 'Per kata', hint: 'Karaoke per kata bila ada' },
  { id: 'lrclib', label: 'LRCLIB', hint: 'LRCLIB / NetEase dulu' },
]

export interface LyricProviderPrefs {
  /** Sumber yang diutamakan (lihat `LyricPriority`). */
  priority: LyricPriority
  /** Saklar utama: false = pakai sumber lama saja (LRCLIB/NetEase/YT Music), tanpa memanggil provider kata. */
  wordSync: boolean
  order: WordProviderId[]
  disabled: WordProviderId[]
}

export const DEFAULT_PREFS: LyricProviderPrefs = { priority: 'ytmusic', wordSync: true, order: WORD_PROVIDERS.map((p) => p.id), disabled: [] }

const KEY = 'musicverse:lyricProviders'
const isId = (v: unknown): v is WordProviderId => WORD_PROVIDERS.some((p) => p.id === v)
const isPriority = (v: unknown): v is LyricPriority => LYRIC_PRIORITIES.some((p) => p.id === v)

/** Membaca preferensi; nilai rusak / tidak dikenal diabaikan. Provider baru yang belum ada di urutan tersimpan ditaruh di akhir. */
export function loadProviderPrefs(): LyricProviderPrefs {
  const saved = readJson(KEY)
  if (saved.status !== 'ok' || typeof saved.value !== 'object' || saved.value === null) return { ...DEFAULT_PREFS, order: [...DEFAULT_PREFS.order], disabled: [] }
  const v = saved.value as Record<string, unknown>
  const order = Array.isArray(v.order) ? v.order.filter(isId) : []
  for (const p of WORD_PROVIDERS) if (!order.includes(p.id)) order.push(p.id)
  return {
    priority: isPriority(v.priority) ? v.priority : DEFAULT_PREFS.priority,
    wordSync: typeof v.wordSync === 'boolean' ? v.wordSync : true,
    order: [...new Set(order)],
    disabled: Array.isArray(v.disabled) ? [...new Set(v.disabled.filter(isId))] : [],
  }
}

const listeners = new Set<() => void>()

/** Dipanggil setiap preferensi provider disimpan (mis. untuk mengosongkan cache lirik sesi). Mengembalikan fungsi berhenti. */
export function onProviderPrefsChange(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function saveProviderPrefs(prefs: LyricProviderPrefs): void {
  writeJson(KEY, prefs)
  listeners.forEach((fn) => fn())
}

/** Tanda pengaturan yang memengaruhi hasil lirik; cache persisten yang tandanya beda dianggap basi. */
export function providerSignature(prefs: LyricProviderPrefs = loadProviderPrefs()): string {
  // Prioritas ikut menentukan hasil; entri cache lama dengan tanda berbeda dianggap basi.
  return `${activeWordProviders(prefs).join(',') || 'off'}+${prefs.priority}`
}

/** Provider yang benar-benar dicoba: urutan tersimpan, tanpa yang dimatikan; kosong bila saklar utama mati. */
export function activeWordProviders(prefs: LyricProviderPrefs = loadProviderPrefs()): WordProviderId[] {
  return prefs.wordSync ? prefs.order.filter((id) => !prefs.disabled.includes(id)) : []
}
