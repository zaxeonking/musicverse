import { Directory, Filesystem } from '@capacitor/filesystem'
import { fetchPlaybackInfo, SpotifyApiError } from '../services/spotifyApi'
import type { PlaybackInfo, PlaylistTrack } from '../types/spotify'
import { isLikelyClip, strictDurationProblem } from '../utils/clipDetect'
import { parseDuration } from '../utils/formatTime'
import { probeAudioDuration } from '../utils/probeAudio'
import { isSafeHttpUrl } from '../utils/spotifyUrl'
import { MusicVerseNative } from './musicVerseNative'
import { fetchAndSaveLyrics } from './offlineLyrics'
import {
  COVER_DIR,
  DOWNLOAD_DIR,
  MIN_VALID_BYTES,
  getOfflineState,
  writeMeta,
  isTooSmallForDuration,
  srcFor,
  setCellular,
  setChargingOnly,
  setItems,
  setPaused,
  setRestored,
  setTransfer,
  setUnplugged,
  setWifiOnly,
  trackKey,
  type DownloadedTrack,
} from './offline'
import { isNativeApp } from './platform'
import { onConnectionChange, readCharging, readConnectionType } from './connection'
import { readJson, removeKey, writeJson } from '../utils/safeStorage'

/**
 * Pengunduh lagu untuk diputar offline. Satu unduhan sekali jalan (antrean), supaya tidak membebani
 * jaringan dan API. URL audio diambil lewat `fetchPlaybackInfo` yang sama dengan pemutaran, jadi
 * hanya lagu penuh yang lolos pemeriksaan durasi/judul yang disimpan (klip 30 detik ditolak).
 *
 * Progres: di tab Unduhan dan di satu notifikasi sistem untuk seluruh antrean.
 *
 * BATAS: unduhan berjalan di dalam proses aplikasi. Selama musik diputar (foreground service aktif),
 * proses aman; jika aplikasi ditutup paksa atau dimatikan sistem saat mengunduh, unduhan terhenti
 * dan harus diulang (berkas `.part` dibersihkan saat unduhan berikutnya).
 */

interface Job {
  track: PlaylistTrack
  key: string
}

const queue: Job[] = []
let running = false
let progressInstalled = false
/** URL yang sedang diunduh -> lagu, untuk memetakan event progress. */
const activeUrls = new Map<string, { key: string; title: string; total: number }>()

/** Berkas lagu wajar: antara ~88 kbps dan ~336 kbps. Di luar itu hampir pasti bukan lagu yang dimaksud (potongan / berkas lain). */
const MIN_BYTES_PER_SEC_STRICT = 11_000
const MAX_BYTES_PER_SEC_STRICT = 42_000
/** Selisih maksimum (detik) antara durasi sumber sebelum diunduh dan durasi berkas hasil unduhan. */
const REMOTE_LOCAL_DRIFT_S = 3

// Hitungan satu "sesi" antrean untuk notifikasi: "Mengunduh 2 dari 12".
let sessionTotal = 0
let sessionDone = 0
let sessionFailed = 0
/** Naik tiap sesi antrean selesai; dipakai agar "coba lagi" tidak mengurangi hitungan gagal sesi yang sudah lewat. */
let sessionEpoch = 0
/** Unduhan yang gagal, disimpan agar bisa dicoba lagi tanpa membuka playlist asalnya. */
const failedJobs = new Map<string, { job: Job; epoch: number }>()
/** Lagu yang sedang diunduh (sudah keluar dari `queue`); ikut disimpan agar tidak hilang bila aplikasi ditutup. */
let current: Job | null = null
let restoring = false

const QUEUE_KEY = 'musicverse:download-queue:v1'
const SETTINGS_KEY = 'musicverse:download-settings:v1'
const NET_POLL_MS = 4_000

