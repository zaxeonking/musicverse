import { useSyncExternalStore } from 'react'
import { albumsFromSongs, fetchAlbumSongs, fetchArtistAlbums, fetchArtistSongs, searchArtists, type AlbumHit, type ArtistHit } from '../services/artistApi'
import type { PlaylistTrack } from '../types/spotify'
import { normalizeSearchText } from './trackSearch'

/** Jenis pencarian untuk teks yang diketik di Beranda: lagu (alur lama) atau artis. */
export type SearchMode = 'track' | 'artist'
export type ArtistPhase = 'idle' | 'searching' | 'list' | 'loading' | 'songs' | 'error'
/** Urutan daftar lagu di halaman artis: populer (urutan sumber) atau A–Z. */
export type ArtistSort = 'popular' | 'az'
/** Tab di halaman artis. */
export type ArtistTab = 'songs' | 'albums'
export type LoadPhase = 'idle' | 'loading' | 'ready' | 'error'

export interface ArtistSearchState {
  mode: SearchMode
  /** Kata kunci artis terakhir yang dicari (dipulihkan ke kolom saat kembali ke Beranda). */
  submitted: string
  phase: ArtistPhase
  artists: ArtistHit[]
  selected: ArtistHit | null
  songs: PlaylistTrack[]
  sort: ArtistSort
  tab: ArtistTab
  /** Diskografi artis yang sedang dibuka (dimuat saat tab Album dibuka). */
  albums: AlbumHit[]
  albumsPhase: LoadPhase
  /** Album yang sedang dibuka di dalam halaman artis, beserta lagunya. */
  album: AlbumHit | null
  albumSongs: PlaylistTrack[]
  albumPhase: LoadPhase
  /** Artis yang terakhir dibuka (terbaru dulu), disimpan di perangkat. */
  recent: ArtistHit[]
}

/* ---------- Riwayat artis yang dibuka (disimpan di perangkat) ---------- */

const RECENT_KEY = 'mv:artistRecent:v1'
const MAX_RECENT = 8

function readRecent(): ArtistHit[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]')
    if (!Array.isArray(parsed)) return []
    const out: ArtistHit[] = []
    for (const item of parsed as Array<Record<string, unknown>>) {
      if (typeof item?.id !== 'string' || typeof item.name !== 'string') continue
      out.push({
        id: item.id,
        name: item.name,
        picture: typeof item.picture === 'string' ? item.picture : '',
        fans: typeof item.fans === 'number' ? item.fans : 0,
      })
      if (out.length >= MAX_RECENT) break
    }
    return out
  } catch {
    return []
  }
}

function writeRecent(list: readonly ArtistHit[]): void {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list))
  } catch {
    /* abaikan: riwayat hanya kemudahan */
  }
}

/* ---------- Cache hasil (di memori, selama app berjalan) ---------- */

const CACHE_TTL_MS = 30 * 60_000
const CACHE_MAX = 30
interface CacheEntry<T> {
  at: number
  value: T
}
const searchCache = new Map<string, CacheEntry<ArtistHit[]>>()
const songsCache = new Map<string, CacheEntry<PlaylistTrack[]>>()
const albumsCache = new Map<string, CacheEntry<AlbumHit[]>>()
const albumSongsCache = new Map<string, CacheEntry<PlaylistTrack[]>>()

function cacheGet<T>(cache: Map<string, CacheEntry<T>>, key: string): T | undefined {
  const hit = cache.get(key)
  if (!hit) return undefined
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key)
    return undefined
  }
  return hit.value
}

function cachePut<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T): void {
  cache.delete(key)
  cache.set(key, { at: Date.now(), value })
  while (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value
    if (oldest === undefined) break
    cache.delete(oldest)
  }
}

/**
 * Pencarian artis di Beranda disimpan di luar komponen supaya tidak hilang saat pindah halaman
 * (Playlist, Cari, dst.) lalu kembali: mode, daftar artis, artis yang sedang dibuka, dan lagunya tetap ada.
 * Hasil juga di-cache (30 menit) supaya mencari/membuka artis yang sama lagi langsung muncul.
 * Status halaman hanya hidup selama app berjalan; hanya riwayat "Terakhir dibuka" yang disimpan ke perangkat.
 */
