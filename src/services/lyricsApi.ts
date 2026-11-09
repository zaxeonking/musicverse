import type { PlaylistTrack } from '../types/spotify'
import { parseDuration } from '../utils/formatTime'
import { parseLrc, type LyricLine } from '../utils/lrc'
import { stripArtistPrefix } from '../utils/trackTitle'
import { fetchYtMusicLyrics } from '../plugins/ytLyrics'
import { fetchTrackIsrc, findDeezerTrackId } from './artistApi'
import { fetchWordLyrics, normalizeIsrc, type WordLyricsHit } from './wordLyrics'
import { loadProviderPrefs, type LyricPriority } from '../utils/lyricProviderPrefs'
import { shouldPreferWord } from '../utils/lyricPriority'
import { getLyricSourcePin, type LyricSourceId } from '../utils/lyricSourcePins'

/**
 * Lirik dari LRCLIB (https://lrclib.net): gratis, tanpa kunci API. Dipanggil langsung dari browser;
 * jika browser/WebView memblokirnya (CORS) atau jaringan gagal, hasilnya error yang jelas, bukan lirik palsu.
 */
const BASE_URL = 'https://lrclib.net/api'
const TIMEOUT_MS = 12_000
/** Selisih durasi terbesar antara lagu dan data lirik yang masih dianggap lagu yang sama. */
const MAX_DURATION_DIFF_S = 8

/** Satu versi lirik bertanda waktu (LRCLIB bisa punya beberapa versi dengan durasi berbeda untuk lagu yang sama). */
export interface SyncedVersion {
  lines: LyricLine[]
  duration: number | null
}

export type LyricsResult =
  /** `duration`: durasi lagu pada data lirik (detik), untuk mendeteksi versi audio yang berbeda. */
  | {
      kind: 'synced'
      lines: LyricLine[]
      duration: number | null
      alternatives: SyncedVersion[]
      /** Provider kata (mis. "lyricsplus") bila lirik ini dari sana; kosong = sumber lama (LRCLIB dkk.). */
      source?: string
      /** true = baris-barisnya punya waktu kata ASLI (karaoke tepat), bukan perkiraan. */
      wordSynced?: boolean
    }
  | { kind: 'plain'; lines: string[]; duration: number | null; /** "ytmusic" bila dari YouTube Music. */ source?: string }
  | { kind: 'instrumental' }
  | { kind: 'none' }

export type LyricsErrorCode = 'network' | 'timeout' | 'bad_response' | 'aborted'

export class LyricsError extends Error {
  readonly code: LyricsErrorCode
  constructor(code: LyricsErrorCode, message: string) {
    super(message)
    this.name = 'LyricsError'
    this.code = code
  }
}

export interface LrclibRecord {
  trackName: string
  artistName: string
  duration: number | null
  instrumental: boolean
  plainLyrics: string | null
  syncedLyrics: string | null
  /** Asal data; LRCLIB diutamakan karena paling konsisten. */
  source?: 'lrclib' | 'netease' | 'ovh' | 'ytmusic'
}

/** Artis utama: "A, B" / "A & B" / "A feat. B" -> "A". */
export function primaryArtist(artists: string): string {
  return artists.split(/\s*(?:,|&|;|\bfeat\.?|\bft\.?|\bx\b)\s*/i)[0]?.trim() ?? ''
}

/** Akhiran setelah " - " yang hanya keterangan versi, bukan bagian judul. */
const VERSION_SUFFIX = /\s+-\s+(?:.*\b)?(?:remaster(?:ed)?|live|version|edit|mix|radio|acoustic|mono|stereo|deluxe|bonus|anniversary|single|from|ost|soundtrack|feat\.?|ft\.?)\b.*$/i

/** Judul tanpa "(feat. ...)", "[Remastered]" atau " - Remastered 2011" supaya pencarian lebih longgar. */
export function cleanTitle(title: string): string {
  return title
    .replace(/\s*[([][^)\]]*[)\]]/g, '')
    .replace(VERSION_SUFFIX, '')
    .trim()
}

