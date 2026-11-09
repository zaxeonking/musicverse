import ErrorBoundary from '../components/ui/ErrorBoundary'
import HomeBanner from '../components/home/HomeBanner'
import HomeHeader from '../components/home/HomeHeader'
import HomeSections from '../components/home/HomeSections'
import { useHomeFeed } from '../hooks/useHomeFeed'

/**
 * Beranda ala StreamBeats: kepala (menu, sapaan, timer, notifikasi, kolom cari + filter), banner besar bergulir otomatis,
 * Recently, lalu deretan kurasi dan rekomendasi dari riwayat dengar dan cari.
 * Semua pencarian dan hasilnya ada di tab Cari; kolom di sini hanya mengantar ke sana.
 */
export default function HomePage() {
  const feed = useHomeFeed(true)

  return (
    <div className="space-y-6">
      <HomeHeader />
      <ErrorBoundary>
        <HomeBanner items={feed.banner.items} loading={feed.banner.loading} />
      </ErrorBoundary>
      <HomeSections feed={feed} />
    </div>
  )
}
