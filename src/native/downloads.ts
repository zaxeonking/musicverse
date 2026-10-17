import { Directory, Filesystem } from '@capacitor/filesystem'
import { fetchPlaybackInfo, SpotifyApiError } from '../services/spotifyApi'
import type { PlaylistTrack } from '../types/spotify'
import { isSafeHttpUrl } from '../utils/spotifyUrl'
import { MusicVerseNative } from './musicVerseNative'
import { fetchAndSaveLyrics } from './offlineLyrics'
import {
  COVER_DIR,
  DOWNLOAD_DIR,
  MIN_VALID_BYTES,
  getOfflineState,
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
 * Progres: di daftar Unduhan (Koleksi) dan di satu notifikasi sistem untuk seluruh antrean.
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
const activeUrls = new Map<string, { key: string; title: string }>()

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

async function downloadOne({ track, key }: Job): Promise<void> {
  const title = track.title
  setTransfer(key, { key, title, status: 'resolving', percent: null })
  notify(title, sessionLine(), null, false, true)
  const info = await fetchPlaybackInfo(track)
  if (!isSafeHttpUrl(info.audioUrl)) throw new Error('Sumber audio tidak valid.')

  await ensureDir(DOWNLOAD_DIR)
  await ensureDir(COVER_DIR)

  const fileName = `${key}.mp3`
  const finalPath = `${DOWNLOAD_DIR}/${fileName}`
  const partPath = `${finalPath}.part`
  await safeDelete(partPath)

  setTransfer(key, { key, title, status: 'downloading', percent: null })
  activeUrls.set(info.audioUrl, { key, title })
  try {
    await Filesystem.downloadFile({
      url: info.audioUrl,
      path: partPath,
      directory: Directory.External,
      recursive: true,
      progress: true,
    })
  } finally {
    activeUrls.delete(info.audioUrl)
  }

  const stat = await Filesystem.stat({ path: partPath, directory: Directory.External })
  if (stat.size < MIN_VALID_BYTES) {
    await safeDelete(partPath)
    throw new Error('Berkas yang terunduh tidak valid (terlalu kecil).')
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
    bytes: stat.size,
    savedAt: Date.now(),
  }
  setItems([entry, ...getOfflineState().items.filter((item) => item.key !== key)])
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
      : `${ok} selesai, ${failed} gagal. Buka Koleksi untuk melihat.`
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
  return `Mengunduh ${result.queued} lagu${skipped > 0 ? ` (${skipped} dilewati)` : ''}. Lihat progres di notifikasi atau Koleksi`
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