function asRecord(value: unknown): LrclibRecord | null {
  if (typeof value !== 'object' || value === null) return null
  const item = value as Record<string, unknown>
  const text = (field: unknown) => (typeof field === 'string' && field.trim() !== '' ? field : null)
  return {
    trackName: typeof item.trackName === 'string' ? item.trackName : '',
    artistName: typeof item.artistName === 'string' ? item.artistName : '',
    duration: typeof item.duration === 'number' && Number.isFinite(item.duration) ? item.duration : null,
    instrumental: item.instrumental === true,
    plainLyrics: text(item.plainLyrics),
    syncedLyrics: text(item.syncedLyrics),
  }
}

async function getJson(base: string, path: string, params: Record<string, string>, signal: AbortSignal): Promise<unknown | null> {
  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, TIMEOUT_MS)
  const onAbort = () => controller.abort()
  if (signal.aborted) controller.abort()
  else signal.addEventListener('abort', onAbort, { once: true })

  try {
    const url = `${base}${path}?${new URLSearchParams(params).toString()}`
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } })
    if (response.status === 404) return null
    if (!response.ok) throw new LyricsError('bad_response', `Server lirik membalas dengan status ${response.status}.`)
    try {
      return await response.json()
    } catch {
      throw new LyricsError('bad_response', 'Balasan server lirik bukan JSON yang valid.')
    }
  } catch (error) {
    if (error instanceof LyricsError) throw error
    if (signal.aborted) throw new LyricsError('aborted', 'Permintaan lirik dibatalkan.')
    if (timedOut) throw new LyricsError('timeout', 'Server lirik tidak merespons tepat waktu.')
    throw new LyricsError('network', 'Tidak bisa menghubungi server lirik (jaringan putus atau diblokir browser).')
  } finally {
    clearTimeout(timer)
    signal.removeEventListener('abort', onAbort)
  }
}

function toResult(record: LrclibRecord, others: LrclibRecord[] = []): LyricsResult {
  if (record.syncedLyrics) {
    const lines = parseLrc(record.syncedLyrics)
    if (lines.length > 0) {
      // Versi lain (durasi berbeda) disertakan: pemutar memilih yang paling dekat dengan durasi audio sebenarnya.
      const alternatives: SyncedVersion[] = []
      for (const other of others) {
        if (!other.syncedLyrics) continue
        // Hanya versi yang durasinya mirip versi utama (selisih <= 6 dtk); versi beda jauh (live, extended) menyesatkan.
        if (record.duration !== null && other.duration !== null && Math.abs(other.duration - record.duration) > 6) continue
        const parsed = parseLrc(other.syncedLyrics)
        if (parsed.length > 0) alternatives.push({ lines: parsed, duration: other.duration })
      }
      return { kind: 'synced', lines, duration: record.duration, alternatives, ...(record.source ? { source: record.source } : {}) }
    }
  }
  if (record.plainLyrics) {
    return {
      kind: 'plain',
      lines: record.plainLyrics.split(/\r?\n/).map((line) => line.trimEnd()),
      duration: record.duration,
      ...(record.source ? { source: record.source } : {}),
    }
  }
  return record.instrumental ? { kind: 'instrumental' } : { kind: 'none' }
}

function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

/** Dua nama dianggap sama jika identik, atau yang satu memuat yang lain dan panjangnya tidak terlalu beda. */
function similarName(a: string, b: string): boolean {
  if (!a || !b) return false
  if (a === b) return true
  const [short, long] = a.length <= b.length ? [a, b] : [b, a]
  return long.includes(short) && short.length / long.length >= 0.6
}

/**
 * Data lirik harus benar-benar lagu yang diminta: judul DAN artis cocok. Pencarian LRCLIB bisa mengembalikan
 * lagu lain yang mirip; tanpa pemeriksaan ini lirik yang tampil bisa milik lagu berbeda.
 */
