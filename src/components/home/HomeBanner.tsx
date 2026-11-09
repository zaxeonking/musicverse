import { Loader2, Play, UserRound } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTrackMenu } from '../../context/TrackMenuContext'
import { useAudioPlayer } from '../../hooks/useAudioPlayer'
import type { BannerItem } from '../../hooks/useHomeFeed'
import { getPlaylistDetail } from '../../services/homeFeed'
import { fallbackCover } from '../../utils/fallbackCover'
import { isSafeHttpUrl } from '../../utils/spotifyUrl'
import { openArtistFromFeed, playlistPath } from './homeNav'

interface HomeBannerProps {
  items: BannerItem[]
  loading: boolean
}

/** Jeda antar slide otomatis (ms). Juga durasi isian titik penanda aktif. */
const AUTOPLAY_MS = 6000

interface SlideView {
  tag: string
  title: string
  text: string
  picture: string
  /** Bulat/persegi: artis dan lagu tampil sebagai sampul di atas latar buram; playlist memenuhi kartu. */
  full: boolean
  round: boolean
  cta: string
  seed: string
}

function describe(item: BannerItem): SlideView {
  if (item.kind === 'playlist') {
    const p = item.playlist
    const meta = [p.count > 0 ? `${p.count} lagu` : '', p.by].filter(Boolean).join(' · ')
    return { tag: item.label, title: p.title, text: p.description || meta, picture: p.coverXl || p.cover, full: true, round: false, cta: 'Putar sekarang', seed: p.title }
  }
  if (item.kind === 'artist') {
    const a = item.artist
    return { tag: item.label, title: a.name, text: a.fans > 0 ? `${new Intl.NumberFormat('id-ID').format(a.fans)} penggemar` : 'Artis', picture: a.picture, full: false, round: true, cta: 'Buka artis', seed: a.name }
  }
  const t = item.tracks[item.index]
  return { tag: item.label, title: t?.title ?? '', text: t?.artists ?? '', picture: t?.cover ?? '', full: false, round: false, cta: 'Putar sekarang', seed: `${t?.title ?? ''}${t?.album ?? ''}` }
}

/**
 * Sorotan utama Beranda (gaya sampul majalah): playlist pilihan, artis, dan lagu yang mungkin disukai. Artwork besar condong dan
 * menjorok keluar dari pojok kanan atas, judul besar di kiri bawah, tombol putar coral dengan cincin berdenyut.
 * Gerak: slide bergulir sendiri tiap 6 detik (berhenti saat disentuh / tab disembunyikan), gambar bergeser pelan mengikuti
 * gulir (paralaks) dan mengendap dari sedikit lebih besar, teks naik bergantian saat slide aktif, titik penanda terisi
 * sebagai hitungan mundur. Semua gerak ikut "Kurangi gerakan" (isian titik dan gulir otomatis dimatikan).
 * Tanpa data (offline / web) jadi ajakan membuka tab Cari.
 */
