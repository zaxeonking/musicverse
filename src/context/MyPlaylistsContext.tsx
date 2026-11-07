import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { MyPlaylist, StorageHealth } from '../types/library'
import type { PlaylistTrack } from '../types/spotify'
import {
  addTrackToMyPlaylist,
  addTracksToMyPlaylist,
  createMyPlaylist,
  deleteMyPlaylist,
  deleteMyPlaylists,
  moveTrackInMyPlaylist,
  transferTracks as transferTracksIn,
  MY_PLAYLISTS_KEY,
  readMyPlaylists,
  removeTrackFromMyPlaylist,
  ensureLiked,
  toggleLikeIn,
  setPinnedIn,
  trackIdentity,
  LIKED_ID,
  renameMyPlaylist,
  restoreMyPlaylist,
  writeMyPlaylists,
  type BulkAddResult,
  type MyPlaylistChange,
  type MyPlaylistFailure,
  type TransferResult,
} from '../utils/myPlaylistStorage'

/** Alasan gagal: kegagalan aturan (lihat MyPlaylistFailure) atau penyimpanan perangkat. */
export type MyPlaylistError = MyPlaylistFailure | 'quota' | 'unavailable'
export type MyPlaylistResult<T> = { ok: true; value: T } | { ok: false; reason: MyPlaylistError }

export interface MyPlaylistsContextValue {
  /** Terbaru diubah lebih dulu. */
  playlists: readonly MyPlaylist[]
  health: StorageHealth
  getPlaylist: (id: string) => MyPlaylist | undefined
  createPlaylist: (name: string, sourceId?: string) => MyPlaylistResult<MyPlaylist>
  renamePlaylist: (id: string, name: string) => MyPlaylistResult<MyPlaylist>
  deletePlaylist: (id: string) => MyPlaylistResult<null>
  /** Menghapus banyak playlist dalam satu penulisan; mengembalikan yang benar-benar terhapus (untuk Urungkan). */
  deletePlaylists: (ids: readonly string[]) => MyPlaylistResult<MyPlaylist[]>
  /** Mengembalikan playlist yang baru dihapus (untuk Urungkan). */
  restorePlaylist: (playlist: MyPlaylist) => MyPlaylistResult<MyPlaylist>
  addTrack: (playlistId: string, track: PlaylistTrack) => MyPlaylistResult<MyPlaylist>
  /** Menambah banyak lagu sekaligus; yang sudah ada dilewati. */
  addTracks: (playlistId: string, tracks: readonly PlaylistTrack[]) => MyPlaylistResult<BulkAddResult>
  /**
   * Playlist untuk hasil "Unduh semua": memakai playlist yang sudah dibuat dari playlist Spotify yang sama,
   * atau membuat yang baru bernama sama. Lagunya langsung dimasukkan.
   */
  saveDownloadedPlaylist: (sourceId: string, name: string, tracks: readonly PlaylistTrack[]) => MyPlaylistResult<{ playlist: MyPlaylist } & BulkAddResult>
  removeTrack: (playlistId: string, trackId: string) => MyPlaylistResult<MyPlaylist>
  moveTrack: (playlistId: string, from: number, to: number) => MyPlaylistResult<MyPlaylist>
  /**
   * Menyalin (`copy`) atau memindahkan (`move`) lagu antar playlist buatanmu dalam satu perubahan.
   * `trackIds` = ID lagu di playlist asal; null = semua lagunya.
   */
  /** Sematkan / lepas sematan playlist (disematkan tampil tepat di bawah Lagu Disukai). */
  setPinned: (id: string, pinned: boolean) => MyPlaylistResult<MyPlaylist>
  /** Lagu ini ada di playlist bawaan "Lagu Disukai"? */
  isLiked: (track: Pick<PlaylistTrack, 'url'>) => boolean
  /** Suka / batal suka (playlist bawaan dibuat otomatis). */
  toggleLike: (track: PlaylistTrack) => MyPlaylistResult<{ liked: boolean }>
  transferTracks: (fromId: string, toId: string, trackIds: readonly string[] | null, mode: 'copy' | 'move') => MyPlaylistResult<TransferResult>
}