/** Menyimpan antrean (termasuk yang sedang berjalan) dan daftar gagal ke penyimpanan perangkat. */
function persistQueue(): void {
  if (restoring) return
  const pending = [...(current ? [current.track] : []), ...queue.map((job) => job.track)]
  const failed = [...failedJobs.values()].map(({ job }) => ({
    track: job.track,
    message: getOfflineState().transfers.get(job.key)?.message ?? 'Unduhan gagal.',
  }))
  if (pending.length === 0 && failed.length === 0) removeKey(QUEUE_KEY)
  else writeJson(QUEUE_KEY, { version: 1, queue: pending, failed })
}

function asTrack(value: unknown): PlaylistTrack | null {
  if (typeof value !== 'object' || value === null) return null
  const v = value as Record<string, unknown>
  const str = (x: unknown) => (typeof x === 'string' ? x : '')
  if (!str(v.title).trim()) return null
  return {
    id: str(v.id) || `restored-${Math.random().toString(36).slice(2, 10)}`,
    title: str(v.title),
    artists: str(v.artists),
    album: str(v.album),
    duration: str(v.duration),
    url: str(v.url),
    cover: str(v.cover),
  }
}

/**
 * Memperbarui syarat unduhan yang menyala: koneksi seluler ("hanya Wi-Fi") dan lepas cas ("hanya saat dicas").
 * Yang tidak bisa dibaca ('unknown' / null) TIDAK dianggap melanggar syarat, jadi tidak memblokir unduhan.
 */
async function refreshConditions(): Promise<void> {
  const s = getOfflineState()
  if (s.wifiOnly) setCellular((await readConnectionType()) === 'cellular')
  if (s.chargingOnly) setUnplugged((await readCharging()) === false)
}

/** Alasan unduhan ditahan sekarang ('wifi' | 'charging' | keduanya), atau kosong bila boleh jalan. Membaca ulang dulu. */
async function conditionsBlocked(): Promise<boolean> {
  const s = getOfflineState()
  if (!s.wifiOnly && !s.chargingOnly) return false
  await refreshConditions()
  return isHeldByConditions()
}

function isHeldByConditions(): boolean {
  const s = getOfflineState()
  return (s.wifiOnly && s.cellular) || (s.chargingOnly && s.unplugged)
}

/** Teks syarat yang belum terpenuhi untuk label dan notifikasi. */
function heldReason(): string {
  const s = getOfflineState()
  const wifi = s.wifiOnly && s.cellular
  const charge = s.chargingOnly && s.unplugged
  if (wifi && charge) return 'Wi-Fi dan cas'
  return wifi ? 'Wi-Fi' : 'cas'
}

/** Melanjutkan antrean otomatis bila tidak ada lagi yang menahannya (jeda manual atau syarat belum terpenuhi). */
function maybeAutoStart(): void {
  const s = getOfflineState()
  if (queue.length > 0 && !running && !s.paused && !isHeldByConditions()) void pump()
}

let netTimer = 0
function updateWatch(): void {
  const s = getOfflineState()
  if (!s.wifiOnly && !s.chargingOnly) {
    window.clearInterval(netTimer)
    netTimer = 0
    return
  }
  if (netTimer) return
  netTimer = window.setInterval(() => {
    if (queue.length === 0 && !running) return
    void refreshConditions().then(maybeAutoStart)
  }, NET_POLL_MS)
}
let notifyAt = 0
let notifyPermissionAsked = false

function notify(title: string, text: string, percent: number | null, done = false, force = false): void {
  if (!isNativeApp()) return
  const now = Date.now()
  if (!force && now - notifyAt < 600) return
  notifyAt = now
  MusicVerseNative.showDownloadProgress({ title, text, percent, done }).catch(() => {
    // Izin notifikasi ditolak / plugin tidak ada: progres tetap tampil di dalam aplikasi.
  })
}

function sessionLine(): string {
  return sessionTotal > 1 ? `Lagu ${Math.min(sessionDone + sessionFailed + 1, sessionTotal)} dari ${sessionTotal}` : 'Mengunduh lagu'
}

