import type { PlaybackInfo } from '../types/spotify'
import { durationFit } from './clipDetect'
import { parseDuration } from './formatTime'
import { extractTrackId } from './spotifyUrl'
import { normalizeSearchText } from './trackSearch'
import { stripArtistPrefix } from './trackTitle'

/** Lagu di playlist yang dijadikan patokan. */
export interface WantedTrack {
  title: string
  artists: string
  duration: string
  url?: string
}

/**
 * Angka 2 sebagai tanda kata ulang (Indonesia/Melayu): \"Mati2an\" = \"Matimatian\", \"Cinta2\" = \"Cintacinta\".
 * Hanya angka 2 yang diapit huruf (minimal dua huruf di depannya), jadi \"U2\", \"2Pac\", atau \"Blink 182\" tidak berubah.
 */
export function expandReduplication(value: string): string {
  return value.replace(/(\p{L}{2,})2(\p{L}*)/gu, '$1$1$2')
}

function tokens(value: string): string[] {
  return expandReduplication(normalizeSearchText(value))
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

/** Ejaan Latin yang mirip: spasi/tanda baca dibuang, vokal panjang romaji disamakan (ou/oo->o, uu->u). */
function compact(value: string): string {
  return expandReduplication(normalizeSearchText(value))
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .replace(/ou|oo/g, 'o')
    .replace(/uu/g, 'u')
}

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = tmp
    }
  }
  return row[b.length]
}

/** Dua teks Latin dianggap sama bila setelah dipadatkan hampir identik ("Ho - Kago Tea Time" ~ "Houkago Teatime"). */
export function sameSpelling(a: string, b: string): boolean {
  const x = compact(a)
  const y = compact(b)
  if (x.length < 4 || y.length < 4) return false
  return 1 - editDistance(x, y) / Math.max(x.length, y.length) >= 0.85
}

function artistNames(value: string): string[] {
  return normalizeSearchText(value)
    .split(/\s*(?:,|&|;| feat\.? | ft\.? | and | x )\s*/)
    .map((name) => name.replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

/**
 * Beda aksara: judul/artis di playlist (Spotify) berhuruf Latin/romaji, sedangkan di YouTube Music berhuruf asli
 * (Jepang, Korea, Mandarin, Cyrillic, dst.), atau sebaliknya. Kata-katanya tidak mungkin saling cocok, jadi skor judul/artis
 * 0 di sini bukan bukti salah lagu, melainkan "tidak bisa dibandingkan".
 */
const NON_LATIN =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Cyrillic}\p{Script=Arabic}\p{Script=Thai}\p{Script=Hebrew}\p{Script=Devanagari}\p{Script=Greek}]/u
const LATIN = /\p{Script=Latin}/u

export function scriptGap(a: string, b: string): boolean {
  const aNon = NON_LATIN.test(a)
  const bNon = NON_LATIN.test(b)
  if (aNon === bNon) return false
  // Sisi yang non-Latin vs sisi yang HANYA Latin.
  return aNon ? LATIN.test(b) : LATIN.test(a)
}

/** 0..1, atau null jika hasil tidak membawa data judul. */
function titleScore(wanted: WantedTrack, info: PlaybackInfo): number | null {
  const got = tokens(info.title)
  if (got.length === 0) return null
  // "Artis - Judul" -> "Judul": nama artis di judul playlist tidak boleh dihitung sebagai bagian judul.
  const want = tokens(stripArtistPrefix(wanted.title, wanted.artists))
  if (want.length === 0) return null
  if (sameSpelling(stripArtistPrefix(wanted.title, wanted.artists), info.title)) return 1
  const wantSet = new Set(want)
  const artistTokens = new Set(tokens(wanted.artists))
  // Judul API cadangan berformat "Judul - Artis": token artis tidak dihitung sebagai kelebihan.
  const gotTitleOnly = got.filter((t) => !artistTokens.has(t) || wantSet.has(t))
  // Hitung per kemunculan: "Pure Pure Heart" vs "Pure Heart" -> 2 dari 3 kata, bukan 3 dari 3.
  const pool = new Map<string, number>()
  for (const t of got) pool.set(t, (pool.get(t) ?? 0) + 1)
  let hit = 0
  for (const t of want) {
    const left = pool.get(t) ?? 0
    if (left > 0) {
      hit += 1
      pool.set(t, left - 1)
    }
  }
  const coverage = hit / want.length
  const precision = gotTitleOnly.length === 0 ? coverage : Math.min(1, hit / gotTitleOnly.length)
  return 0.7 * coverage + 0.3 * precision
}

