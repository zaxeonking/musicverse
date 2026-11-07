import type { MyPlaylist, StorageHealth } from '../types/library'
import type { PlaylistTrack } from '../types/spotify'
import { parseStoredTrack, toStoredTrack } from './libraryStorage'
import { readJson, writeJson, type WriteOutcome } from './safeStorage'
import { extractTrackId } from './spotifyUrl'

/**
 * Penyimpanan "Playlist saya": playlist buatan pengguna di perangkat. Data dari penyimpanan dianggap
 * tidak tepercaya dan divalidasi ulang. Fungsi pengubah di bawah murni (tidak menyentuh penyimpanan)
 * supaya mudah diuji; context yang membaca-ubah-tulis.
 */

export const MY_PLAYLISTS_KEY = 'musicverse:my-playlists:v1'
const VERSION = 1
export const MAX_MY_PLAYLISTS = 100
export const MAX_MY_PLAYLIST_TRACKS = 1000
export const MAX_MY_PLAYLIST_NAME = 60

/** Playlist bawaan "Lagu Disukai" (tombol hati). ID tetap; tidak bisa dihapus atau diganti namanya. */
export const LIKED_ID = 'my-liked'
export const LIKED_NAME = 'Lagu Disukai'
export const isLikedId = (id: string): boolean => id === LIKED_ID