const INITIAL: ArtistSearchState = {
  mode: 'track',
  submitted: '',
  phase: 'idle',
  artists: [],
  selected: null,
  songs: [],
  sort: 'popular',
  tab: 'songs',
  albums: [],
  albumsPhase: 'idle',
  album: null,
  albumSongs: [],
  albumPhase: 'idle',
  recent: readRecent(),
}

const NO_ALBUM: Pick<ArtistSearchState, 'tab' | 'albums' | 'albumsPhase' | 'album' | 'albumSongs' | 'albumPhase'> = {
  tab: 'songs',
  albums: [],
  albumsPhase: 'idle',
  album: null,
  albumSongs: [],
  albumPhase: 'idle',
}

let state: ArtistSearchState = INITIAL
const listeners = new Set<() => void>()
let searchCtl: AbortController | null = null
let songsCtl: AbortController | null = null
let albumsCtl: AbortController | null = null
let albumCtl: AbortController | null = null
/** Artis dibuka dari "Terakhir dibuka" (bukan dari hasil cari): tombol kembali mengarah ke sana. */
let openedFromRecent = false

function set(patch: Partial<ArtistSearchState>) {
  state = { ...state, ...patch }
  listeners.forEach((listener) => listener())
}

function abortAlbums() {
  albumsCtl?.abort()
  albumCtl?.abort()
  albumsCtl = null
  albumCtl = null
}

function abortAll() {
  searchCtl?.abort()
  songsCtl?.abort()
  searchCtl = null
  songsCtl = null
  abortAlbums()
}

/** Cari artis dengan cache yang sama dipakai halaman lain (mis. blok Artis di tab Cari). */
export async function cachedArtistSearch(query: string, signal?: AbortSignal): Promise<ArtistHit[]> {
  const key = normalizeSearchText(query)
  const cached = cacheGet(searchCache, key)
  if (cached) return cached
  const found = await searchArtists(query, signal)
  if (found.length > 0) cachePut(searchCache, key, found)
  return found
}

export function getArtistSearchState(): ArtistSearchState {
  return state
}

