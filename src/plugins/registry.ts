import { MusicVerseNative } from '../native/musicVerseNative'
import { isNativeApp } from '../native/platform'
import type { PlaybackInfo } from '../types/spotify'
import { durationFit, isLikelyClip, strictDurationProblem } from '../utils/clipDetect'
import { fetchTitleAliases, peekAliases, type TrackAlias } from '../services/titleAliases'
import { artistVerified, bothScriptGap, GAP_DURATION_TOLERANCE_S, metadataMismatch, scoreWithAliases, scriptGap, versionMarkers, type WantedTrack } from '../utils/matchTrack'
import { getNetworkTier } from '../utils/networkQuality'
import { probeAudioDuration } from '../utils/probeAudio'
import { extractSpotifyTrackLink } from '../utils/spotifyUrl'
import { stripArtistPrefix } from '../utils/trackTitle'
import { getManualPin } from './manualPins'
import { DEFAULT_DOWNLOAD_QUALITY, orderStreamsForQuality, type DownloadQuality } from './quality'
import type { ManualCandidate, ManualPick, ResolverPlugin, StreamSource } from './types'
import { THIRD_PARTY_SOURCES } from './thirdParty'
import { ytMusicPlugin } from './ytmusic'
import { ytVideoPlugin } from './ytvideo'

/**
 * Daftar plugin pemutaran, dicoba berurutan (sama seperti StreamBeats: YouTube Music, lalu YouTube). Audio HANYA berasal
 * dari plugin; tidak ada API pihak ketiga. Menambah sumber baru = buat `ResolverPlugin` (lihat ytmusic.ts) lalu
 * daftarkan di sini atau lewat `registerPlugin`.
 */
let pluginList: ResolverPlugin[] | null = null

/** Dibangun saat pertama dipakai (bukan saat modul dimuat): modul plugin dan registry saling mengimpor lewat jaringan/API. */
function plugins(): ResolverPlugin[] {
  if (!pluginList) pluginList = [ytMusicPlugin, ytVideoPlugin]
  return pluginList
}

const DISABLED_KEY = 'mv:plugins:disabled'

