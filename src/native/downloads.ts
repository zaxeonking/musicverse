import { Directory, Filesystem } from '@capacitor/filesystem'
import { avoidKeyOf, fetchPlaybackInfo, SpotifyApiError } from '../services/spotifyApi'
import { isDownloadQuality, type DownloadQuality } from '../plugins/quality'
import { forgetResolved, isNativeUnimplemented } from '../plugins/registry'
import type { ApiSourceName, PlaybackInfo, PlaylistTrack } from '../types/spotify'
import { isLikelyClip, strictDurationProblem } from '../utils/clipDetect'
import { parseDuration } from '../utils/formatTime'
import { probeAudioDuration } from '../utils/probeAudio'
import { isSafeHttpUrl } from '../utils/spotifyUrl'
import { MusicVerseNative, type NativeDownloadResult, type NativeQueueJob, type NativeQueueResult } from './musicVerseNative'
import { fetchAndSaveLyrics } from './offlineLyrics'
import {
  COVER_DIR,
  DOWNLOAD_DIR,
  META_DIR,
  MIN_VALID_BYTES,
  getOfflineState,
  writeMeta,
  isTooSmallForDuration,
  srcFor,
  setCellular,
  replaceItem,
  setDownloadQuality,
  setExportMusic,
  setUpgrade,
  setChargingOnly,
  setItems,
  setPaused,
  setRestored,
  setTransfer,
  setUnplugged,
  setWifiOnly,
  toPlaylistTrack,
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
 * PENGUNDUH NATIVE (v0.3.7): byte diunduh oleh thread native (`MusicVerseNative.downloadFile`), bukan lagi
 * `Filesystem.downloadFile` di WebView. Sama seperti sistem unduhan StreamBeats: berkas `.part` hanya bertambah,
 * putus sinyal ditunggu lalu disambung lewat Range (tidak mulai dari nol), dan URL sumber yang kedaluwarsa cukup
 * di-resolve ulang karena sisa `.part` tetap dipakai selama ukuran total sumbernya sama.
 *
 * PENYELESAIAN NATIVE (v0.4.1, padanan Rust + lofty di StreamBeats): setelah byte lengkap, native memeriksa ISI berkas
 * (`inspectDownload`: halaman error ditolak, jenis wadah menentukan ekstensi), lalu `finalizeDownload` menyematkan judul,
 * artis, album, dan sampul ke dalam berkas (M4A/MP3), mengganti nama .part secara atomik, menulis metadata (jurnal
 * pemulihan) dan, bila dipilih, menyalin ke Music/MusicVerse. APK lama tanpa fungsi ini memakai jalur lama (.mp3, tanpa tag).
 *
 * ANTREAN NATIVE (v0.4.4, tahap 1): JS tetap menyusun urutan dan me-resolve link (kode plugin ada di JS), tetapi lagu yang
 * URL-nya siap diserahkan ke `DownloadQueue` (Java). Native mengunduh, memeriksa isi, memverifikasi, menyematkan tag,
 * menyimpan, menulis metadata, dan mencatat hasilnya di jurnal sendiri. Lagu yang sedang berjalan + `NATIVE_LOOKAHEAD`
 * lagu di depannya karena itu tetap selesai walau aplikasi digeser dari recent apps; hasilnya dibaca JS saat dibuka lagi
 * (`syncNative`). APK lama tanpa antrean native memakai jalur JS di bawah, persis seperti sebelumnya.
 *
 * BATAS: lagu yang BELUM diserahkan (di luar lookahead, atau yang perlu di-resolve ulang) menunggu aplikasi dibuka lagi, karena
 * resolve link masih di JS. Memindahkan resolve link ke native adalah tahap 2. Pada APK tanpa antrean native, lagu yang
 * sedang berjalan berhenti saat app digeser, tetapi `.part` + catatan ukurannya TETAP ada dan disambung saat diunduh lagi. */

interface Job {
  track: PlaylistTrack
  key: string
  /** Dipilih pengguna untuk diunduh sekarang: abaikan jeda dan syarat Wi-Fi/cas. */
  forced?: boolean
  /** Ditahan satu per satu oleh pengguna: dilewati antrean sampai dilanjutkan. */
  held?: boolean
  /** Sumber yang sudah dilewati untuk lagu ini (dipakai saat me-resolve ulang). */
  avoid?: ApiSourceName[]
  /** Lagu ini sudah (atau sedang) diserahkan ke antrean native lebih awal; `downloadOne` tinggal menunggu hasilnya. */
  handoff?: Handoff
}

/** Hasil penyerahan ke antrean native: hasilnya + info sumber yang dipakai (untuk menyingkirkan sumber yang tidak cocok). */
interface HandoffOutcome {
  result: NativeQueueResult
  info: PlaybackInfo
}

interface Handoff {
  /** null = penyerahan gagal / dicabut sebelum mulai: lagu diproses dengan jalur biasa. */
  pending: Promise<HandoffOutcome | null>
  /** Selesai (true bila sudah diterima native) setelah URL di-resolve dan diserahkan. */
  ready: Promise<boolean>
}

/** Dilempar di titik aman saat antrean dijeda; lagunya dikembalikan ke depan antrean, BUKAN dihitung gagal. */
class PauseSignal extends Error {
  constructor() {
    super('Dijeda')
    this.name = 'PauseSignal'
  }
}

function throwIfPaused(job: Job): void {
  if (!job.forced && (job.held || getOfflineState().paused)) throw new PauseSignal()
}

const queue: Job[] = []
let running = false
let progressInstalled = false
/** URL yang sedang diunduh -> lagu, untuk memetakan event progress. */
const activeUrls = new Map<string, { key: string; title: string; total: number }>()
/** Unduhan yang sedang dikerjakan pengunduh native (id = kunci lagu) -> lagu, untuk memetakan event `downloadProgress`. */
const activeById = new Map<string, { key: string; title: string; total: number }>()
/** True bila APK belum punya pengunduh native (UNIMPLEMENTED): pakai Filesystem.downloadFile seperti sebelumnya. */
let nativeDownloaderMissing = false
/** True bila APK belum punya pemeriksa/penyelesai unduhan native (v0.4.1+): jalur lama (.mp3, tanpa tag). */
let nativeFinalizerMissing = false
/** True bila APK belum punya antrean native (v0.4.4+): semua langkah unduhan dikerjakan JS seperti sebelumnya. */
let nativeQueueMissing = false
/** Berapa lagu di depan yang boleh diserahkan ke antrean native sebelum gilirannya (supaya terus jalan walau app digeser). */
const NATIVE_LOOKAHEAD = 2
/** Lagu yang sedang ditunggu hasilnya dari native -> penyelesai. null = dicabut sebelum mulai. */
const waiters = new Map<string, (result: NativeQueueResult | null) => void>()
/** Lagu yang sudah dicatat selesai (dari event / sinkronisasi), supaya lirik dan hitungan tidak ganda. */
const adopted = new Set<string>()
let prefetching = false

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
  if (queue.some((j) => !j.held) && !running && !s.paused && !isHeldByConditions()) void pump()
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

function notify(
  title: string,
  text: string,
  percent: number | null,
  done = false,
  force = false,
  waiting = false,
  action?: 'pause' | 'resume',
): void {
  if (!isNativeApp()) return
  const now = Date.now()
  if (!force && now - notifyAt < 600) return
  notifyAt = now
  MusicVerseNative.showDownloadProgress({ title, text, percent, done, waiting, action }).catch(() => {
    // Izin notifikasi ditolak / plugin tidak ada: progres tetap tampil di dalam aplikasi.
  })
}

function sessionLine(): string {
  return sessionTotal > 1 ? `Lagu ${Math.min(sessionDone + sessionFailed + 1, sessionTotal)} dari ${sessionTotal}` : 'Mengunduh lagu'
}

function reportProgress(active: { key: string; title: string; total: number }, bytes: number, contentLength: number): void {
  if (contentLength > 0) active.total = contentLength
  const known = contentLength > 0
  const percent = known ? Math.min(100, Math.round((bytes / contentLength) * 100)) : null
  setTransfer(active.key, {
    key: active.key,
    title: active.title,
    status: 'downloading',
    percent,
    bytes,
    total: known ? contentLength : undefined,
    forced: getOfflineState().transfers.get(active.key)?.forced,
  })
  notify(active.title, sessionLine(), percent, false, false, false, 'pause')
}

function installProgressListener(): void {
  if (progressInstalled) return
  progressInstalled = true
  void Filesystem.addListener('progress', (event) => {
    const active = activeUrls.get(event.url)
    if (!active) return
    reportProgress(active, event.bytes, event.contentLength)
  })
  if (isNativeApp()) {
    MusicVerseNative.addListener('downloadProgress', (event) => {
      const active = activeById.get(event.id)
      if (!active) return
      reportProgress(active, event.bytes, event.total)
    }).catch(() => {
      // Plugin lama tanpa event ini: progres native tidak tampil, unduhan tetap berjalan.
    })
    MusicVerseNative.addListener('queueResult', (event) => {
      void handleNativeResult(event)
    }).catch(() => {
      // Plugin lama tanpa antrean native: jalur JS dipakai.
    })
  }
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

/** Menghapus berkas .part beserta catatan ukuran sumbernya (.meta milik pengunduh native). */
async function safeDeletePart(partPath: string): Promise<void> {
  await safeDelete(partPath)
  await safeDelete(`${partPath}.meta`)
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

/** Nama berkas untuk salinan publik (Music/MusicVerse): "Artis - Judul.ext", tanpa karakter terlarang. */
function exportDisplayName(track: PlaylistTrack, ext: string): string {
  const clean = (text: string) => text.replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim()
  const base = clean([track.artists, track.title].filter(Boolean).join(' - ')).slice(0, 120).trim()
  return `${base || 'MusicVerse'}.${ext}`
}

const MIME_BY_EXT: Record<string, string> = {
  m4a: 'audio/mp4',
  mp3: 'audio/mpeg',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  flac: 'audio/flac',
  webm: 'audio/webm',
  wav: 'audio/wav',
}

/** Gangguan jaringan saat unduh: dicoba lagi sampai sekian kali (jeda naik bertahap), lalu menyerah dengan pesan sinyal jelek. */
const NET_RETRY_MAX = 12
const NET_RETRY_DELAY_MS = 2_000
const NET_RETRY_MAX_DELAY_MS = 10_000
const OFFLINE_WAIT_MS = 10 * 60_000
/** Berkas tidak cocok (klip / durasi / judul beda) di semua sumber: semua sumber dicoba lagi dari awal sampai sekian putaran, karena server sering memberi berkas yang benar di percobaan berikutnya. */
const MISMATCH_ROUNDS_MAX = 5
const MISMATCH_RETRY_DELAY_MS = 1_500
const BAD_SIGNAL_TEXT = 'Sinyal jelek, unduhan gagal. Coba lagi saat koneksi lebih baik.'

const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms))

/** Menunggu jeda coba ulang; bila perangkat offline, menunggu sampai online lagi (maks. 1 menit). */
/** Tidur yang memeriksa jeda tiap 250 ms, supaya lagu yang sedang menunggu/mengulang ikut berhenti saat dijeda. */
async function pausableSleep(ms: number, job: Job): Promise<void> {
  const end = Date.now() + ms
  while (Date.now() < end) {
    throwIfPaused(job)
    await sleep(Math.min(250, Math.max(0, end - Date.now())))
  }
  throwIfPaused(job)
}

async function waitBeforeRetry(attempt: number, job: Job): Promise<void> {
  await pausableSleep(Math.min(NET_RETRY_MAX_DELAY_MS, NET_RETRY_DELAY_MS * attempt), job)
  const until = Date.now() + OFFLINE_WAIT_MS
  while (typeof navigator !== 'undefined' && navigator.onLine === false && Date.now() < until) await pausableSleep(1_000, job)
}

/** Kegagalan yang bukan gangguan sesaat (lagu tanpa audio / hanya klip / dibatalkan): tidak dicoba ulang. */
function isTransientApiError(error: unknown): boolean {
  if (!(error instanceof SpotifyApiError)) return true
  return error.code !== 'no_audio' && error.code !== 'clip_only' && error.code !== 'aborted'
}

/* ---------------- antrean native (tahap 1) ----------------
 * JS tetap me-resolve link (kode plugin ada di JS) lalu menyerahkan lagu yang URL-nya siap ke antrean native
 * (DownloadQueue.java). Native mengerjakan unduh + verifikasi + tag + simpan sendiri, jadi lagu yang sedang berjalan dan
 * beberapa lagu di depannya (NATIVE_LOOKAHEAD) tetap selesai walau aplikasi digeser dari recent apps. Hasilnya dicatat di
 * native (jurnal + metadata) dan dibaca JS lewat event `queueResult` atau `queueSync` saat aplikasi dibuka lagi. */

function buildQueueJob(job: Job, info: PlaybackInfo, sourceUrl: string, expected: number | null): NativeQueueJob {
  const { track, key } = job
  const coverUrl = track.cover || info.cover
  const entry = { key, title: track.title, artists: track.artists, album: track.album, duration: track.duration, url: track.url, cover: track.cover }
  return {
    key,
    url: sourceUrl,
    userAgent: info.directUserAgent,
    partPath: `${DOWNLOAD_DIR}/${key}.part.mp3`,
    finalBase: `${DOWNLOAD_DIR}/${key}`,
    coverUrl: isSafeHttpUrl(coverUrl) ? coverUrl : undefined,
    coverPath: `${COVER_DIR}/${key}.jpg`,
    metaPath: `${META_DIR}/${key}.json`,
    entryJson: JSON.stringify(entry),
    title: track.title,
    artist: track.artists,
    album: track.album,
    exportToMusic: getOfflineState().exportMusic,
    exportName: exportDisplayName(track, 'tmp').slice(0, -'.tmp'.length),
    expectedSec: expected ?? -1,
    remoteSec: info.probedDuration ?? -1,
    forced: job.forced === true,
    resolvedAt: Date.now(),
  }
}

/** Menyerahkan satu lagu ke native. `result` selesai saat native melapor (null = dicabut sebelum mulai). Menolak bila APK lama. */
async function submitToNative(
  job: Job,
  info: PlaybackInfo,
  sourceUrl: string,
  expected: number | null,
): Promise<{ result: Promise<NativeQueueResult | null> }> {
  installProgressListener()
  await ensureDir(DOWNLOAD_DIR)
  await ensureDir(COVER_DIR)
  const result = new Promise<NativeQueueResult | null>((resolve) => {
    waiters.set(job.key, resolve)
  })
  try {
    await MusicVerseNative.queueAdd({ job: buildQueueJob(job, info, sourceUrl, expected) })
  } catch (error) {
    waiters.delete(job.key)
    throw error
  }
  return { result }
}

/** Me-resolve dan menyerahkan satu lagu di depan antrean sementara lagu sebelumnya masih berjalan. Gagal = diproses biasa nanti. */
function startHandoff(job: Job): Handoff {
  let markReady: (ok: boolean) => void = () => undefined
  const ready = new Promise<boolean>((resolve) => {
    markReady = resolve
  })
  const pending = (async (): Promise<HandoffOutcome | null> => {
    try {
      const info = await fetchPlaybackInfo(job.track, { strict: true, avoid: [...(job.avoid ?? [])], quality: getOfflineState().downloadQuality })
      const sourceUrl = info.directUrl ?? info.audioUrl
      if (!isSafeHttpUrl(sourceUrl)) throw new Error('Sumber audio tidak valid.')
      const handed = await submitToNative(job, info, sourceUrl, parseDuration(job.track.duration))
      markReady(true)
      const result = await handed.result
      return result ? { result, info } : null
    } catch (error) {
      if (isNativeUnimplemented(error)) nativeQueueMissing = true
      markReady(false)
      return null
    }
  })()
  return { pending, ready }
}

/** Menjaga NATIVE_LOOKAHEAD lagu di depan sudah diserahkan ke native (hanya saat tidak dijeda dan syarat terpenuhi). */
async function prefetchAhead(): Promise<void> {
  if (prefetching || nativeQueueMissing || !isNativeApp()) return
  prefetching = true
  try {
    for (;;) {
      if (getOfflineState().paused || isHeldByConditions() || nativeQueueMissing) return
      if (queue.filter((j) => j.handoff).length >= NATIVE_LOOKAHEAD) return
      const next = queue.find((j) => !j.held && !j.handoff && !j.forced)
      if (!next) return
      const handoff = startHandoff(next)
      next.handoff = handoff
      if (!(await handoff.ready)) return
    }
  } finally {
    prefetching = false
  }
}

/** Mencabut semua lagu yang belum mulai di native (jeda): lagunya kembali ke antrean JS. Yang sudah berjalan diselesaikan. */
async function releasePrefetched(): Promise<void> {
  if (nativeQueueMissing || !isNativeApp()) return
  try {
    const { released } = await MusicVerseNative.queueRelease()
    for (const key of released) {
      const waiter = waiters.get(key)
      waiters.delete(key)
      waiter?.(null)
      const job = queue.find((j) => j.key === key)
      if (job) job.handoff = undefined
    }
  } catch (error) {
    if (isNativeUnimplemented(error)) nativeQueueMissing = true
  }
}

/** Mencabut SATU lagu yang belum mulai di native. False bila sudah berjalan (tidak bisa dihentikan di tengah). */
async function cancelHandoff(key: string): Promise<boolean> {
  if (nativeQueueMissing || !isNativeApp()) return false
  try {
    const { removed } = await MusicVerseNative.queueCancel({ key })
    if (removed) {
      const waiter = waiters.get(key)
      waiters.delete(key)
      waiter?.(null)
    }
    return removed
  } catch {
    return false
  }
}

/** Mencatat lagu yang selesai di native: masuk daftar unduhan, keluar dari antrean JS. Aman dipanggil berulang. */
function adoptNativeDone(result: NativeQueueResult): void {
  let entry: DownloadedTrack
  try {
    entry = JSON.parse(result.entry ?? '') as DownloadedTrack
  } catch {
    return
  }
  if (typeof entry?.key !== 'string' || typeof entry.fileName !== 'string') return
  const key = entry.key
  setItems([entry, ...getOfflineState().items.filter((item) => item.key !== key)])
  const index = queue.findIndex((j) => j.key === key)
  if (index !== -1) queue.splice(index, 1)
  failedJobs.delete(key)
  setTransfer(key, null)
  persistQueue()
  if (!adopted.has(key)) {
    adopted.add(key)
    // Lirik usaha terbaik di latar belakang, seperti jalur JS.
    void fetchAndSaveLyrics(toPlaylistTrack(entry), key)
  }
  if (getOfflineState().exportMusic && result.exported === false) {
    console.warn(`[MusicVerse] Salinan ke folder Musik gagal: ${result.exportError ?? 'tak diketahui'}`)
  }
}

/** Hasil yang datang tanpa ada `downloadOne` yang menunggu (app baru dibuka lagi setelah digeser). */
function takeOrphan(result: NativeQueueResult): void {
  const job = queue.find((j) => j.key === result.key)
  if (!job) return
  if (result.status === 'failed') {
    const index = queue.indexOf(job)
    queue.splice(index, 1)
    failedJobs.set(job.key, { job: { track: job.track, key: job.key }, epoch: sessionEpoch })
    setTransfer(job.key, { key: job.key, title: job.track.title, status: 'error', percent: null, message: result.message || 'Unduhan gagal.' })
    persistQueue()
    return
  }
  // handback / verify: tetap di antrean, di-resolve ulang pada gilirannya (sisa .part disambung bila sumbernya sama).
  if (result.reason === 'rejected') forgetResolved(job.track)
  job.handoff = undefined
  setTransfer(job.key, { key: job.key, title: job.track.title, status: 'queued', percent: null, held: job.held })
}

async function handleNativeResult(result: NativeQueueResult): Promise<void> {
  if (result.status === 'done') adoptNativeDone(result)
  const waiter = waiters.get(result.key)
  waiters.delete(result.key)
  if (waiter) waiter(result)
  else if (result.status !== 'done') takeOrphan(result)
  // Sudah dipegang JS: native boleh menghapusnya dari jurnal.
  MusicVerseNative.queueAck({ keys: [result.key] }).catch(() => undefined)
}

/** Dipanggil saat app dibuka: hasil yang terjadi selagi JS mati (lagu selesai, dikembalikan, gagal). */
async function syncNative(): Promise<void> {
  if (!isNativeApp() || nativeQueueMissing) return
  installProgressListener()
  try {
    const { results } = await MusicVerseNative.queueSync()
    for (const result of results) await handleNativeResult(result)
  } catch (error) {
    if (isNativeUnimplemented(error)) nativeQueueMissing = true
  }
}

/** Syarat Wi-Fi / cas juga dipegang native, supaya tetap dihormati saat JS mati. */
function pushConditions(): void {
  if (!isNativeApp() || nativeQueueMissing) return
  const s = getOfflineState()
  MusicVerseNative.queueConfigure({ wifiOnly: s.wifiOnly, chargingOnly: s.chargingOnly }).catch((error) => {
    if (isNativeUnimplemented(error)) nativeQueueMissing = true
  })
}

async function downloadOne(job: Job): Promise<void> {
  const { track, key, forced } = job
  const title = track.title
  setTransfer(key, { key, title, status: 'resolving', percent: null, forced })
  notify(title, sessionLine(), null, false, true, false, 'pause')
  await ensureDir(DOWNLOAD_DIR)
  await ensureDir(COVER_DIR)

  // Berakhiran .mp3 supaya durasinya bisa dibaca sebelum berkas dianggap sah.
  const partPath = `${DOWNLOAD_DIR}/${key}.part.mp3`
  const expected = parseDuration(track.duration)
  const avoid: ApiSourceName[] = [...(job.avoid ?? [])]
  let netFailures = 0
  /** Sumber menolak URL (HTTP 4xx) berturut-turut; dua kali = plugin itu dilewati, plugin berikutnya yang dipakai. */
  let httpRejects = 0
  let mismatchRounds = 0
  /** Penyerahan lebih awal ke antrean native (lihat `prefetchAhead`); dipakai sekali, putaran berikutnya me-resolve sendiri. */
  let handoff = job.handoff
  job.handoff = undefined
  const active = { key, title, total: 0 }

  /**
   * Menerjemahkan hasil antrean native menjadi langkah berikut: 'done' (berkas sudah jadi, dicatat oleh `adoptNativeDone`),
   * 'verify' (berkas utuh, durasinya diperiksa JS), atau 'retry' (resolve ulang; hitungan gagal sudah diperbarui).
   */
  const applyOutcome = async (outcome: HandoffOutcome): Promise<'done' | 'verify' | 'retry'> => {
    const out = outcome.result
    if (out.status === 'done') return 'done'
    if (out.status === 'verify') return 'verify'
    if (out.status === 'failed') throw new Error(out.message || 'Unduhan gagal.')
    console.warn(`[MusicVerse] Antrean native mengembalikan "${title}" (${out.reason ?? 'tanpa alasan'}): ${out.message ?? ''}`)
    const api = avoidKeyOf(outcome.info)
    if (out.reason === 'notaudio' || out.reason === 'mismatch') {
      // Isi tidak cocok: singkirkan sumber itu, atau ulangi semua sumber dari awal bila sudah habis.
      if (api && !avoid.includes(api)) {
        avoid.push(api)
      } else {
        mismatchRounds += 1
        if (mismatchRounds > MISMATCH_ROUNDS_MAX) throw new Error(out.message || 'Isi unduhan tidak cocok.')
        avoid.length = 0
        await pausableSleep(MISMATCH_RETRY_DELAY_MS, job)
      }
      return 'retry'
    }
    // rejected | network | truncated: gangguan sesaat, dicoba lagi (URL ditolak = resolve ulang).
    netFailures += 1
    if (out.reason === 'rejected') {
      forgetResolved(track)
      httpRejects += 1
      // Dua kali ditolak berturut-turut: lewati plugin itu dan coba plugin berikutnya (mis. ytmusic -> ytvideo).
      const rejectedKey = avoidKeyOf(outcome.info)
      if (httpRejects >= 2 && rejectedKey && !avoid.includes(rejectedKey)) avoid.push(rejectedKey)
    }
    if (netFailures > NET_RETRY_MAX) throw new Error(BAD_SIGNAL_TEXT)
    await waitBeforeRetry(netFailures, job)
    return 'retry'
  }

  // Unduhan HARUS cocok dengan data lagu di playlist: judul + artis (dicek saat memilih sumber) dan durasi
  // (dicek dari berkas yang benar-benar terunduh). Berkas yang tidak cocok dibuang dan sumber lain dicoba.
  let info!: PlaybackInfo
  let size = 0
  /** Jenis wadah menurut ISI berkas (null = tidak diperiksa: APK lama / pengunduh lama). */
  let container: { ext: string; mime: string } | null = null
  for (;;) {
    throwIfPaused(job)
    let outcome: HandoffOutcome | null = null
    let sourceUrl = ''
    if (handoff) {
      // Lagu ini sudah diserahkan ke native saat lagu sebelumnya masih berjalan; tinggal menunggu hasilnya.
      setTransfer(key, { key, title, status: 'downloading', percent: null, forced })
      activeById.set(key, active)
      try {
        outcome = await handoff.pending
      } finally {
        activeById.delete(key)
      }
      handoff = undefined
      if (outcome === null) continue
    } else {
      // .part TIDAK dihapus di sini: sisa unduhan yang terputus disambung oleh pengunduh native (lihat NativeDownloader).
      setTransfer(key, { key, title, status: 'resolving', percent: null, forced })
      try {
        info = await fetchPlaybackInfo(track, { strict: true, avoid, quality: getOfflineState().downloadQuality })
      } catch (error) {
        // Semua sumber ditolak karena tidak cocok dengan lagunya: putaran baru, sumber dicoba lagi dari awal.
        if (error instanceof SpotifyApiError && error.code === 'clip_only') {
          mismatchRounds += 1
          console.warn(`[MusicVerse] Semua sumber tidak cocok (putaran ${mismatchRounds}/${MISMATCH_ROUNDS_MAX}):`, error)
          if (mismatchRounds > MISMATCH_ROUNDS_MAX) throw error
          avoid.length = 0
          await pausableSleep(MISMATCH_RETRY_DELAY_MS, job)
          continue
        }
        if (!isTransientApiError(error)) throw error
        netFailures += 1
        console.warn(`[MusicVerse] Gagal mengambil sumber unduhan (percobaan ${netFailures}/${NET_RETRY_MAX}):`, error)
        if (netFailures > NET_RETRY_MAX) throw new Error(BAD_SIGNAL_TEXT)
        await waitBeforeRetry(netFailures, job)
        continue
      }
      // Plugin: unduh langsung dari URL asli sumber dengan User-Agent-nya (bukan lewat proxy pemutaran).
      sourceUrl = info.directUrl ?? info.audioUrl
      if (!isSafeHttpUrl(sourceUrl)) throw new Error('Sumber audio tidak valid.')
      // Titik aman terakhir sebelum unduhan berkas (yang tidak bisa dihentikan di tengah): bila dijeda, berhenti di sini.
      throwIfPaused(job)

      setTransfer(key, { key, title, status: 'downloading', percent: null, forced })
      if (isNativeApp() && !nativeQueueMissing) {
        // Antrean native: unduh + cek isi + verifikasi + tag + simpan dikerjakan thread native, tanpa WebView.
        activeById.set(key, active)
        try {
          const handed = await submitToNative(job, info, sourceUrl, expected)
          void prefetchAhead()
          const result = await handed.result
          if (result) outcome = { result, info }
          else continue // dicabut sebelum mulai (dijeda): putaran berikut memutuskan
        } catch (error) {
          if (isNativeUnimplemented(error)) {
            nativeQueueMissing = true
            console.warn('[MusicVerse] APK ini belum punya antrean native; unduhan dikerjakan JS (jalur lama).')
          } else {
            throw error
          }
        } finally {
          activeById.delete(key)
        }
      }
    }

    let viaNative = false
    if (outcome) {
      const action = await applyOutcome(outcome)
      if (action === 'done') return
      if (action === 'retry') continue
      // 'verify': berkas sudah utuh di .part; periksa durasinya di bawah (pembaca WebView) lalu selesaikan seperti biasa.
      info = outcome.info
      active.total = outcome.result.total ?? 0
      viaNative = true
    }

    let downloadError: unknown = null
    let triedNative = viaNative
    if (!viaNative) {
      if (isNativeApp() && !nativeDownloaderMissing) {
        triedNative = true
        activeById.set(key, active)
        try {
          const result: NativeDownloadResult = await MusicVerseNative.downloadFile({
            id: key,
            url: sourceUrl,
            userAgent: info.directUserAgent,
            path: partPath,
          })
          if (result.total > 0) active.total = result.total
          if (result.resumed) console.info(`[MusicVerse] Unduhan "${title}" disambung dari sisa sebelumnya.`)
        } catch (error) {
          if (isNativeUnimplemented(error)) {
            nativeDownloaderMissing = true
            triedNative = false
            console.warn('[MusicVerse] APK ini belum punya pengunduh native; memakai pengunduh lama (tanpa resume).')
          } else {
            downloadError = error ?? new Error('Unduhan terputus.')
          }
        } finally {
          activeById.delete(key)
        }
      }
      if (!triedNative && !downloadError) {
        // Pengunduh lama (web view): selalu mulai dari awal.
        await safeDeletePart(partPath)
        activeUrls.set(info.audioUrl, active)
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
      }
      if (downloadError) {
        netFailures += 1
        const code = typeof (downloadError as { code?: unknown }).code === 'string' ? String((downloadError as { code: string }).code) : ''
        console.warn(`[MusicVerse] Unduhan terputus (percobaan ${netFailures}/${NET_RETRY_MAX}, ${code || 'tanpa kode'}):`, downloadError)
        const rejected = /^HTTP_(401|403|404|410)$/.test(code)
        if (rejected) {
          // URL kedaluwarsa / ditolak: resolve ulang (cache dibuang). Dua kali berturut-turut = lewati plugin itu, coba berikutnya.
          forgetResolved(track)
          httpRejects += 1
          const rejectedKey = avoidKeyOf(info)
          if (httpRejects >= 2 && rejectedKey && !avoid.includes(rejectedKey)) avoid.push(rejectedKey)
        }
        // Pengunduh native menyimpan .part untuk disambung; hapus hanya bila memang tidak bisa disambung / pengunduh lama.
        const resumable = triedNative && (code === 'NETWORK' || rejected)
        if (!resumable) await safeDeletePart(partPath)
        if (netFailures > NET_RETRY_MAX) throw new Error(BAD_SIGNAL_TEXT)
        await waitBeforeRetry(netFailures, job)
        continue
      }
    }

    // Isi berkas harus audio sungguhan (bukan halaman error yang tersimpan sebagai lagu), dan jenis wadahnya menentukan
    // ekstensi, seperti pemeriksaan wadah di StreamBeats.
    container = null
    if (triedNative && !nativeFinalizerMissing) {
      try {
        container = await MusicVerseNative.inspectDownload({ path: partPath })
      } catch (error) {
        if (isNativeUnimplemented(error)) {
          nativeFinalizerMissing = true
        } else if ((error as { code?: unknown } | null)?.code === 'NOT_AUDIO') {
          await safeDeletePart(partPath)
          const api = avoidKeyOf(info)
          console.warn(`[MusicVerse] Isi unduhan dari ${api ?? 'sumber tak dikenal'} bukan audio; sumber dilewati.`)
          if (api && !avoid.includes(api)) {
            avoid.push(api)
          } else {
            mismatchRounds += 1
            if (mismatchRounds > MISMATCH_ROUNDS_MAX) throw new Error('Isi unduhan bukan audio.')
            avoid.length = 0
            await pausableSleep(MISMATCH_RETRY_DELAY_MS, job)
          }
          continue
        }
        // Kegagalan lain pada pemeriksaan ini tidak menghentikan unduhan: verifikasi durasi di bawah tetap berjalan.
      }
    }

    const stat = await Filesystem.stat({ path: partPath, directory: Directory.External })
    const problem = await checkDownloaded(partPath, stat.size, expected, info.probedDuration, active.total)
    if (!problem) {
      size = stat.size
      break
    }
    await safeDeletePart(partPath)
    const api = avoidKeyOf(info)
    console.warn(`[MusicVerse] Unduhan dari ${api ?? 'sumber tak dikenal'} ditolak: ${problem.reason}`)
    // Unduhan terpotong karena jaringan: ulangi sumber yang sama beberapa kali sebelum menyerah (sinyal jelek).
    if (problem.retrySame) {
      netFailures += 1
      if (netFailures > NET_RETRY_MAX) throw new Error(BAD_SIGNAL_TEXT)
      await waitBeforeRetry(netFailures, job)
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
      await pausableSleep(MISMATCH_RETRY_DELAY_MS, job)
    }
  }

  const ext = container?.ext ?? 'mp3'
  const fileName = `${key}.${ext}`
  const finalPath = `${DOWNLOAD_DIR}/${fileName}`

  // Sampul lebih dulu: ikut disematkan ke dalam berkas. Usaha terbaik; gagal = pakai sampul bawaan.
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
    // Tag sudah dicoba di native (wadah tak didukung dibiarkan, itu bukan kegagalan): tidak perlu dirapikan lagi.
    ...(container && !nativeFinalizerMissing && isNativeApp() ? { tagged: true } : {}),
  }

  // Penyelesaian di native: tag + sampul disematkan, .part diganti nama atomik, metadata (jurnal) ditulis, dan bila
  // diminta disalin ke Music/MusicVerse. Berkas yang sudah jadi tidak bergantung lagi pada WebView yang mungkin dibekukan.
  let finalized = false
  if (container && !nativeFinalizerMissing && isNativeApp()) {
    try {
      const done = await MusicVerseNative.finalizeDownload({
        partPath,
        finalPath,
        title: track.title,
        artist: track.artists,
        album: track.album,
        coverPath: coverFileName ? `${COVER_DIR}/${coverFileName}` : undefined,
        metaPath: `${META_DIR}/${key}.json`,
        metaJson: JSON.stringify(entry),
        exportToMusic: getOfflineState().exportMusic,
        exportName: exportDisplayName(track, ext),
      })
      entry.bytes = done.bytes > 0 ? done.bytes : size
      finalized = true
      if (!done.tagged) console.info(`[MusicVerse] "${title}": tag tidak disematkan (wadah ${ext} belum didukung / tidak aman).`)
      if (getOfflineState().exportMusic && !done.exported) console.warn(`[MusicVerse] Salinan ke folder Musik gagal: ${done.exportError ?? 'tak diketahui'}`)
    } catch (error) {
      if (isNativeUnimplemented(error)) nativeFinalizerMissing = true
      else console.warn('[MusicVerse] Penyelesaian native gagal; memakai ganti nama biasa:', error)
    }
  }
  if (!finalized) {
    delete entry.tagged
    await safeDelete(finalPath)
    await Filesystem.rename({ from: partPath, to: finalPath, directory: Directory.External, toDirectory: Directory.External })
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
    for (;;) {
      // Lagu yang dipilih manual jalan walau dijeda dan walau syarat Wi-Fi/cas belum terpenuhi.
      const wantsForced = queue.some((j) => j.forced)
      // Lagu yang ditahan satu per satu dilewati; bila hanya tersisa yang ditahan, sesi selesai.
      if (!wantsForced && (getOfflineState().paused || !queue.some((j) => !j.held))) break
      if (!wantsForced && (await conditionsBlocked())) break
      const forcedIndex = queue.findIndex((j) => j.forced)
      const runnableIndex = queue.findIndex((j) => !j.held)
      const index = forcedIndex >= 0 ? forcedIndex : getOfflineState().paused ? -1 : runnableIndex
      const job = index >= 0 ? queue.splice(index, 1)[0] : undefined
      if (!job) break
      current = job
      try {
        await downloadOne(job)
        sessionDone += 1
        failedJobs.delete(job.key)
      } catch (error) {
        if (error instanceof PauseSignal) {
          // Dijeda di titik aman: kembali ke depan antrean, bukan gagal.
          queue.unshift({ track: job.track, key: job.key, held: job.held })
          setTransfer(job.key, { key: job.key, title: job.track.title, status: 'queued', percent: null, held: job.held })
        } else {
          console.warn('[MusicVerse] Unduhan gagal:', error)
          sessionFailed += 1
          failedJobs.set(job.key, { job, epoch: sessionEpoch })
          setTransfer(job.key, { key: job.key, title: job.track.title, status: 'error', percent: null, message: errorText(error) })
        }
      }
      current = null
      persistQueue()
    }
  } finally {
    running = false
    current = null
    const s = getOfflineState()
    // Berhenti karena dijeda / menunggu syarat: lagu yang sudah diserahkan ke native tetapi belum mulai dikembalikan.
    if (queue.length > 0 && (s.paused || isHeldByConditions())) void releasePrefetched()
    if (queue.length > 0 && s.paused) {
      notify('Unduhan dijeda', `${queue.length} lagu menunggu. Buka Unduhan untuk melanjutkan.`, null, true, true, false, 'resume')
    } else if (queue.length > 0 && isHeldByConditions()) {
      const why = heldReason()
      notify(`Menunggu ${why}`, `${queue.length} lagu menunggu. Lanjut otomatis saat ${why === 'cas' ? 'HP dicas' : why === 'Wi-Fi' ? 'tersambung Wi-Fi' : 'tersambung Wi-Fi dan dicas'}.`, null, false, true, true)
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
  adopted.delete(key)
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
  MusicVerseNative.requestNotificationPermission()
    .catch(() => undefined)
    .then(askBatteryExemptionOnce)
    .catch(() => undefined)
}

const BATTERY_ASKED_KEY = 'musicverse:batteryExemptionAsked'

/**
 * Tanpa pengecualian penghemat baterai, Android (terutama ColorOS/Realme, MIUI) membekukan app yang di latar belakang
 * walau foreground service jalan, sehingga unduhan berhenti sendiri saat layar mati. Minta SEKALI lewat dialog sistem
 * (satu ketukan "Izinkan"); jika ditolak tidak ditanya lagi.
 */
async function askBatteryExemptionOnce(): Promise<void> {
  if (readJson(BATTERY_ASKED_KEY).status === 'ok') return
  const { ignoring } = await MusicVerseNative.isIgnoringBatteryOptimizations()
  if (ignoring) return
  writeJson(BATTERY_ASKED_KEY, true)
  await MusicVerseNative.openBatterySettings()
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
    // Sudah diserahkan ke native tetapi belum mulai: cabut juga di sana (yang sudah berjalan tidak bisa dibatalkan).
    if (queue[index].handoff) void cancelHandoff(key)
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
  // Lagu yang sudah diserahkan ke native tetapi belum mulai dikembalikan; yang sedang berjalan diselesaikan.
  void releasePrefetched()
}

/** Melanjutkan antrean yang dijeda. */
export function resumeDownloads(): void {
  setPaused(false)
  setRestored(0)
  void pump()
}

/**
 * Menahan SATU lagu (yang lain jalan terus). Lagu yang menunggu dilewati antrean; lagu yang masih menyiapkan berhenti di
 * titik aman. Lagu yang sudah mengunduh berkas tidak bisa dihentikan di tengah (plugin Filesystem tidak punya pembatalan).
 */
export function holdDownload(key: string): boolean {
  const queued = queue.find((j) => j.key === key)
  const target = queued ?? (current?.key === key ? current : undefined)
  if (!target) return false
  const transfer = getOfflineState().transfers.get(key)
  if (transfer?.status === 'downloading') return false
  target.held = true
  if (target.handoff) {
    const handoff = target.handoff
    void cancelHandoff(key).then((removed) => {
      if (removed && target.handoff === handoff) target.handoff = undefined
    })
  }
  if (transfer) setTransfer(key, { ...transfer, held: true })
  return true
}

/** Melanjutkan satu lagu yang ditahan: kembali ke antrean biasa. */
export function resumeHeld(key: string): boolean {
  const job = queue.find((j) => j.key === key)
  if (!job) return false
  job.held = false
  const transfer = getOfflineState().transfers.get(key)
  if (transfer) setTransfer(key, { ...transfer, held: false })
  void pump()
  return true
}

/** Mengunduh lagu pilihan sekarang juga: jalan walau antrean dijeda atau syarat Wi-Fi/cas belum terpenuhi. */
export function downloadNow(key: string): boolean {
  const job = queue.find((j) => j.key === key)
  if (!job) return false
  job.forced = true
  job.held = false
  setTransfer(key, { ...(getOfflineState().transfers.get(key) ?? { key, status: 'queued' as const, percent: null }), forced: true, held: false })
  void pump()
  return true
}

/** Menyalakan/mematikan "Unduh hanya lewat Wi-Fi" (disimpan di perangkat). */
export function setWifiOnlyEnabled(on: boolean): void {
  setWifiOnly(on)
  saveSettings()
  if (!on) setCellular(false)
  updateWatch()
  void refreshConditions().then(maybeAutoStart)
}

/**
 * Menyalakan/mematikan "Salin ke folder Musik" (disimpan di perangkat). Saat dinyalakan, lagu yang SUDAH diunduh ikut
 * disalin di latar belakang satu per satu; yang sudah pernah disalin dilewati native (tidak jadi dobel).
 */
export function setExportMusicEnabled(on: boolean): void {
  setExportMusic(on)
  saveSettings()
  if (!on || !isNativeApp() || nativeFinalizerMissing) return
  void (async () => {
    for (const item of getOfflineState().items) {
      if (!getOfflineState().exportMusic) return
      const ext = /\.([a-z0-9]+)$/.exec(item.fileName)?.[1] ?? 'mp3'
      try {
        await MusicVerseNative.exportDownload({
          path: `${DOWNLOAD_DIR}/${item.fileName}`,
          exportName: exportDisplayName(toPlaylistTrack(item), ext),
          mime: MIME_BY_EXT[ext] ?? 'audio/mpeg',
        })
      } catch (error) {
        if (isNativeUnimplemented(error)) {
          nativeFinalizerMissing = true
          return
        }
      }
    }
  })()
}

/**
 * Kualitas unduhan BARU (disimpan di perangkat). Lagu yang sudah diunduh tidak berubah. Hanya berlaku untuk sumber
 * plugin: API pihak ketiga tidak menyediakan pilihan bitrate.
 */
export function setDownloadQualityPreference(quality: DownloadQuality): void {
  setDownloadQuality(quality)
  saveSettings()
}

/** Menyalakan/mematikan "Unduh hanya saat dicas" (disimpan di perangkat). */
export function setChargingOnlyEnabled(on: boolean): void {
  setChargingOnly(on)
  saveSettings()
  if (!on) setUnplugged(false)
  updateWatch()
  void refreshConditions().then(maybeAutoStart)
}

/* ---------------- merapikan unduhan lama ---------------- */

export interface UpgradeSummary {
  upgraded: number
  skipped: number
  failed: number
}

/** APK sudah 0.4.1 (punya inspectDownload) tetapi belum 0.4.2 (belum punya upgradeDownload). */
let nativeUpgradeMissing = false
/** Lagu yang gagal / bukan audio di sesi ini: tidak diulang tiap saat (dicoba lagi di sesi berikutnya). */
const upgradeSkipped = new Set<string>()
let upgrading: Promise<UpgradeSummary> | null = null

/** Jumlah unduhan yang belum dirapikan (belum bertag / ekstensi belum sesuai isi). */
export function countUpgradable(): number {
  return getOfflineState().items.filter((item) => item.tagged !== true).length
}

/**
 * Menulis ulang unduhan LAMA (dulu semuanya `.mp3` walau isinya M4A, tanpa tag): sematkan judul/artis/album + sampul dan
 * beri ekstensi sesuai isi. Satu lagu sekali jalan, semuanya di native dan atomik (lihat AudioFinalizer.upgradeInPlace),
 * jadi dihentikan di titik mana pun tidak merusak lagu. Tanpa internet. Aman dipanggil berulang: yang sedang berjalan
 * dipakai bersama, yang sudah rapi dilewati.
 */
export function upgradeOldDownloads(): Promise<UpgradeSummary> {
  if (!upgrading) upgrading = runUpgrade().finally(() => (upgrading = null))
  return upgrading
}

async function runUpgrade(): Promise<UpgradeSummary> {
  const summary: UpgradeSummary = { upgraded: 0, skipped: 0, failed: 0 }
  if (!isNativeApp() || nativeFinalizerMissing || nativeUpgradeMissing) return summary
  const todo = getOfflineState().items.filter((item) => item.tagged !== true && !upgradeSkipped.has(item.key))
  if (todo.length === 0) return summary
  let done = 0
  const report = (running: boolean) => setUpgrade({ running, total: todo.length, done, failed: summary.failed + summary.skipped })
  report(true)
  for (const snapshot of todo) {
    // Daftar bisa berubah selagi menyapu (lagu dihapus / sudah dirapikan): selalu baca entri terbaru.
    const item = getOfflineState().items.find((entry) => entry.key === snapshot.key)
    if (item && item.tagged !== true) {
      const path = `${DOWNLOAD_DIR}/${item.fileName}`
      try {
        const info = await MusicVerseNative.inspectDownload({ path })
        const fileName = `${item.key}.${info.ext}`
        const next: DownloadedTrack = { ...item, fileName, tagged: true }
        const result = await MusicVerseNative.upgradeDownload({
          path,
          finalPath: `${DOWNLOAD_DIR}/${fileName}`,
          title: item.title,
          artist: item.artists,
          album: item.album,
          coverPath: item.coverFileName ? `${COVER_DIR}/${item.coverFileName}` : undefined,
          metaPath: `${META_DIR}/${item.key}.json`,
          metaJson: JSON.stringify(next),
        })
        if (result.bytes > 0) next.bytes = result.bytes
        if (replaceItem(next)) {
          summary.upgraded += 1
        } else {
          // Dihapus pengguna selagi dirapikan: berkas dengan nama baru jangan jadi yatim.
          for (const orphan of [`${DOWNLOAD_DIR}/${fileName}`, `${META_DIR}/${item.key}.json`]) await safeDelete(orphan)
        }
      } catch (error) {
        if (isNativeUnimplemented(error)) {
          nativeUpgradeMissing = true
          break
        }
        upgradeSkipped.add(item.key)
        const code = (error as { code?: unknown } | null)?.code
        if (code === 'NOT_AUDIO' || code === 'NO_SPACE') summary.skipped += 1
        else summary.failed += 1
        console.warn(`[MusicVerse] Unduhan lama "${item.title}" tidak dirapikan:`, error)
      }
    }
    done += 1
    report(true)
    await sleep(150) // beri napas supaya tidak berebut disk dengan pemutaran
  }
  report(false)
  return summary
}

function saveSettings(): void {
  const s = getOfflineState()
  writeJson(SETTINGS_KEY, { wifiOnly: s.wifiOnly, chargingOnly: s.chargingOnly, exportMusic: s.exportMusic, downloadQuality: s.downloadQuality })
  pushConditions()
}

/**
 * Dipanggil sekali saat start (setelah indeks unduhan siap): memuat pengaturan, memantau perubahan koneksi, dan
 * memulihkan antrean + daftar gagal dari sesi sebelumnya. Antrean yang dipulihkan DIJEDA dulu (tidak langsung
 * memakai data); pengguna menekan "Lanjutkan unduhan".
 */
export function initDownloads(): void {
  if (!isNativeApp()) return
  // Hasil antrean native yang terjadi selagi aplikasi mati. Ditunda satu putaran supaya antrean JS sudah dipulihkan di bawah.
  window.setTimeout(() => {
    pushConditions()
    void syncNative()
  }, 0)
  // Unduhan lama dirapikan pelan-pelan di latar belakang setelah aplikasi tenang (tanpa internet, satu lagu sekali jalan).
  window.setTimeout(() => void upgradeOldDownloads(), 20_000)
  // Tombol Jeda / Lanjutkan di notifikasi unduhan.
  void MusicVerseNative.addListener('downloadAction', (event) => {
    if (event.action === 'pause') pauseDownloads()
    else if (event.action === 'resume') resumeDownloads()
  }).catch(() => {
    // Plugin lama tanpa event ini: tombol notifikasi tidak ada juga.
  })
  const settings = readJson(SETTINGS_KEY)
  if (settings.status === 'ok' && typeof settings.value === 'object' && settings.value !== null) {
    const saved = settings.value as { wifiOnly?: unknown; chargingOnly?: unknown; exportMusic?: unknown; downloadQuality?: unknown }
    if (isDownloadQuality(saved.downloadQuality)) setDownloadQuality(saved.downloadQuality)
    if (saved.exportMusic === true) setExportMusic(true)
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