function installProgressListener(): void {
  if (progressInstalled) return
  progressInstalled = true
  void Filesystem.addListener('progress', (event) => {
    const active = activeUrls.get(event.url)
    if (!active) return
    if (event.contentLength > 0) active.total = event.contentLength
    const known = event.contentLength > 0
    const percent = known ? Math.min(100, Math.round((event.bytes / event.contentLength) * 100)) : null
    setTransfer(active.key, {
      key: active.key,
      title: active.title,
      status: 'downloading',
      percent,
      bytes: event.bytes,
      total: known ? event.contentLength : undefined,
    })
    notify(active.title, sessionLine(), percent)
  })
}

function errorText(error: unknown): string {
  if (error instanceof SpotifyApiError) return error.message
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'object' && error !== null && 'message' in error && typeof (error as { message: unknown }).message === 'string') {
    return (error as { message: string }).message
  }
  return 'Unduhan gagal.'
}

async function safeDelete(path: string): Promise<void> {
  try {
    await Filesystem.deleteFile({ path, directory: Directory.External })
  } catch {
    // Tidak ada.
  }
}

/** Pastikan folder tujuan ada. `recursive` pada downloadFile tidak selalu membuatnya, dan itu penyebab "Error downloading file". */
async function ensureDir(path: string): Promise<void> {
  try {
    await Filesystem.mkdir({ path, directory: Directory.External, recursive: true })
  } catch {
    // Sudah ada (error "exists" diabaikan); jika benar-benar gagal, downloadFile yang melaporkan.
  }
}

interface DownloadProblem {
  reason: string
  /** Gangguan jaringan (unduhan terpotong): sumber yang sama boleh dicoba sekali lagi. */
  retrySame?: boolean
}

/** Membaca durasi berkas lokal; dicoba beberapa kali dengan batas waktu makin panjang (WebView kadang lambat). */
async function probeLocal(path: string): Promise<number | null> {
  const src = await srcFor(path)
  for (const timeout of [10_000, 15_000, 20_000]) {
    const value = await probeAudioDuration(src, timeout)
    if (value !== null) return value
  }
  return null
}

/**
 * null = berkas sah. Pemeriksaan KETAT, semuanya harus lolos sebelum berkas disimpan:
 *  1. ukuran minimal dan tidak terpotong (sama dengan Content-Length dari server);
 *  2. durasi berkas lokal terbaca dan sangat dekat dengan lagu di playlist (dua arah: pendek maupun panjang);
 *  3. durasi berkas sama dengan durasi sumber yang dibaca sebelum diunduh (berkas tidak berubah/terpotong);
 *  4. laju bit wajar untuk durasinya (menangkap cuplikan / berkas lain walau durasi tak terbaca).
 * Berkas yang tidak bisa diverifikasi TIDAK disimpan.
 */
