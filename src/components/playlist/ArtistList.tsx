import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import type { ArtistHit } from '../../services/artistApi'
import { fallbackCover } from '../../utils/fallbackCover'
import CoverArt from '../ui/CoverArt'

const fansFormat = new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 })

interface ArtistListProps {
  title: string
  artists: readonly ArtistHit[]
  onOpen: (artist: ArtistHit) => void
  /** Elemen di kanan judul (mis. tombol Hapus riwayat). */
  action?: ReactNode
}

/** Daftar artis: foto bulat, nama, jumlah penggemar, dan panah. Dipakai hasil cari, riwayat, dan blok Artis di tab Cari. */
export default function ArtistList({ title, artists, onOpen, action }: ArtistListProps) {
  return (
    <section aria-label={title}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold tracking-tight text-ink">{title}</h2>
        {action}
      </div>
      <ul className="mv-list space-y-1">
        {artists.map((artist) => (
          <li key={artist.id}>
            <button
              type="button"
              onClick={() => onOpen(artist)}
              className="focus-ring flex w-full items-center gap-3 rounded-lg px-1 py-1 text-left"
            >
              <div className="w-14 shrink-0 overflow-hidden rounded-full">
                <CoverArt cover={fallbackCover(artist.name)} src={artist.picture} />
              </div>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">{artist.name}</span>
                <span className="block truncate text-xs text-ink-muted">
                  {artist.fans > 0 ? `Artis, ${fansFormat.format(artist.fans)} penggemar` : 'Artis'}
                </span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-ink-muted" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