export function matchesTrack(record: { trackName: string; artistName: string }, title: string, artist: string): boolean {
  if (!similarName(normalizeName(cleanTitle(record.trackName) || record.trackName), normalizeName(title))) return false
  const wanted = normalizeName(artist)
  const got = normalizeName(record.artistName)
  if (!wanted || !got) return true
  return got.includes(wanted) || wanted.includes(got)
}

/** Kandidat yang cocok judul + artis, diurutkan: durasi paling dekat dulu, yang bertanda waktu diutamakan. */
/** Jumlah baris lirik yang berisi (bertanda waktu atau polos); dipakai menilai kelengkapan antar-sumber. */
function lyricLineCount(record: LrclibRecord): number {
  if (record.syncedLyrics) {
    const n = parseLrc(record.syncedLyrics).length
    if (n > 0) return n
  }
  return record.plainLyrics ? record.plainLyrics.split(/\r?\n/).filter((line) => line.trim() !== '').length : 0
}

/** Penalti skor untuk lirik yang jauh lebih pendek dari versi terpanjang sumber lain (kemungkinan tidak lengkap). */
export function incompletenessPenalty(lines: number, maxLines: number): number {
  if (maxLines <= 0 || lines <= 0) return 0
  const ratio = lines / maxLines
  return ratio < 0.6 ? 25 : ratio < 0.8 ? 10 : 0
}

export function rankCandidates(records: LrclibRecord[], durationS: number | null, title: string, artist: string): LrclibRecord[] {
  const candidates = records
    .filter((r) => r.instrumental || r.syncedLyrics || r.plainLyrics)
    .filter((r) => matchesTrack(r, title, artist))
    .filter((r) => durationS === null || r.duration === null || Math.abs(r.duration - durationS) <= MAX_DURATION_DIFF_S)
    // NetEase tanpa durasi tidak bisa diverifikasi waktunya: lebih baik dilewati daripada lirik ngaco.
    .filter((r) => r.source !== 'netease' || r.duration !== null)
  // Hybrid: sumber yang jauh lebih pendek dari yang terlengkap (mis. hanya satu bait) dikalahkan, walau bertanda waktu.
  const counts = new Map(candidates.map((r) => [r, lyricLineCount(r)] as const))
  const maxLines = Math.max(0, ...counts.values())
  const score = (r: LrclibRecord) =>
    (durationS !== null && r.duration !== null ? Math.abs(r.duration - durationS) : 5) +
    (r.syncedLyrics ? 0 : 20) +
    (r.source === 'netease' ? 4 : 0) + // LRCLIB menang jika kualitasnya kira-kira sama
    (r.instrumental ? 0 : incompletenessPenalty(counts.get(r) ?? 0, maxLines))
  return [...candidates].sort((a, b) => score(a) - score(b))
}

/* ------------------------------------------------------------------ */
/* Sumber lirik: LRCLIB, NetEase (lewat proxy di web), lyrics.ovh        */
/* ------------------------------------------------------------------ */

const NETEASE_DIRECT = 'https://music.163.com'
const LYRICS_OVH = 'https://api.lyrics.ovh/v1'

/** Web: lewat proxy /netease (CORS). APK Capacitor: langsung (CapacitorHttp tidak kena CORS). */
function neteaseBase(): string {
  const configured = import.meta.env?.VITE_LYRICS_NETEASE_BASE?.trim()
  if (configured) return configured.replace(/\/+$/, '')
  const cap = (typeof window !== 'undefined' ? (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor : undefined)
  return cap?.isNativePlatform?.() ? NETEASE_DIRECT : '/netease'
}

/** Baris kredit seperti "作词 : ..." / "Lyrics by: ..." bukan lirik; dibuang supaya tidak ikut disorot. */
const CREDIT_LINE = /^\s*\[[^\]]+\]\s*(?:作词|作曲|编曲|制作人?|混音|母带|监制|词|曲|lyrics?\s+by|music\s+by|composed?\s+by|produced?\s+by|arranged?\s+by)\s*[:：]/i

