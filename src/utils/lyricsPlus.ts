import type { LyricLine, LyricWord } from './lrc'
import { finalizeLines } from './lrc'

/**
 * Adapter JSON LyricsPlus (`/v2/lyrics/get`) -> LyricLine[].
 *
 * BENTUK YANG DIASUMSIKAN (dari nama field di APK Auralys: `syllabus`, `singer`, `transliteration`; belum diuji ke
 * server sungguhan karena jaringan dimatikan saat ditulis; verifikasi dulu, lihat CHANGES-0.5.46.md, bagian 0.5.54):
 *   { type: "Word" | "Line", lyrics: [ { time: ms, duration: ms, text, 
 *       element?: { singer }, syllabus?: [ { time: ms, duration: ms, text, isBackground? } ] } ], metadata?, cached? }
 * Semua waktu dalam milidetik. Parser sengaja toleran: field yang hilang / salah tipe dilewati, bukan error.
 */

type Rec = Record<string, unknown>

const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v)
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/** `translation` / `transliteration` LyricsPlus: objek `{lang, text, ...}` (cek dex Auralys) atau string. Kosong / sama dengan teks asli = diabaikan. */
function subText(v: unknown, original: string): string | undefined {
  const raw = typeof v === 'string' ? v : isRec(v) && typeof v.text === 'string' ? v.text : ''
  const t = raw.replace(/\s+/g, ' ').trim()
  return t !== '' && t !== original ? t : undefined
}

/**
 * `transliteration.syllabus` LyricsPlus: romanisasi per kata/suku kata, bentuk sama dengan `syllabus` utama
 * (`{time, duration, text}` dalam ms; terverifikasi dari dex Auralys: Transliteration {lang, text, syllabus: List}).
 * Elemen rusak dilewati; hasil kosong = tidak ada. Teks kata membawa spasinya sendiri, seperti kata utama.
 */
function syllabusWords(v: unknown): LyricWord[] {
  if (!isRec(v) || !Array.isArray(v.syllabus)) return []
  const words: LyricWord[] = []
  for (const s of v.syllabus) {
    if (!isRec(s) || typeof s.text !== 'string') continue
    const t = num(s.time)
    if (t === null) continue
    const d = num(s.duration)
    words.push({ time: t / 1000, end: d !== null ? (t + d) / 1000 : t / 1000, text: s.text })
  }
  return words
}

export function parseLyricsPlus(body: unknown): LyricLine[] | null {
  if (!isRec(body) || !Array.isArray(body.lyrics)) return null
  const lines: LyricLine[] = []
  for (const raw of body.lyrics) {
    if (!isRec(raw)) continue
    const startMs = num(raw.time)
    if (startMs === null) continue
    const durMs = num(raw.duration)
    const text = typeof raw.text === 'string' ? raw.text : ''

    // `isBackground` ada di tingkat KATA (syllabus) pada respons asli (cek dex Auralys: LyricWord.isBackground; LyricLine tidak
    // punya). Kata latar dipisah jadi baris latar tersendiri (seperti parser TTML); `raw.isBackground` tingkat baris tetap dihormati.
    const words: LyricWord[] = []
    const bgWords: LyricWord[] = []
    if (Array.isArray(raw.syllabus)) {
      for (const s of raw.syllabus) {
        if (!isRec(s) || typeof s.text !== 'string') continue
        const t = num(s.time)
        if (t === null) continue
        const d = num(s.duration)
        const word: LyricWord = { time: t / 1000, end: d !== null ? (t + d) / 1000 : t / 1000, text: s.text }
        ;(s.isBackground === true ? bgWords : words).push(word)
      }
    }

    const singer = isRec(raw.element) && typeof raw.element.singer === 'string' ? raw.element.singer : undefined
    const clean = (v: string) => v.replace(/\s+/g, ' ').trim()
    const lineBg = raw.isBackground === true
    // Semua kata latar (tanpa kata utama) = baris ini sendiri adalah vokal latar.
    const allBg = words.length === 0 && bgWords.length > 0
    const main = allBg ? bgWords : words

    const line: LyricLine = { time: startMs / 1000, text: clean(main.length > 0 ? main.map((w) => w.text).join('') : text) }
    if (durMs !== null) line.end = (startMs + durMs) / 1000
    if (main.length > 0) line.words = main
    if (singer) line.agent = singer.toLowerCase()
    if (lineBg || allBg) line.background = true
    const translation = subText(raw.translation, line.text)
    const translitWords = syllabusWords(raw.transliteration)
    // Teks romanisasi: field `text`; bila kosong, rangkai dari kata-katanya.
    const transliteration = subText(raw.transliteration, line.text) ?? subText(translitWords.map((w) => w.text).join(''), line.text)
    if (translation) line.translation = translation
    if (transliteration) {
      line.transliteration = transliteration
      // Waktu kata dipakai hanya bila rangkaian katanya memang teks romanisasi yang sama (kalau beda, sorotan per kata menyesatkan).
      const joined = translitWords.map((w) => w.text).join('').replace(/\s+/g, ' ').trim()
      if (translitWords.length > 0 && joined === transliteration) line.transliterationWords = translitWords
    }
    lines.push(line)

    if (words.length > 0 && bgWords.length > 0) {
      const bg: LyricLine = { time: bgWords[0].time, text: clean(bgWords.map((w) => w.text).join('')).replace(/^\(|\)$/g, ''), words: bgWords, background: true }
      if (singer) bg.agent = singer.toLowerCase()
      lines.push(bg)
    }
  }
  if (lines.length === 0) return null
  return finalizeLines(lines.sort((a, b) => a.time - b.time))
}

/** Respons BetterLyrics (`/getLyrics`) membungkus TTML sebagai string di field `ttml`. */
export function ttmlFromBetterLyrics(body: unknown): string | null {
  if (!isRec(body)) return null
  const ttml = body.ttml
  return typeof ttml === 'string' && ttml.includes('<') ? ttml : null
}
