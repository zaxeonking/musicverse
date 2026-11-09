import ErrorBoundary from '../components/ui/ErrorBoundary'
import HomeBanner from '../components/home/HomeBanner'
import HomeHeader from '../components/home/HomeHeader'
import HomeSections from '../components/home/HomeSections'
import MigrationBanner from '../components/home/MigrationBanner'
import { useHomeFeed } from '../hooks/useHomeFeed'

/**
 * Beranda MusicVerse: kepala (avatar/menu, sapaan, timer, notifikasi, kolom cari + filter), banner pengumuman migrasi (selalu ada), sorotan utama bergulir otomatis, lalu
 * suasana, terakhir diputar, dan deretan kurasi serta rekomendasi dengan komposisi yang berganti-ganti.
 * Semua pencarian dan hasilnya ada di tab Cari; kolom di sini hanya mengantar ke sana.
 */
export default function HomePage() {
  const feed = useHomeFeed(true)

  return (
    <div className="space-y-7">
      <HomeHeader />
      <MigrationBanner />
      <ErrorBoundary>
        <HomeBanner items={feed.banner.items} loading={feed.banner.loading} />
      </ErrorBoundary>
      <HomeSections feed={feed} />
    </div>
  )
}
