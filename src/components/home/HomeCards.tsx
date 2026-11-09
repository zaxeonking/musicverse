import type { ReactNode } from 'react'
import type { PlaylistTrack } from '../../types/spotify'
import { fallbackCover } from '../../utils/fallbackCover'
import CoverArt from '../ui/CoverArt'
import HorizontalRow from '../music/HorizontalRow'

/** Satu deretan bergulir: judul besar + kartu-kartu menyamping. */
export function HomeRow({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="mv-swap">
      <div className="mb-3.5">
        <h2 className="font-display text-[1.65rem] font-extrabold leading-tight tracking-tight text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-ink-muted">{subtitle}</p>}
      </div>
      <HorizontalRow>{children}</HorizontalRow>
    </section>
  )
}

/**
 * Kartu bergaya StreamBeats: sampul besar bersudut bulat, judul tebal di bawahnya.
 * Masuk bergantian (maks. 7 kartu pertama, sisanya bersamaan), menekan = kartu mengecil dan sampulnya sedikit membesar.
 */
export function MediaCard({
  title,
  subtitle,
  cover,
  seed,
  label,
  index = 0,
  round = false,
  onOpen,
}: {
  title: string
  subtitle?: string
  cover?: string
  seed: string
  label: string
  index?: number
  round?: boolean
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={label}
      style={{ ['--mv-delay' as string]: `${Math.min(index, 7) * 55}ms` }}
      className="mv-in tap-card focus-ring group w-[9.5rem] shrink-0 snap-start text-left sm:w-44"
    >
      <div className={`overflow-hidden shadow-lg shadow-black/40 ${round ? 'rounded-full' : '!rounded-3xl'}`}>
        <CoverArt
          round={round}
          cover={fallbackCover(seed)}
          src={cover}
          className={`${round ? '' : '!rounded-3xl'} transition-transform duration-500 ease-out group-active:scale-105 motion-reduce:transition-none motion-reduce:group-active:scale-100`}
        />
      </div>
      <p className={`mt-2.5 line-clamp-2 px-0.5 font-display text-[0.95rem] font-bold leading-snug text-ink ${round ? 'text-center' : ''}`}>{title}</p>
      {subtitle && <p className={`mt-0.5 truncate px-0.5 text-sm text-ink-muted ${round ? 'text-center' : ''}`}>{subtitle}</p>}
    </button>
  )
}

/** Kerangka kartu saat deretan masih dimuat (berdenyut pelan). */
export function MediaCardSkeleton() {
  return (
    <div aria-hidden="true" className="w-[9.5rem] shrink-0 sm:w-44">
      <div className="aspect-square animate-pulse rounded-3xl bg-raised motion-reduce:animate-none" />
      <div className="mt-3 h-3 w-4/5 animate-pulse rounded-full bg-raised motion-reduce:animate-none" />
      <div className="mt-2 h-3 w-1/2 animate-pulse rounded-full bg-raised/70 motion-reduce:animate-none" />
    </div>
  )
}

export function TrackCard({ track, onPlay, index = 0 }: { track: PlaylistTrack; onPlay: () => void; index?: number }) {
  const by = track.artists ? ` oleh ${track.artists}` : ''
  return (
    <MediaCard
      index={index}
      title={track.title}
      subtitle={track.artists}
      cover={track.cover}
      seed={`${track.title}${track.album}`}
      label={`Putar ${track.title}${by}`}
      onOpen={onPlay}
    />
  )
}

export function PlaylistTile({ title, cover, plays, index = 0, onOpen }: { title: string; cover: string; plays: number; index?: number; onOpen: () => void }) {
  return <MediaCard index={index} title={title} subtitle={`${plays} lagu didengar`} cover={cover} seed={title} label={`Buka playlist ${title}`} onOpen={onOpen} />
}

export function ArtistBubble({ name, picture, index = 0, onOpen }: { name: string; picture?: string; index?: number; onOpen: () => void }) {
  return <MediaCard index={index} round title={name} subtitle="Artis" cover={picture} seed={name} label={`Buka artis ${name}`} onOpen={onOpen} />
}
