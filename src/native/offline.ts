import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { useSyncExternalStore } from 'react'
import type { PlaybackInfo, PlaylistTrack } from '../types/spotify'
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
const INDEX_KEY = 'musicverse:downloads:v1'
/** Berkas lebih kecil dari ini dianggap rusak (mis. halaman error HTML yang tersimpan sebagai audio). */
export const MIN_VALID_BYTES = 100 * 1024

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
  message?: string
}

interface OfflineState {
  items: readonly DownloadedTrack[]
  transfers: ReadonlyMap<string, Transfer>
  ready: boolean
}

let state: OfflineState = { items: [], transfers: new Map(), ready: false }
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

/** Memuat indeks dan membuang entri yang berkasnya sudah hilang (mis. dihapus lewat pengelola berkas). */
export async function initOffline(): Promise<void> {
  if (!isNativeApp()) return
  const loaded = loadIndex()
  setState({ items: loaded, ready: true })
  const alive: DownloadedTrack[] = []
  for (const item of loaded) {
    try {
      const info = await Filesystem.stat({ path: `${DOWNLOAD_DIR}/${item.fileName}`, directory: Directory.External })
      if (info.size >= MIN_VALID_BYTES) alive.push({ ...item, bytes: info.size })
    } catch {
      // Berkas hilang: entri dibuang.
    }
  }
  if (alive.length !== loaded.length) setItems(alive)
}

/** URL yang bisa dipakai <audio> untuk berkas di Android/data/.../files/<path>. */
async function srcFor(path: string): Promise<string> {
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
}): Promise<PlaybackInfo | null> {
  if (!isNativeApp()) return null
  const item = findDownloaded(track)
  if (!item) return null
  try {
    const path = `${DOWNLOAD_DIR}/${item.fileName}`
    const info = await Filesystem.stat({ path, directory: Directory.External })
    if (info.size < MIN_VALID_BYTES) throw new Error('berkas terlalu kecil')
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
    // Berkas rusak/hilang: buang entri dan biarkan pemutar memakai internet.
    setItems(state.items.filter((entry) => entry.key !== item.key))
    return null
  }
}

export async function removeDownload(key: string): Promise<void> {
  const item = state.items.find((entry) => entry.key === key)
  if (!item) return
  const targets = [`${DOWNLOAD_DIR}/${item.fileName}`, ...(item.coverFileName ? [`${COVER_DIR}/${item.coverFileName}`] : [])]
  for (const path of targets) {
    try {
      await Filesystem.deleteFile({ path, directory: Directory.External })
    } catch {
      // Sudah tidak ada.
    }
  }
  setItems(state.items.filter((entry) => entry.key !== key))
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