function stripCredits(lrc: string): string {
  return lrc
    .split(/\r?\n/)
    .filter((row) => !CREDIT_LINE.test(row))
    .join('\n')
}

async function lrclibRecords(track: PlaylistTrack, baseTitle: string, title: string, artist: string, durationS: number | null, signal: AbortSignal): Promise<LrclibRecord[]> {
  const exactParams: Record<string, string> = { track_name: baseTitle, artist_name: track.artists }
  if (track.album) exactParams.album_name = track.album
  if (durationS) exactParams.duration = String(Math.round(durationS))
  const settled = await Promise.allSettled([
    getJson(BASE_URL, '/get', exactParams, signal),
    getJson(BASE_URL, '/search', artist ? { track_name: title, artist_name: artist } : { track_name: title }, signal),
    getJson(BASE_URL, '/search', { q: `${title} ${artist}`.trim() }, signal),
  ])
  const records: LrclibRecord[] = []
  const exact = settled[0].status === 'fulfilled' ? asRecord(settled[0].value) : null
  if (exact) records.push({ ...exact, source: 'lrclib' })
  for (const item of settled.slice(1)) {
    if (item.status !== 'fulfilled' || !Array.isArray(item.value)) continue
    for (const raw of item.value) {
      const record = asRecord(raw)
      if (record) records.push({ ...record, source: 'lrclib' })
    }
  }
  const failed = settled.find((r): r is PromiseRejectedResult => r.status === 'rejected')
  if (failed && records.length === 0) throw failed.reason
  return records
}

interface NeteaseSong {
  id: number
  name: string
  artist: string
  duration: number | null
}

function parseNeteaseSongs(body: unknown): NeteaseSong[] {
  if (typeof body !== 'object' || body === null) return []
  const result = (body as { result?: { songs?: unknown } }).result
  if (!result || !Array.isArray(result.songs)) return []
  const songs: NeteaseSong[] = []
  for (const raw of result.songs) {
    if (typeof raw !== 'object' || raw === null) continue
    const item = raw as Record<string, unknown>
    if (typeof item.id !== 'number' || typeof item.name !== 'string') continue
    const people = Array.isArray(item.artists) ? item.artists : Array.isArray(item.ar) ? item.ar : []
    const artist = people
      .map((p) => (typeof p === 'object' && p !== null && typeof (p as { name?: unknown }).name === 'string' ? (p as { name: string }).name : ''))
      .filter(Boolean)
      .join(', ')
    const ms = typeof item.duration === 'number' ? item.duration : typeof item.dt === 'number' ? item.dt : null
    songs.push({ id: item.id, name: item.name, artist, duration: ms !== null ? ms / 1000 : null })
  }
  return songs
}

