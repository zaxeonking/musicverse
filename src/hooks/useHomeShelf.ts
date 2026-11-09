import { useEffect, useState } from 'react'
import type { ShelfDef } from '../config/homeShelves'
import type { NewAlbumHit, PlaylistHit } from '../services/artistApi'
import { getChartPlaylists, getChartTracks, getNewReleases, getShelfPlaylists } from '../services/homeFeed'
import type { PlaylistTrack } from '../types/spotify'

export type ShelfData =
  | { kind: 'playlists'; items: PlaylistHit[] }
  | { kind: 'albums'; items: NewAlbumHit[] }
  | { kind: 'tracks'; items: PlaylistTrack[] }

export type ShelfState = { phase: 'idle' | 'loading' | 'empty' } | { phase: 'ready'; data: ShelfData }

/**
 * Memuat satu deretan Beranda hanya saat `active` (deretannya sudah dekat dengan layar). Deretan di bawah tidak
 * menembak Deezer sebelum digulir ke sana: Beranda cepat terbuka dan kuota permintaan Deezer hemat.
 * Galat jaringan tidak dilempar: deretan yang gagal/kosong jadi `empty` dan tidak tampil.
 */
export function useHomeShelf(def: ShelfDef, active: boolean): ShelfState {
  const [state, setState] = useState<ShelfState>({ phase: 'idle' })

  useEffect(() => {
    if (!active || state.phase !== 'idle') return
    let off = false
    setState({ phase: 'loading' })
    void (async () => {
      const source = def.source
      let data: ShelfData | null = null
      if (source.kind === 'releases') {
        const items = await getNewReleases()
        if (items && items.length > 0) data = { kind: 'albums', items }
      } else if (source.kind === 'chart-playlists') {
        const items = (await getChartPlaylists())?.filter((p) => p.cover)
        if (items && items.length > 0) data = { kind: 'playlists', items }
      } else if (source.kind === 'playlists') {
        const items = await getShelfPlaylists(def.id, source.queries, source.perQuery)
        if (items && items.length > 0) data = { kind: 'playlists', items }
      } else {
        const all = await getChartTracks()
        const items = all?.slice(source.offset, source.offset + source.count) ?? []
        if (items.length > 0) data = { kind: 'tracks', items }
      }
      if (off) return
      setState(data ? { phase: 'ready', data } : { phase: 'empty' })
    })()
    return () => {
      off = true
    }
    // `state.phase` sengaja tidak jadi dependensi: efek ini hanya memulai muat sekali, saat pertama aktif.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, def])

  return state
}