async function checkDownloaded(
  path: string,
  bytes: number,
  expected: number | null,
  remoteDuration: number | undefined,
  declaredBytes: number,
): Promise<DownloadProblem | null> {
  if (bytes < MIN_VALID_BYTES) return { reason: 'Berkas yang terunduh tidak valid (terlalu kecil).' }
  if (declaredBytes > 0 && bytes < declaredBytes * 0.99) {
    return { reason: `Unduhan terpotong (${bytes} dari ${declaredBytes} byte).`, retrySame: true }
  }
  if (isTooSmallForDuration(bytes, expected)) return { reason: 'Berkas yang terunduh terlalu kecil untuk durasi lagu, kemungkinan cuplikan.' }

  let actual: number | null = null
  try {
    actual = await probeLocal(path)
  } catch {
    // Dianggap tak terbaca; ditangani di bawah.
  }

  if (actual !== null) {
    const problem = strictDurationProblem(actual, expected)
    if (problem) return { reason: problem }
    if (isLikelyClip(actual, expected)) return { reason: `Durasi audio (${Math.round(actual)} dtk) menunjukkan cuplikan.` }
    if (remoteDuration !== undefined && Math.abs(actual - remoteDuration) > REMOTE_LOCAL_DRIFT_S) {
      return {
        reason: `Durasi berkas (${Math.round(actual)} dtk) tidak sama dengan sumbernya (${Math.round(remoteDuration)} dtk), unduhan tidak utuh.`,
        retrySame: true,
      }
    }
  }

  // Durasi dipakai juga untuk memeriksa laju bit; jika tak terbaca, durasi dari playlist yang jadi acuan.
  const reference = actual ?? expected
  if (reference === null || reference <= 0) {
    return { reason: 'Durasi lagu tidak diketahui dan berkas tidak bisa diverifikasi.' }
  }
  if (actual === null) {
    console.warn('[MusicVerse] Durasi berkas tidak terbaca; diverifikasi lewat ukuran dan laju bit saja.')
  }
  const rate = bytes / reference
  if (rate < MIN_BYTES_PER_SEC_STRICT || rate > MAX_BYTES_PER_SEC_STRICT) {
    return { reason: `Ukuran berkas tidak wajar untuk durasinya (${Math.round((rate * 8) / 1000)} kbps), kemungkinan bukan lagu yang dimaksud.` }
  }
  return null
}

/** Gangguan jaringan saat unduh: dicoba lagi sampai sekian kali (jeda naik bertahap), lalu menyerah dengan pesan sinyal jelek. */
const NET_RETRY_MAX = 6
const NET_RETRY_DELAY_MS = 2_000
const NET_RETRY_MAX_DELAY_MS = 10_000
const OFFLINE_WAIT_MS = 60_000
/** Berkas tidak cocok (klip / durasi / judul beda) di semua sumber: semua sumber dicoba lagi dari awal sampai sekian putaran, karena server sering memberi berkas yang benar di percobaan berikutnya. */
const MISMATCH_ROUNDS_MAX = 5
const MISMATCH_RETRY_DELAY_MS = 1_500
const BAD_SIGNAL_TEXT = 'Sinyal jelek, unduhan gagal. Coba lagi saat koneksi lebih baik.'

const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms))

/** Menunggu jeda coba ulang; bila perangkat offline, menunggu sampai online lagi (maks. 1 menit). */
async function waitBeforeRetry(attempt: number): Promise<void> {
  await sleep(Math.min(NET_RETRY_MAX_DELAY_MS, NET_RETRY_DELAY_MS * attempt))
  const until = Date.now() + OFFLINE_WAIT_MS
  while (typeof navigator !== 'undefined' && navigator.onLine === false && Date.now() < until) await sleep(1_000)
}

/** Kegagalan yang bukan gangguan sesaat (lagu tanpa audio / hanya klip / dibatalkan): tidak dicoba ulang. */
function isTransientApiError(error: unknown): boolean {
  if (!(error instanceof SpotifyApiError)) return true
  return error.code !== 'no_audio' && error.code !== 'clip_only' && error.code !== 'aborted'
}

