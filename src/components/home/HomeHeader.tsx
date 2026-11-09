import { Bell, Compass, ListMusic, Menu, Mic2, Music2, Search, SlidersHorizontal, Timer } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { SITE_NAME } from '../../config/site'
import { useSleepTimer } from '../../context/SleepTimerContext'
import { useGreeting } from '../../hooks/greeting'
import { useAppUpdate } from '../../hooks/useAppUpdate'
import { useMountTransition } from '../../hooks/useMountTransition'
import { artistSearch } from '../../utils/artistSearchStore'
import SleepTimerSheet from '../player/SleepTimerSheet'
import HomeMenuDrawer from './HomeMenuDrawer'

/** Emoji sapaan ikut waktu: matahari (pagi-sore), senja, bulan. */
function greetingEmoji(greeting: string): string {
  if (greeting.endsWith('malam')) return '🌙'
  if (greeting.endsWith('sore')) return '🌇'
  return '☀️'
}

/** Kartu kecil yang muncul di bawah tombol (filter, notifikasi): membesar dari pojok kanan atas, tutup lewat ketuk di luar atau Escape. */
function Popover({ open, onClose, label, children }: { open: boolean; onClose: () => void; label: string; children: ReactNode }) {
  const { mounted, open: shown } = useMountTransition(open, 200)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => {
      // Ketukan di tombol pemicunya (saudara kartu ini dalam pembungkus yang sama) diurus tombolnya sendiri, supaya tidak menutup lalu membuka lagi.
      const wrapper = ref.current?.parentElement
      if (wrapper && !wrapper.contains(e.target as Node)) onClose()
    }
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('pointerdown', away, true)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('pointerdown', away, true)
      document.removeEventListener('keydown', key)
    }
  }, [open, onClose])

  if (!mounted) return null
  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={label}
      className={`absolute right-0 top-full z-40 mt-2 w-72 origin-top-right rounded-3xl border border-line bg-raised p-2 shadow-2xl shadow-black/50 transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.34,1.4,0.64,1)] motion-reduce:transition-none ${
        shown ? 'scale-100 opacity-100' : 'pointer-events-none scale-90 opacity-0'
      }`}
    >
      {children}
    </div>
  )
}

function MenuRow({ icon: Icon, title, hint, onClick }: { icon: typeof Search; title: string; hint: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="focus-ring tap-row flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left hover:bg-veil/10">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink">{title}</span>
        <span className="block truncate text-xs text-ink-muted">{hint}</span>
      </span>
    </button>
  )
}

/**
 * Kepala Beranda ala StreamBeats: menu (laci), sapaan + nama aplikasi, sleep timer, notifikasi; di bawahnya kolom cari dan tombol
 * filter. Kolom cari tetap hanya pintu ke tab Cari. Timer membuka lembar sleep timer yang sama dengan pemutar penuh.
 */