/** 0..1, atau null jika tidak ada data artis yang bisa dibandingkan. */
function artistScore(wanted: WantedTrack, info: PlaybackInfo): number | null {
  const wantNames = artistNames(wanted.artists)
  if (wantNames.length === 0) return null
  let haystack = normalizeSearchText(info.artist).replace(/[^\p{L}\p{N}\s]/gu, ' ')
  if (!haystack.trim()) {
    // Tanpa field artis: hanya bisa dibaca dari judul berformat "Judul - Artis".
    if (!info.title.includes(' - ')) return null
    haystack = normalizeSearchText(info.title).replace(/[^\p{L}\p{N}\s]/gu, ' ')
  }
  haystack = haystack.replace(/\s+/g, ' ')
  if (wantNames.some((name) => haystack.includes(name))) return 1
  if (sameSpelling(wanted.artists, info.artist || haystack)) return 1
  // Uploader YouTube sering label/channel, sedangkan nama artis aslinya ada di judul ("Artis - Judul").
  const titleText = normalizeSearchText(info.title).replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ')
  if (wantNames.some((name) => name.length >= 4 && ` ${titleText} `.includes(` ${name} `))) return 1
  const gotTokens = new Set(haystack.split(' ').filter(Boolean))
  // Urutan nama beda (\"Kamiya Hiroshi\" vs \"Hiroshi Kamiya\"): semua kata satu nama artis ada di data server = cocok.
  if (wantNames.some((name) => name.split(' ').filter(Boolean).every((t) => gotTokens.has(t)))) return 1
  const wantTokens = wantNames.flatMap((name) => name.split(' ')).filter(Boolean)
  const overlap = wantTokens.filter((t) => gotTokens.has(t)).length
  return overlap / Math.max(1, wantTokens.length) >= 0.5 ? 0.5 : 0
}

/** Selisih durasi maksimum (detik) yang masih dianggap lagu yang sama bila judul beda aksara tetapi artisnya cocok. */
export const GAP_DURATION_TOLERANCE_S = 6

/** Durasi untuk kasus judul beda aksara + artis cocok: <= 1,5 dtk = 1, sampai toleransi = 0,75, lebih dari itu = 0. */
export function gapDurationFit(actual: number, expected: number): number {
  const diff = Math.abs(actual - expected)
  if (diff <= 1.5) return 1
  return diff <= GAP_DURATION_TOLERANCE_S ? 0.75 : 0
}

/** 0..1, atau null jika salah satu durasi tidak diketahui. */
function durationScore(wanted: WantedTrack, info: PlaybackInfo, actualDuration: number | null): number | null {
  const a = parseDuration(wanted.duration)
  // Durasi file audio yang sebenarnya lebih dapat dipercaya daripada metadata API.
  if (actualDuration !== null) return durationFit(actualDuration, a)
  const b = parseDuration(info.duration)
  if (a === null || b === null) return null
  const diff = Math.abs(a - b)
  if (diff <= 3) return 1
  if (diff <= 8) return 0.6
  if (diff <= 15) return 0.3
  return 0
}

/**
 * Seberapa cocok hasil API dengan lagu di playlist (judul, artis, durasi). Hasil dari tautan lagu
 * mendapat bonus karena server memang diminta lagu persis itu; hasil pencarian judul hanya mendapat
 * bonus jika tautan Spotify yang dikembalikan sama dengan tautan lagu di playlist.
 * Skor >= 1 dianggap pasti cocok. Nilai tidak dibatasi 1 supaya bonus bisa menjadi pembeda.
 */