const MyPlaylistsContext = createContext<MyPlaylistsContextValue | null>(null)

const byRecent = (list: readonly MyPlaylist[]) => {
  const others = [...list].filter((item) => item.id !== LIKED_ID).sort((a, b) => b.updatedAt - a.updatedAt)
  const pinned = others.filter((item) => item.pinned)
  const rest = others.filter((item) => !item.pinned)
  // Urutan tetap: "Lagu Disukai" (bawaan, tak bisa digeser) -> yang disematkan -> sisanya menurut perubahan terbaru.
  return ensureLiked(list).slice(0, 1).concat(pinned, rest)
}

/** Pesan singkat untuk pengguna dari alasan gagal. */
// eslint-disable-next-line react-refresh/only-export-components
export function myPlaylistErrorText(reason: MyPlaylistError): string {
  switch (reason) {
    case 'limit':
      return 'Batas playlist atau jumlah lagu sudah tercapai'
    case 'invalid':
      return 'Nama atau data tidak valid'
    case 'protected':
      return 'Playlist bawaan tidak bisa dihapus atau diganti namanya'
    case 'duplicate':
      return 'Lagu ini sudah ada di playlist itu'
    case 'missing':
      return 'Playlist tidak ditemukan'
    case 'quota':
      return 'Penyimpanan browser penuh, perubahan tidak tersimpan'
    case 'unavailable':
      return 'Browser tidak mengizinkan penyimpanan lokal'
  }
}

/**
 * Sumber data "Playlist saya". Setiap perubahan membaca ulang penyimpanan dulu (baca-ubah-tulis) supaya
 * dua tab tidak saling menimpa. Perubahan yang gagal tersimpan TIDAK ditampilkan seolah berhasil. Jika
 * localStorage tidak bisa diakses sama sekali, playlist hidup di memori selama tab terbuka.
 */
