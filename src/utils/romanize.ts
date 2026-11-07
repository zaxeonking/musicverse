/**
 * Romanisasi lokal (tanpa server) untuk lirik: kana Jepang (Hepburn), Hangul (Revised Romanization, dengan liaison dan
 * asimilasi umum), Devanagari / Hindi (gaya Bollywood, dengan penghapusan schwa), dan Sirilik (Rusia / Ukraina / Serbia).
 *
 * BATAS YANG DISENGAJA:
 *  - Baris yang memuat kanji / hanzi (Han) TIDAK dibaca: tanpa kamus, cara bacanya tidak bisa ditebak, dan romanisasi
 *    parsial (hanya kana-nya) lebih menyesatkan daripada kosong. Mandarin (pinyin) karena itu tidak didukung.
 *  - Kana: は / へ hanya dibaca "wa" / "e" bila berdiri sendiri (partikel yang dipisah spasi) atau pada
 *    こんにちは / こんばんは; selebihnya "ha" / "he" karena tanpa pemisah kata partikel tidak bisa dibedakan.
 *  - Hangul: aturan per kata (antar-spasi); asimilasi lintas kata dan aturan ㅎ / ㄱ+ㄹ yang jarang tidak dibuat.
 *  - Hasil adalah bantuan baca, bukan transkripsi baku.
 */

const HAN = /\p{Script=Han}/u
const RUN = /[\u3040-\u309F\u30A0-\u30FF\u31F0-\u31FF]+|[\uAC00-\uD7A3]+|[\u0900-\u097F]+|[\u0400-\u052F]+/g
const HALFWIDTH_KANA = /[\uFF66-\uFF9F]+/g

// ---------- Kana ----------
const KANA: Record<string, string> = {}
const addKana = (chars: string, romaji: string[]) => chars.split(' ').forEach((c, i) => (KANA[c] = romaji[i]))
addKana('あ い う え お', ['a', 'i', 'u', 'e', 'o'])
addKana('か き く け こ', ['ka', 'ki', 'ku', 'ke', 'ko'])
addKana('さ し す せ そ', ['sa', 'shi', 'su', 'se', 'so'])
addKana('た ち つ て と', ['ta', 'chi', 'tsu', 'te', 'to'])
addKana('な に ぬ ね の', ['na', 'ni', 'nu', 'ne', 'no'])
addKana('は ひ ふ へ ほ', ['ha', 'hi', 'fu', 'he', 'ho'])
addKana('ま み む め も', ['ma', 'mi', 'mu', 'me', 'mo'])
addKana('や ゆ よ', ['ya', 'yu', 'yo'])
addKana('ら り る れ ろ', ['ra', 'ri', 'ru', 're', 'ro'])
addKana('わ ゐ ゑ を ん', ['wa', 'i', 'e', 'o', 'n'])
addKana('が ぎ ぐ げ ご', ['ga', 'gi', 'gu', 'ge', 'go'])
addKana('ざ じ ず ぜ ぞ', ['za', 'ji', 'zu', 'ze', 'zo'])
addKana('だ ぢ づ で ど', ['da', 'ji', 'zu', 'de', 'do'])
addKana('ば び ぶ べ ぼ', ['ba', 'bi', 'bu', 'be', 'bo'])
addKana('ぱ ぴ ぷ ぺ ぽ', ['pa', 'pi', 'pu', 'pe', 'po'])
addKana('ゔ ゕ ゖ', ['vu', 'ka', 'ke'])

const SMALL_VOWEL: Record<string, string> = { ぁ: 'a', ぃ: 'i', ぅ: 'u', ぇ: 'e', ぉ: 'o' }
const SMALL_Y: Record<string, string> = { ゃ: 'a', ゅ: 'u', ょ: 'o' }
const VOWELS = 'aiueo'

/** 1 suku kana + kana kecil (ゃゅょ / ぁぃぅぇぉ) -> romaji gabungan, atau null bila kombinasinya tidak dikenal. */
function combine(base: string, small: string): string | null {
  const r = KANA[base]
  if (!r || r === 'n') return null
  if (small in SMALL_Y) {
    if (!r.endsWith('i')) return null
    const stem = r.slice(0, -1)
    return /(sh|ch|j)$/.test(stem) ? stem + SMALL_Y[small] : `${stem}y${SMALL_Y[small]}`
  }
  if (small in SMALL_VOWEL) {
    const v = SMALL_VOWEL[small]
    const stem = VOWELS.includes(r[r.length - 1]) ? r.slice(0, -1) : r
    return (stem === '' ? 'w' : stem) + v
  }
  return null
}

