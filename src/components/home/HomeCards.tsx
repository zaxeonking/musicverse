import { EllipsisVertical, Play } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { useTrackMenu } from '../../context/TrackMenuContext'
import type { PlaylistTrack } from '../../types/spotify'
import { fallbackCover } from '../../utils/fallbackCover'
import { recentKey } from '../../utils/libraryStorage'
import CoverArt from '../ui/CoverArt'
import { CoverPlayingBadge } from '../ui/PlayingBars'
import HorizontalRow from '../music/HorizontalRow'

/** Satu deretan bergulir: judul besar + kartu-kartu menyamping. */
export function HomeRow({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="mv-swap">
      <SectionTitle title={title} subtitle={subtitle} />
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

const delay = (index: number, step = 55, max = 7): CSSProperties => ({ ['--mv-delay' as string]: `${Math.min(index, max) * step}ms` })

/** Judul bagian bergaya majalah: judul tebal rapat, penanda coral pendek di bawahnya, aksi opsional di kanan. */
export function SectionTitle({ title, subtitle, emoji, action }: { title: string; subtitle?: string; emoji?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h2 className="font-display text-[1.6rem] font-extrabold leading-[1.05] tracking-[-0.03em] text-ink">
          {title}
          {emoji && <span aria-hidden="true"> {emoji}</span>}
        </h2>
        <span aria-hidden="true" className="mt-2 block h-[3px] w-9 rounded-full bg-coral" />
        {subtitle && <p className="mt-2 text-sm text-ink-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

/** Satu item sorot yang tidak peduli asalnya (album, playlist, atau lagu). */
export interface ShelfItem {
  key: string
  title: string
  subtitle?: string
  cover?: string
  seed: string
  label: string
  onOpen: () => void
}

/**
 * Tombol putar kustom: lingkaran coral dengan segitiga yang sedikit bergeser (optis tepat di tengah) dan cincin yang
 * melebar pelan. Hiasan saja (bukan tombol): ketukan ditangani kartu yang membungkusnya.
 */
export function PlayDisc({ size = 'md', pulse = false }: { size?: 'sm' | 'md' | 'lg'; pulse?: boolean }) {
  const box = size === 'lg' ? 'h-14 w-14' : size === 'md' ? 'h-11 w-11' : 'h-9 w-9'
  const icon = size === 'lg' ? 'h-6 w-6' : size === 'md' ? 'h-5 w-5' : 'h-4 w-4'
  return (
    <span aria-hidden="true" className={`relative inline-flex shrink-0 items-center justify-center ${box}`}>
      {pulse && <span className="absolute inset-0 animate-play-ring rounded-full bg-coral/60 motion-reduce:hidden" />}
      <span className="relative flex h-full w-full items-center justify-center rounded-full bg-coral text-[#1a0a05] shadow-[0_6px_18px_rgb(var(--mv-coral)/0.45)]">
        <Play className={`${icon} translate-x-[1px]`} fill="currentColor" strokeWidth={0} />
      </span>
    </span>
  )
}

/** Artwork yang mengisi kotak induk (bukan persegi): dipakai kartu fitur dan majalah. */
function Fill({ item, round = false }: { item: Pick<ShelfItem, 'cover' | 'seed'>; round?: boolean }) {
  return (
    <CoverArt
      round={round}
      cover={fallbackCover(item.seed)}
      src={item.cover}
      className="mv-art !absolute !inset-0 !aspect-auto !h-full !w-full !rounded-none"
    />
  )
}

/**
 * Kartu fitur: artwork penuh, judul besar di kiri bawah, tombol putar di kanan bawah. `hero` = judul lebih besar.
 * Sudut dibuat tidak sama (besar di kiri atas, kecil di kanan bawah) supaya bentuknya punya karakter.
 */
export function FeatureCard({ item, hero = false, index = 0, className = '' }: { item: ShelfItem; hero?: boolean; index?: number; className?: string }) {
  return (
    <button
      type="button"
      onClick={item.onOpen}
      aria-label={item.label}
      style={delay(index, 80)}
      className={`mv-in tap-card focus-ring group relative isolate overflow-hidden text-left text-white shadow-lg shadow-black/40 ${
        hero ? 'rounded-[2rem_0.75rem_2rem_0.75rem]' : 'rounded-[1.5rem_0.6rem_1.5rem_0.6rem]'
      } ${className}`}
    >
      <Fill item={item} />
      <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />
      <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-3.5">
        <span className="min-w-0">
          <span className={`line-clamp-2 block font-display font-extrabold leading-[1.05] tracking-tight ${hero ? 'text-[1.55rem]' : 'text-[0.98rem]'}`}>{item.title}</span>
          {item.subtitle && <span className={`mt-1 block truncate text-white/75 ${hero ? 'text-sm' : 'text-xs'}`}>{item.subtitle}</span>}
        </span>
        {hero && <PlayDisc size="md" />}
      </span>
    </button>
  )
}

/** Kartu majalah: artwork tegak (4:5) dengan judul dan keterangan di bawahnya, mudah dibaca. */
export function EditorialCard({ item, index = 0, wide = false }: { item: ShelfItem; index?: number; wide?: boolean }) {
  return (
    <button type="button" onClick={item.onOpen} aria-label={item.label} style={delay(index, 70)} className="mv-in tap-card focus-ring group block w-full text-left">
      <span className={`relative block overflow-hidden rounded-[1.5rem_0.6rem_1.5rem_0.6rem] shadow-lg shadow-black/40 ${wide ? 'aspect-[16/10]' : 'aspect-[4/5]'}`}>
        <Fill item={item} />
        <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
        <span className="absolute bottom-2.5 right-2.5">
          <PlayDisc size="sm" />
        </span>
      </span>
      <span className="mt-2.5 block line-clamp-2 px-0.5 font-display text-[0.98rem] font-bold leading-snug tracking-tight text-ink">{item.title}</span>
      {item.subtitle && <span className="mt-0.5 block truncate px-0.5 text-sm text-ink-muted">{item.subtitle}</span>}
    </button>
  )
}

/**
 * Baris lagu ringkas: nomor urut, sampul kecil, judul + artis, menu. Lagu yang sedang aktif disorot dan bertanda equalizer.
 * Seluruh baris = putar dari lagu ini (daftar yang sama jadi antrean).
 */
export function CompactTrackRow({
  track,
  rank,
  index = 0,
  current,
  activity,
  onPlay,
}: {
  track: PlaylistTrack
  rank?: number
  index?: number
  current: boolean
  activity: string
  onPlay: () => void
}) {
  const { openTrackMenu } = useTrackMenu()
  return (
    <li style={delay(index, 40, 8)} className={`mv-in flex items-center gap-1 rounded-2xl transition-colors duration-300 motion-reduce:transition-none ${current ? 'bg-accent/10' : ''}`}>
      <button
        type="button"
        onClick={onPlay}
        aria-label={`Putar ${track.title}${track.artists ? ` oleh ${track.artists}` : ''}`}
        className="focus-ring tap-row flex min-w-0 flex-1 items-center gap-3 rounded-2xl p-1.5 text-left"
      >
        {rank !== undefined && (
          <span aria-hidden="true" className={`w-6 shrink-0 text-center font-display text-lg font-extrabold tabular-nums ${rank <= 3 ? 'text-coral' : 'text-ink-faint'}`}>
            {rank}
          </span>
        )}
        <span className="relative w-12 shrink-0">
          <CoverArt cover={fallbackCover(`${track.title}${track.album}`)} src={track.cover} className="!rounded-xl shadow-md shadow-black/40" />
          {current && <CoverPlayingBadge activity={activity} className="rounded-xl" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block truncate font-display text-[1rem] font-semibold tracking-tight ${current ? 'text-accent' : 'text-ink'}`}>{track.title}</span>
          <span className="block truncate text-sm text-ink-muted">{track.artists}</span>
        </span>
      </button>
      <button type="button" onClick={() => openTrackMenu(track, { place: 'browse' })} aria-label={`Opsi untuk ${track.title}`} aria-haspopup="dialog" className="icon-btn shrink-0 text-ink-muted">
        <EllipsisVertical className="h-5 w-5" aria-hidden="true" />
      </button>
    </li>
  )
}

/** Daftar lagu ringkas satu/dua kolom. `ranked` memberi nomor urut (untuk tangga lagu). */
export function CompactTrackList({
  tracks,
  limit,
  ranked = false,
  currentKey,
  activity,
  onPlay,
}: {
  tracks: PlaylistTrack[]
  limit: number
  ranked?: boolean
  currentKey: string | null
  activity: string
  onPlay: (index: number) => void
}) {
  return (
    <ul className="grid gap-x-6 gap-y-0.5 lg:grid-cols-2">
      {tracks.slice(0, limit).map((track, i) => (
        <CompactTrackRow
          key={`${recentKey(track)}-${i}`}
          track={track}
          rank={ranked ? i + 1 : undefined}
          index={i}
          current={currentKey !== null && recentKey(track) === currentKey}
          activity={activity}
          onPlay={() => onPlay(i)}
        />
      ))}
    </ul>
  )
}

/** Kerangka kartu fitur/majalah saat deretan dimuat. */
export function FeatureSkeleton() {
  return (
    <div aria-hidden="true" className="grid h-[17rem] grid-cols-5 grid-rows-2 gap-3 sm:h-[22rem]">
      <div className="col-span-3 row-span-2 animate-pulse rounded-[2rem_0.75rem_2rem_0.75rem] bg-raised motion-reduce:animate-none" />
      <div className="col-span-2 animate-pulse rounded-[1.5rem_0.6rem_1.5rem_0.6rem] bg-raised motion-reduce:animate-none" />
      <div className="col-span-2 animate-pulse rounded-[1.5rem_0.6rem_1.5rem_0.6rem] bg-raised/70 motion-reduce:animate-none" />
    </div>
  )
}
