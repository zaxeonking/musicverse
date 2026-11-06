import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { useEffect, useSyncExternalStore } from 'react'
import type { PlaybackInfo, PlaylistTrack } from '../types/spotify'
import { formatTime } from '../utils/formatTime'
import { LOCAL_KEY_PREFIX, localAudioUri, localIdOf, localUrlFor } from '../utils/localTrack'
import { readJson, writeJson } from '../utils/safeStorage'
import { MusicVerseNative, type NativeLocalAudio } from './musicVerseNative'
import { isAndroidApp, isNativeApp } from './platform'

/**
 * Folder "Lokal" di tab Unduhan: semua audio di HP KECUALI milik MusicVerse (unduhan di Android/data/<paket> dan salinan
 * Music/MusicVerse; pengecualiannya dilakukan di native, `LocalAudioScanner.java`). Hanya dibaca: tidak ada yang disalin,
 * diubah, atau dihapus, dan daftarnya hidup di memori (dipindai ulang saat Unduhan dibuka / aplikasi kembali aktif).
 *
 * Modul ini TIDAK mengimpor spotifyApi (spotifyApi yang mengimpor modul ini untuk memutar lagu lokal), sama seperti offline.ts.
 */

export interface LocalTrack {
  id: string
  title: string
  artists: string
  album: string
  durationMs: number
  bytes: number
  addedAt: number
}

/**
 * idle         belum pernah dipindai
 * scanning     sedang memindai (daftar lama tetap tampil bila ada)
 * ready        daftar siap (kosong juga termasuk ready)
 * denied       izin audio belum diberikan / dicabut
 * unsupported  bukan APK, atau APK lama tanpa fitur ini
 * error        pemindaian gagal
 */
export type LocalStatus = 'idle' | 'scanning' | 'ready' | 'denied' | 'unsupported' | 'error'

export interface LocalState {
  status: LocalStatus
  tracks: readonly LocalTrack[]
  scannedAt: number
}

let state: LocalState = { status: 'idle', tracks: [], scannedAt: 0 }
const listeners = new Set<() => void>()

function setState(next: Partial<LocalState>): void {
  state = { ...state, ...next }
  for (const listener of [...listeners]) listener()
}

export function getLocalState(): LocalState {
  return state
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Hook React: daftar lagu lokal + status pemindaian. */
export function useLocalMusic(): LocalState {
  return useSyncExternalStore(subscribe, getLocalState, getLocalState)
}

const ASKED_KEY = 'musicverse:localAudioAsked'
/** Pindai ulang paling cepat tiap ini saat aplikasi kembali aktif (pemindaian ribuan lagu tidak perlu berulang-ulang). */
const RESUME_RESCAN_MS = 5000

function parseTrack(value: NativeLocalAudio): LocalTrack | null {
  if (typeof value !== 'object' || value === null) return null
  if (typeof value.id !== 'string' || !/^\d{1,18}$/.test(value.id)) return null
  const str = (x: unknown) => (typeof x === 'string' ? x : '')
  const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x > 0 ? x : 0)
  const durationMs = num(value.durationMs)
  if (durationMs <= 0) return null
  return {
    id: value.id,
    title: str(value.title) || 'Tanpa judul',
    artists: str(value.artist),
    album: str(value.album),
    durationMs,
    bytes: num(value.size),
    addedAt: num(value.addedAt),
  }
}

const collator = new Intl.Collator('id', { sensitivity: 'base', numeric: true })

function isUnimplemented(error: unknown): boolean {
  const e = error as { code?: unknown; message?: unknown } | null
  return e?.code === 'UNIMPLEMENTED' || (typeof e?.message === 'string' && /not implemented|unimplemented/i.test(e.message))
}

let inflight: Promise<void> | null = null

/**
 * Memeriksa izin lalu memindai audio. `ask`: boleh menampilkan dialog izin (hanya dari tindakan pengguna atau saat pertama
 * kali Unduhan dibuka). Panggilan yang bersamaan dipakai bersama (satu pemindaian).
 */
export function refreshLocalMusic(options: { ask?: boolean } = {}): Promise<void> {
  if (inflight) return inflight
  inflight = (async () => {
    if (!isAndroidApp()) {
      setState({ status: 'unsupported', tracks: [] })
      return
    }
    try {
      let granted = (await MusicVerseNative.localAudioPermission()).granted
      if (!granted && options.ask) {
        writeJson(ASKED_KEY, true)
        granted = (await MusicVerseNative.requestLocalAudioPermission()).granted
      }
      if (!granted) {
        setState({ status: 'denied', tracks: [] })
        return
      }
      setState({ status: 'scanning' })
      const { tracks } = await MusicVerseNative.scanLocalAudio()
      const parsed = (Array.isArray(tracks) ? tracks : [])
        .map(parseTrack)
        .filter((t): t is LocalTrack => t !== null)
        .sort((a, b) => collator.compare(a.title, b.title) || collator.compare(a.artists, b.artists) || a.addedAt - b.addedAt)
      setState({ status: 'ready', tracks: parsed, scannedAt: Date.now() })
    } catch (error) {
      if (isUnimplemented(error)) setState({ status: 'unsupported', tracks: [] })
      else if ((error as { code?: unknown } | null)?.code === 'PERMISSION') setState({ status: 'denied', tracks: [] })
      else {
        console.warn('[MusicVerse] Gagal memindai audio lokal:', error)
        setState({ status: 'error' })
      }
    }
  })().finally(() => {
    inflight = null
  })
  return inflight
}

