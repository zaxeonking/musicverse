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
  setItems,
  setTransfer,
  trackKey,
  type DownloadedTrack,
} from './offline'
import { isNativeApp } from './platform'

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
}

async function pump(): Promise<void> {
  if (running) return
  running = true
  installProgressListener()
  try {
    for (let job = queue.shift(); job; job = queue.shift()) {
      try {
        await downloadOne(job)
        sessionDone += 1
      } catch (error) {
        console.warn('[MusicVerse] Unduhan gagal:', error)
        sessionFailed += 1
        setTransfer(job.key, { key: job.key, title: job.track.title, status: 'error', percent: null, message: errorText(error) })
      }
    }
  } finally {
    running = false
    finishSession()
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
}

export function dismissTransferError(key: string): void {
  setTransfer(key, null)
}