export default function HomeHeader() {
  const greeting = useGreeting()
  const navigate = useNavigate()
  const timer = useSleepTimer()
  const update = useAppUpdate()
  const [drawer, setDrawer] = useState(false)
  const [timerOpen, setTimerOpen] = useState(false)
  const [filter, setFilter] = useState(false)
  const [bell, setBell] = useState(false)

  const goSearch = (mode: 'track' | 'artist') => {
    setFilter(false)
    artistSearch.setMode(mode)
    navigate('/search', { state: { focus: true } })
  }

  return (
    <header className="space-y-5">
      <div className="flex items-center gap-3">
        {/* Menu membawa penanda tutorial Pengaturan: pengaturan kini ada di laci ini. */}
        <button
          type="button"
          data-tour="settings-btn tour-restart"
          onClick={() => setDrawer(true)}
          aria-label="Buka menu"
          aria-haspopup="dialog"
          className="icon-btn -ml-2 shrink-0 text-ink"
        >
          <Menu className="h-7 w-7" aria-hidden="true" />
        </button>
        <div className="mv-in min-w-0 flex-1">
          <p className="truncate text-sm text-ink-muted">
            {greeting} <span aria-hidden="true">{greetingEmoji(greeting)}</span>
          </p>
          <h1 id="home-title" className="truncate font-display text-[1.7rem] font-extrabold leading-tight tracking-tight text-ink">
            {SITE_NAME}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setTimerOpen(true)}
          aria-label={timer.active ? 'Sleep timer aktif, atur' : 'Atur sleep timer'}
          aria-haspopup="dialog"
          className="icon-btn relative shrink-0 text-ink"
        >
          <Timer className="h-7 w-7" aria-hidden="true" />
          {timer.active && <span aria-hidden="true" className="mv-pop absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-bg" />}
        </button>
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => {
              setFilter(false)
              setBell((v) => !v)
            }}
            aria-label={update ? 'Notifikasi, ada pembaruan' : 'Notifikasi'}
            aria-expanded={bell}
            className="icon-btn relative text-ink"
          >
            <Bell className={`h-7 w-7 ${update ? 'mv-ring' : ''}`} aria-hidden="true" />
            {update && <span aria-hidden="true" className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-bg" />}
          </button>
          <Popover open={bell} onClose={() => setBell(false)} label="Notifikasi">
            {update ? (
              <Link to="/settings/update" onClick={() => setBell(false)} className="focus-ring tap-row flex items-center gap-3 rounded-2xl px-3 py-2.5 hover:bg-veil/10">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
                  <Music2 className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink">Pembaruan tersedia</span>
                  <span className="block truncate text-xs text-ink-muted">Versi {update.release.version}. Ketuk untuk memperbarui.</span>
                </span>
              </Link>
            ) : (
              <p className="px-3 py-4 text-center text-sm text-ink-muted">Tidak ada notifikasi baru.</p>
            )}
          </Popover>
        </div>
      </div>

      <div className="relative flex items-center gap-3">
        <Link
          to="/search"
          state={{ focus: true }}
          data-tour="home-search"
          aria-label="Buka pencarian"
          className="focus-ring tap-row flex h-14 min-w-0 flex-1 items-center gap-3 rounded-2xl bg-raised px-4 text-ink-faint hover:bg-raised-hover"
        >
          <Search className="h-6 w-6 shrink-0 text-ink" aria-hidden="true" />
          <span className="truncate text-[1.02rem]">Mau dengar apa hari ini?</span>
        </Link>
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => {
              setBell(false)
              setFilter((v) => !v)
            }}
            aria-label="Filter pencarian"
            aria-expanded={filter}
            className="focus-ring tap-card flex h-14 w-14 items-center justify-center rounded-2xl bg-raised text-ink hover:bg-raised-hover"
          >
            <SlidersHorizontal className={`h-6 w-6 transition-transform duration-300 motion-reduce:transition-none ${filter ? 'rotate-90' : ''}`} aria-hidden="true" />
          </button>
          <Popover open={filter} onClose={() => setFilter(false)} label="Filter pencarian">
            <MenuRow icon={Music2} title="Cari lagu" hint="Judul lagu atau tautan Spotify" onClick={() => goSearch('track')} />
            <MenuRow icon={Mic2} title="Cari artis" hint="Profil, lagu, dan album artis" onClick={() => goSearch('artist')} />
            <MenuRow
              icon={Compass}
              title="Jelajah suasana & genre"
              hint="Pilih dari kotak suasana"
              onClick={() => {
                setFilter(false)
                navigate('/search')
              }}
            />
            <MenuRow
              icon={ListMusic}
              title="Semua lagu"
              hint="Lagu di perangkatmu"
              onClick={() => {
                setFilter(false)
                navigate('/search?view=all')
              }}
            />
          </Popover>
        </div>
      </div>

      <HomeMenuDrawer open={drawer} onClose={() => setDrawer(false)} />
      {timerOpen && <SleepTimerSheet onClose={() => setTimerOpen(false)} />}
    </header>
  )
}