/** True bila dialog izin audio sudah pernah ditampilkan otomatis (selanjutnya hanya lewat tombol). */
function askedBefore(): boolean {
  return readJson(ASKED_KEY).status === 'ok'
}

/**
 * Dipasang di halaman Unduhan: memindai saat dibuka (meminta izin otomatis SEKALI, pertama kali) dan lagi saat aplikasi
 * kembali aktif, mis. sesudah mengubah izin di pengaturan atau menambah lagu lewat aplikasi lain.
 */
export function useLocalMusicScan(): void {
  useEffect(() => {
    if (!isNativeApp()) return
    void refreshLocalMusic({ ask: !askedBefore() })
    const resume = App.addListener('appStateChange', ({ isActive }) => {
      if (!isActive || Date.now() - state.scannedAt < RESUME_RESCAN_MS) return
      void refreshLocalMusic()
    })
    return () => {
      void resume.then((handle) => handle.remove())
    }
  }, [])
}

export function toLocalPlaylistTrack(item: LocalTrack): PlaylistTrack {
  return {
    id: `${LOCAL_KEY_PREFIX}${item.id}`,
    title: item.title,
    artists: item.artists,
    album: item.album,
    duration: formatTime(item.durationMs / 1000),
    url: localUrlFor(item.id),
    cover: '',
  }
}

export function totalLocalBytes(items: readonly LocalTrack[]): number {
  return items.reduce((sum, item) => sum + item.bytes, 0)
}

// ---- Sampul ----

const coverCache = new Map<string, string | null>()
const COVER_CACHE_MAX = 600
const COVER_PARALLEL = 3
let coverActive = 0
const coverWaiting: Array<() => void> = []

function withCoverSlot<T>(task: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const run = () => {
      coverActive += 1
      task()
        .then(resolve, reject)
        .finally(() => {
          coverActive -= 1
          coverWaiting.shift()?.()
        })
    }
    if (coverActive < COVER_PARALLEL) run()
    else coverWaiting.push(run)
  })
}

/** URL sampul lagu lokal (berkas JPEG di cache aplikasi), atau undefined bila lagunya tidak punya sampul. Dibatasi 3 sekaligus. */
export async function localCoverSrc(id: string): Promise<string | undefined> {
  if (coverCache.has(id)) return coverCache.get(id) ?? undefined
  try {
    const src = await withCoverSlot(async () => {
      const { has } = await MusicVerseNative.localAudioCover({ id })
      if (!has) return null
      const { uri } = await Filesystem.getUri({ path: `localcovers/${id}.jpg`, directory: Directory.Cache })
      return Capacitor.convertFileSrc(uri)
    })
    if (coverCache.size >= COVER_CACHE_MAX) coverCache.delete(coverCache.keys().next().value as string)
    coverCache.set(id, src)
    return src ?? undefined
  } catch {
    return undefined // gangguan sesaat: tidak di-cache, dicoba lagi lain kali
  }
}

// ---- Pemutaran ----

/**
 * Dipanggil oleh fetchPlaybackInfo untuk lagu lokal: diputar langsung dari berkasnya lewat URI MediaStore (tanpa internet,
 * tanpa proxy, tanpa pencarian sumber). Null = berkasnya sudah tidak ada atau izin audio dicabut.
 */
export async function resolveLocalPlayback(track: { url?: string }): Promise<PlaybackInfo | null> {
  const id = localIdOf(track.url)
  if (id === null || !isNativeApp()) return null
  let entry = state.tracks.find((t) => t.id === id)
  if (!entry) {
    // Mis. sesi lama dipulihkan sebelum Unduhan pernah dibuka: pindai dulu, lalu cek lagi.
    await refreshLocalMusic()
    entry = state.tracks.find((t) => t.id === id)
  }
  if (!entry) return null
  return {
    title: entry.title,
    artist: entry.artists,
    album: entry.album,
    duration: formatTime(entry.durationMs / 1000),
    cover: (await localCoverSrc(id)) ?? '',
    spotifyUrl: '',
    audioUrl: localAudioUri(id),
    source: 'local',
  }
}