async function downloadOne({ track, key }: Job): Promise<void> {
  const title = track.title
  setTransfer(key, { key, title, status: 'resolving', percent: null })
  notify(title, sessionLine(), null, false, true)
  await ensureDir(DOWNLOAD_DIR)
  await ensureDir(COVER_DIR)

  const fileName = `${key}.mp3`
  const finalPath = `${DOWNLOAD_DIR}/${fileName}`
  // Berakhiran .mp3 supaya durasinya bisa dibaca sebelum berkas dianggap sah.
  const partPath = `${DOWNLOAD_DIR}/${key}.part.mp3`
  const expected = parseDuration(track.duration)
  const avoid: Array<'kyzz' | 'cadangan'> = []
  let netFailures = 0
  let mismatchRounds = 0

  // Unduhan HARUS cocok dengan data lagu di playlist: judul + artis (dicek saat memilih sumber) dan durasi
  // (dicek dari berkas yang benar-benar terunduh). Berkas yang tidak cocok dibuang dan sumber lain dicoba.
  let info: PlaybackInfo
  let size = 0
  for (;;) {
    await safeDelete(partPath)
    setTransfer(key, { key, title, status: 'resolving', percent: null })
    try {
      info = await fetchPlaybackInfo(track, { strict: true, avoid })
    } catch (error) {
      // Semua sumber ditolak karena tidak cocok dengan lagunya: putaran baru, sumber dicoba lagi dari awal.
      if (error instanceof SpotifyApiError && error.code === 'clip_only') {
        mismatchRounds += 1
        console.warn(`[MusicVerse] Semua sumber tidak cocok (putaran ${mismatchRounds}/${MISMATCH_ROUNDS_MAX}):`, error)
        if (mismatchRounds > MISMATCH_ROUNDS_MAX) throw error
        avoid.length = 0
        await sleep(MISMATCH_RETRY_DELAY_MS)
        continue
      }
      if (!isTransientApiError(error)) throw error
      netFailures += 1
      console.warn(`[MusicVerse] Gagal mengambil sumber unduhan (percobaan ${netFailures}/${NET_RETRY_MAX}):`, error)
      if (netFailures > NET_RETRY_MAX) throw new Error(BAD_SIGNAL_TEXT)
      await waitBeforeRetry(netFailures)
      continue
    }
    if (!isSafeHttpUrl(info.audioUrl)) throw new Error('Sumber audio tidak valid.')

    setTransfer(key, { key, title, status: 'downloading', percent: null })
    const active = { key, title, total: 0 }
    activeUrls.set(info.audioUrl, active)
    let downloadError: unknown = null
    try {
      await Filesystem.downloadFile({
        url: info.audioUrl,
        path: partPath,
        directory: Directory.External,
        recursive: true,
        progress: true,
      })
    } catch (error) {
      downloadError = error ?? new Error('Unduhan terputus.')
    } finally {
      activeUrls.delete(info.audioUrl)
    }
    if (downloadError) {
      // Koneksi putus / lambat di tengah unduhan: buang sisa, lalu coba lagi (sumber sama, URL baru).
      netFailures += 1
      console.warn(`[MusicVerse] Unduhan terputus (percobaan ${netFailures}/${NET_RETRY_MAX}):`, downloadError)
      await safeDelete(partPath)
      if (netFailures > NET_RETRY_MAX) throw new Error(BAD_SIGNAL_TEXT)
      await waitBeforeRetry(netFailures)
      continue
    }

    const stat = await Filesystem.stat({ path: partPath, directory: Directory.External })
    const problem = await checkDownloaded(partPath, stat.size, expected, info.probedDuration, active.total)
    if (!problem) {
      size = stat.size
      break
    }
    await safeDelete(partPath)
    const api = info.apiSource
    console.warn(`[MusicVerse] Unduhan dari ${api ?? 'sumber tak dikenal'} ditolak: ${problem.reason}`)
    // Unduhan terpotong karena jaringan: ulangi sumber yang sama beberapa kali sebelum menyerah (sinyal jelek).
    if (problem.retrySame) {
      netFailures += 1
      if (netFailures > NET_RETRY_MAX) throw new Error(BAD_SIGNAL_TEXT)
      await waitBeforeRetry(netFailures)
      continue
    }
    // Berkas tidak cocok: singkirkan sumber itu dan coba sumber lain. Bila semua sudah dicoba, ulangi dari awal
    // (maks. MISMATCH_ROUNDS_MAX putaran) sebelum menyerah.
    if (api && !avoid.includes(api)) {
      avoid.push(api)
    } else {
      mismatchRounds += 1
      if (mismatchRounds > MISMATCH_ROUNDS_MAX) throw new Error(problem.reason)
      avoid.length = 0
      await sleep(MISMATCH_RETRY_DELAY_MS)
    }
  }

  await safeDelete(finalPath)
  await Filesystem.rename({ from: partPath, to: finalPath, directory: Directory.External, toDirectory: Directory.External })

  // Sampul: usaha terbaik; gagal = pakai sampul bawaan.
  let coverFileName: string | undefined
  const coverUrl = track.cover || info.cover
  if (isSafeHttpUrl(coverUrl)) {
    const coverPath = `${COVER_DIR}/${key}.jpg`
    try {
      await Filesystem.downloadFile({ url: coverUrl, path: coverPath, directory: Directory.External, recursive: true })
      coverFileName = `${key}.jpg`
    } catch {
      await safeDelete(coverPath)
    }
  }

  const entry: DownloadedTrack = {
    key,
    title: track.title,
    artists: track.artists,
    album: track.album,
    duration: track.duration,
    url: track.url,
    cover: track.cover,
    fileName,
    coverFileName,
    bytes: size,
    savedAt: Date.now(),
  }
  setItems([entry, ...getOfflineState().items.filter((item) => item.key !== key)])
  void writeMeta(entry)
  setTransfer(key, null)
  // Lirik ikut disimpan supaya tampil offline. Usaha terbaik di latar belakang; gagal tidak memengaruhi unduhan
  // (nanti dicoba lagi oleh backfill / saat lirik dibuka).
  void fetchAndSaveLyrics(track, key)
}

