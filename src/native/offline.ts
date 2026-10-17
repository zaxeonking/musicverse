import { Capacitor } from '@capacitor/core'
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { useSyncExternalStore } from 'react'
import type { PlaybackInfo, PlaylistTrack } from '../types/spotify'
import { parseDuration } from '../utils/formatTime'
import { readJson, writeJson } from '../utils/safeStorage'
import { extractSpotifyTrackLink } from '../utils/spotifyUrl'
import { isNativeApp } from './platform'

/**
 * Unduhan offline. Berkas disimpan di
 *   Android/data/<nama paket>/files/download/<kunci>.mp3   (+ download/covers/<kunci>.jpg)
 * Indeks (metadata) disimpan lewat safeStorage, jadi ikut tercermin ke Android/data/.../data/.
 *
 * Modul ini TIDAK mengimpor spotifyApi (spotifyApi yang mengimpor modul ini untuk memutar berkas lokal).
 * Pengunduh yang butuh `fetchPlaybackInfo` ada di `downloads.ts`.
 */

export const DOWNLOAD_DIR = 'download'
export const COVER_DIR = `${DOWNLOAD_DIR}/covers`
export const LYRICS_DIR = `${DOWNLOAD_DIR}/lyrics`
/** Salinan metadata per lagu (<kunci>.json): indeks bisa dibangun ulang dari sini jika data aplikasi hilang. */
export const META_DIR = `${DOWNLOAD_DIR}/meta`
const INDEX_KEY = 'musicverse:downloads:v1'
/** Berkas lebih kecil dari ini dianggap rusak (mis. halaman error HTML yang tersimpan sebagai audio). */
export const MIN_VALID_BYTES = 100 * 1024
/** Lagu penuh jarang di bawah ~40 kbps; berkas yang lebih kecil dari ini untuk durasinya hampir pasti cuplikan. */
export const MIN_BYTES_PER_SEC = 5000

/** True jika ukuran berkas terlalu kecil untuk durasi lagu yang diharapkan (detik). */
export function isTooSmallForDuration(bytes: number, expectedSeconds: number | null): boolean {
  return expectedSeconds !== null && expectedSeconds > 0 && bytes < expectedSeconds * MIN_BYTES_PER_SEC
}

export interface DownloadedTrack {
  key: string
  title: string
  artists: string
  album: string
  duration: string
  /** URL lagu Spotify asli (dipakai sebagai identitas; tidak ditampilkan di APK). */
  url: string
  cover: string
  fileName: string
  coverFileName?: string
  bytes: number
  savedAt: number
}

export type TransferStatus = 'queued' | 'resolving' | 'downloading' | 'error'
export interface Transfer {
  key: string
  status: TransferStatus
  /** 0..100, hanya bermakna saat `downloading` dan ukuran total diketahui. */
  percent: number | null
  /** Judul lagu (untuk daftar progres; lagu yang belum selesai belum ada di daftar unduhan). */
  title?: string
  /** Byte yang sudah diterima dan total (-1/undefined jika server tidak memberi ukuran). */
  bytes?: number
  total?: number
  message?: string
}

interface OfflineState {
  items: readonly DownloadedTrack[]
  transfers: ReadonlyMap<string, Transfer>
  ready: boolean
  /** Antrean unduhan dijeda: lagu berikutnya tidak dimulai (yang sedang berjalan diselesaikan dulu). */
  paused: boolean
  /** Pilihan "Unduh hanya lewat Wi-Fi". */
  wifiOnly: boolean
  /** Koneksi aktif sekarang seluler (hanya diperbarui saat wifiOnly menyala). */
  cellular: boolean
  /** Pilihan "Unduh hanya saat dicas". */
  chargingOnly: boolean
  /** HP sedang TIDAK dicas (hanya diperbarui saat chargingOnly menyala). */
  unplugged: boolean
  /** Jumlah lagu antrean yang dipulihkan dari sesi sebelumnya dan masih menunggu "Lanjutkan". */
  restored: number
}