function romanizeKana(run: string, isolated: boolean): string {
  if (isolated) {
    if (run === 'は' || run === 'ハ') return 'wa'
    if (run === 'へ' || run === 'ヘ') return 'e'
  }
  // Katakana -> hiragana (selisih 0x60); tanda panjang ー dan titik tengah ・ dibiarkan.
  const hira = Array.from(run, (c) => {
    const code = c.charCodeAt(0)
    return code >= 0x30a1 && code <= 0x30f6 ? String.fromCharCode(code - 0x60) : c
  })
  if (run === 'こんにちは' || run === 'こんばんは') return `${run === 'こんにちは' ? 'konnichi' : 'konban'}wa`

  const out: string[] = []
  let geminate = false
  for (let i = 0; i < hira.length; i += 1) {
    const c = hira[i]
    if (c === 'っ') {
      geminate = true
      continue
    }
    if (c === 'ー') {
      const last = out[out.length - 1]
      const v = last ? last[last.length - 1] : ''
      if (v && VOWELS.includes(v)) out.push(v)
      continue
    }
    if (c === '・') {
      out.push(' ')
      continue
    }
    let r = KANA[c]
    if (r === undefined) {
      out.push(c)
      continue
    }
    const next = hira[i + 1]
    if (next && (next in SMALL_Y || next in SMALL_VOWEL)) {
      const combo = combine(c, next)
      if (combo) {
        r = combo
        i += 1
      }
    }
    if (geminate) {
      r = r.startsWith('ch') ? `t${r}` : r[0] === 'n' || VOWELS.includes(r[0]) ? r : `${r[0]}${r}`
      geminate = false
    }
    if (r === 'n') {
      // ん sebelum vokal / y: beri apostrof (kon'ya, bukan konya).
      const after = hira[i + 1]
      const afterR = after ? KANA[after] : undefined
      if (afterR && (VOWELS.includes(afterR[0]) || afterR[0] === 'y')) r = "n'"
    }
    out.push(r)
  }
  return out.join('')
}