function finishSession(): void {
  const ok = sessionDone
  const failed = sessionFailed
  if (ok + failed === 0) return
  const text =
    failed === 0
      ? ok === 1
        ? '1 lagu selesai diunduh'
        : `${ok} lagu selesai diunduh`
      : `${ok} selesai, ${failed} gagal. Buka Unduhan untuk melihat.`
  notify('Unduhan selesai', text, null, true, true)
  sessionTotal = 0
  sessionDone = 0
  sessionFailed = 0
  sessionEpoch += 1
}

async function pump(): Promise<void> {
  if (running) return
  running = true
  installProgressListener()
  try {
    // Dijeda atau (mode hanya Wi-Fi) sedang seluler: lagu yang sedang berjalan diselesaikan dulu, berikutnya tidak dimulai.
    while (!getOfflineState().paused && !(await conditionsBlocked())) {
      const job = queue.shift()
      if (!job) break
      current = job
      try {
        await downloadOne(job)
        sessionDone += 1
        failedJobs.delete(job.key)
      } catch (error) {
        console.warn('[MusicVerse] Unduhan gagal:', error)
        sessionFailed += 1
        failedJobs.set(job.key, { job, epoch: sessionEpoch })
        setTransfer(job.key, { key: job.key, title: job.track.title, status: 'error', percent: null, message: errorText(error) })
      }
      current = null
      persistQueue()
    }
  } finally {
    running = false
    current = null
    const s = getOfflineState()
    if (queue.length > 0 && s.paused) {
      notify('Unduhan dijeda', `${queue.length} lagu menunggu. Buka Unduhan untuk melanjutkan.`, null, true, true)
    } else if (queue.length > 0 && isHeldByConditions()) {
      const why = heldReason()
      notify(`Menunggu ${why}`, `${queue.length} lagu menunggu. Lanjut otomatis saat ${why === 'cas' ? 'HP dicas' : why === 'Wi-Fi' ? 'tersambung Wi-Fi' : 'tersambung Wi-Fi dan dicas'}.`, null, true, true)
    } else {
      // Antrean habis: jeda tidak boleh "menempel" ke unduhan berikutnya.
      setPaused(false)
      setRestored(0)
      finishSession()
    }
  }
}

export type EnqueueResult = 'queued' | 'already' | 'busy' | 'unsupported'