function readDisabled(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(DISABLED_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

export function registerPlugin(plugin: ResolverPlugin): void {
  const list = plugins()
  if (!list.some((p) => p.id === plugin.id)) list.push(plugin)
}

export function listPlugins(): Array<{ id: string; name: string; enabled: boolean }> {
  const disabled = readDisabled()
  return plugins().map((p) => ({ id: p.id, name: p.name, enabled: !disabled.includes(p.id) }))
}

export function setPluginEnabled(id: string, enabled: boolean): void {
  const next = readDisabled().filter((v) => v !== id)
  if (!enabled) next.push(id)
  try {
    localStorage.setItem(DISABLED_KEY, JSON.stringify(next))
  } catch {
    /* abaikan */
  }
}

/* ---------------- cache hasil resolve (sadar kedaluwarsa) ---------------- */

const CACHE_MAX_MS = 30 * 60_000
const CACHE_SAFETY_MS = 60_000
const cache = new Map<string, { info: PlaybackInfo; until: number }>()

function cacheKey(wanted: WantedTrack): string {
  return `${wanted.title}|${wanted.artists}`.toLowerCase()
}

/** Membuang hasil resolve yang tersimpan untuk lagu ini (mis. URL-nya ditolak sumber walau belum kedaluwarsa). */
export function forgetResolved(track: { title: string; artists?: string }): void {
  const key = cacheKey({ title: track.title, artists: track.artists ?? '', duration: '' })
  cache.delete(key)
  // Hasil unduhan berkualitas non-default disimpan di kunci sendiri (lihat resolveViaPlugins); ikut dibuang.
  for (const k of [...cache.keys()]) if (k.startsWith(`${key}|q:`)) cache.delete(k)
}

function cacheGet(key: string): PlaybackInfo | null {
  const hit = cache.get(key)
  if (!hit) return null
  if (Date.now() >= hit.until) {
    cache.delete(key)
    return null
  }
  return hit.info
}

function cachePut(key: string, info: PlaybackInfo, stream: StreamSource): void {
  const now = Date.now()
  for (const [k, v] of cache) if (now >= v.until) cache.delete(k)
  const limit = stream.expiresAt !== null ? stream.expiresAt - CACHE_SAFETY_MS : now + CACHE_MAX_MS
  const until = Math.min(now + CACHE_MAX_MS, limit)
  if (until > now) cache.set(key, { info, until })
}

/* ---------------- resolusi ---------------- */

const ACCEPT_SCORE = 0.7
const MAX_CANDIDATES = 2
const MAX_STREAMS_PER_CANDIDATE = 2
/**
 * Batas total waktu satu kali resolve plugin. Di sinyal lemah rangkaian (visitorData + cari + ambil stream + baca
 * metadata lewat proxy) butuh waktu lebih lama, jadi batasnya mengikuti kualitas jaringan; unduhan (tidak ada
 * pendengar yang menunggu) diberi waktu paling longgar. Lewat batas = gagal sementara (diulang pemanggil), bukan
 * pindah ke sumber lain.
 */
const PLUGIN_BUDGET_BY_TIER = { good: 9_000, medium: 16_000, poor: 28_000 } as const
const PLUGIN_BUDGET_STRICT_MS = 35_000
/**
 * Cek ketersediaan (`searchOnly`): batas waktu SATU lagu. Di dalamnya lagu benar-benar dicari, stream diambil, dan
 * metadata audionya dibaca (sama seperti saat diputar), jadi lagu yang hanya "ada di hasil pencarian" tetapi tidak
 * bisa diputar tidak lolos. Lewat batas = dianggap tidak ditemukan (pengguna bisa Cari manual atau Cek ulang).
 */
const CHECK_BUDGET_MS = 6_000
const CHECK_PROBE_TIMEOUT_MS = 4_000

function pluginBudgetMs(strict: boolean): number {
  return strict ? PLUGIN_BUDGET_STRICT_MS : PLUGIN_BUDGET_BY_TIER[getNetworkTier()]
}

function probeTimeoutMs(strict: boolean, check = false): number {
  if (check) return CHECK_PROBE_TIMEOUT_MS
  return strict || getNetworkTier() !== 'good' ? 12_000 : 7_000
}
function formatClock(totalSec: number | null): string {
  if (totalSec === null) return ''
  const s = Math.round(totalSec)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

let proxyUnavailable = false

/** Kode galat Capacitor untuk metode native yang tidak ada (APK lama). */
export function isNativeUnimplemented(error: unknown): boolean {
  const e = error as { code?: unknown; message?: unknown } | null
  const text = typeof e?.message === 'string' ? e.message.toLowerCase() : ''
  return e?.code === 'UNIMPLEMENTED' || text.includes('not implemented') || text.includes('unimplemented')
}

/**
 * Menyalurkan URL audio lewat proxy lokal native (StreamProxy). Di sana koneksi yang putus di tengah lagu otomatis
 * disambung dari byte terakhir, jadi <audio> tidak melihat error jaringan saat sinyal hilang sebentar. User-Agent
 * (bila ada) dikirim proxy karena <audio> di WebView tidak bisa. Tanpa proxy (web / APK lama) URL dipakai apa adanya.
 */
export async function proxyRemoteUrl(url: string, userAgent?: string): Promise<string> {
  if (!isNativeApp() || proxyUnavailable) return url
  if (!/^https?:\/\//i.test(url) || url.startsWith('http://127.0.0.1')) return url
  try {
    return (await MusicVerseNative.proxyStream({ url, userAgent })).url
  } catch (error) {
    if (isNativeUnimplemented(error)) {
      proxyUnavailable = true
      console.warn('[MusicVerse] APK ini belum punya StreamProxy: stream plugin tidak bisa dikirimi User-Agent dan koneksi putus tidak disambung. Pasang APK versi terbaru.')
    }
    return url
  }
}

async function toPlayableUrl(stream: StreamSource): Promise<string> {
  const userAgent = stream.headers?.['User-Agent']
  if (!userAgent) return stream.url
  return proxyRemoteUrl(stream.url, userAgent)
}

/** True bila judul hasil memuat instrumental/karaoke sedangkan lagu di playlist bukan versi itu. */
function isUnwantedInstrumental(wanted: WantedTrack, gotTitle: string): boolean {
  const want = versionMarkers(stripArtistPrefix(wanted.title, wanted.artists), wanted.artists)
  const got = versionMarkers(gotTitle, wanted.artists)
  return got.has('instrumental') && !want.has('instrumental')
}

/** Pemeriksaan ketat untuk unduhan: artis/versi cocok dan durasi file sangat dekat dengan lagu di playlist. null = lolos. */
function strictProblem(wanted: WantedTrack, info: PlaybackInfo, actual: number | null, expected: number | null): string | null {
  const mismatch = metadataMismatch(wanted, info)
  if (mismatch) return mismatch
  return strictDurationProblem(actual, expected)
}

/** Hasil resolve plugin: `ok`, atau alasan gagal supaya pemanggil tahu perlu mengulang atau menyerah. */
export type PluginOutcome = 'ok' | 'timeout' | 'failed' | 'rejected' | 'nomatch' | 'aborted'

export interface PluginResolveResult {
  info: PlaybackInfo | null
  outcome: PluginOutcome
}

/** Sama seperti `resolveViaPluginsDetailed`, tetapi hanya mengembalikan infonya (null bila gagal). */
export async function resolveViaPlugins(
  wanted: WantedTrack,
  options: { signal?: AbortSignal; expected: number | null; strict?: boolean; quality?: DownloadQuality; avoid?: ReadonlyArray<string>; thirdParty?: boolean; searchOnly?: boolean },
): Promise<PlaybackInfo | null> {
  return (await resolveViaPluginsDetailed(wanted, options)).info
}

/**
 * Mencari lagu lewat plugin (berurutan) dan mengembalikan info playback beserta alasannya bila tidak ada.
 * `avoid` berisi kunci `plugin:<id>` yang dilewati (mis. yang baru memberi berkas salah). Tidak pernah melempar error.
 * Setiap stream diperiksa dulu (metadata audio terbaca di WebView, bukan klip) sebelum dipakai.
 */
export async function resolveViaPluginsDetailed(
  wanted: WantedTrack,
  options: { signal?: AbortSignal; expected: number | null; strict?: boolean; quality?: DownloadQuality; avoid?: ReadonlyArray<string>; thirdParty?: boolean; searchOnly?: boolean },
): Promise<PluginResolveResult> {
  const { expected, strict = false } = options

  // Pilihan manual pengguna untuk lagu ini (Cari manual) didahulukan. Bila gagal diambil (mis. sinyal lemah atau video
  // dihapus), tetap lanjut ke pencarian otomatis di bawah; pilihannya tidak dibuang.
  const pin = getManualPin(wanted)
  if (pin) {
    // Hanya cek ketersediaan: lagu yang sudah dipilih manual dianggap ada, tanpa jaringan.
    if (options.searchOnly) return { info: null, outcome: 'ok' }
    // Pilihan manual itu mutlak: hanya yang dipilih pengguna yang diputar/diunduh. Bila gagal diambil (sinyal lemah,
    // video dihapus) hasilnya dikembalikan apa adanya supaya pemanggil mengulang; TIDAK jatuh ke pencarian otomatis.
    return resolveManualPick(pin, { signal: options.signal, quality: options.quality })
  }
  // Kualitas hanya berlaku untuk unduhan (strict). Selain "tinggi" hasilnya disimpan di kunci sendiri supaya tidak
  // menimpa stream yang dipakai pemutaran (yang selalu memakai kualitas terbaik).
  const quality: DownloadQuality = strict ? (options.quality ?? DEFAULT_DOWNLOAD_QUALITY) : DEFAULT_DOWNLOAD_QUALITY
  const key = quality === DEFAULT_DOWNLOAD_QUALITY ? cacheKey(wanted) : `${cacheKey(wanted)}|q:${quality}`
  const cached = cacheGet(key)
  // Mode unduhan menambah pemeriksaan ketat (artis, versi, durasi); hasil cache yang tidak lolos dibuang.
  const cachedSource = cached?.source ? `plugin:${cached.source.replace(/^plugin:/, '')}` : ''
  if (
    cached &&
    !isUnwantedInstrumental(wanted, cached.title) &&
    // Hasil lama yang tersimpan sebelum perbaikan (mis. lagu lain berdurasi mirip) dinilai ulang dan dibuang bila tidak cocok.
    scoreWithAliases(wanted, { ...cached, spotifyUrl: '' }, false, cached.probedDuration ?? null, peekAliases(wanted)) >= ACCEPT_SCORE &&
    !options.avoid?.includes(cachedSource) &&
    (!strict || strictProblem(wanted, cached, cached.probedDuration ?? null, expected) === null)
  ) {
    return { info: cached, outcome: 'ok' }
  }

  const inner = new AbortController()
  const forward = () => inner.abort()
  if (options.signal?.aborted) return { info: null, outcome: 'aborted' }
  options.signal?.addEventListener('abort', forward, { once: true })
  const budget = setTimeout(() => inner.abort(), options.searchOnly ? CHECK_BUDGET_MS : pluginBudgetMs(strict))
  const signal = inner.signal

  const disabled = readDisabled()
  const query = [stripArtistPrefix(wanted.title, wanted.artists), wanted.artists.split(/\s*[,&;]\s*/)[0]]
    .filter(Boolean)
    .join(' ')
  // Pencarian bertahap, berhenti di yang pertama menghasilkan lagu yang lolos. Judul tidak pernah ditambah kata apa pun
  // (tanpa "lyrics" / "official" dst.): 1) judul + artis, 2) judul saja, 3) artis saja (judul beda aksara tetap bisa
  // ditemukan lewat durasi; teks yang tidak cocok tetap ditolak oleh skor).
  const cleanTitle = stripArtistPrefix(wanted.title, wanted.artists)
  const firstArtist = wanted.artists.split(/\s*[,&;]\s*/)[0]?.trim() ?? ''
  // Nama artis Spotify sering berhuruf "Ho - Kago Tea Time" sedangkan YouTube menulis "Houkago Teatime"; tanda hubung di tengah
  // nama merusak pencarian. Varian tanpa tanda hubung dicoba lebih dulu.
  const plainArtist = firstArtist.replace(/\s+[-\u2013\u2014]\s+/g, '').trim()
  const plainQuery = plainArtist && plainArtist !== firstArtist ? `${cleanTitle} ${plainArtist}` : ''
  const queries = [...new Set([plainQuery, query, cleanTitle, firstArtist].map((q) => q.trim()).filter(Boolean))]
  const spotifyUrl = extractSpotifyTrackLink(wanted.url ?? '') ?? ''
  // Nama lain lagu ini (bahasa/aksara lain), dicari paralel dengan pencarian pertama; tidak menghambat bila lambat.
  const aliasPromise: Promise<TrackAlias[]> = fetchTitleAliases(wanted, signal).catch(() => [])
  const aliasesWithin = (ms: number): Promise<TrackAlias[]> =>
    Promise.race([aliasPromise, new Promise<TrackAlias[]>((resolve) => setTimeout(() => resolve([]), ms))])
  let aliases: TrackAlias[] = []
  let hadFailure = false
  let sawCandidate = false
  const stopped = (): PluginResolveResult => ({ info: null, outcome: options.signal?.aborted ? 'aborted' : 'timeout' })

  try {
    for (const plugin of plugins()) {
      if (disabled.includes(plugin.id) || options.avoid?.includes(`plugin:${plugin.id}`)) continue
      if (signal.aborted) return stopped()
      try {
        const seen = new Set<string>()
        const queue = [...queries]
        let aliasesQueued = false
        for (let qi = 0; qi < queue.length; qi++) {
        const q = queue[qi]
        if (signal.aborted) return stopped()
        const found = await plugin.search(q, signal)
        aliases = await aliasesWithin(qi === 0 ? 1500 : 0)
        const hits = found.filter((h) => !seen.has(h.id))
        for (const h of hits) seen.add(h.id)
        const scored = hits
          .map((hit) => {
            const probe: PlaybackInfo = {
              title: hit.title,
              artist: hit.artist,
              album: hit.album,
              duration: formatClock(hit.durationSec),
              cover: hit.cover,
              // SENGAJA kosong: hasil pencarian YouTube bukan hasil dari tautan Spotify. Kalau diisi tautan lagu yang diminta,
              // scoreCandidate memberi bonus "ID Spotify sama" (+0,25) ke SEMUA kandidat sehingga lagu lain berdurasi mirip lolos.
              spotifyUrl: '',
              audioUrl: '',
            }
            // Durasi dari hasil pencarian: kecocokan durasi (bobot terbesar) langsung terhitung.
            const score = scoreWithAliases(wanted, probe, false, hit.durationSec, aliases)
            // Peringkat (bukan penerimaan): versi live/remix/cover/dst. yang tidak ada di lagu aslinya turun di bawah versi yang
            // sama dengan playlist, tetapi tetap diterima bila hanya itu yang ada. Judul yang persis sama sedikit dinaikkan.
            const wantTitle = stripArtistPrefix(wanted.title, wanted.artists)
            const want = versionMarkers(wantTitle, wanted.artists)
            const got = versionMarkers(hit.title, wanted.artists)
            const differs = [...want, ...got].some((m) => want.has(m) !== got.has(m))
            const exact = hit.title.trim().toLowerCase() === wantTitle.trim().toLowerCase()
            // Instrumental / karaoke TIDAK PERNAH dipilih bila lagu di playlist bukan versi itu (pengguna menginginkan yang berlirik).
            const blocked = got.has('instrumental') && !want.has('instrumental')
            // Judul + artis sama-sama beda aksara: hanya durasi yang bisa dicocokkan, jadi hanya hasil teratas pencarian
            // (urutan relevansi YouTube, yang paham alih aksara) yang dipercaya. Lagu acak berdurasi mirip tidak dipilih.
            const rankInResults = found.indexOf(hit)
            const titleGap = scriptGap(wantTitle, hit.title)
            // Judul beda aksara: hanya urutan relevansi YouTube + artis + durasi yang menentukan, jadi hanya 2 hasil teratas yang dipercaya.
            const unrelated = bothScriptGap(wanted, probe) ? rankInResults > 2 : titleGap && rankInResults > 1
            // Artis yang sama (walau beda aksara/penulisan) diutamakan: lagu dari artis lain tidak menang atas yang artisnya sama.
            const sameArtist = artistVerified(wanted, probe, aliases)
            // Judul beda aksara + artis terverifikasi: durasi file boleh meleset beberapa detik (master Spotify vs YouTube Music).
            const tolerant = !strict && titleGap && sameArtist
            return { hit, score, tolerant, blocked: blocked || unrelated, rank: score - (differs ? 0.3 : 0) + (exact ? 0.05 : 0) + (sameArtist ? 0.2 : 0) }
          })
          .filter((c) => c.score >= ACCEPT_SCORE && !c.blocked)
          .sort((a, b) => b.rank - a.rank)
          .slice(0, MAX_CANDIDATES)

        // Cek ketersediaan (`searchOnly`) memakai jalur yang SAMA dengan pemutaran: stream diambil dan durasi file dibaca.
        // Skor hasil pencarian saja tidak cukup (lagu bisa muncul di pencarian tetapi streamnya tidak terbaca).
        for (const { hit, score, tolerant } of scored) {
          sawCandidate = true
          const streams = orderStreamsForQuality(await plugin.getStreams(hit.id, signal), quality).slice(0, MAX_STREAMS_PER_CANDIDATE)
          for (const stream of streams) {
            const playable = await toPlayableUrl(stream)
            const actual = await probeAudioDuration(playable, probeTimeoutMs(strict, options.searchOnly), signal)
            if (signal.aborted) return stopped()
            // Tidak terbaca di WebView (mis. ditolak CDN) atau jelas bukan lagunya: coba berikutnya.
            if (actual === null) {
              hadFailure = true
              continue
            }
            if (isLikelyClip(actual, expected)) continue
            const fit = durationFit(actual, expected)
            const withinTolerance = tolerant && expected !== null && Math.abs(actual - expected) <= GAP_DURATION_TOLERANCE_S
            if (fit !== null && fit < 0.7 && !withinTolerance) continue
            const info: PlaybackInfo = {
              title: hit.title,
              artist: hit.artist,
              album: hit.album,
              duration: formatClock(actual),
              cover: hit.cover,
              spotifyUrl,
              audioUrl: playable,
              source: `plugin:${plugin.id}`,
              apiSource: 'plugin',
              probedDuration: actual,
              directUrl: stream.url,
              directUserAgent: stream.headers?.['User-Agent'],
            }
            if (strict) {
              const problem = strictProblem(wanted, info, actual, expected)
              if (problem) {
                console.warn(`[MusicVerse] Plugin ${plugin.id} ditolak untuk unduhan: ${problem}`)
                continue
              }
            }
            console.info(`[MusicVerse] Plugin ${plugin.id}: "${hit.title}" skor ${score.toFixed(2)}, ${actual.toFixed(1)} dtk`)
            cachePut(key, info, stream)
            return { info, outcome: 'ok' }
          }
        }
        // Belum ada yang lolos setelah kata kunci terakhir: coba nama lain lagu ini (bahasa/aksara lain), mis. judul Jepangnya.
        if (qi === queue.length - 1 && !aliasesQueued) {
          aliasesQueued = true
          aliases = await aliasesWithin(2500)
          for (const alias of aliases) {
            const extra = [`${alias.title} ${alias.artist}`.trim(), alias.title].map((x) => x.trim()).filter(Boolean)
            for (const x of extra) if (!queue.includes(x)) queue.push(x)
          }
        }
        }
      } catch (error) {
        if (signal.aborted) return stopped()
        hadFailure = true
        console.warn(`[MusicVerse] Plugin ${plugin.id} gagal:`, error)
      }
    }
    // Cadangan TERAKHIR (opsional, default mati, hanya unduhan): sumber pihak ketiga, dengan verifikasi yang sama ketatnya.
    // Hanya bila plugin sungguh tidak menemukan yang cocok; gangguan jaringan / timeout diulang pemanggil, bukan dialihkan.
    if (options.thirdParty && strict && spotifyUrl && !hadFailure && !options.signal?.aborted) {
      const fallback = await resolveViaThirdParty(wanted, spotifyUrl, { signal: options.signal, expected, avoid: options.avoid })
      if (fallback.info) return { info: fallback.info, outcome: 'ok' }
      if (fallback.sawCandidate) sawCandidate = true
    }
    // Gagal nyata (jaringan / stream tak terbaca) dibedakan dari "ada kandidat tetapi semuanya ditolak" dan "tidak ada".
    return { info: null, outcome: hadFailure ? 'failed' : sawCandidate ? 'rejected' : 'nomatch' }
  } finally {
    clearTimeout(budget)
    options.signal?.removeEventListener('abort', forward)
  }
}

/**
 * Sumber pihak ketiga (lihat thirdParty.ts). Hasilnya DIVERIFIKASI seperti plugin: audio terbaca di WebView, bukan klip,
 * judul + artis cocok dengan lagu di playlist, dan durasi file sangat dekat dengan durasi playlist. Tidak di-cache
 * (URL bertoken).
 */
async function resolveViaThirdParty(
  wanted: WantedTrack,
  spotifyUrl: string,
  options: { signal?: AbortSignal; expected: number | null; avoid?: ReadonlyArray<string> },
): Promise<{ info: PlaybackInfo | null; sawCandidate: boolean }> {
  let sawCandidate = false
  for (const source of THIRD_PARTY_SOURCES) {
    if (options.signal?.aborted) break
    if (options.avoid?.includes(`plugin:${source.id}`)) continue
    try {
      const found = await source.fetch(spotifyUrl, options.signal)
      sawCandidate = true
      const actual = await probeAudioDuration(found.audioUrl, probeTimeoutMs(true), options.signal)
      if (actual === null || isLikelyClip(actual, options.expected)) continue
      const info: PlaybackInfo = {
        title: found.title,
        artist: found.artist,
        album: found.album,
        duration: formatClock(actual),
        cover: found.cover,
        spotifyUrl,
        audioUrl: found.audioUrl,
        source: `plugin:${source.id}`,
        apiSource: 'plugin',
        probedDuration: actual,
        directUrl: found.audioUrl,
      }
      const problem = strictProblem(wanted, info, actual, options.expected)
      if (problem) {
        console.warn(`[MusicVerse] ${source.name} ditolak untuk unduhan: ${problem}`)
        continue
      }
      console.info(`[MusicVerse] ${source.name}: "${found.title}", ${actual.toFixed(1)} dtk`)
      return { info, sawCandidate }
    } catch (error) {
      if (options.signal?.aborted) break
      console.warn(`[MusicVerse] ${source.name} gagal:`, error)
    }
  }
  return { info: null, sawCandidate }
}

/* ---------------- pilih manual ---------------- */

const MANUAL_RESULTS = 5

/**
 * Sampai 5 hasil pencarian (YouTube Music dan YouTube bergantian, tanpa duplikat) untuk dipilih pengguna bila pencarian
 * otomatis gagal. Melempar bila SEMUA sumber tidak bisa dihubungi; sebagian gagal tidak apa-apa.
 */
export async function searchManualCandidates(track: { title: string; artists?: string }, signal?: AbortSignal): Promise<ManualCandidate[]> {
  const artists = track.artists ?? ''
  const query = [stripArtistPrefix(track.title, artists), artists.split(/\s*[,&;]\s*/)[0]].filter(Boolean).join(' ')
  const disabled = readDisabled()
  const active = plugins().filter((plugin) => !disabled.includes(plugin.id))
  const settled = await Promise.allSettled(active.map(async (plugin) => ({ plugin, hits: await plugin.search(query, signal) })))
  const lists: ManualCandidate[][] = []
  for (const result of settled) {
    if (result.status !== 'fulfilled') continue
    const { plugin, hits } = result.value
    lists.push(hits.map((hit) => ({ ...hit, pluginId: plugin.id, pluginName: plugin.name })))
  }
  if (lists.length === 0) throw new Error('Pencarian tidak bisa dihubungi. Periksa koneksi lalu coba lagi.')
  const out: ManualCandidate[] = []
  const seen = new Set<string>()
  for (let round = 0; out.length < MANUAL_RESULTS; round += 1) {
    let any = false
    for (const list of lists) {
      const hit = list[round]
      if (!hit) continue
      any = true
      const id = `${hit.pluginId}:${hit.id}`
      if (seen.has(id) || out.length >= MANUAL_RESULTS) continue
      seen.add(id)
      out.push(hit)
    }
    if (!any) break
  }
  return out
}

/**
 * Mengambil stream untuk hasil yang DIPILIH pengguna. Pengguna yang menentukan, jadi TIDAK ada pemeriksaan judul, artis,
 * maupun durasi (baik terhadap playlist maupun terhadap hasil pencarian): audionya dipakai apa adanya. Satu-satunya
 * syarat: ada stream yang bisa diambil. Stream yang metadatanya terbaca didahulukan; bila tidak ada yang terbaca di
 * WebView (mis. ditolak CDN untuk <audio> tetapi bisa diunduh native), stream pertama tetap dipakai.
 */
export async function resolveManualPick(
  pick: ManualPick,
  options: { signal?: AbortSignal; quality?: DownloadQuality },
): Promise<PluginResolveResult> {
  const plugin = plugins().find((p) => p.id === pick.pluginId)
  if (!plugin) return { info: null, outcome: 'nomatch' }
  if (options.signal?.aborted) return { info: null, outcome: 'aborted' }
  const inner = new AbortController()
  const forward = () => inner.abort()
  options.signal?.addEventListener('abort', forward, { once: true })
  const budget = setTimeout(() => inner.abort(), PLUGIN_BUDGET_STRICT_MS)
  const signal = inner.signal
  try {
    const streams = orderStreamsForQuality(await plugin.getStreams(pick.id, signal), options.quality ?? DEFAULT_DOWNLOAD_QUALITY).slice(
      0,
      MAX_STREAMS_PER_CANDIDATE,
    )
    // Tidak ada stream sama sekali: gangguan sesaat (diulang pemanggil), bukan "lagu tidak ada".
    if (streams.length === 0) return { info: null, outcome: 'failed' }
    let fallback: PlaybackInfo | null = null
    for (const stream of streams) {
      const playable = await toPlayableUrl(stream)
      const actual = await probeAudioDuration(playable, probeTimeoutMs(true), signal)
      if (signal.aborted) return { info: null, outcome: options.signal?.aborted ? 'aborted' : 'timeout' }
      const info: PlaybackInfo = {
        title: pick.title,
        artist: pick.artist,
        album: pick.album,
        duration: formatClock(actual ?? pick.durationSec),
        cover: pick.cover,
        spotifyUrl: '',
        audioUrl: playable,
        source: `plugin:${plugin.id}`,
        apiSource: 'plugin',
        probedDuration: actual ?? undefined,
        directUrl: stream.url,
        directUserAgent: stream.headers?.['User-Agent'],
        manualPick: true,
      }
      // Durasi tidak dibandingkan dengan apa pun: terbaca = langsung dipakai.
      if (actual !== null) return { info, outcome: 'ok' }
      fallback ??= info
    }
    return { info: fallback, outcome: 'ok' }
  } catch (error) {
    if (signal.aborted) return { info: null, outcome: options.signal?.aborted ? 'aborted' : 'timeout' }
    console.warn(`[MusicVerse] Pilihan manual gagal (${plugin.id}):`, error)
    return { info: null, outcome: 'failed' }
  } finally {
    clearTimeout(budget)
    options.signal?.removeEventListener('abort', forward)
  }
}

/**
 * Menyiapkan link stream lagu berikutnya di latar belakang (hasil masuk cache), sehingga saat lagu
 * berganti tidak ada lagi jeda mencari/mengambil link. Aman dipanggil berkali-kali.
 */
export function warmResolve(wanted: WantedTrack, expected: number | null): void {
  if (cacheGet(cacheKey(wanted))) return
  // Lagu dengan pilihan manual tidak dihangatkan lewat pencarian otomatis (hasilnya tidak dipakai).
  if (getManualPin(wanted)) return
  // Beri waktu lagu yang sedang dimuat menyelesaikan permintaannya lebih dulu.
  setTimeout(() => {
    void resolveViaPlugins(wanted, { expected })
  }, 2_500)
}