export function MyPlaylistsProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(readMyPlaylists)
  const [playlists, setPlaylists] = useState<MyPlaylist[]>(() => byRecent(initial.items))
  const [health, setHealth] = useState<StorageHealth>(initial.health)
  const listRef = useRef(playlists)

  const commit = useCallback((list: MyPlaylist[]) => {
    const sorted = byRecent(list)
    listRef.current = sorted
    setPlaylists(sorted)
  }, [])

  const mutate = useCallback(
    <T,>(op: (list: readonly MyPlaylist[]) => MyPlaylistChange<T>): MyPlaylistResult<T> => {
      const read = readMyPlaylists()
      const memoryOnly = read.health === 'unavailable'
      const base = memoryOnly ? listRef.current : read.items
      const change = op(base)
      if (!change.ok) return { ok: false, reason: change.reason }
      const write = writeMyPlaylists(change.list)
      if (!write.ok) {
        if (write.reason === 'quota') {
          commit(base)
          return { ok: false, reason: 'quota' }
        }
        // Penyimpanan tidak tersedia: tetap bekerja di memori, tapi beri tahu lewat `health`.
        setHealth('unavailable')
      } else {
        setHealth('ok')
      }
      commit(change.list)
      return { ok: true, value: change.value }
    },
    [commit],
  )

  const createPlaylist = useCallback((name: string, sourceId?: string) => mutate((l) => createMyPlaylist(l, name, Date.now(), sourceId)), [mutate])
  const renamePlaylist = useCallback((id: string, name: string) => mutate((l) => renameMyPlaylist(l, id, name)), [mutate])
  const deletePlaylist = useCallback((id: string) => mutate((l) => deleteMyPlaylist(l, id)), [mutate])
  const deletePlaylists = useCallback((ids: readonly string[]) => mutate((l) => deleteMyPlaylists(l, ids)), [mutate])
  const restorePlaylist = useCallback((playlist: MyPlaylist) => mutate((l) => restoreMyPlaylist(l, playlist)), [mutate])
  const addTrack = useCallback((id: string, track: PlaylistTrack) => mutate((l) => addTrackToMyPlaylist(l, id, track)), [mutate])
  const addTracks = useCallback((id: string, tracks: readonly PlaylistTrack[]) => mutate((l) => addTracksToMyPlaylist(l, id, tracks)), [mutate])
  const saveDownloadedPlaylist = useCallback(
    (sourceId: string, name: string, tracks: readonly PlaylistTrack[]) =>
      mutate((l) => {
        // Satu kali baca-ubah-tulis: cari playlist asal yang sama, kalau belum ada buat dulu, lalu isi.
        const existing = l.find((item) => item.sourceId === sourceId)
        let base: readonly MyPlaylist[] = l
        let target = existing
        if (!target) {
          const made = createMyPlaylist(l, name, Date.now(), sourceId)
          if (!made.ok) return made
          base = made.list
          target = made.value
        }
        const filled = addTracksToMyPlaylist(base, target.id, tracks)
        if (!filled.ok) return filled
        const playlist = filled.list.find((item) => item.id === target.id) ?? target
        return { ok: true, list: filled.list, value: { playlist, ...filled.value } }
      }),
    [mutate],
  )
  const setPinned = useCallback((id: string, pinned: boolean) => mutate((l) => setPinnedIn(l, id, pinned)), [mutate])
  const toggleLike = useCallback((track: PlaylistTrack) => mutate((l) => toggleLikeIn(l, track)), [mutate])
  const removeTrack = useCallback((id: string, trackId: string) => mutate((l) => removeTrackFromMyPlaylist(l, id, trackId)), [mutate])
  const moveTrack = useCallback((id: string, from: number, to: number) => mutate((l) => moveTrackInMyPlaylist(l, id, from, to)), [mutate])
  const transferTracks = useCallback(
    (fromId: string, toId: string, trackIds: readonly string[] | null, mode: 'copy' | 'move') =>
      mutate((l) => transferTracksIn(l, fromId, toId, trackIds, mode)),
    [mutate],
  )

  /* Tab lain mengubah playlist: ikuti. */
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== MY_PLAYLISTS_KEY) return
      const next = readMyPlaylists()
      if (next.health === 'unavailable') return
      commit(next.items)
      setHealth(next.health)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [commit])

  const value = useMemo<MyPlaylistsContextValue>(
    () => ({
      playlists,
      health,
      getPlaylist: (id: string) => playlists.find((item) => item.id === id),
      createPlaylist,
      renamePlaylist,
      deletePlaylist,
      deletePlaylists,
      restorePlaylist,
      addTrack,
      addTracks,
      saveDownloadedPlaylist,
      removeTrack,
      moveTrack,
      isLiked: (track: Pick<PlaylistTrack, 'url'>) => {
        const identity = trackIdentity(track)
        return playlists.find((item) => item.id === LIKED_ID)?.tracks.some((item) => trackIdentity(item) === identity) ?? false
      },
      toggleLike,
      setPinned,
      transferTracks,
    }),
    [playlists, health, createPlaylist, renamePlaylist, deletePlaylist, deletePlaylists, restorePlaylist, addTrack, addTracks, saveDownloadedPlaylist, removeTrack, moveTrack, transferTracks, toggleLike, setPinned],
  )

  return <MyPlaylistsContext.Provider value={value}>{children}</MyPlaylistsContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useMyPlaylists(): MyPlaylistsContextValue {
  const context = useContext(MyPlaylistsContext)
  if (!context) throw new Error('useMyPlaylists harus dipakai di dalam <MyPlaylistsProvider>.')
  return context
}
