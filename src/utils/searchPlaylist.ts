import type { TrackMeta } from '../plugins/spotifyImporter'
import type { PlaybackInfo, PlaylistDetail, PlaylistTrack } from '../types/spotify'
import { extractSpotifyTrackLink, extractTrackId, isSafeHttpUrl } from './spotifyUrl'
import { normalizeSearchText } from './trackSearch'

/**
 * Membungkus hasil pencarian (judul atau tautan lagu) menjadi "playlist" berisi satu lagu agar bisa
 * tampil dan diputar lewat PlaylistView dan pemutar yang sama. Ditandai `source: 'search'`.
 * `url` berisi masukan pengguna (kata kunci atau tautan lagu), jadi "Muat ulang" dan "Coba lagi"
 * mengulang permintaan yang sama.
 */
export function buildSearchPlaylist(query: string, info: PlaybackInfo, relatedMetas: readonly TrackMeta[] = []): PlaylistDetail {
  const trackLink = extractSpotifyTrackLink(query)
  const title = info.title.trim() || (trackLink ? 'Lagu tanpa judul' : query)

  // URL lagu wajib non-kosong (validasi Koleksi/Riwayat). Urutan: tautan yang diketik pengguna,
  // spotify_url dari API, lalu tautan pencarian Spotify (tanpa ID lagu) sebagai cadangan.
  const url =
    trackLink ??
    (isSafeHttpUrl(info.spotifyUrl) ? info.spotifyUrl : `https://open.spotify.com/search/${encodeURIComponent(title)}`)

  const slug = normalizeSearchText(query).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
  const id = trackLink ? `lagu-${extractTrackId(trackLink) ?? 'track'}` : `cari-${slug || 'lagu'}`

  // Terkait: hasil lain dari pencarian yang sama, tanpa duplikat (judul + artis) dan tanpa lagu yang sudah jadi hasil teratas.
  const topKey = normalizeSearchText(`${title} ${info.artist}`)
  const topId = extractTrackId(url)
  const seen = new Set<string>([topKey])
  const related: PlaylistTrack[] = []
  relatedMetas.forEach((meta, index) => {
    const key = normalizeSearchText(`${meta.title} ${meta.artist}`)
    const metaId = extractTrackId(meta.spotifyUrl)
    if (!meta.title.trim() || seen.has(key) || (metaId && metaId === topId) || !isSafeHttpUrl(meta.spotifyUrl)) return
    seen.add(key)
    related.push({
      id: `r${index}-${metaId ?? 'track'}`,
      title: meta.title,
      artists: meta.artist,
      album: meta.album,
      duration: meta.duration,
      cover: meta.cover,
      url: meta.spotifyUrl,
    })
  })

  return {
    id,
    url: query,
    title: trackLink ? title : `Hasil pencarian: ${query}`,
    cover: info.cover,
    source: 'search',
    tracks: [
      {
        id: `0-${extractTrackId(url) ?? 'track'}`,
        title,
        artists: info.artist,
        album: info.album,
        duration: info.duration,
        cover: info.cover,
        url,
      },
    ],
    ...(related.length > 0 ? { related: related.slice(0, 9) } : {}),
  }
}
