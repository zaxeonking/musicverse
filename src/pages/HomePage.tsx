import { Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import HomeBanner from '../components/home/HomeBanner'
import HomeSections from '../components/home/HomeSections'
import { useGreeting } from '../hooks/greeting'
import { useHomeFeed } from '../hooks/useHomeFeed'

/**
 * Beranda: sapaan, banner acak, pintu ke tab Cari, lalu deretan rekomendasi dari riwayat dengar dan cari.
 * Semua pencarian dan hasilnya ada di tab Cari; kolom di sini hanya mengantar ke sana.
 */
export default function HomePage() {
  const greeting = useGreeting()
  const feed = useHomeFeed(true)

  return (
    <div className="space-y-8">
      <section aria-labelledby="home-title" className="space-y-5">
        <div>
          <h1
            id="home-title"
            className="font-display text-2xl font-extrabold tracking-tight sm:text-4xl"
          >
            {greeting}
          </h1>
          <p className="mt-1 text-ink-muted">Apa yang ingin kamu dengar hari ini?</p>
        </div>
        <HomeBanner items={feed.banner.items} loading={feed.banner.loading} />
        <Link
          to="/search"
          state={{ focus: true }}
          data-tour="home-search"
          aria-label="Buka pencarian"
          className="focus-ring flex h-12 w-full items-center gap-3 rounded-full bg-raised px-4 text-ink-faint transition-colors hover:bg-raised-hover"
        >
          <Search className="h-5 w-5 shrink-0 text-ink-muted" aria-hidden="true" />
          <span className="truncate">Cari lagu, artis, atau tempel tautan</span>
        </Link>
      </section>

      <HomeSections feed={feed} />
    </div>
  )
}
