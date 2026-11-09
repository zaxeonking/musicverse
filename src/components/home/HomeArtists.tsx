import { ChevronRight } from 'lucide-react'
import type { FavArtist } from '../../hooks/useHomeFeed'
import { fallbackCover } from '../../utils/fallbackCover'
import CoverArt from '../ui/CoverArt'
import { ArtistBubble, SectionTitle } from './HomeCards'
import HorizontalRow from '../music/HorizontalRow'

/**
 * Sorotan artis: artis yang paling sering diputar tampil besar (foto bulat yang menjorok keluar dari kartu), artis lain
 * sebagai deretan gelembung kecil di bawahnya. Tanpa artis favorit, bagian ini tidak dirender oleh pemanggil.
 */
export default function HomeArtists({ artists, onOpen }: { artists: FavArtist[]; onOpen: (artist: FavArtist) => void }) {
  const [top, ...rest] = artists
  if (!top) return null
  const colors = fallbackCover(top.name)
  return (
    <section aria-label="Artis favoritmu">
      <SectionTitle title="Artis favoritmu" subtitle="Dari lagu yang sering kamu putar" />
      <button
        type="button"
        onClick={() => onOpen(top)}
        aria-label={`Buka artis ${top.name}`}
        className="mv-in tap-card focus-ring group relative flex w-full items-center overflow-hidden rounded-[0.8rem_2rem_0.8rem_2rem] p-4 pl-5 text-left ring-1 ring-veil/[0.07]"
        style={{ background: `linear-gradient(120deg, ${colors.to}, rgb(var(--mv-card)))` }}
      >
        <span aria-hidden="true" className="pointer-events-none absolute -left-8 -top-10 h-32 w-32 rounded-full bg-accent/25 blur-2xl" />
        <span className="relative min-w-0 flex-1 pr-3">
          <span className="block font-display text-[2rem] font-extrabold leading-[0.98] tracking-[-0.035em] text-ink [overflow-wrap:anywhere] line-clamp-3">{top.name}</span>
          <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-coral">
            {top.plays > 0 ? `${top.plays} lagu kamu putar` : 'Buka profil'}
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </span>
        </span>
        <span className="relative w-[42%] max-w-[10rem] shrink-0">
          <CoverArt round cover={colors} src={top.hit?.picture} className="mv-art shadow-2xl shadow-black/60 ring-2 ring-white/10" />
        </span>
      </button>
      {rest.length > 0 && (
        <div className="mt-4">
          <HorizontalRow>
            {rest.map((a, i) => (
              <ArtistBubble key={a.name} index={i} name={a.name} picture={a.hit?.picture} onOpen={() => onOpen(a)} />
            ))}
          </HorizontalRow>
        </div>
      )}
    </section>
  )
}
