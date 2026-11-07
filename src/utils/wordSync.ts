import type { LyricLine, LyricWord } from './lrc'

/**
 * Sinkron per kata. Dua sumber waktu kata:
 *  - ASLI: `line.words` dari eLRC / TTML / LyricsPlus (tepat).
 *  - PERKIRAAN: LRC biasa tidak punya waktu kata; kata dibobot menurut panjang huruf di rentang menyanyikan baris
 *    (logika yang sebelumnya ada di `LyricLine.tsx`: `singingSpan` + `wordAt`, dipindah ke sini supaya satu tempat).
 */

export interface TimedWords {
  words: LyricWord[]
  /** true = waktu kata hanya perkiraan (bukan dari sumber). UI boleh memberi tanda / animasi lebih lembut. */
  estimated: boolean
}

/** Lama (detik) menyanyikan satu baris: dibatasi jarak ke baris berikutnya dan perkiraan dari panjang teks. */
export function singingSpan(chars: number, gap: number): number {
  return Math.min(gap, Math.max(2, chars * 0.14))
}

/** Kata + waktunya untuk `line`. `nextTime` = waktu baris berikutnya (batas atas perkiraan); tanpa itu dianggap 6 dtk. */
export function wordsFor(line: LyricLine, nextTime?: number): TimedWords {
  if (line.words && line.words.length > 0) return { words: line.words, estimated: false }
  const parts = line.text.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { words: [], estimated: true }
  const gap = nextTime !== undefined && nextTime > line.time ? nextTime - line.time : 6
  const span = singingSpan(line.text.length, gap)
  const weights = parts.map((w) => w.length + 1)
  const total = weights.reduce((a, b) => a + b, 0)
  let acc = 0
  const words = parts.map((text, i): LyricWord => {
    const time = line.time + (acc / total) * span
    acc += weights[i]
    return { time, end: line.time + (acc / total) * span, text: i < parts.length - 1 ? `${text} ` : text }
  })
  return { words, estimated: true }
}

/** Indeks kata yang sedang dinyanyikan pada waktu `t` (kata terakhir yang sudah mulai); -1 bila belum ada yang mulai. */
export function activeWordIndex(words: readonly LyricWord[], t: number): number {
  let low = 0
  let high = words.length - 1
  let found = -1
  while (low <= high) {
    const mid = (low + high) >> 1
    if (words[mid].time <= t) {
      found = mid
      low = mid + 1
    } else {
      high = mid - 1
    }
  }
  return found
}

/** Isi sorotan 0..1 untuk satu kata pada waktu `t` (0 belum mulai, 1 selesai): dasar efek karaoke yang mengisi halus. */
export function wordFill(word: LyricWord, t: number): number {
  if (t <= word.time) return 0
  if (t >= word.end || word.end <= word.time) return 1
  return (t - word.time) / (word.end - word.time)
}

/** Apakah `line` punya waktu kata ASLI dari sumber. */
export function hasRealWordTiming(line: LyricLine): boolean {
  return !!line.words && line.words.length > 0
}

/** Lebar tepi lembut sorotan (persen lebar kata). */
const SWEEP_FEATHER = 20

/**
 * Gradien sorotan berujung lembut (gaya karaoke Apple Music): bagian yang sudah dinyanyikan terang, sisanya redup,
 * dengan tepi buram yang bergerak halus per huruf. Dikendalikan variabel CSS `--p` (0..1, tanpa satuan):
 * 0 = seluruh kata redup, 1 = seluruh kata terang. Tepi digeser keluar kata di kedua ujung, jadi tidak ada sisa terang di 0
 * dan tidak ada sisa redup di 1.
 */
export function sweepGradient(rest: string, bright = '#fff'): string {
  const span = 100 + SWEEP_FEATHER
  return `linear-gradient(90deg, ${bright} calc(var(--p, 0) * ${span}% - ${SWEEP_FEATHER}%), ${rest} calc(var(--p, 0) * ${span}%))`
}
