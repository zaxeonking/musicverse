import { useEffect, useMemo, useState } from 'react'
import { useLibrary } from '../context/LibraryContext'
import { useMyPlaylists } from '../context/MyPlaylistsContext'
import type { ArtistHit } from '../services/artistApi'
import {
  getArtistRadio,
  getChartArtists,
  getChartTracks,
  resolveArtistByName,
  resolveArtistByQuery,
} from '../services/homeFeed'
import type { PlaylistTrack } from '../types/spotify'
import { recentKey } from '../utils/libraryStorage'
import { computeStats, readPlayLog } from '../utils/playLog'
import { readSearchHistory } from '../utils/searchHistory'
import { normalizeSearchText } from '../utils/trackSearch'

/**
 * Data Beranda ala Spotify, seluruhnya disusun di perangkat dari riwayat dengar dan riwayat cari:
 *  - playlist yang sering didengar (dari asal playlist di "Baru diputar"),
 *  - artis dari lagu yang sering didengar,
 *  - rekomendasi dari artis favorit dan kata kunci yang pernah dicari (radio artis Deezer),
 *  - "Dengar lagi": lagu yang dulu sering diputar tapi sudah beberapa hari tidak,
 *  - banner acak: artis dan lagu yang mungkin disukai. Pengguna baru (tanpa riwayat) mendapat chart dunia.
 */

const DAY_MS = 86_400_000

export interface FavPlaylist {
  id: string
  title: string
  cover: string
  /** Jumlah lagu berbeda yang diputar dari playlist ini. */
  plays: number
  last: number
  /** Playlist saya (buka halamannya) atau playlist Koleksi (muat lewat URL). */
  mineId?: string
  savedUrl?: string
}

export interface FavArtist {
  name: string
  plays: number
  /** Null selama belum ditemukan atau tidak cocok; kartu lalu mencari lewat nama. */
  hit: ArtistHit | null
}

export interface RecSection {
  id: string
  title: string
  subtitle?: string
  tracks: PlaylistTrack[]
}

export type BannerItem =
  | { id: string; kind: 'artist'; label: string; artist: ArtistHit }
  | { id: string; kind: 'track'; label: string; tracks: PlaylistTrack[]; index: number }

export interface HomeFeed {
  favPlaylists: FavPlaylist[]
  favArtists: FavArtist[]
  sections: RecSection[]
  replay: PlaylistTrack[]
  banner: { items: BannerItem[]; loading: boolean }
}

function sameArtist(a: string, b: string): boolean {
  const x = normalizeSearchText(a)
  const y = normalizeSearchText(b)
  return x !== '' && y !== '' && (x === y || x.includes(y) || y.includes(x))
}

function hashOf(value: string): number {
  let h = 0
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) >>> 0
  return h
}

function useFavoritePlaylists(): FavPlaylist[] {
  const { recent, saved } = useLibrary()
  const { playlists } = useMyPlaylists()
  return useMemo(() => {
    const groups = new Map<string, { count: number; last: number; title: string; cover: string }>()
    for (const entry of recent) {
      if (!entry.playlistId) continue
      const group = groups.get(entry.playlistId) ?? { count: 0, last: 0, title: '', cover: '' }
      group.count += 1
      group.last = Math.max(group.last, entry.playedAt)
      if (!group.cover) group.cover = entry.track.cover
      if (!group.title && entry.playlistTitle) group.title = entry.playlistTitle
      groups.set(entry.playlistId, group)
    }
    const out: FavPlaylist[] = []
    const used = new Set<string>()
    for (const [id, group] of groups) {
      const mine = playlists.find((p) => p.id === id || p.sourceId === id)
      if (mine) {
        if (used.has(`m:${mine.id}`)) continue
        used.add(`m:${mine.id}`)
        out.push({ id, title: mine.name, cover: mine.tracks[0]?.cover ?? group.cover, plays: group.count, last: group.last, mineId: mine.id })
        continue
      }
      const keep = saved.find((s) => s.id === id && s.source !== 'search')
      if (keep) {
        if (used.has(`s:${keep.id}`)) continue
        used.add(`s:${keep.id}`)
        out.push({ id, title: keep.title, cover: keep.cover || group.cover, plays: group.count, last: group.last, savedUrl: keep.url })
      }
    }
    return out.sort((a, b) => b.plays - a.plays || b.last - a.last).slice(0, 10)
  }, [recent, saved, playlists])
}

function useFavoriteArtists(top: ReadonlyArray<{ name: string; count: number }>, enabled: boolean): FavArtist[] {
  const [hits, setHits] = useState<Record<string, ArtistHit | null>>({})
  useEffect(() => {
    if (!enabled) return
    let off = false
    void (async () => {
      for (const item of top) {
        const hit = await resolveArtistByName(item.name)
        if (off) return
        setHits((prev) => ({ ...prev, [item.name]: hit && sameArtist(hit.name, item.name) ? hit : null }))
      }
    })()
    return () => {
      off = true
    }
  }, [top, enabled])
  return useMemo(() => top.map((a) => ({ name: a.name, plays: a.count, hit: hits[a.name] ?? null })), [top, hits])
}

