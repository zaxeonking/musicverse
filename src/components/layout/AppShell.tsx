import { useCallback, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAudioPlayer } from '../../hooks/useAudioPlayer'
import { useEnterClosesKeyboard } from '../../hooks/useEnterClosesKeyboard'
import { useKeyboardOpen } from '../../hooks/useKeyboardOpen'
import { useMiniPlayerMode } from '../../hooks/useMiniPlayerMode'
import { useTheme } from '../../hooks/useTheme'
import ErrorBoundary from '../ui/ErrorBoundary'
import MigrationNotice from './MigrationNotice'
import OfflineBanner from './OfflineBanner'
import PageTransition from './PageTransition'
import UpdateBanner from './UpdateBanner'
import PlayerDock from '../player/PlayerDock'
import BottomNav from './BottomNav'
import MobileHeader from './MobileHeader'
import Sidebar from './Sidebar'
import TourHost from '../../tour/TourHost'

/**
 * Kerangka layar penuh yang terkunci ke viewport (fixed inset-0) dan disusun sebagai kolom flex:
 *   header -> konten (satu-satunya area scroll) -> mini player -> bottom nav.
 * Mini player dan bottom nav adalah anak flex setinggi 0 yang kartu/barnya diposisikan absolut di dasar
 * (bukan position: fixed), jadi keduanya tidak ikut bergeser saat toolbar browser muncul/hilang. Konten meluas sampai tepi
 * bawah (tampak lewat di bawah nav kaca) dan tidak tertutup karena diberi padding sebesar ruang dock (`--dock-offset`).
 */
export default function AppShell() {
  const { pathname } = useLocation()
  const { status, currentTrack } = useAudioPlayer()
  const playerActive = status !== 'idle' && currentTrack !== null
  const { collapsed } = useMiniPlayerMode()
  // Keyboard terbuka: mini player jadi gelembung (lihat MiniPlayer), jadi padding konten ikut ukuran gelembung.
  const keyboardOpen = useKeyboardOpen()
  const compactDock = collapsed || keyboardOpen
  const mainRef = useRef<HTMLElement>(null)
  const [theme] = useTheme()
  useEnterClosesKeyboard()

  // Area scroll ada di <main>, bukan window: kembalikan ke atas saat halaman baru terpasang (lihat PageTransition).
  const scrollToTop = useCallback(() => {
    mainRef.current?.scrollTo({ top: 0 })
  }, [])

  return (
    // --dock-offset = ruang yang dipesan bottom nav melayang di dasar layar (bar 4rem + jarak 0,5rem / safe area). Dipakai padding
    // konten (di bawah) dan posisi mini player; 0 di layar lebar (tidak ada nav bawah) dan saat keyboard terbuka (nav turun).
    <div
      data-keyboard={keyboardOpen ? 'open' : 'closed'}
      className={`fixed inset-0 flex overflow-hidden bg-bg text-ink ${theme.glow ? 'mv-glow' : ''} [--dock-offset:calc(4.5rem_+_var(--sab))] data-[keyboard=open]:[--dock-offset:0px] lg:[--dock-offset:0px]`}
    >
      <a
        href="#konten"
        onClick={(event) => {
          event.preventDefault()
          document.getElementById('konten')?.focus()
        }}
        className="btn-primary sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70]"
      >
        Lewati ke konten
      </a>
      <Sidebar />
      <div className="flex h-full min-w-0 flex-1 flex-col lg:ml-sidebar">
        <MobileHeader />
        <OfflineBanner />
        <UpdateBanner />
        <main
          ref={mainRef}
          id="konten"
          tabIndex={-1}
          className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain pl-[var(--sal)] pr-[var(--sar)] outline-none lg:pr-0"
        >
          {/* Transisi geser horizontal antar halaman (halaman lama memudar, lalu halaman baru masuk). */}
          <ErrorBoundary
            resetKey={pathname}
            fallback={(reset) => (
              <div role="alert" className="mx-auto flex max-w-sm flex-col items-center gap-3 px-4 py-24 text-center">
                <h2 className="font-display text-xl font-extrabold text-ink">Halaman ini bermasalah</h2>
                <p className="text-sm text-ink-muted">Ada yang gagal ditampilkan. Aplikasi tetap aman, coba lagi atau muat ulang.</p>
                <div className="flex gap-2">
                  <button type="button" className="btn-primary" onClick={reset}>
                    Coba lagi
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => window.location.reload()}>
                    Muat ulang
                  </button>
                </div>
              </div>
            )}
          >
            <PageTransition
              pathname={pathname}
              onSwap={scrollToTop}
              className={`mx-auto w-full max-w-6xl px-4 pt-2 lg:px-8 lg:pt-8 ${
                playerActive
                  ? compactDock
                    ? 'pb-[calc(6rem+var(--dock-offset))] lg:pb-28'
                    : 'pb-[calc(13rem+var(--dock-offset))] lg:pb-56'
                  : 'pb-[calc(1.5rem+var(--dock-offset))] lg:pb-10'
              }`}
            />
          </ErrorBoundary>
        </main>
        <PlayerDock />
        <BottomNav />
      </div>
      <TourHost />
      <MigrationNotice />
    </div>
  )
}
