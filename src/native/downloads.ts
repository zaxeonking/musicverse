import { Directory, Filesystem } from '@capacitor/filesystem'
import { fetchPlaybackInfo, SpotifyApiError } from '../services/spotifyApi'
import type { PlaylistTrack } from '../types/spotify'
import { isSafeHttpUrl } from '../utils/spotifyUrl'
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
/** URL yang sedang diunduh -> key, untuk memetakan event progress. */
const activeUrls = new Map<string, string>()

function installProgressListener(): void {
  if (progressInstalled) return
  progressInstalled = true
  void Filesystem.addListener('progress', (event) => {
    const key = activeUrls.get(event.url)
    if (!key) return
    const percent = event.contentLength > 0 ? Math.min(100, Math.round((event.bytes / event.contentLength) * 100)) : null
    setTransfer(key, { key, status: 'downloading', percent })
  })
}

function errorText(error: unknown): string {
  if (error instanceof SpotifyApiError) return error.message
  if (error instanceof Error && error.message) return error.message
  return 'Unduhan gagal.'
}

async function safeDelete(path: string): Promise<void> {
  try {
    await Filesystem.deleteFile({ path, directory: Directory.External })
  } catch {
    // Tidak ada.
  }
}

async function downloadOne({ track, key }: Job): Promise<void> {
  setTransfer(key, { key, status: 'resolving', percent: null })
  const info = await fetchPlaybackInfo(track)
  if (!isSafeHttpUrl(info.audioUrl)) throw new Error('Sumber audio tidak valid.')

  const fileName = `${key}.mp3`
  const finalPath = `${DOWNLOAD_DIR}/${fileName}`
  const partPath = `${finalPath}.part`
  await safeDelete(partPath)

  setTransfer(key, { key, status: 'downloading', percent: null })
  activeUrls.set(info.audioUrl, key)
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
}

async function pump(): Promise<void> {
  if (running) return
  running = true
  installProgressListener()
  try {
    for (let job = queue.shift(); job; job = queue.shift()) {
      try {
        await downloadOne(job)
      } catch (error) {
        console.warn('[MusicVerse] Unduhan gagal:', error)
        setTransfer(job.key, { key: job.key, status: 'error', percent: null, message: errorText(error) })
      }
    }
  } finally {
    running = false
  }
}

export type EnqueueResult = 'queued' | 'already' | 'busy' | 'unsupported'

/** Menambahkan lagu ke antrean unduhan. */
export function downloadTrack(track: PlaylistTrack): EnqueueResult {
  if (!isNativeApp()) return 'unsupported'
  const key = trackKey(track)
  const state = getOfflineState()
  if (state.items.some((item) => item.key === key)) return 'already'
  const current = state.transfers.get(key)
  if (current && current.status !== 'error') return 'busy'
  queue.push({ track, key })
  setTransfer(key, { key, status: 'queued', percent: null })
  void pump()
  return 'queued'
}

/** Membatalkan unduhan yang masih mengantre (yang sudah berjalan tidak bisa dibatalkan). */
export function cancelQueued(key: string): void {
  const index = queue.findIndex((job) => job.key === key)
  if (index !== -1) queue.splice(index, 1)
  setTransfer(key, null)
}

export function dismissTransferError(key: string): void {
  setTransfer(key, null)
}