function useRecommendations(artistNames: readonly string[], enabled: boolean): { sections: RecSection[]; loading: boolean } {
  const [sections, setSections] = useState<RecSection[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!enabled) return
    let off = false
    setSections([])
    setLoading(true)
    void (async () => {
      const seeds: Array<{ hit: ArtistHit; title: string }> = []
      const seen = new Set<string>()
      for (const name of artistNames.slice(0, 2)) {
        const hit = await resolveArtistByName(name)
        if (off) return
        if (hit && sameArtist(hit.name, name) && !seen.has(hit.id)) {
          seen.add(hit.id)
          seeds.push({ hit, title: `Karena kamu sering dengar ${hit.name}` })
        }
      }
      for (const query of readSearchHistory().slice(0, 3)) {
        if (seeds.length >= 3) break
        const hit = await resolveArtistByQuery(query)
        if (off) return
        if (hit && !seen.has(hit.id)) {
          seen.add(hit.id)
          seeds.push({ hit, title: `Karena kamu mencari “${query}”` })
        }
      }
      if (seeds.length === 0) {
        const chart = await getChartTracks()
        if (off) return
        setSections(chart && chart.length > 0 ? [{ id: 'chart', title: 'Lagu top untuk kamu', subtitle: 'Lagi ramai didengar', tracks: chart }] : [])
        setLoading(false)
        return
      }
      for (const seed of seeds) {
        const tracks = await getArtistRadio(seed.hit.id)
        if (off) return
        if (tracks && tracks.length > 0) setSections((prev) => [...prev, { id: `radio-${seed.hit.id}`, title: seed.title, tracks }])
      }
      if (!off) setLoading(false)
    })()
    return () => {
      off = true
    }
  }, [artistNames, enabled])
  return { sections, loading }
}

function useChartArtists(enabled: boolean): { artists: ArtistHit[]; done: boolean } {
  const [state, setState] = useState<{ artists: ArtistHit[]; done: boolean }>({ artists: [], done: false })
  useEffect(() => {
    if (!enabled) return
    let off = false
    void getChartArtists().then((found) => {
      if (!off) setState({ artists: found ?? [], done: true })
    })
    return () => {
      off = true
    }
  }, [enabled])
  return state
}

/** `enabled` = false saat hasil pencarian tampil: tidak ada permintaan jaringan yang dimulai di belakangnya. */
export function useHomeFeed(enabled: boolean): HomeFeed {
  const log = useMemo(() => readPlayLog(), [])
  const top = useMemo(() => computeStats(log, 10).topArtists, [log])
  const topNames = useMemo(() => top.map((a) => a.name), [top])
  const [shuffleSeed] = useState(() => String(Math.random()))

  const favPlaylists = useFavoritePlaylists()
  const favArtists = useFavoriteArtists(top, enabled)
  const { sections, loading: recLoading } = useRecommendations(topNames, enabled)
  const { artists: chartArtists, done: chartDone } = useChartArtists(enabled)

  const replay = useMemo(() => {
    const map = new Map<string, { track: PlaylistTrack; count: number; last: number }>()
    for (const entry of log) {
      const key = recentKey(entry.track)
      const hit = map.get(key)
      if (hit) {
        hit.count += 1
        hit.last = Math.max(hit.last, entry.at)
      } else map.set(key, { track: entry.track, count: 1, last: entry.at })
    }
    const cutoff = Date.now() - 2 * DAY_MS
    return [...map.values()]
      .filter((g) => g.count >= 2 && g.last < cutoff)
      .sort((a, b) => b.count - a.count || b.last - a.last)
      .slice(0, 15)
      .map((g) => g.track)
  }, [log])

  const items = useMemo<BannerItem[]>(() => {
    const out: BannerItem[] = []
    const used = new Set<string>()
    for (const fav of favArtists) {
      if (!fav.hit || used.has(fav.hit.id) || used.size >= 3) continue
      used.add(fav.hit.id)
      out.push({ id: `a-${fav.hit.id}`, kind: 'artist', label: 'Artis favoritmu', artist: fav.hit })
    }
    for (const artist of chartArtists) {
      if (used.size >= 3) break
      if (used.has(artist.id)) continue
      used.add(artist.id)
      out.push({ id: `a-${artist.id}`, kind: 'artist', label: 'Artis populer', artist })
    }
    const source = sections[0]
    if (source) {
      const label = source.id === 'chart' ? 'Lagu top' : 'Mungkin kamu suka'
      source.tracks.slice(0, 3).forEach((track, index) => out.push({ id: `t-${track.id}`, kind: 'track', label, tracks: source.tracks, index }))
    }
    // Urutan acak, tetap sama selama Beranda terbuka (tidak berubah tiap data baru masuk).
    return out.sort((a, b) => hashOf(a.id + shuffleSeed) - hashOf(b.id + shuffleSeed))
  }, [favArtists, chartArtists, sections, shuffleSeed])

  return {
    favPlaylists,
    favArtists,
    sections,
    replay,
    banner: { items, loading: enabled && items.length === 0 && (recLoading || !chartDone) },
  }
}