// ---------- Hangul ----------
const H_INITIAL = ['g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's', 'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h']
const H_VOWEL = ['a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o', 'wa', 'wae', 'oe', 'yo', 'u', 'wo', 'we', 'wi', 'yu', 'eu', 'ui', 'i']
/** Bunyi akhir suku kata (indeks 1..27 = jongseong). */
const H_FINAL = ['', 'k', 'k', 'k', 'n', 'n', 'n', 't', 'l', 'k', 'm', 'l', 'l', 'l', 'p', 'l', 'm', 'p', 'p', 't', 't', 'ng', 't', 't', 'k', 't', 'p', 't']
/** Liaison (final + vokal berikutnya): [final tersisa, inisial yang pindah]; inisial -1 = ㅎ (tidak dibunyikan). */
const H_LIAISON: Array<[number, number]> = [
  [0, 0], [0, 1], [1, 9], [0, 2], [4, 12], [4, -1], [0, 3], [0, 5], [8, 0], [8, 6], [8, 7], [8, 9], [8, 16], [8, 17], [8, -1],
  [0, 6], [0, 7], [17, 9], [0, 9], [0, 10], [-1, -1], [0, 12], [0, 14], [0, 15], [0, 16], [0, 17], [0, -1],
]
const K_CLASS = new Set([1, 2, 3, 9, 24])
const T_CLASS = new Set([7, 19, 20, 22, 23, 25, 27])
const P_CLASS = new Set([14, 17, 18, 26])
const N_CLASS = new Set([4, 5, 6])
const L_CLASS = new Set([8, 11, 12, 13, 15])

function romanizeHangul(run: string): string {
  const syl = Array.from(run, (c) => {
    const n = c.charCodeAt(0) - 0xac00
    return { l: Math.floor(n / 588), v: Math.floor((n % 588) / 28), t: n % 28 }
  })
  const out: string[] = []
  let forceL = false // ㄹ awal dibunyikan "l" setelah final "l" (mis. ㄴ+ㄹ -> ll)
  for (let i = 0; i < syl.length; i += 1) {
    const s = syl[i]
    const next = syl[i + 1]
    const initialStr = forceL && s.l === 5 ? 'l' : H_INITIAL[s.l]
    forceL = false
    let finalStr = H_FINAL[s.t]
    if (s.t !== 0 && next) {
      if (next.l === 11 && s.t !== 21) {
        // liaison: final (atau bagian kedua final ganda) pindah jadi inisial suku kata berikutnya
        const [rest, move] = H_LIAISON[s.t - 1]
        finalStr = H_FINAL[rest]
        if (move >= 0) next.l = move
      } else if (next.l === 2 || next.l === 6) {
        if (L_CLASS.has(s.t) && next.l === 2) {
          finalStr = 'l'
          forceL = true // ㄹ+ㄴ -> ll
          next.l = 5
        } else {
          finalStr = K_CLASS.has(s.t) ? 'ng' : T_CLASS.has(s.t) ? 'n' : P_CLASS.has(s.t) ? 'm' : finalStr
        }
      } else if (next.l === 5 && (K_CLASS.has(s.t) || T_CLASS.has(s.t) || P_CLASS.has(s.t))) {
        finalStr = K_CLASS.has(s.t) ? 'ng' : T_CLASS.has(s.t) ? 'n' : 'm' // ㄱ/ㄷ/ㅂ + ㄹ -> ng/n/m + n
        next.l = 2
      } else if (next.l === 5 && N_CLASS.has(s.t)) {
        finalStr = 'l' // ㄴ+ㄹ -> ll
        forceL = true
      } else if (next.l === 5 && L_CLASS.has(s.t)) {
        forceL = true // ㄹ+ㄹ -> ll
      }
    }
    out.push(initialStr + H_VOWEL[s.v] + finalStr)
  }
  return out.join('')
}

// ---------- Devanagari (Hindi) ----------
const D_CONS: Record<string, string> = {
  क: 'k', ख: 'kh', ग: 'g', घ: 'gh', ङ: 'ng', च: 'ch', छ: 'chh', ज: 'j', झ: 'jh', ञ: 'ny', ट: 't', ठ: 'th', ड: 'd', ढ: 'dh', ण: 'n',
  त: 't', थ: 'th', द: 'd', ध: 'dh', न: 'n', प: 'p', फ: 'ph', ब: 'b', भ: 'bh', म: 'm', य: 'y', र: 'r', ल: 'l', व: 'v', श: 'sh', ष: 'sh',
  स: 's', ह: 'h', ळ: 'l',
  // huruf bertitik (nukta) bentuk tunggal U+0958..U+095F
  'क़': 'q', 'ख़': 'kh', 'ग़': 'gh', 'ज़': 'z', 'ड़': 'r', 'ढ़': 'rh', 'फ़': 'f', 'य़': 'y',
}
const D_NUKTA: Record<string, string> = { क: 'q', ख: 'kh', ग: 'gh', ज: 'z', ड: 'r', ढ: 'rh', फ: 'f' }
const D_INDEP: Record<string, string> = { अ: 'a', आ: 'aa', इ: 'i', ई: 'i', उ: 'u', ऊ: 'oo', ऋ: 'ri', ए: 'e', ऐ: 'ai', ओ: 'o', औ: 'au', ऍ: 'e', ऑ: 'o' }
const D_MATRA: Record<string, string> = { 'ा': 'aa', 'ि': 'i', 'ी': 'i', 'ु': 'u', 'ू': 'oo', 'ृ': 'ri', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ॅ': 'e', 'ॉ': 'o' }
const D_DIGITS = '०१२३४५६७८९'
const LABIAL = new Set(['p', 'ph', 'b', 'bh', 'm'])

interface DUnit {
  cons: string
  /** Vokal eksplisit (matra / vokal mandiri); null = vokal bawaan "a" atau tanpa vokal (virama). */
  vowel: string | null
  schwa: boolean
  nasal: boolean
  post: string
}

function romanizeDevanagariWord(word: string): string {
  const chars = Array.from(word.normalize('NFC'))
  const units: DUnit[] = []
  let i = 0
  while (i < chars.length) {
    const c = chars[i]
    if (c in D_INDEP) {
      units.push({ cons: '', vowel: D_INDEP[c], schwa: false, nasal: false, post: '' })
      i += 1
    } else if (c in D_CONS) {
      let cons = D_CONS[c]
      i += 1
      if (chars[i] === '\u093C' && c in D_NUKTA) {
        cons = D_NUKTA[c]
        i += 1
      }
      const unit: DUnit = { cons, vowel: null, schwa: true, nasal: false, post: '' }
      if (chars[i] === '\u094D') {
        unit.schwa = false
        i += 1
        // ज्ञ dibaca "gy"
        if (c === 'ज' && chars[i] === 'ञ') {
          unit.cons = 'g'
          i += 1
          const y: DUnit = { cons: 'y', vowel: null, schwa: true, nasal: false, post: '' }
          if (chars[i] && chars[i] in D_MATRA) {
            y.vowel = D_MATRA[chars[i]]
            y.schwa = false
            i += 1
          }
          units.push(unit, y)
          continue
        }
      } else if (chars[i] && chars[i] in D_MATRA) {
        unit.vowel = D_MATRA[chars[i]]
        unit.schwa = false
        i += 1
      }
      units.push(unit)
    } else if (c === 'ं' || c === 'ँ') {
      const last = units[units.length - 1]
      if (last) last.nasal = true
      i += 1
    } else if (c === 'ः') {
      const last = units[units.length - 1]
      if (last) last.post += 'h'
      i += 1
    } else {
      const d = D_DIGITS.indexOf(c)
      units.push({ cons: d >= 0 ? String(d) : '', vowel: null, schwa: false, nasal: false, post: d >= 0 ? '' : c })
      i += 1
    }
  }

  // Penghapusan schwa, dari kanan ke kiri: akhir kata dan di antara dua suku kata (bukan suku kata pertama).
  const hasVowel = (u: DUnit) => u.schwa || u.vowel !== null
  const firstVowel = units.findIndex(hasVowel)
  for (let k = units.length - 1; k > firstVowel && k >= 0; k -= 1) {
    const u = units[k]
    if (!u.schwa || u.nasal || u.post) continue
    const next = units[k + 1]
    if (k === units.length - 1) {
      u.schwa = false
    } else if (next && next.vowel !== null && !units[k - 1]?.nasal && units.slice(0, k).some(hasVowel)) {
      u.schwa = false
    }
  }

  return units
    .map((u, k) => {
      const nextCons = units[k + 1]?.cons ?? ''
      const nasal = u.nasal ? (LABIAL.has(nextCons) ? 'm' : 'n') : ''
      return `${u.cons}${u.schwa ? 'a' : (u.vowel ?? '')}${nasal}${u.post}`
    })
    .join('')
}

function romanizeDevanagari(run: string): string {
  return run
    .split(/([।॥])/)
    .map((part) => (part === '।' ? '.' : part === '॥' ? '' : romanizeDevanagariWord(part)))
    .join('')
}

// ---------- Sirilik ----------
const CYR: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p',
  р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  // Ukraina
  і: 'i', ї: 'yi', є: 'ye', ґ: 'g',
  // Serbia / Makedonia
  ј: 'j', љ: 'lj', њ: 'nj', ћ: 'c', ђ: 'dj', џ: 'dz', ѓ: 'gj', ќ: 'kj', ѕ: 'dz',
}

function romanizeCyrillic(run: string): string {
  return Array.from(run, (c) => {
    const lower = c.toLowerCase()
    const r = CYR[lower]
    if (r === undefined) return c
    return c !== lower && r !== '' ? r[0].toUpperCase() + r.slice(1) : r
  }).join('')
}

/**
 * Romanisasi `text` bila memuat kana / Hangul / Devanagari / Sirilik. Mengembalikan undefined bila tidak ada yang perlu
 * diromanisasi, bila baris memuat Han (lihat BATAS di atas), atau bila hasilnya sama dengan teks asli.
 */
export function romanize(text: string): string | undefined {
  if (text === '' || HAN.test(text)) return undefined
  const source = text.replace(HALFWIDTH_KANA, (s) => s.normalize('NFKC')).normalize('NFC')
  if (!/[\u3040-\u30FF\u31F0-\u31FF\uAC00-\uD7A3\u0900-\u097F\u0400-\u052F]/.test(source)) return undefined
  const out = source.replace(RUN, (run, offset: number) => {
    const before = source[offset - 1]
    const after = source[offset + run.length]
    const isolated = (before === undefined || /\s/.test(before)) && (after === undefined || /[\s\p{P}]/u.test(after))
    const code = run.charCodeAt(0)
    if (code >= 0x3040 && code <= 0x30ff) return romanizeKana(run, isolated)
    if (code >= 0x31f0 && code <= 0x31ff) return romanizeKana(run, isolated)
    if (code >= 0xac00 && code <= 0xd7a3) return romanizeHangul(run)
    if (code >= 0x0900 && code <= 0x097f) return romanizeDevanagari(run)
    return romanizeCyrillic(run)
  })
  const clean = out.replace(/\s+/g, ' ').trim()
  return clean !== '' && clean !== text.trim() ? clean : undefined
}
