/**
 * Deretan Beranda dari Deezer. Ubah judul / kata kunci di sini untuk mengganti isi Beranda; tidak perlu menyentuh komponen.
 * `queries`: tiap kata kunci mengambil `perQuery` playlist teratas (digabung, tanpa duplikat), jadi satu deretan bisa
 * berisi beberapa gaya. `chart` memakai playlist yang sedang ramai.
 */
export type ShelfSource =
  | { kind: 'releases' }
  | { kind: 'chart-playlists' }
  | { kind: 'playlists'; queries: readonly string[]; perQuery: number }
  | { kind: 'chart-tracks'; offset: number; count: number }

/** Komposisi deretan di Beranda (bukan semuanya carousel): feature = satu kartu besar + dua kecil; magazine = susunan majalah; chart = daftar lagu ringkas; row = deretan menyamping. */
export type ShelfLayout = 'feature' | 'magazine' | 'chart' | 'row'

export interface ShelfDef {
  /** Bentuk tampilan; bawaan `row`. */
  layout?: ShelfLayout
  id: string
  title: string
  /** Teks kecil di bawah judul. */
  subtitle?: string
  /** Hiasan setelah judul. */
  emoji?: string
  source: ShelfSource
}

export const HOME_SHELVES: readonly ShelfDef[] = [
  { id: 'new-releases', title: 'New releases', layout: 'feature', source: { kind: 'releases' } },
  {
    id: 'all-time',
    title: 'All Time Hits',
    source: { kind: 'playlists', queries: ['dangdut klasik', 'pop biggest hits', 'dance hits', 'rock classics', 'hip hop classics'], perQuery: 1 },
  },
  {
    id: 'forever-fav',
    title: 'Favorit selamanya!',
    emoji: '🫶',
    source: { kind: 'playlists', queries: ['the hits 10s', 'lagu lama sakitnya sama', 'pop indonesia', 'the hits 00s'], perQuery: 1 },
  },
  { id: 'community', title: 'Trending community playlists', layout: 'magazine', source: { kind: 'chart-playlists' } },
  {
    id: 'featured',
    title: 'Featured playlists for you',
    layout: 'magazine',
    source: { kind: 'playlists', queries: ['trending 20 indonesia', 'top 100 music videos indonesia', 'daily top music videos', 'top hits indonesia'], perQuery: 1 },
  },
  {
    id: 'indie',
    title: 'Indie Corner',
    emoji: '🎧',
    source: { kind: 'playlists', queries: ['indo indie', 'indo indie on repeat', 'hujan senja', 'folk indonesia'], perQuery: 1 },
  },
  { id: 'quick-picks', title: 'Quick picks', layout: 'chart', source: { kind: 'chart-tracks', offset: 0, count: 12 } },
  {
    id: 'indo-hits',
    title: "Today's Indonesian Hits",
    source: { kind: 'playlists', queries: ['hits of 2026 indonesia', 'hot koplo', 'trend viral songs indonesia', 'lagu terpopuler indonesia'], perQuery: 1 },
  },
  { id: 'trending-songs', title: 'Trending songs for you', layout: 'chart', source: { kind: 'chart-tracks', offset: 12, count: 18 } },
]
