import type { ReactNode } from 'react'
import type { PlaylistTrack } from '../../types/spotify'
import { fallbackCover } from '../../utils/fallbackCover'
import CoverArt from '../ui/CoverArt'
import SectionHeader from '../ui/SectionHeader'
import HorizontalRow from '../music/HorizontalRow'

/** Satu deretan bergulir di Beranda: judul + kartu-kartu menyamping. */
export function HomeRow({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="mv-swap">
      <SectionHeader title={title} subtitle={subtitle} />
      <HorizontalRow>{children}</HorizontalRow>
    </section>
  )
}

export function TrackCard({ track, onPlay }: { track: PlaylistTrack; onPlay: () => void }) {
  const by = track.artists ? ` oleh ${track.artists}` : ''
  return (
    <button
      type="button"
      onClick={onPlay}
      aria-label={`Putar ${track.title}${by}`}
      className="focus-ring w-36 shrink-0 snap-start rounded-lg bg-card p-3 text-left transition-transform duration-150 active:scale-[0.97] motion-reduce:active:scale-100 sm:w-40"
    >
      <div className="mb-3">
        <CoverArt cover={fallbackCover(`${track.title}${track.album}`)} src={track.cover} className="shadow-lg shadow-black/40" />
      </div>
      <p className="truncate font-display text-sm font-bold text-ink">{track.title}</p>
      <p className="mt-0.5 truncate text-xs text-ink-muted">{track.artists}</p>
    </button>
  )
}

export function PlaylistTile({ title, cover, plays, onOpen }: { title: string; cover: string; plays: number; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Buka playlist ${title}`}
      className="focus-ring w-36 shrink-0 snap-start rounded-lg bg-card p-3 text-left transition-transform duration-150 active:scale-[0.97] motion-reduce:active:scale-100 sm:w-40"
    >
      <div className="mb-3">
        <CoverArt cover={fallbackCover(title)} src={cover} className="shadow-lg shadow-black/40" />
      </div>
      <p className="truncate font-display text-sm font-bold text-ink">{title}</p>
      <p className="mt-0.5 truncate text-xs text-ink-muted">{plays} lagu didengar</p>
    </button>
  )
}

export function ArtistBubble({ name, picture, onOpen }: { name: string; picture?: string; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Buka artis ${name}`}
      className="focus-ring w-28 shrink-0 snap-start rounded-lg p-1 text-center transition-transform duration-150 active:scale-[0.97] motion-reduce:active:scale-100 sm:w-32"
    >
      <div className="mb-2">
        <CoverArt round cover={fallbackCover(name)} src={picture} className="shadow-lg shadow-black/40" />
      </div>
      <p className="truncate text-sm font-semibold text-ink">{name}</p>
      <p className="text-xs text-ink-muted">Artis</p>
    </button>
  )
}