export const artistSearch = {
  setMode(mode: SearchMode) {
    if (mode !== state.mode) set({ mode })
  },

  setSort(sort: ArtistSort) {
    if (sort !== state.sort) set({ sort })
  },

  /** Cari daftar artis dari kata kunci. */
  search(query: string) {
    abortAll()
    openedFromRecent = false
    const key = normalizeSearchText(query)
    const cached = cacheGet(searchCache, key)
    if (cached) {
      set({ submitted: query, phase: 'list', artists: cached, selected: null, songs: [], ...NO_ALBUM })
      return
    }
    const ctl = new AbortController()
    searchCtl = ctl
    set({ submitted: query, phase: 'searching', artists: [], selected: null, songs: [], ...NO_ALBUM })
    searchArtists(query, ctl.signal)
      .then((found) => {
        if (ctl.signal.aborted) return
        if (found.length > 0) cachePut(searchCache, key, found)
        set({ artists: found, phase: 'list' })
      })
      .catch(() => {
        if (!ctl.signal.aborted) set({ phase: 'error' })
      })
  },

  /** Buka satu artis dan muat lagunya. `fromRecent`: dibuka dari daftar "Terakhir dibuka". */
  open(artist: ArtistHit, fromRecent = false) {
    songsCtl?.abort()
    abortAlbums()
    openedFromRecent = fromRecent
    const recent = [artist, ...state.recent.filter((item) => item.id !== artist.id)].slice(0, MAX_RECENT)
    writeRecent(recent)
    const cached = cacheGet(songsCache, artist.id)
    if (cached) {
      songsCtl = null
      set({ selected: artist, songs: cached, phase: 'songs', recent, ...NO_ALBUM })
      return
    }
    const ctl = new AbortController()
    songsCtl = ctl
    set({ selected: artist, songs: [], phase: 'loading', recent, ...NO_ALBUM })
    fetchArtistSongs(artist, ctl.signal)
      .then((found) => {
        if (ctl.signal.aborted) return
        if (found.length > 0) cachePut(songsCache, artist.id, found)
        set({ songs: found, phase: 'songs' })
        if (state.tab === 'albums' && state.albums.length === 0 && state.albumsPhase !== 'loading') artistSearch.loadAlbums()
      })
      .catch(() => {
        if (!ctl.signal.aborted) set({ phase: 'error' })
      })
  },

  /** Pindah tab Lagu / Album; diskografi dimuat saat tab Album pertama dibuka. */
  setTab(tab: ArtistTab) {
    if (tab !== state.tab) set({ tab })
    if (tab === 'albums' && (state.albumsPhase === 'idle' || state.albumsPhase === 'error')) artistSearch.loadAlbums()
  },

  loadAlbums() {
    const artist = state.selected
    if (!artist) return
    albumsCtl?.abort()
    const cached = cacheGet(albumsCache, artist.id)
    if (cached) {
      albumsCtl = null
      set({ albums: cached, albumsPhase: 'ready' })
      return
    }
    const ctl = new AbortController()
    albumsCtl = ctl
    set({ albumsPhase: 'loading' })
    /** Daftar album Deezer kosong atau gagal: susun dari lagu yang sudah dimuat supaya tab Album tidak kosong. */
    const fallback = (failed: boolean) => {
      const derived = albumsFromSongs(state.songs)
      if (derived.length > 0) set({ albums: derived, albumsPhase: 'ready' })
      else set({ albums: [], albumsPhase: failed ? 'error' : 'ready' })
    }
    fetchArtistAlbums(artist.id, ctl.signal)
      .then((found) => {
        if (ctl.signal.aborted) return
        if (found.length === 0) return fallback(false)
        cachePut(albumsCache, artist.id, found)
        set({ albums: found, albumsPhase: 'ready' })
      })
      .catch(() => {
        if (!ctl.signal.aborted) fallback(true)
      })
  },

  /** Buka satu album (di dalam halaman artis) dan muat lagunya. */
  openAlbum(album: AlbumHit) {
    const artist = state.selected
    if (!artist) return
    albumCtl?.abort()
    if (album.local) {
      albumCtl = null
      const key = normalizeSearchText(album.title)
      set({ album, albumSongs: state.songs.filter((song) => normalizeSearchText(song.album) === key), albumPhase: 'ready' })
      return
    }
    const cached = cacheGet(albumSongsCache, album.id)
    if (cached) {
      albumCtl = null
      set({ album, albumSongs: cached, albumPhase: 'ready' })
      return
    }
    const ctl = new AbortController()
    albumCtl = ctl
    set({ album, albumSongs: [], albumPhase: 'loading' })
    fetchAlbumSongs(album, artist.name, ctl.signal)
      .then((found) => {
        if (ctl.signal.aborted) return
        if (found.length > 0) cachePut(albumSongsCache, album.id, found)
        set({ albumSongs: found, albumPhase: 'ready' })
      })
      .catch(() => {
        if (!ctl.signal.aborted) set({ albumPhase: 'error' })
      })
  },

  closeAlbum() {
    albumCtl?.abort()
    albumCtl = null
    set({ album: null, albumSongs: [], albumPhase: 'idle' })
  },

  /** Dari detail artis kembali ke daftar artis (atau ke riwayat kalau dibuka dari sana). */
  back() {
    songsCtl?.abort()
    songsCtl = null
    abortAlbums()
    const toList = !openedFromRecent && (state.artists.length > 0 || state.submitted !== '')
    set({ selected: null, songs: [], phase: toList ? 'list' : 'idle', ...NO_ALBUM })
  },

  /** Hapus semua hasil artis (mode tetap). */
  clear() {
    abortAll()
    openedFromRecent = false
    set({ submitted: '', phase: 'idle', artists: [], selected: null, songs: [], ...NO_ALBUM })
  },

  clearRecent() {
    writeRecent([])
    set({ recent: [] })
  },
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useArtistSearch(): ArtistSearchState {
  return useSyncExternalStore(subscribe, getArtistSearchState, getArtistSearchState)
}