let state: OfflineState = { items: [], transfers: new Map(), ready: false, paused: false, wifiOnly: false, cellular: false, chargingOnly: false, unplugged: false, restored: 0 }
const listeners = new Set<() => void>()

function setState(next: Partial<OfflineState>): void {
  state = { ...state, ...next }
  for (const listener of [...listeners]) listener()
}

export function getOfflineState(): OfflineState {
  return state
}

export function subscribeOffline(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Hook React: daftar unduhan + transfer yang sedang berjalan. */
export function useOffline(): OfflineState {
  return useSyncExternalStore(subscribeOffline, getOfflineState, getOfflineState)
}

/** Kunci stabil sebuah lagu: ID Spotify jika ada, jika tidak hash judul+artis. */
export function trackKey(track: { title: string; artists?: string; url?: string }): string {
  const link = extractSpotifyTrackLink(track.url ?? '')
  if (link) return `sp-${link.slice(link.lastIndexOf('/') + 1)}`
  const text = `${track.title}|${track.artists ?? ''}`.toLowerCase().replace(/\s+/g, ' ').trim()
  let hash = 5381
  for (let i = 0; i < text.length; i += 1) hash = ((hash << 5) + hash + text.charCodeAt(i)) >>> 0
  return `tt-${hash.toString(36)}`
}

function parseItem(value: unknown): DownloadedTrack | null {
  if (typeof value !== 'object' || value === null) return null
  const v = value as Record<string, unknown>
  const str = (x: unknown) => (typeof x === 'string' ? x : '')
  const key = str(v.key)
  const fileName = str(v.fileName)
  // Nama berkas hanya boleh polos: cegah path traversal dari data yang rusak.
  if (!/^[A-Za-z0-9_-]+\.mp3$/.test(fileName) || !/^[A-Za-z0-9_-]+$/.test(key)) return null
  const coverFileName = str(v.coverFileName)
  return {
    key,
    title: str(v.title),
    artists: str(v.artists),
    album: str(v.album),
    duration: str(v.duration),
    url: str(v.url),
    cover: str(v.cover),
    fileName,
    coverFileName: /^[A-Za-z0-9_-]+\.jpg$/.test(coverFileName) ? coverFileName : undefined,
    bytes: typeof v.bytes === 'number' && Number.isFinite(v.bytes) ? v.bytes : 0,
    savedAt: typeof v.savedAt === 'number' && Number.isFinite(v.savedAt) ? v.savedAt : 0,
  }
}

function loadIndex(): DownloadedTrack[] {
  const outcome = readJson(INDEX_KEY)
  if (outcome.status !== 'ok' || typeof outcome.value !== 'object' || outcome.value === null) return []
  const list = (outcome.value as { items?: unknown }).items
  if (!Array.isArray(list)) return []
  return list.map(parseItem).filter((item): item is DownloadedTrack => item !== null)
}

function saveIndex(items: readonly DownloadedTrack[]): void {
  writeJson(INDEX_KEY, { version: 1, items })
}

export function setItems(items: readonly DownloadedTrack[]): void {
  saveIndex(items)
  setState({ items })
}

export function setPaused(paused: boolean): void {
  if (state.paused !== paused) setState({ paused })
}

export function setWifiOnly(wifiOnly: boolean): void {
  if (state.wifiOnly !== wifiOnly) setState({ wifiOnly })
}

export function setCellular(cellular: boolean): void {
  if (state.cellular !== cellular) setState({ cellular })
}

export function setChargingOnly(chargingOnly: boolean): void {
  if (state.chargingOnly !== chargingOnly) setState({ chargingOnly })
}

export function setUnplugged(unplugged: boolean): void {
  if (state.unplugged !== unplugged) setState({ unplugged })
}

export function setRestored(restored: number): void {
  if (state.restored !== restored) setState({ restored })
}

export function setTransfer(key: string, transfer: Transfer | null): void {
  const next = new Map(state.transfers)
  if (transfer) next.set(key, transfer)
  else next.delete(key)
  setState({ transfers: next })
}

export function findDownloaded(track: { title: string; artists?: string; url?: string }): DownloadedTrack | undefined {
  const key = trackKey(track)
  return state.items.find((item) => item.key === key)
}

/** True jika error berarti berkas/folder memang tidak ada (bukan gangguan sesaat seperti izin atau penyimpanan belum siap). */
function isMissingError(error: unknown): boolean {
  const text = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  return /not exist|not found|no such file|enoent/i.test(text)
}

/** Menyimpan salinan metadata lagu di samping berkasnya (usaha terbaik). */
export async function writeMeta(item: DownloadedTrack): Promise<void> {
  try {
    await Filesystem.writeFile({
      path: `${META_DIR}/${item.key}.json`,
      directory: Directory.External,
      data: JSON.stringify(item),
      encoding: Encoding.UTF8,
      recursive: true,
    })
  } catch {
    // Tidak kritis: indeks utama tetap ada.
  }
}

async function readMeta(key: string): Promise<DownloadedTrack | null> {
  try {
    const file = await Filesystem.readFile({ path: `${META_DIR}/${key}.json`, directory: Directory.External, encoding: Encoding.UTF8 })
    const text = typeof file.data === 'string' ? file.data : await file.data.text()
    const item = parseItem(JSON.parse(text))
    return item && item.key === key ? item : null
  } catch {
    return null
  }
}

/**
 * Memuat indeks lalu mencocokkannya dengan isi folder unduhan.
 *
 * Prinsip: unduhan TIDAK boleh hilang karena pembaruan aplikasi (hanya karena di-uninstall atau dihapus pengguna).
 *  - Entri dibuang hanya jika folder berhasil dibaca dan berkasnya memang tidak ada. Jika folder tidak bisa dibaca
 *    (penyimpanan belum siap, dll.) semua entri dipertahankan.
 *  - Berkas lagu yang ada di folder tetapi tidak ada di indeks (indeks hilang/rusak) dipulihkan dari salinan
 *    metadata (`download/meta`), atau minimal dimunculkan lagi supaya tetap bisa diputar dan dihapus.
 */
export async function initOffline(): Promise<void> {
  if (!isNativeApp()) return
  const loaded = loadIndex()
  setState({ items: loaded, ready: true })

  let files: Map<string, number | undefined>
  try {
    const listing = await Filesystem.readdir({ path: DOWNLOAD_DIR, directory: Directory.External })
    files = new Map(listing.files.map((file) => [file.name, typeof file.size === 'number' ? file.size : undefined]))
  } catch {
    return
  }

  const known = new Set<string>()
  const alive: DownloadedTrack[] = []
  for (const item of loaded) {
    known.add(item.key)
    if (!files.has(item.fileName)) continue
    const size = files.get(item.fileName)
    if (size !== undefined && size < MIN_VALID_BYTES) continue
    alive.push(size !== undefined ? { ...item, bytes: size } : item)
  }

  let recovered = 0
  for (const [name, size] of files) {
    const match = /^([A-Za-z0-9_-]+)\.mp3$/.exec(name)
    if (!match || known.has(match[1])) continue
    if (size !== undefined && size < MIN_VALID_BYTES) continue
    const key = match[1]
    const meta = await readMeta(key)
    const spotifyId = key.startsWith('sp-') ? key.slice(3) : ''
    alive.push(
      meta
        ? { ...meta, bytes: size ?? meta.bytes }
        : {
            key,
            title: 'Lagu terunduh',
            artists: '',
            album: '',
            duration: '',
            url: spotifyId ? `https://open.spotify.com/track/${spotifyId}` : '',
            cover: '',
            fileName: name,
            bytes: size ?? 0,
            savedAt: Date.now(),
          },
    )
    recovered += 1
  }

  if (alive.length !== loaded.length || recovered > 0 || alive.some((item, index) => item !== loaded[index])) setItems(alive)

  // Isi salinan metadata untuk unduhan lama yang belum punya (di latar belakang).
  void (async () => {
    for (const item of alive) {
      if ((await readMeta(item.key)) === null) await writeMeta(item)
    }
  })()
}

/** URL yang bisa dipakai <audio> untuk berkas di Android/data/.../files/<path>. */
export async function srcFor(path: string): Promise<string> {
  const { uri } = await Filesystem.getUri({ path, directory: Directory.External })
  return Capacitor.convertFileSrc(uri)
}

export async function coverSrcFor(item: DownloadedTrack): Promise<string | undefined> {
  if (!item.coverFileName) return undefined
  try {
    return await srcFor(`${COVER_DIR}/${item.coverFileName}`)
  } catch {
    return undefined
  }
}

/** Dipanggil oleh fetchPlaybackInfo: jika lagu sudah diunduh, putar dari berkas lokal (tanpa internet). */
export async function resolveOfflinePlayback(track: {
  title: string
  artists?: string
  url?: string
  duration?: string
}): Promise<PlaybackInfo | null> {
  if (!isNativeApp()) return null
  const item = findDownloaded(track)
  if (!item) return null
  const path = `${DOWNLOAD_DIR}/${item.fileName}`
  let size: number
  try {
    size = (await Filesystem.stat({ path, directory: Directory.External })).size
  } catch (error) {
    // Hanya jika berkasnya memang tidak ada indeks dibuang (tidak ada berkas yang perlu dihapus).
    // Gangguan sesaat tidak boleh menghapus apa pun: cukup putar lewat internet kali ini.
    if (isMissingError(error)) setItems(state.items.filter((entry) => entry.key !== item.key))
    return null
  }
  // Berkas jelas rusak / cuplikan (terunduh sebelum ada verifikasi): buang dan ambil ulang dari internet.
  const expected = parseDuration(track.duration) ?? parseDuration(item.duration)
  if (size < MIN_VALID_BYTES || isTooSmallForDuration(size, expected)) {
    void removeDownload(item.key)
    return null
  }
  try {
    return {
      title: item.title,
      artist: item.artists,
      album: item.album,
      duration: item.duration,
      cover: (await coverSrcFor(item)) ?? item.cover,
      spotifyUrl: '',
      audioUrl: await srcFor(path),
      source: 'offline',
    }
  } catch {
    return null
  }
}

function filesOf(item: DownloadedTrack): string[] {
  return [
    `${DOWNLOAD_DIR}/${item.fileName}`,
    ...(item.coverFileName ? [`${COVER_DIR}/${item.coverFileName}`] : []),
    `${LYRICS_DIR}/${item.key}.json`,
    `${META_DIR}/${item.key}.json`,
  ]
}

export async function removeDownload(key: string): Promise<void> {
  await removeDownloads([key])
}

/** Menghapus banyak unduhan sekaligus (lagu, sampul, lirik, meta). Mengembalikan jumlah lagu yang dihapus. */
export async function removeDownloads(keys: readonly string[]): Promise<number> {
  const wanted = new Set(keys)
  const items = state.items.filter((entry) => wanted.has(entry.key))
  if (items.length === 0) return 0
  // Entri dibuang dulu (sinkron, sekali) supaya pemutar tidak lagi menemukannya selagi berkas dihapus.
  setItems(state.items.filter((entry) => !wanted.has(entry.key)))
  for (const item of items) {
    for (const path of filesOf(item)) {
      try {
        await Filesystem.deleteFile({ path, directory: Directory.External })
      } catch {
        // Sudah tidak ada.
      }
    }
  }
  return items.length
}

export function toPlaylistTrack(item: DownloadedTrack): PlaylistTrack {
  return {
    id: item.key,
    title: item.title,
    artists: item.artists,
    album: item.album,
    duration: item.duration,
    url: item.url,
    cover: item.cover,
  }
}

export function totalBytes(items: readonly DownloadedTrack[]): number {
  return items.reduce((sum, item) => sum + item.bytes, 0)
}