export function scoreCandidate(
  wanted: WantedTrack,
  info: PlaybackInfo,
  viaLink: boolean,
  actualDuration: number | null = null,
  ignoreTitle = false,
): number {
  let title = ignoreTitle ? null : titleScore(wanted, info)
  let artist = artistScore(wanted, info)
  // Aksara berbeda (mis. judul Spotify \"Kimi no Na wa\" vs YouTube \"君の名は\"): skor kata rendah bukan tanda salah lagu.
  // Dianggap tidak bisa dibandingkan; yang menentukan tinggal durasi file (lihat `unverifiable` di bawah).
  let unverifiable = false
  let titleGap = false
  let artistGap = false
  if (title !== null && title < 0.5 && scriptGap(stripArtistPrefix(wanted.title, wanted.artists), info.title)) {
    title = null
    unverifiable = true
    titleGap = true
  }
  if (artist !== null && artist < 0.5 && scriptGap(wanted.artists, info.artist || info.title)) {
    artist = null
    unverifiable = true
    artistGap = true
  }
  let duration = durationScore(wanted, info, actualDuration)
  // Judul beda aksara tapi artis cocok: identitas lagu sudah terbukti lewat artis, durasi bukan satu-satunya penentu lagi.
  // Master di Spotify dan YouTube Music sering beda beberapa detik, jadi toleransinya dilonggarkan (lihat gapDurationFit).
  const wantSec = parseDuration(wanted.duration)
  if (titleGap && !artistGap && artist === 1 && actualDuration !== null && wantSec !== null) {
    duration = gapDurationFit(actualDuration, wantSec)
  }
  const parts: Array<[number | null, number]> = [
    // Unduhan: judul tidak dihitung (judul dari server sering beda tulisan dari judul playlist).
    [title, 0.3],
    [artist, 0.2],
    [duration, actualDuration !== null ? 0.5 : 0.35],
  ]
  let weight = 0
  let sum = 0
  for (const [value, w] of parts) {
    if (value === null) continue
    weight += w
    sum += value * w
  }
  let score = weight > 0 ? sum / weight : 0.5
  // Tanpa kecocokan teks, kecocokan durasi saja harus nyaris sempurna: durasi pas (>= 0,9) tetap lolos, selisih sedang tidak.
  if (unverifiable) score *= 0.92
  // Judul DAN artis sama-sama beda aksara: tidak ada satu pun teks yang bisa dicocokkan, hanya durasi. Lagu lain dengan durasi
  // mirip bisa lolos begitu saja ("asal ambil"), jadi skor diturunkan sampai hanya durasi yang nyaris sempurna yang lolos
  // (dan pemanggil juga membatasi ke hasil teratas pencarian).
  if (titleGap && artistGap) score *= 0.8
  // GERBANG JUDUL: judul dinilai sendiri, terpisah dari artis. Artis dan durasi yang cocok tidak boleh menutupi judul yang
  // jelas beda (lagu lain dari artis yang sama dengan durasi mirip). Judul beda aksara (title === null) tidak kena gerbang.
  if (title !== null && title < 0.4) score = Math.min(score, 0.45)
  // GERBANG ARTIS: artis sama sekali tidak cocok (skor 0, aksara sama sehingga bisa dibandingkan) berarti kemungkinan besar
  // lagu lain dengan judul mirip ("Pure Pure Heart" vs "Pure Heart" oleh artis lain). Judul + durasi tidak boleh menutupinya.
  // Pengecualian: judul PERSIS sama (ejaan hampir identik) boleh lolos, karena channel label/uploader sering mengisi
  // field artis dengan nama lain.
  if (artist !== null && artist === 0 && !artistGap) {
    const wantTitle = stripArtistPrefix(wanted.title, wanted.artists)
    const exactTitle = title !== null && (title >= 1 && tokens(wantTitle).join(' ') === tokens(info.title).join(' ') || sameSpelling(wantTitle, info.title))
    if (!exactTitle) score = Math.min(score, 0.45)
  }
  if (viaLink) score += 0.15
  else {
    const wantedId = extractTrackId(wanted.url ?? '')
    const gotId = extractTrackId(info.spotifyUrl)
    if (wantedId && gotId && wantedId === gotId) score += 0.25
  }
  return score
}

/**
 * Skor terbaik dari judul asli DAN nama-nama lain lagu yang sama dalam bahasa lain (lihat services/titleAliases):
 * judul hasil cukup cocok dengan salah satunya. Artis ikut diganti sesuai nama lain itu.
 */
export function scoreWithAliases(
  wanted: WantedTrack,
  info: PlaybackInfo,
  viaLink: boolean,
  actualDuration: number | null,
  aliases: ReadonlyArray<{ title: string; artist: string }>,
): number {
  let best = scoreCandidate(wanted, info, viaLink, actualDuration)
  for (const alias of aliases) {
    const score = scoreCandidate({ ...wanted, title: alias.title, artists: alias.artist || wanted.artists }, info, viaLink, actualDuration)
    if (score > best) best = score
  }
  return best
}

/**
 * Artis hasil dianggap SAMA dengan artis lagu walau aksaranya berbeda: cocok dengan artis di playlist, atau dengan salah satu
 * penulisan lain artis itu (nama dari katalog lain, mis. "RADWIMPS" = "ラッドウィンプス").
 */
export function artistVerified(wanted: WantedTrack, info: PlaybackInfo, aliases: ReadonlyArray<{ title: string; artist: string }>): boolean {
  const variants = [wanted.artists, ...aliases.map((a) => a.artist).filter(Boolean)]
  return variants.some((name) => {
    const score = artistScore({ ...wanted, artists: name }, info)
    return score !== null && score >= 1
  })
}