export default function HomeBanner({ items, loading }: HomeBannerProps) {
  const player = useAudioPlayer()
  const navigate = useNavigate()
  const { showToast } = useTrackMenu()
  const scroller = useRef<HTMLDivElement>(null)
  const slideRefs = useRef<Array<HTMLDivElement | null>>([])
  const [index, setIndex] = useState(0)
  const [ready, setReady] = useState(false)
  const [held, setHeld] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const frame = useRef(0)
  const resume = useRef(0)

  const count = items.length

  // Teks slide pertama ikut naik saat Beranda dibuka (bukan langsung tampil).
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const goTo = useCallback((i: number) => {
    const el = scroller.current
    if (!el) return
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' })
  }, [])

  // Gulir otomatis. Tidak jalan bila "Kurangi gerakan" aktif, sedang disentuh, atau tab tidak terlihat.
  useEffect(() => {
    if (count < 2 || held) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = window.setTimeout(() => {
      if (document.visibilityState === 'visible') goTo((index + 1) % count)
    }, AUTOPLAY_MS)
    return () => window.clearTimeout(timer)
  }, [index, count, held, goTo])

  useEffect(() => () => window.clearTimeout(resume.current), [])

  const update = () => {
    const el = scroller.current
    if (!el || el.clientWidth === 0) return
    const width = el.clientWidth
    setIndex(Math.round(el.scrollLeft / width))
    // Paralaks: tiap gambar bergeser berlawanan arah gulir (diubah langsung di elemen, tanpa render ulang).
    slideRefs.current.forEach((slide, i) => {
      slide?.style.setProperty('--p', String((i * width - el.scrollLeft) / width))
    })
  }
  const handleScroll = () => {
    if (frame.current) return
    frame.current = requestAnimationFrame(() => {
      frame.current = 0
      update()
    })
  }
  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  const hold = () => {
    window.clearTimeout(resume.current)
    setHeld(true)
  }
  const release = () => {
    window.clearTimeout(resume.current)
    resume.current = window.setTimeout(() => setHeld(false), 1800)
  }

  const playPlaylist = async (id: string) => {
    if (busy) return
    setBusy(id)
    const detail = await getPlaylistDetail(id)
    setBusy(null)
    if (!detail) {
      showToast('Playlist belum bisa dimuat. Coba lagi nanti.')
      return
    }
    player.playList(detail.tracks, 0)
  }

  const act = (item: BannerItem) => {
    if (item.kind === 'playlist') void playPlaylist(item.playlist.id)
    else if (item.kind === 'artist') {
      openArtistFromFeed(item.artist)
      navigate('/search')
    } else player.playList(item.tracks, item.index)
  }

  if (count === 0) {
    if (loading) {
      return <div aria-hidden="true" className="aspect-[4/5] w-full animate-pulse rounded-[2.5rem_0.9rem_2.5rem_0.9rem] bg-raised motion-reduce:animate-none sm:aspect-[16/8]" />
    }
    return (
      <section aria-label="Mulai" className="mv-in relative overflow-hidden rounded-[2.5rem_0.9rem_2.5rem_0.9rem] bg-card p-6 ring-1 ring-veil/[0.07] sm:p-8">
        <span aria-hidden="true" className="mv-float pointer-events-none absolute -right-12 -top-12 h-52 w-52 rounded-full bg-accent/30 blur-2xl" />
        <span aria-hidden="true" className="pointer-events-none absolute -bottom-10 right-6 h-24 w-24 rounded-full bg-coral/25 blur-2xl" />
        <h2 className="relative font-display text-[2.2rem] font-extrabold leading-[1.02] tracking-[-0.03em] text-ink">Mulai dari lagu favoritmu</h2>
        <p className="relative mt-2 max-w-sm text-sm text-ink-muted">Cari judul atau artis, atau tempel tautan playlist Spotify. Rekomendasi muncul di sini setelah kamu mendengarkan.</p>
        <button type="button" onClick={() => navigate('/search', { state: { focus: true } })} className="btn-primary relative mt-5 !h-12 !px-7">
          Mulai cari
        </button>
      </section>
    )
  }

  return (
    <section aria-label="Untuk kamu" aria-roledescription="carousel" className="mv-in">
      <div
        ref={scroller}
        onScroll={handleScroll}
        onPointerDown={hold}
        onPointerUp={release}
        onPointerCancel={release}
        onTouchStart={hold}
        onTouchEnd={release}
        className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto rounded-[2.5rem_0.9rem_2.5rem_0.9rem]"
      >
        {items.map((item, i) => {
          const view = describe(item)
          const active = ready && i === index
          const colors = fallbackCover(view.seed)
          const showPicture = isSafeHttpUrl(view.picture)
          const loadingThis = item.kind === 'playlist' && busy === item.playlist.id
          return (
            <div
              key={item.id}
              ref={(el) => {
                slideRefs.current[i] = el
              }}
              data-active={active}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} dari ${count}`}
              className="mv-banner-slide relative aspect-[4/5] w-full shrink-0 snap-center overflow-hidden sm:aspect-[16/8]"
              style={{ background: `linear-gradient(150deg, ${colors.from}, ${colors.to})` }}
            >
              {/* Latar: artwork yang sama diperbesar dan digelapkan (tanpa blur, supaya ringan di Android), bergeser pelan mengikuti gulir. */}
              {showPicture && (
                <div className="absolute inset-y-0 -left-[9%] w-[118%] [transform:translate3d(calc(var(--p,0)*-9%),0,0)]">
                  <img
                    src={view.picture}
                    alt=""
                    decoding="async"
                    loading={i === 0 ? 'eager' : 'lazy'}
                    referrerPolicy="no-referrer"
                    className="mv-banner-img h-full w-full scale-125 object-cover opacity-45"
                  />
                </div>
              )}
              <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/10" />
              <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/25 via-transparent to-transparent" />

              {/* Artwork utama: besar, condong, menjorok keluar dari pojok kanan atas. */}
              {showPicture && (
                <div className="mv-banner-cover pointer-events-none absolute -right-[12%] top-[9%] w-[74%] max-w-[22rem] sm:-right-[3%] sm:top-[8%] sm:w-[46%] sm:max-w-[26rem]">
                  <img
                    src={view.picture}
                    alt=""
                    decoding="async"
                    referrerPolicy="no-referrer"
                    className={`aspect-square w-full rotate-[5deg] object-cover shadow-2xl shadow-black/70 ring-1 ring-white/15 ${view.round ? 'rounded-full' : 'rounded-[2rem_0.7rem_2rem_0.7rem]'}`}
                  />
                </div>
              )}

              {/* Seluruh kartu bisa diketuk (buka detail); tombol Putar di dalamnya punya aksinya sendiri. */}
              <button
                type="button"
                tabIndex={-1}
                aria-hidden="true"
                onClick={() => (item.kind === 'playlist' ? navigate(playlistPath(item.playlist.id, item.playlist.title)) : act(item))}
                className="absolute inset-0 h-full w-full cursor-pointer"
              />

              <div className="pointer-events-none absolute left-5 top-5 sm:left-8 sm:top-8">
                <span className="mv-banner-chip inline-flex items-center gap-2 rounded-full bg-black/50 py-1.5 pl-2.5 pr-3.5 text-[0.78rem] font-semibold text-white ring-1 ring-white/15">
                  <span aria-hidden="true" className="h-2 w-2 rounded-full bg-coral" />
                  {view.tag}
                </span>
              </div>

              <div className="mv-banner-text pointer-events-none absolute inset-x-0 bottom-0 p-5 pb-6 text-white sm:p-8">
                <h2 className="line-clamp-3 max-w-[85%] font-display text-[2.35rem] font-extrabold leading-[0.98] tracking-[-0.035em] sm:max-w-[60%] sm:text-6xl">{view.title}</h2>
                {view.text && <p className="mt-2.5 line-clamp-1 max-w-[80%] text-[0.95rem] text-white/70 sm:text-base">{view.text}</p>}
                <div>
                  <button
                    type="button"
                    onClick={() => act(item)}
                    disabled={loadingThis}
                    aria-label={`${view.cta}: ${view.title}`}
                    className="focus-ring tap-card group pointer-events-auto mt-5 inline-flex items-center gap-3 rounded-full bg-white/10 py-1.5 pl-1.5 pr-5 text-sm font-bold text-white ring-1 ring-white/20 backdrop-blur-md disabled:opacity-80"
                  >
                    <span className="relative flex h-12 w-12 items-center justify-center">
                      {active && !loadingThis && <span aria-hidden="true" className="absolute inset-0 animate-play-ring rounded-full bg-coral/60 motion-reduce:hidden" />}
                      <span className="relative flex h-full w-full items-center justify-center rounded-full bg-coral text-[#1a0a05] shadow-[0_8px_22px_rgb(var(--mv-coral)/0.5)]">
                        {loadingThis ? (
                          <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                        ) : item.kind === 'artist' ? (
                          <UserRound className="h-5 w-5" aria-hidden="true" fill="currentColor" />
                        ) : (
                          <Play className="h-5 w-5 translate-x-[1px]" aria-hidden="true" fill="currentColor" strokeWidth={0} />
                        )}
                      </span>
                    </span>
                    {view.cta}
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {count > 1 && (
        <div role="tablist" aria-label="Pilih slide" className="mt-3 flex items-center px-2">
          {items.map((item, i) => {
            const on = i === index
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={on}
                aria-label={`Slide ${i + 1}`}
                onClick={() => goTo(i)}
                className="focus-ring flex h-6 items-center justify-center px-[3px]"
              >
                {/* Segmen tipis: yang aktif memanjang dan terisi sebagai hitungan mundur ke slide berikutnya. */}
                <span className={`relative block h-[3px] overflow-hidden rounded-full bg-ink-faint/35 transition-[width] duration-300 ease-out motion-reduce:transition-none ${on ? 'w-10' : 'w-4'}`}>
                  {on && (
                    <span
                      key={`${index}-${held}`}
                      className="mv-dot-fill absolute inset-0 origin-left rounded-full bg-coral"
                      style={{ animationDuration: `${AUTOPLAY_MS}ms`, animationPlayState: held ? 'paused' : 'running' }}
                    />
                  )}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
