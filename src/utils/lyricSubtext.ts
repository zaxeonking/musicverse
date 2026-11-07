import type { LyricWord } from './lrc'
import { romanize } from './romanize'

/** Teks tambahan di bawah baris lirik, setelah pengaturan tampilan diterapkan. */
export interface LyricSubTexts {
  translation?: string
  transliteration?: string
  /** Romanisasi per kata (waktu asli dari server); tidak pernah dari romanisasi lokal. */
  transliterationWords?: LyricWord[]
}

/** Teks tambahan sesuai pengaturan tampilan: romanisasi server, atau lokal bila server tidak punya; terjemahan hanya dari server. */
export function subTextsFor(
  line: { text: string } & LyricSubTexts,
  prefs: { translation: boolean; romanization: boolean },
): LyricSubTexts {
  const out: LyricSubTexts = {}
  if (prefs.translation && line.translation) out.translation = line.translation
  if (prefs.romanization) {
    const text = line.transliteration ?? romanize(line.text)
    if (text) out.transliteration = text
    if (line.transliteration && line.transliterationWords) out.transliterationWords = line.transliterationWords
  }
  return out
}
