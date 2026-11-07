import type { LyricLine, LyricWord } from './lrc'
import { finalizeLines } from './lrc'

/**
 * Parser TTML (Timed Text Markup Language) untuk lirik per kata / per baris, format yang dipakai
 * BetterLyrics dan lirik gaya Apple Music. Tanpa DOMParser (tokenizer kecil) supaya jalan di WebView, worker,
 * dan Node untuk tes.
 *
 * - `<p begin end ttm:agent="v1">` = satu baris; `<span begin end>` di dalamnya = satu kata / suku kata.
 * - `<span ttm:role="x-bg">` = vokal latar: jadi baris tersendiri (`background: true`) dengan penyanyi yang sama.
 * - TTML per baris (tanpa span bertanda waktu) tetap menghasilkan baris biasa tanpa `words`.
 */

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

function decodeEntities(text: string): string {
  return text.replace(/&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/gi, (whole, dec: string, hex: string, name: string) => {
    if (dec) return String.fromCodePoint(Number(dec))
    if (hex) return String.fromCodePoint(parseInt(hex, 16))
    return ENTITIES[name.toLowerCase()] ?? whole
  })
}

/** "1:02.345", "00:01:02.345", "62.345s", "62345ms", "62.5" -> detik. null bila tidak dikenali. */
export function parseClock(value: string | undefined): number | null {
  if (!value) return null
  const v = value.trim()
  let m = /^(\d+(?:\.\d+)?)ms$/i.exec(v)
  if (m) return Number(m[1]) / 1000
  m = /^(\d+(?:\.\d+)?)s$/i.exec(v)
  if (m) return Number(m[1])
  m = /^(?:(\d+):)?(\d+):(\d+(?:[.,]\d+)?)$/.exec(v)
  if (m) return Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3].replace(',', '.'))
  m = /^\d+(?:\.\d+)?$/.exec(v)
  return m ? Number(v) : null
}

function attr(tag: string, name: string): string | undefined {
  // Nama atribut boleh berawalan namespace (ttm:agent, tts:...), dicocokkan persis di akhir.
  const m = new RegExp(`(?:^|\\s)(?:[A-Za-z0-9_-]+:)?${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(tag)
  return m ? decodeEntities(m[1] ?? m[2] ?? '') : undefined
}

interface SpanFrame {
  begin: number | null
  end: number | null
  background: boolean
  text: string
}

export function parseTtml(xml: string): LyricLine[] {
  const lines: LyricLine[] = []
  const tokens = xml.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<(\/?)([A-Za-z0-9_:.-]+)([^>]*?)(\/?)>|([^<]+)/g)

  let paraOpen = false
  let paraBegin: number | null = null
  let paraEnd: number | null = null
  let paraAgent: string | undefined
  let words: LyricWord[] = []
  let bgWords: LyricWord[] = []
  let bareText = ''
  let pendingSpace = false
  const spans: SpanFrame[] = []

  const closeWord = (frame: SpanFrame) => {
    const text = frame.text
    if (text.trim() === '' || frame.begin === null) return
    const word: LyricWord = { time: frame.begin, end: frame.end ?? frame.begin, text }
    const insideBg = frame.background || spans.some((s) => s.background)
    ;(insideBg ? bgWords : words).push(word)
  }

  const pushSpaceToLast = () => {
    const target = spans.some((s) => s.background) ? bgWords : words
    const last = target[target.length - 1]
    if (last && !/\s$/.test(last.text)) last.text += ' '
  }

  const flushPara = () => {
    if (!paraOpen) return
    // Spasi pemisah di ujung baris (mis. newline sebelum blok vokal latar) bukan bagian kata terakhir.
    for (const list of [words, bgWords]) {
      const last = list[list.length - 1]
      if (last) last.text = last.text.trimEnd()
    }
    const mainText = (words.length > 0 ? words.map((w) => w.text).join('') : bareText).replace(/\s+/g, ' ').trim()
    const start = words.length > 0 ? words[0].time : paraBegin
    if (start !== null && (mainText !== '' || words.length > 0)) {
      const line: LyricLine = { time: start, text: mainText }
      if (paraEnd !== null) line.end = paraEnd
      if (words.length > 0) line.words = words
      if (paraAgent) line.agent = paraAgent
      lines.push(line)
    }
    if (bgWords.length > 0) {
      const bg: LyricLine = {
        time: bgWords[0].time,
        text: bgWords.map((w) => w.text).join('').replace(/\s+/g, ' ').trim().replace(/^\(|\)$/g, ''),
        words: bgWords,
        background: true,
      }
      if (paraAgent) bg.agent = paraAgent
      lines.push(bg)
    }
    paraOpen = false
    words = []
    bgWords = []
    bareText = ''
    pendingSpace = false
    spans.length = 0
  }

  for (const t of tokens) {
    const [, closing, rawName, rawAttrs, selfClose, textNode] = t
    if (textNode !== undefined) {
      if (!paraOpen) continue
      const decoded = decodeEntities(textNode)
      const timed = [...spans].reverse().find((s) => s.begin !== null)
      if (timed && (decoded.trim() !== '' || timed.text !== '')) {
        timed.text += decoded // isi kata
      } else if (decoded.trim() === '') {
        // Spasi antar-span: jadi spasi di ujung kata sebelumnya (sebelum kata pertama: ditunda).
        if (words.length > 0 || bgWords.length > 0) pushSpaceToLast()
        else pendingSpace = true
      } else if (!spans.some((s) => s.background)) {
        bareText += (pendingSpace ? ' ' : '') + decoded // TTML per baris: teks langsung di <p>
        pendingSpace = false
      }
      continue
    }
    const name = rawName.toLowerCase().replace(/^.*:/, '')
    if (name === 'p') {
      if (closing) {
        flushPara()
      } else {
        flushPara()
        paraOpen = true
        paraBegin = parseClock(attr(rawAttrs, 'begin'))
        paraEnd = parseClock(attr(rawAttrs, 'end'))
        paraAgent = attr(rawAttrs, 'agent')
        if (selfClose) flushPara()
      }
    } else if (name === 'span' && paraOpen) {
      if (closing) {
        const frame = spans.pop()
        if (frame) closeWord(frame)
      } else if (!selfClose) {
        spans.push({
          begin: parseClock(attr(rawAttrs, 'begin')),
          end: parseClock(attr(rawAttrs, 'end')),
          background: /x-bg/i.test(attr(rawAttrs, 'role') ?? ''),
          text: '',
        })
      }
    } else if (name === 'br' && paraOpen) {
      bareText += ' '
    }
  }
  flushPara()
  return finalizeLines(lines.sort((a, b) => a.time - b.time))
}