/** Pastikan playlist bawaan ada (kosong bila belum pernah ada). Selalu di urutan pertama. */
export function ensureLiked(list: readonly MyPlaylist[], now = Date.now()): MyPlaylist[] {
  const liked = list.find((item) => item.id === LIKED_ID)
  const rest = list.filter((item) => item.id !== LIKED_ID)
  return [liked ? { ...liked, name: LIKED_NAME } : { id: LIKED_ID, name: LIKED_NAME, createdAt: now, updatedAt: now, tracks: [] }, ...rest]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function time(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0
}

/** Nama yang dirapikan (spasi ganda dihapus, dipotong ke batas), atau null jika kosong. */
export function cleanPlaylistName(raw: string): string | null {
  const name = raw.replace(/\s+/g, ' ').trim().slice(0, MAX_MY_PLAYLIST_NAME).trim()
  return name === '' ? null : name
}

/* ------------------------------------------------------------------ */
/* Membaca / menulis                                                    */
/* ------------------------------------------------------------------ */

export function parseMyPlaylist(raw: unknown): MyPlaylist | null {
  if (!isRecord(raw)) return null
  const { id, name } = raw
  if (typeof id !== 'string' || !id.startsWith('my-') || typeof name !== 'string') return null
  const clean = cleanPlaylistName(name)
  if (!clean || !Array.isArray(raw.tracks)) return null

  const seen = new Set<string>()
  const tracks: PlaylistTrack[] = []
  for (const item of raw.tracks as unknown[]) {
    const track = parseStoredTrack(item)
    // ID harus unik: dipakai sebagai kunci baris dan penanda lagu aktif di antrean.
    if (!track || seen.has(track.id)) continue
    seen.add(track.id)
    tracks.push(track)
    if (tracks.length >= MAX_MY_PLAYLIST_TRACKS) break
  }
  const createdAt = time(raw.createdAt)
  const sourceId = typeof raw.sourceId === 'string' && raw.sourceId ? raw.sourceId : undefined
  return {
    id,
    name: clean,
    createdAt,
    updatedAt: time(raw.updatedAt) || createdAt,
    tracks,
    ...(sourceId ? { sourceId } : {}),
    ...(raw.pinned === true && id !== LIKED_ID ? { pinned: true } : {}),
  }
}

export interface MyPlaylistsRead {
  items: MyPlaylist[]
  health: StorageHealth
}

export function readMyPlaylists(): MyPlaylistsRead {
  const outcome = readJson(MY_PLAYLISTS_KEY)
  if (outcome.status === 'unavailable') return { items: [], health: 'unavailable' }
  if (outcome.status === 'empty') return { items: [], health: 'ok' }
  if (outcome.status === 'corrupt') return { items: [], health: 'recovered' }
  const { value } = outcome
  if (!isRecord(value) || value.version !== VERSION || !Array.isArray(value.playlists)) {
    return { items: [], health: 'recovered' }
  }
  const entries = value.playlists as unknown[]
  const byId = new Map<string, MyPlaylist>()
  for (const entry of entries) {
    const parsed = parseMyPlaylist(entry)
    if (parsed && !byId.has(parsed.id)) byId.set(parsed.id, parsed)
  }
  const items = [...byId.values()].slice(0, MAX_MY_PLAYLISTS)
  return { items, health: items.length === entries.length ? 'ok' : 'recovered' }
}

export function writeMyPlaylists(list: readonly MyPlaylist[]): WriteOutcome {
  return writeJson(MY_PLAYLISTS_KEY, {
    version: VERSION,
    playlists: list.map((p) => ({ ...p, tracks: p.tracks.map(toStoredTrack) })),
  })
}

/* ------------------------------------------------------------------ */
/* Pengubah murni                                                       */
/* ------------------------------------------------------------------ */

export type MyPlaylistFailure = 'limit' | 'invalid' | 'duplicate' | 'missing' | 'protected'
export type MyPlaylistChange<T> = { ok: true; list: MyPlaylist[]; value: T } | { ok: false; reason: MyPlaylistFailure }

let counter = 0
function uid(): string {
  counter = (counter + 1) % 1_000_000
  return `${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

/** Kunci untuk mendeteksi lagu yang sama (ID Spotify bila ada, selain itu URL). */
export function trackIdentity(track: Pick<PlaylistTrack, 'url'>): string {
  return extractTrackId(track.url) ?? track.url
}

export function createMyPlaylist(
  list: readonly MyPlaylist[],
  rawName: string,
  now = Date.now(),
  sourceId?: string,
): MyPlaylistChange<MyPlaylist> {
  const name = cleanPlaylistName(rawName)
  if (!name) return { ok: false, reason: 'invalid' }
  if (list.length >= MAX_MY_PLAYLISTS) return { ok: false, reason: 'limit' }
  const playlist: MyPlaylist = {
    id: `my-${uid()}`,
    name,
    createdAt: now,
    updatedAt: now,
    tracks: [],
    ...(sourceId ? { sourceId } : {}),
  }
  return { ok: true, list: [playlist, ...list], value: playlist }
}

function update(
  list: readonly MyPlaylist[],
  id: string,
  change: (playlist: MyPlaylist) => MyPlaylist | MyPlaylistFailure,
): MyPlaylistChange<MyPlaylist> {
  const index = list.findIndex((item) => item.id === id)
  if (index === -1) return { ok: false, reason: 'missing' }
  const next = change(list[index])
  if (typeof next === 'string') return { ok: false, reason: next }
  const copy = [...list]
  copy[index] = next
  return { ok: true, list: copy, value: next }
}

export function renameMyPlaylist(list: readonly MyPlaylist[], id: string, rawName: string, now = Date.now()) {
  if (isLikedId(id)) return { ok: false, reason: 'protected' } as const
  const name = cleanPlaylistName(rawName)
  if (!name) return { ok: false, reason: 'invalid' } as const
  return update(list, id, (p) => ({ ...p, name, updatedAt: now }))
}

/** Sematkan / lepas sematan. Tidak mengubah `updatedAt` (urutan terbaru tidak ikut bergeser). "Lagu Disukai" selalu di atas. */
export function setPinnedIn(list: readonly MyPlaylist[], id: string, pinned: boolean): MyPlaylistChange<MyPlaylist> {
  if (isLikedId(id)) return { ok: false, reason: 'protected' }
  return update(list, id, (p) => {
    const { pinned: _old, ...rest } = p
    void _old
    return pinned ? { ...rest, pinned: true } : rest
  })
}

/** Mengembalikan playlist yang baru dihapus (ID, isi, sematan, dan waktunya sama seperti semula). Dipakai tombol Urungkan. */
export function restoreMyPlaylist(list: readonly MyPlaylist[], playlist: MyPlaylist): MyPlaylistChange<MyPlaylist> {
  if (isLikedId(playlist.id)) return { ok: false, reason: 'protected' }
  if (list.some((item) => item.id === playlist.id)) return { ok: true, list: [...list], value: playlist }
  if (list.length >= MAX_MY_PLAYLISTS) return { ok: false, reason: 'limit' }
  return { ok: true, list: [playlist, ...list], value: playlist }
}

export function deleteMyPlaylist(list: readonly MyPlaylist[], id: string): MyPlaylistChange<null> {
  if (isLikedId(id)) return { ok: false, reason: 'protected' }
  if (!list.some((item) => item.id === id)) return { ok: false, reason: 'missing' }
  return { ok: true, list: list.filter((item) => item.id !== id), value: null }
}

/**
 * Menghapus banyak playlist sekaligus dalam satu perubahan (mode pilih banyak di Koleksi).
 * "Lagu Disukai" dan ID yang tidak ada dilewati; `value` = playlist yang benar-benar terhapus (untuk Urungkan).
 * Gagal ('missing') bila tidak ada satu pun yang bisa dihapus.
 */
export function deleteMyPlaylists(list: readonly MyPlaylist[], ids: readonly string[]): MyPlaylistChange<MyPlaylist[]> {
  const wanted = new Set(ids.filter((id) => !isLikedId(id)))
  const removed = list.filter((item) => wanted.has(item.id))
  if (removed.length === 0) return { ok: false, reason: ids.length > 0 && ids.every(isLikedId) ? 'protected' : 'missing' }
  return { ok: true, list: list.filter((item) => !wanted.has(item.id)), value: removed }
}

/** Suka / batal suka sebuah lagu di playlist bawaan. Lagu baru ditaruh di paling atas (seperti Spotify). */
export function toggleLikeIn(list: readonly MyPlaylist[], track: PlaylistTrack, now = Date.now()): MyPlaylistChange<{ liked: boolean }> {
  const base = ensureLiked(list, now)
  const liked = base[0]
  const identity = trackIdentity(track)
  const exists = liked.tracks.some((item) => trackIdentity(item) === identity)
  if (!exists && liked.tracks.length >= MAX_MY_PLAYLIST_TRACKS) return { ok: false, reason: 'limit' }
  const nextTracks = exists
    ? liked.tracks.filter((item) => trackIdentity(item) !== identity)
    : [{ ...toStoredTrack(track), id: `${uid()}-${extractTrackId(track.url) ?? 'track'}` }, ...liked.tracks]
  return { ok: true, list: [{ ...liked, tracks: nextTracks, updatedAt: now }, ...base.slice(1)], value: { liked: !exists } }
}

/** Menambah salinan lagu di akhir playlist. Lagu yang sama (ID Spotify/URL) tidak ditambahkan dua kali. */
export function addTrackToMyPlaylist(list: readonly MyPlaylist[], id: string, track: PlaylistTrack, now = Date.now()) {
  return update(list, id, (p) => {
    const identity = trackIdentity(track)
    if (p.tracks.some((item) => trackIdentity(item) === identity)) return 'duplicate'
    if (p.tracks.length >= MAX_MY_PLAYLIST_TRACKS) return 'limit'
    const copy: PlaylistTrack = { ...toStoredTrack(track), id: `${uid()}-${extractTrackId(track.url) ?? 'track'}` }
    return { ...p, tracks: [...p.tracks, copy], updatedAt: now }
  })
}

export interface BulkAddResult {
  added: number
  /** Sudah ada di playlist itu (atau melewati batas jumlah lagu). */
  skipped: number
}

/** Menambah banyak lagu sekaligus (satu kali baca-tulis). Lagu yang sudah ada dilewati, bukan error. */
export function addTracksToMyPlaylist(
  list: readonly MyPlaylist[],
  id: string,
  tracks: readonly PlaylistTrack[],
  now = Date.now(),
): MyPlaylistChange<BulkAddResult> {
  const index = list.findIndex((item) => item.id === id)
  if (index === -1) return { ok: false, reason: 'missing' }
  const playlist = list[index]
  const known = new Set(playlist.tracks.map(trackIdentity))
  const next = [...playlist.tracks]
  let added = 0
  let skipped = 0
  for (const track of tracks) {
    const identity = trackIdentity(track)
    if (known.has(identity) || next.length >= MAX_MY_PLAYLIST_TRACKS) {
      skipped += 1
      continue
    }
    known.add(identity)
    next.push({ ...toStoredTrack(track), id: `${uid()}-${extractTrackId(track.url) ?? 'track'}` })
    added += 1
  }
  if (added === 0) return { ok: true, list: [...list], value: { added, skipped } }
  const copy = [...list]
  copy[index] = { ...playlist, tracks: next, updatedAt: now }
  return { ok: true, list: copy, value: { added, skipped } }
}

export function removeTrackFromMyPlaylist(list: readonly MyPlaylist[], id: string, trackId: string, now = Date.now()) {
  return update(list, id, (p) => {
    if (!p.tracks.some((item) => item.id === trackId)) return 'missing'
    return { ...p, tracks: p.tracks.filter((item) => item.id !== trackId), updatedAt: now }
  })
}

/** Memindahkan lagu dari posisi `from` ke `to` (0-based). */
export function moveTrackInMyPlaylist(list: readonly MyPlaylist[], id: string, from: number, to: number, now = Date.now()) {
  return update(list, id, (p) => {
    const max = p.tracks.length - 1
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0 || from > max || to > max) return 'invalid'
    if (from === to) return p
    const tracks = [...p.tracks]
    const [moved] = tracks.splice(from, 1)
    tracks.splice(to, 0, moved)
    return { ...p, tracks, updatedAt: now }
  })
}

export interface TransferResult {
  /** Lagu yang benar-benar ditambahkan ke playlist tujuan. */
  added: number
  /** Lagu yang sudah ada di playlist tujuan (tidak ditambah dua kali). */
  duplicates: number
  /** Lagu yang tidak bisa masuk karena playlist tujuan penuh; tetap di playlist asal. */
  kept: number
}

/**
 * Menyalin (`copy`) atau memindahkan (`move`) lagu dari satu playlist ke playlist lain dalam SATU perubahan,
 * jadi pindah tidak pernah menghilangkan lagu di tengah jalan. `trackIds` = ID lagu di playlist asal; null = semua.
 * Pada `move`, lagu yang sudah ada di tujuan ikut dihapus dari asal (hasil akhirnya sama dengan memindahkan);
 * lagu yang tak muat (batas jumlah lagu tercapai) tetap di asal.
 */
export function transferTracks(
  list: readonly MyPlaylist[],
  fromId: string,
  toId: string,
  trackIds: readonly string[] | null,
  mode: 'copy' | 'move',
  now = Date.now(),
): MyPlaylistChange<TransferResult> {
  if (fromId === toId) return { ok: false, reason: 'invalid' }
  const from = list.find((item) => item.id === fromId)
  const to = list.find((item) => item.id === toId)
  if (!from || !to) return { ok: false, reason: 'missing' }
  const wanted = trackIds === null ? from.tracks : from.tracks.filter((track) => trackIds.includes(track.id))
  if (wanted.length === 0) return { ok: false, reason: 'missing' }

  const known = new Set(to.tracks.map(trackIdentity))
  const nextTo = [...to.tracks]
  const leaving = new Set<string>()
  let added = 0
  let duplicates = 0
  let kept = 0
  for (const track of wanted) {
    const identity = trackIdentity(track)
    if (known.has(identity)) {
      duplicates += 1
      leaving.add(track.id)
    } else if (nextTo.length >= MAX_MY_PLAYLIST_TRACKS) {
      kept += 1
    } else {
      known.add(identity)
      nextTo.push({ ...toStoredTrack(track), id: `${uid()}-${extractTrackId(track.url) ?? 'track'}` })
      added += 1
      leaving.add(track.id)
    }
  }

  const next = list.map((item) => {
    if (item.id === toId) return added > 0 ? { ...item, tracks: nextTo, updatedAt: now } : item
    if (item.id === fromId && mode === 'move' && leaving.size > 0) {
      return { ...item, tracks: item.tracks.filter((track) => !leaving.has(track.id)), updatedAt: now }
    }
    return item
  })
  return { ok: true, list: next, value: { added, duplicates, kept } }
}
