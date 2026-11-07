/** Satu kata (atau suku kata) bertanda waktu, detik dari awal lagu. `text` menyimpan spasi aslinya (mis. "kata "). */
export interface LyricWord {
  time: number
  end: number
  text: string
}

/** Satu baris lirik bertanda waktu (detik dari awal lagu). Field selain `time`/`text` hanya ada bila sumbernya punya. */
export interface LyricLine {
  time: number
  text: string
  /** Waktu selesai baris (detik). Diisi saat sumber memberi tahu, atau dari baris berikutnya. */
  end?: number
  /** Waktu per kata ASLI dari sumber (eLRC / TTML / LyricsPlus). Tidak ada = LRC biasa, hanya waktu per baris. */
  words?: LyricWord[]
  /** Penyanyi (mis. "v1", "v2") untuk duet. Tidak ada = satu penyanyi. */
  agent?: string
  /** Vokal latar (backing vocal), ditampilkan lebih kecil / redup. */
  background?: boolean
  /** Terjemahan baris (dari server, mis. LyricsPlus `translation.text`). */
  translation?: string
  /** Romanisasi / transliterasi baris (mis. LyricsPlus `transliteration.text`). */
  transliteration?: string
  /** Romanisasi PER KATA dengan waktu (LyricsPlus `transliteration.syllabus`); dipakai untuk sorotan karaoke di baris romanisasi. */
  transliterationWords?: LyricWord[]
}

const STAMP = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g
const WORD_TAG = /<(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?>/g
const HAS_WORD_TAG = /<\d{1,3}:\d{2}(?:[.:]\d{1,3})?>/
const OFFSET_TAG = /^\s*\[offset:\s*([+-]?\d+)\s*\]\s*$/im
/** Penanda penyanyi di awal teks: "v1: Halo" / "v2:" (eLRC multi-penyanyi). */
const AGENT_PREFIX = /^\s*(v\d+)\s*:\s*/i

function stampSeconds(min: string, sec: string, frac: string | undefined): number {
  return Number(min) * 60 + Number(sec) + (frac ? Number(`0.${frac}`) : 0)
}

/** "<00:01.20>Halo <00:01.80>dunia<00:02.40>" -> kata bertanda waktu. Tag penutup di ujung memberi akhir kata terakhir. */
export function parseWordTags(text: string): LyricWord[] {
  const marks: Array<{ at: number; from: number; to: number }> = []
  WORD_TAG.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = WORD_TAG.exec(text)) !== null) {
    marks.push({ at: stampSeconds(m[1], m[2], m[3]), from: m.index, to: WORD_TAG.lastIndex })
  }
  const words: LyricWord[] = []
  for (let i = 0; i < marks.length; i += 1) {
    const chunk = text.slice(marks[i].to, i + 1 < marks.length ? marks[i + 1].from : text.length)
    if (chunk === '') continue // tag berturut-turut / tag penutup: hanya penanda waktu
    const next = marks[i + 1]
    words.push({ time: marks[i].at, end: next ? next.at : marks[i].at, text: chunk })
  }
  return words
}

/**
 * Mengurai format LRC: `[mm:ss.xx] teks`. Satu baris boleh punya beberapa stempel waktu, tag
 * metadata (`[ar:...]`, `[ti:...]`) dilewati, hasil diurutkan menurut waktu. Teks kosong dipertahankan
 * (jeda instrumental) supaya sorotan baris tidak "menggantung" di baris sebelumnya.
 *
 * Mendukung juga eLRC (waktu per kata): `[00:12.00]<00:12.00>Halo <00:12.50>dunia<00:13.00>` -> `words` terisi
 * dan `text` bersih dari tag. Awalan `v1:` / `v2:` jadi `agent`. Tag `[offset:ms]` dihormati (positif = lirik lebih awal).
 */
export function parseLrc(raw: string): LyricLine[] {
  const offsetMatch = OFFSET_TAG.exec(raw)
  const shift = offsetMatch ? Number(offsetMatch[1]) / 1000 : 0
  const lines: LyricLine[] = []
  for (const row of raw.split(/\r?\n/)) {
    const times: number[] = []
    let lastEnd = 0
    STAMP.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = STAMP.exec(row)) !== null) {
      times.push(stampSeconds(match[1], match[2], match[3]))
      lastEnd = STAMP.lastIndex
    }
    if (times.length === 0) continue
    let rest = row.slice(lastEnd)
    let agent: string | undefined
    const prefix = AGENT_PREFIX.exec(rest)
    if (prefix) {
      agent = prefix[1].toLowerCase()
      rest = rest.slice(prefix[0].length)
    }
    const words = HAS_WORD_TAG.test(rest) ? parseWordTags(rest) : []
    const text = (words.length > 0 ? words.map((w) => w.text).join('') : rest).replace(/\s+/g, ' ').trim()
    for (const time of times) {
      const line: LyricLine = { time: time - shift, text }
      if (agent) line.agent = agent
      if (words.length > 0) {
        // Waktu kata ikut digeser sama seperti baris (satu baris dengan beberapa stempel = waktu kata dari stempel pertama).
        const delta = time - times[0]
        line.words = words.map((w) => ({ ...w, time: w.time + delta - shift, end: w.end + delta - shift }))
      }
      lines.push(line)
    }
  }
  // Array.prototype.sort stabil: baris dengan waktu sama tetap berurutan seperti di file.
  return finalizeLines(lines.sort((a, b) => a.time - b.time))
}

/**
 * Melengkapi `end` baris dan `end` kata: baris berakhir di kata terakhirnya (bila ada) atau di awal baris berikutnya;
 * kata tanpa akhir berakhir di awal kata berikutnya. Mengubah dan mengembalikan array yang sama.
 */
export function finalizeLines(lines: LyricLine[]): LyricLine[] {
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    const nextTime = i + 1 < lines.length ? lines[i + 1].time : undefined
    const words = line.words
    if (words && words.length > 0) {
      for (let w = 0; w < words.length; w += 1) {
        const word = words[w]
        if (word.end <= word.time) {
          const following = w + 1 < words.length ? words[w + 1].time : nextTime
          word.end = following !== undefined && following > word.time ? following : word.time + 0.5
        }
      }
      line.end ??= words[words.length - 1].end
    } else if (line.end === undefined && nextTime !== undefined && nextTime > line.time) {
      line.end = nextTime
    }
  }
  return lines
}

/**
 * Indeks baris yang sedang dinyanyikan pada waktu `time`: baris terakhir yang waktunya <= time.
 * -1 jika belum sampai baris pertama.
 */
export function findActiveLine(lines: readonly LyricLine[], time: number): number {
  let low = 0
  let high = lines.length - 1
  let found = -1
  while (low <= high) {
    const mid = (low + high) >> 1
    if (lines[mid].time <= time) {
      found = mid
      low = mid + 1
    } else {
      high = mid - 1
    }
  }
  return found
}