/** NetEase Cloud Music: cari lagu, ambil lirik bertanda waktu untuk beberapa hasil teratas yang cocok. */
async function neteaseRecords(title: string, artist: string, signal: AbortSignal): Promise<LrclibRecord[]> {
  const base = neteaseBase()
  const search = await getJson(base, '/api/search/get', { s: `${title} ${artist}`.trim(), type: '1', limit: '8', offset: '0' }, signal)
  const songs = parseNeteaseSongs(search)
    .filter((song) => matchesTrack({ trackName: song.name, artistName: song.artist }, title, artist))
    .slice(0, 3)
  const settled = await Promise.allSettled(
    songs.map((song) => getJson(base, '/api/song/lyric', { id: String(song.id), lv: '-1', kv: '-1', tv: '-1' }, signal)),
  )
  const records: LrclibRecord[] = []
  settled.forEach((item, i) => {
    if (item.status !== 'fulfilled' || typeof item.value !== 'object' || item.value === null) return
    const lrc = (item.value as { lrc?: { lyric?: unknown } }).lrc?.lyric
    if (typeof lrc !== 'string' || !/\[\d{1,3}:\d{2}/.test(lrc)) return
    const song = songs[i]
    records.push({
      trackName: song.name,
      artistName: song.artist,
      duration: song.duration,
      instrumental: false,
      plainLyrics: null,
      syncedLyrics: stripCredits(lrc),
      source: 'netease',
    })
  })
  const failed = settled.find((r): r is PromiseRejectedResult => r.status === 'rejected')
  if (failed && records.length === 0 && songs.length > 0) throw failed.reason
  return records
}

/** lyrics.ovh: hanya teks biasa (tanpa waktu), dipakai sebagai cadangan terakhir. */
async function ovhRecords(title: string, artist: string, signal: AbortSignal): Promise<LrclibRecord[]> {
  if (!artist) return []
  const body = await getJson(LYRICS_OVH, `/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`, {}, signal)
  const lyrics = typeof body === 'object' && body !== null ? (body as { lyrics?: unknown }).lyrics : null
  if (typeof lyrics !== 'string' || !lyrics.trim()) return []
  return [{ trackName: title, artistName: artist, duration: null, instrumental: false, plainLyrics: lyrics.trim(), syncedLyrics: null, source: 'ovh' }]
}

/** Setelah ada versi bertanda waktu, sumber lain masih ditunggu sebentar supaya bisa dibandingkan. */
const SOURCE_GRACE_MS = 1500

interface LookupContext {
  track: PlaylistTrack
  baseTitle: string
  title: string
  artist: string
  durationS: number | null
  signal: AbortSignal
}

function lookupContext(track: PlaylistTrack, signal: AbortSignal): LookupContext {
  const durationS = parseDuration(track.duration)
  const artist = primaryArtist(track.artists)
  // Judul playlist sering "Artis - Judul": buang bagian artis, kalau tidak pencarian memakai nama artis sebagai judul.
  const baseTitle = stripArtistPrefix(track.title, track.artists)
  const title = cleanTitle(baseTitle) || baseTitle
  return { track, baseTitle, title, artist, durationS, signal }
}

/** YouTube Music: bertanda waktu bila ada, kalau tidak lirik biasa. null = tidak ada. */
async function ytMusicResult(ctx: LookupContext): Promise<LyricsResult | null> {
  const { track, title, artist, durationS, signal } = ctx
  const yt = await fetchYtMusicLyrics(
    track,
    (hits) => {
      const hit = hits.find(
        (h) =>
          matchesTrack({ trackName: h.title, artistName: h.artist }, title, artist) &&
          (durationS === null || h.durationSec === null || Math.abs(h.durationSec - durationS) <= MAX_DURATION_DIFF_S),
      )
      return hit ?? null
    },
    signal,
    [title, artist].filter(Boolean).join(' '),
  )
  if (signal.aborted) throw new LyricsError('aborted', 'Permintaan lirik dibatalkan.')
  if (!yt) return null
  return toResult({
    trackName: yt.title,
    artistName: yt.artist,
    duration: yt.durationSec,
    instrumental: false,
    plainLyrics: yt.plain,
    syncedLyrics: yt.synced,
    source: 'ytmusic',
  })
}

type RecordSource = 'lrclib' | 'netease' | 'ovh'

/**
 * Mencari lirik dari sumber-sumber lama (LRCLIB, NetEase, lyrics.ovh) sekaligus, atau hanya `only` bila diberikan.
 * Semua versi bertanda waktu dikumpulkan jadi satu daftar; yang durasinya paling dekat dengan lagu dipakai, sisanya
 * dikembalikan sebagai `alternatives` supaya pemutar bisa memilih ulang memakai durasi audio yang benar-benar terdengar.
 * Sumber yang gagal/diblokir tidak menggagalkan yang lain; galat baru dilaporkan jika SEMUA sumber gagal.
 */
async function recordSourcesResult(ctx: LookupContext, only?: RecordSource): Promise<LyricsResult> {
  const { track, baseTitle, title, artist, durationS, signal } = ctx
  const all: Array<[RecordSource, () => Promise<LrclibRecord[]>]> = [
    ['lrclib', () => lrclibRecords(track, baseTitle, title, artist, durationS, signal)],
    ['netease', () => neteaseRecords(title, artist, signal)],
    ['ovh', () => ovhRecords(title, artist, signal)],
  ]
  const jobs = all.filter(([id]) => !only || id === only).map(([, run]) => run())

  const records: LrclibRecord[] = []
  const errors: unknown[] = []
  await new Promise<void>((resolve) => {
    let pending = jobs.length
    let grace: ReturnType<typeof setTimeout> | undefined
    const onSettled = () => {
      pending -= 1
      if (pending === 0) {
        clearTimeout(grace)
        resolve()
      }
    }
    for (const job of jobs) {
      job
        .then((found) => {
          records.push(...found)
          if (!grace && found.some((r) => r.syncedLyrics)) grace = setTimeout(resolve, SOURCE_GRACE_MS)
        })
        .catch((error: unknown) => errors.push(error))
        .finally(onSettled)
    }
  })

  const aborted = errors.find((e) => e instanceof LyricsError && e.code === 'aborted')
  if (aborted || signal.aborted) throw aborted ?? new LyricsError('aborted', 'Permintaan lirik dibatalkan.')

  const ranked = rankCandidates(records, durationS, title, artist)
  if (ranked.length > 0) {
    const [best, ...rest] = ranked
    return toResult(best, rest)
  }
  // Tidak ada hasil DAN semua sumber gagal: laporkan galatnya, jangan bilang "tidak ditemukan".
  if (errors.length === jobs.length) throw errors[0]
  return { kind: 'none' }
}

/**
 * Rantai sumber lama menurut prioritas. YouTube Music dicoba PERTAMA (bawaan), kecuali prioritas "lrclib": LRCLIB / NetEase /
 * lyrics.ovh dulu, YouTube Music hanya cadangan bila yang lain tidak menemukan apa pun.
 */
async function fetchLegacyLyrics(ctx: LookupContext, priority: LyricPriority): Promise<LyricsResult> {
  if (priority !== 'lrclib') {
    const yt = await ytMusicResult(ctx)
    if (yt) return yt
    return recordSourcesResult(ctx)
  }
  let others: LyricsResult | null = null
  let othersError: unknown
  try {
    others = await recordSourcesResult(ctx)
  } catch (error) {
    if (error instanceof LyricsError && error.code === 'aborted') throw error
    othersError = error
  }
  if (others && others.kind !== 'none') return others
  const yt = await ytMusicResult(ctx)
  if (yt) return yt
  if (others) return others
  throw othersError
}

/** Satu sumber saja (pilihan manual pengguna untuk lagu ini). Tidak ada hasil = `none`, tidak diam-diam pindah sumber. */
async function fetchFromSource(ctx: LookupContext, source: LyricSourceId): Promise<LyricsResult> {
  if (source === 'ytmusic') return (await ytMusicResult(ctx)) ?? { kind: 'none' }
  if (source === 'word') {
    const isrc = await resolveIsrc(ctx.track, ctx.signal)
    const word = await fetchWordLyrics({ title: ctx.title, artist: ctx.artist, album: ctx.track.album || undefined, isrc, durationS: ctx.durationS }, ctx.signal, { force: true })
    if (ctx.signal.aborted) throw new LyricsError('aborted', 'Permintaan lirik dibatalkan.')
    return word ? wordResult(word) : { kind: 'none' }
  }
  return recordSourcesResult(ctx, source)
}

export { shouldPreferWord }

const isrcCache = new Map<string, string | undefined>()

/**
 * ISRC lagu: dari `track.isrc`; untuk lagu asal Deezer (`id` = `dz-<angka>`) dari `/track/{id}`; untuk lagu lain (mis. playlist
 * Spotify, yang sumbernya tanpa ISRC) dicari di Deezer lewat judul + artis + durasi, hanya bila rekamannya cocok persis
 * (`pickDeezerTrackId`). Di-cache per sesi; "tidak ketemu" di-cache, galat / lambat tidak (dicoba lagi lain kali).
 * Hanya dicari di APK karena hanya Binimum (APK) yang memakainya.
 */
export async function resolveIsrc(track: PlaylistTrack, signal: AbortSignal): Promise<string | undefined> {
  const own = normalizeIsrc(track.isrc)
  if (own) return own
  const cap = typeof window !== 'undefined' ? (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor : undefined
  if (cap?.isNativePlatform?.() !== true) return undefined
  const dz = /^dz-(\d+)$/.exec(track.id)?.[1]
  const title = cleanTitle(stripArtistPrefix(track.title, track.artists)) || track.title
  const artist = primaryArtist(track.artists)
  const durationS = parseDuration(track.duration)
  const key = dz ?? (title && artist ? `q:${normalizeName(title)}|${normalizeName(artist)}|${Math.round((durationS ?? 0) / 4)}` : '')
  if (!key) return undefined
  if (isrcCache.has(key)) return isrcCache.get(key)
  try {
    const dzId = dz ?? (await findDeezerTrackId(title, artist, durationS, signal))
    const found = dzId ? normalizeIsrc(await fetchTrackIsrc(dzId, signal)) : undefined
    isrcCache.set(key, found)
    return found
  } catch {
    return undefined // tidak di-cache: coba lagi lain kali
  }
}

function wordResult(word: WordLyricsHit): LyricsResult {
  // duration: null = anggap waktu lirik cocok dengan audio ("exact"). Waktu akhir baris terakhir BUKAN durasi lagu,
  // dan mengisinya akan memaksa useLyricTiming masuk mode "scaled" / "estimated" yang salah.
  return { kind: 'synced', lines: word.lines, duration: null, alternatives: [], source: word.provider, wordSynced: word.wordSynced }
}

/**
 * Titik masuk lirik. Bila pengguna memilih sumber untuk lagu ini (`options.source` atau pilihan tersimpan), HANYA sumber itu
 * yang dipakai. Selain itu: provider per kata (LyricsPlus / BetterLyrics; lihat wordLyrics.ts) dijalankan BERSAMAAN dengan
 * rantai sumber lama; hasil per kata dipakai bila lebih baik (`shouldPreferWord`, menurut prioritas di Pengaturan), kalau tidak
 * sumber lama seperti biasa. Provider kata tidak pernah menggagalkan pencarian: galat hanya dilaporkan dari sumber lama.
 */
export async function fetchLyrics(track: PlaylistTrack, options: { signal: AbortSignal; source?: LyricSourceId | null }): Promise<LyricsResult> {
  const { signal } = options
  const ctx = lookupContext(track, signal)
  const source = options.source !== undefined ? options.source : getLyricSourcePin(track)
  if (source) return fetchFromSource(ctx, source)

  const priority = loadProviderPrefs().priority
  const wordJob = resolveIsrc(track, signal).then((isrc) =>
    fetchWordLyrics({ title: ctx.title, artist: ctx.artist, album: track.album || undefined, isrc, durationS: ctx.durationS }, signal),
  )
  let legacy: LyricsResult | null = null
  let legacyError: unknown
  try {
    legacy = await fetchLegacyLyrics(ctx, priority)
  } catch (error) {
    legacyError = error
  }
  if (signal.aborted) throw new LyricsError('aborted', 'Permintaan lirik dibatalkan.')
  const word = await wordJob
  if (word && shouldPreferWord(word, legacy, priority)) return wordResult(word)
  if (legacy) return legacy
  throw legacyError
}
