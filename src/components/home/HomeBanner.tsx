import { Play, UserRound } from 'lucide-react'
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAudioPlayer } from '../../hooks/useAudioPlayer'
import type { BannerItem } from '../../hooks/useHomeFeed'
import { fallbackCover } from '../../utils/fallbackCover'
import CoverArt from '../ui/CoverArt'
import { openArtistFromFeed } from './homeNav'

interface HomeBannerProps {
  items: BannerItem[]
  loading: boolean
}

/** Banner acak di atas Beranda: artis dan lagu yang mungkin disukai. Tanpa data (offline / web) jadi ajakan membuka tab Cari. */
export default function HomeBanner({ items, loading }: HomeBannerProps) {
  const player = useAudioPlayer()
  const navigate = useNavigate()
  const scroller = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)

  if (items.length === 0) {
    if (loading) return <div aria-hidden="true" className="h-44 animate-pulse rounded-2xl bg-raised motion-reduce:animate-none sm:h-56" />
    return (
      <section aria-label="Mulai" className="rounded-2xl bg-gradient-to-br from-accent/30 to-raised p-5 sm:p-6">
        <h2 className="font-display text-xl font-extrabold text-ink sm:text-2xl">Mulai dari lagu favoritmu</h2>
        <p className="mt-1 text-sm text-ink-muted">Cari judul atau artis, atau tempel tautan playlist Spotify. Rekomendasi muncul di sini setelah kamu mendengarkan.</p>
        <button type="button" onClick={() => navigate('/search', { state: { focus: true } })} className="btn-primary mt-4">
          Mulai cari
        </button>
      </section>
    )
  }

  const handleScroll = () => {
    const el = scroller.current
    if (el && el.clientWidth > 0) setIndex(Math.round(el.scrollLeft / el.clientWidth))
  }

  return (
    <section aria-label="Untuk kamu" aria-roledescription="carousel">
      <div ref={scroller} onScroll={handleScroll} className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto rounded-2xl">
        {items.map((item) => {
          const isArtist = item.kind === 'artist'
          const track = item.kind === 'track' ? item.tracks[item.index] : null
          const name = isArtist ? item.artist.name : (track?.title ?? '')
          const sub = isArtist ? 'Artis' : (track?.artists ?? '')
          const picture = isArtist ? item.artist.picture : track?.cover
          const colors = fallbackCover(name)
          return (
            <div key={item.id} className="w-full shrink-0 snap-center">
              <button
                type="button"
                onClick={() => {
                  if (item.kind === 'artist') {
                    openArtistFromFeed(item.artist)
                    navigate('/search')
                  } else player.playList(item.tracks, item.index)
                }}
                aria-label={isArtist ? `Buka artis ${name}` : `Putar ${name}${sub ? ` oleh ${sub}` : ''}`}
                className="focus-ring relative flex h-44 w-full items-center gap-4 overflow-hidden p-4 text-left sm:h-56 sm:gap-6 sm:p-6"
                style={{ background: `linear-gradient(135deg, ${colors.from}, ${colors.to})` }}
              >
                <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
                <div className="relative w-28 shrink-0 sm:w-40">
                  <CoverArt round={isArtist} cover={colors} src={picture} className="shadow-xl shadow-black/40" />
                </div>
                <div className="relative min-w-0 flex-1 text-white">
                  <p className="text-xs font-semibold uppercase tracking-wider text-white/70">{item.label}</p>
                  <h2 className="mt-1 line-clamp-2 font-display text-xl font-extrabold leading-tight sm:text-3xl">{name}</h2>
                  <p className="mt-0.5 truncate text-sm text-white/75">{sub}</p>
                  <span className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-semibold text-black">
                    {isArtist ? <UserRound className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
                    {isArtist ? 'Buka' : 'Putar'}
                  </span>
                </div>
              </button>
            </div>
          )
        })}
      </div>
      {items.length > 1 && (
        <div aria-hidden="true" className="mt-2 flex justify-center gap-1.5">
          {items.map((item, i) => (
            <span key={item.id} className={`h-1.5 rounded-full transition-[width,background-color] duration-200 ${i === index ? 'w-4 bg-accent' : 'w-1.5 bg-ink-faint/50'}`} />
          ))}
        </div>
      )}
    </section>
  )
}