function enqueue(track: PlaylistTrack): EnqueueResult {
  const key = trackKey(track)
  const state = getOfflineState()
  if (state.items.some((item) => item.key === key)) return 'already'
  const current = state.transfers.get(key)
  if (current && current.status !== 'error') return 'busy'
  queue.push({ track, key })
  sessionTotal += 1
  setTransfer(key, { key, title: track.title, status: 'queued', percent: null })
  persistQueue()
  return 'queued'
}

function askNotificationPermissionOnce(): void {
  if (notifyPermissionAsked) return
  notifyPermissionAsked = true
  // Android 13+: tanpa izin notifikasi, progres hanya tampil di dalam aplikasi.
  MusicVerseNative.requestNotificationPermission().catch(() => undefined)
}

/** Menambahkan lagu ke antrean unduhan. */
export function downloadTrack(track: PlaylistTrack): EnqueueResult {
  if (!isNativeApp()) return 'unsupported'
  const result = enqueue(track)
  if (result === 'queued') {
    askNotificationPermissionOnce()
    void pump()
  }
  return result
}

export interface BulkEnqueueResult {
  queued: number
  already: number
  busy: number
  unsupported: boolean
}

/** Mengunduh banyak lagu sekaligus (satu playlist). Lagu yang sudah diunduh atau sedang diproses dilewati. */
export function downloadTracks(tracks: readonly PlaylistTrack[]): BulkEnqueueResult {
  const out: BulkEnqueueResult = { queued: 0, already: 0, busy: 0, unsupported: false }
  if (!isNativeApp()) return { ...out, unsupported: true }
  for (const track of tracks) {
    const result = enqueue(track)
    if (result === 'queued') out.queued += 1
    else if (result === 'already') out.already += 1
    else if (result === 'busy') out.busy += 1
  }
  if (out.queued > 0) {
    askNotificationPermissionOnce()
    void pump()
  }
  return out
}

/** Teks toast untuk hasil `downloadTracks`. */
export function bulkDownloadText(result: BulkEnqueueResult): string {
  if (result.unsupported) return 'Unduhan hanya tersedia di aplikasi Android'
  if (result.queued === 0) return result.already > 0 ? 'Semua lagu sudah diunduh' : 'Lagu sedang diunduh'
  const skipped = result.already + result.busy
  return `Mengunduh ${result.queued} lagu${skipped > 0 ? ` (${skipped} dilewati)` : ''}. Lihat progres di notifikasi atau tab Unduhan`
}

/** Membatalkan unduhan yang masih mengantre (yang sudah berjalan tidak bisa dibatalkan). */
export function cancelQueued(key: string): void {
  const index = queue.findIndex((job) => job.key === key)
  if (index !== -1) {
    queue.splice(index, 1)
    sessionTotal = Math.max(0, sessionTotal - 1)
  }
  setTransfer(key, null)
  if (queue.length === 0 && !running) {
    setPaused(false)
    setRestored(0)
  }
  persistQueue()
}

export function dismissTransferError(key: string): void {
  failedJobs.delete(key)
  setTransfer(key, null)
  persistQueue()
}

/** Jumlah unduhan gagal yang masih bisa dicoba lagi. */
export function failedCount(): number {
  return failedJobs.size
}

/** Mencoba lagi satu unduhan yang gagal. false jika datanya sudah tidak ada. */
export function retryDownload(key: string): boolean {
  const entry = failedJobs.get(key)
  if (!entry) return false
  failedJobs.delete(key)
  // Gagal yang sudah dihitung di sesi berjalan dicabut; sesi yang sudah selesai tidak diubah.
  if (entry.epoch === sessionEpoch) sessionFailed = Math.max(0, sessionFailed - 1)
  const result = enqueue(entry.job.track)
  if (result === 'queued') {
    askNotificationPermissionOnce()
    void pump()
  }
  persistQueue()
  return result === 'queued'
}