/** True bila judul DAN artis hasil beda aksara dari lagu di playlist (tidak ada teks yang bisa dicocokkan, hanya durasi). */
export function bothScriptGap(wanted: WantedTrack, info: PlaybackInfo): boolean {
  return (
    scriptGap(stripArtistPrefix(wanted.title, wanted.artists), info.title) && scriptGap(wanted.artists, info.artist || info.title)
  )
}

/** Penanda versi lain dari lagu yang sama (live, remix, dst.). Judul asli dan audio harus sama-sama punya atau sama-sama tidak. */
const VERSION_MARKERS: ReadonlyArray<[string, RegExp]> = [
  ['live', /\blive\b|\bunplugged\b|\bkonser\b/],
  ['remix', /\bremix\b|\bmashup\b|\bbootleg\b|\bedit\b/],
  ['instrumental', /\binstrumental\b|\bkaraoke\b|\bbacking track\b/],
  ['acoustic', /\bacoustic\b|\bakustik\b|\bpiano version\b/],
  ['cover', /\bcover\b|\btribute\b/],
  ['speed', /\bsped up\b|\bspeed up\b|\bslowed\b|\breverb\b|\b8d\b|\bnightcore\b|\bdaycore\b/],
  ['lofi', /\blo ?-?fi\b/],
  ['demo', /\bdemo\b|\bsession\b/],
]

/** Himpunan penanda versi di sebuah judul; nama artis dibuang dulu supaya nama artis tidak terbaca sebagai penanda. */
export function versionMarkers(title: string, artists: string): Set<string> {
  let text = ` ${normalizeSearchText(title)} `
  for (const name of artistNames(artists)) text = text.split(name).join(' ')
  text = text.replace(/[^\p{L}\p{N}\s]/gu, ' ')
  const found = new Set<string>()
  for (const [name, pattern] of VERSION_MARKERS) if (pattern.test(text)) found.add(name)
  return found
}

/**
 * Pemeriksaan ketat untuk unduhan: null jika identitas audio dari server cocok dengan lagu di playlist,
 * selain itu pesan alasannya. Yang dibandingkan: ID lagu Spotify (jika kedua sisi punya),
 * artis (nama harus ditemukan), dan penanda versi (live/remix/instrumental/cover/...). Server yang tidak mengirim
 * judul atau artis tidak otomatis ditolak, tetapi harus lolos pemeriksaan durasi file yang ketat. Durasi diperiksa
 * terpisah dari berkas aslinya.
 */
export function metadataMismatch(wanted: WantedTrack, info: PlaybackInfo): string | null {
  const wantedId = extractTrackId(wanted.url ?? '')
  const gotId = extractTrackId(info.spotifyUrl ?? '')
  if (wantedId && gotId && wantedId !== gotId) {
    return 'Audio dari server berasal dari lagu Spotify yang berbeda dengan lagu di playlist.'
  }
  // Judul TIDAK dipakai untuk menolak: server sering menulis judul beda dari playlist (mis. "Ho - Kago Tea Time - Fuyu No Hi"
  // vs "Fuyu No Hi"). Yang tetap wajib cocok: ID lagu Spotify, artis, penanda versi, dan durasi.
  // Artis hanya dipakai untuk MENOLAK jika server benar-benar menyebut artis (field `artist` terisi) dan ID lagu Spotify
  // tidak bisa dicocokkan. Server yang tidak mengirim nama artis, atau ID lagu yang sudah sama, tidak boleh membuat unduhan ditolak.
  const idMatches = Boolean(wantedId && gotId && wantedId === gotId)
  const artist = idMatches || !info.artist.trim() ? null : artistScore(wanted, info)
  // Sebagian nama artis cocok sudah cukup (penulisan nama antar server sering berbeda); ID + durasi + versi tetap diperiksa ketat.
  const needed = 0.5
  if (artist !== null && artist < needed) {
    return `Artis audio dari server ("${info.artist}") tidak cocok dengan lagu di playlist ("${wanted.artists}").`
  }
  if (info.title.trim()) {
    const want = versionMarkers(stripArtistPrefix(wanted.title, wanted.artists), wanted.artists)
    const got = versionMarkers(info.title, wanted.artists)
    const differ = [...want, ...got].filter((m) => want.has(m) !== got.has(m))
    if (differ.length > 0) {
      return `Versi audio dari server ("${info.title}") berbeda dengan lagu di playlist ("${wanted.title}"): ${[...new Set(differ)].join(', ')}.`
    }
  }
  return null
}