/** Mencoba lagi semua unduhan yang gagal. Mengembalikan jumlah yang dimasukkan ke antrean. */
export function retryAllFailed(): number {
  let count = 0
  for (const key of [...failedJobs.keys()]) if (retryDownload(key)) count += 1
  return count
}

/** Menjeda antrean: lagu yang sedang diunduh diselesaikan dulu (unduhan berjalan tidak bisa dihentikan di tengah), sisanya menunggu. */
export function pauseDownloads(): void {
  if (queue.length === 0) return
  setPaused(true)
}

/** Melanjutkan antrean yang dijeda. */
export function resumeDownloads(): void {
  setPaused(false)
  setRestored(0)
  void pump()
}

/** Menyalakan/mematikan "Unduh hanya lewat Wi-Fi" (disimpan di perangkat). */
export function setWifiOnlyEnabled(on: boolean): void {
  setWifiOnly(on)
  saveSettings()
  if (!on) setCellular(false)
  updateWatch()
  void refreshConditions().then(maybeAutoStart)
}

/** Menyalakan/mematikan "Unduh hanya saat dicas" (disimpan di perangkat). */
export function setChargingOnlyEnabled(on: boolean): void {
  setChargingOnly(on)
  saveSettings()
  if (!on) setUnplugged(false)
  updateWatch()
  void refreshConditions().then(maybeAutoStart)
}

function saveSettings(): void {
  const s = getOfflineState()
  writeJson(SETTINGS_KEY, { wifiOnly: s.wifiOnly, chargingOnly: s.chargingOnly })
}

/**
 * Dipanggil sekali saat start (setelah indeks unduhan siap): memuat pengaturan, memantau perubahan koneksi, dan
 * memulihkan antrean + daftar gagal dari sesi sebelumnya. Antrean yang dipulihkan DIJEDA dulu (tidak langsung
 * memakai data); pengguna menekan "Lanjutkan unduhan".
 */
export function initDownloads(): void {
  if (!isNativeApp()) return
  const settings = readJson(SETTINGS_KEY)
  if (settings.status === 'ok' && typeof settings.value === 'object' && settings.value !== null) {
    const saved = settings.value as { wifiOnly?: unknown; chargingOnly?: unknown }
    if (saved.wifiOnly === true) setWifiOnly(true)
    if (saved.chargingOnly === true) setChargingOnly(true)
    updateWatch()
    void refreshConditions()
  }
  onConnectionChange(() => {
    if (!getOfflineState().wifiOnly) return
    void refreshConditions().then(maybeAutoStart)
  })

  const saved = readJson(QUEUE_KEY)
  if (saved.status !== 'ok' || typeof saved.value !== 'object' || saved.value === null) return
  const data = saved.value as { queue?: unknown; failed?: unknown }
  restoring = true
  try {
    const have = new Set(getOfflineState().items.map((item) => item.key))
    if (Array.isArray(data.failed)) {
      for (const entry of data.failed) {
        const track = asTrack((entry as { track?: unknown } | null)?.track)
        if (!track) continue
        const key = trackKey(track)
        if (have.has(key) || failedJobs.has(key)) continue
        const message = typeof (entry as { message?: unknown }).message === 'string' ? (entry as { message: string }).message : 'Unduhan gagal.'
        failedJobs.set(key, { job: { track, key }, epoch: sessionEpoch })
        setTransfer(key, { key, title: track.title, status: 'error', percent: null, message })
      }
    }
    let restored = 0
    if (Array.isArray(data.queue)) {
      for (const value of data.queue) {
        const track = asTrack(value)
        if (!track) continue
        const key = trackKey(track)
        if (have.has(key) || failedJobs.has(key) || getOfflineState().transfers.has(key)) continue
        queue.push({ track, key })
        sessionTotal += 1
        restored += 1
        setTransfer(key, { key, title: track.title, status: 'queued', percent: null })
      }
    }
    if (restored > 0) {
      setPaused(true)
      setRestored(restored)
    }
  } finally {
    restoring = false
  }
  persistQueue()
}
