import { ArrowDownToLine, Bell, Compass, ListMusic, Mic2, Music2, RefreshCw, Rocket, Search, Sparkles, SlidersHorizontal, Timer, UserRound } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { SITE_NAME } from '../../config/site'
import { useSleepTimer } from '../../context/SleepTimerContext'
import { useGreeting } from '../../hooks/greeting'
import { checkForUpdate, useAppUpdate, type AppUpdateState, type UpdateCheckResult } from '../../hooks/useAppUpdate'
import { useMountTransition } from '../../hooks/useMountTransition'
import { updatesSupported } from '../../native/appUpdate'
import { startWhatsNew, unseenWhatsNewSteps } from '../../tour/tourStore'
import { WHATS_NEW } from '../../tour/steps'
import { artistSearch } from '../../utils/artistSearchStore'
import { MIGRATION_NOTICE_ID, openMigrationNotice } from '../../utils/migrationNotice'
import { markNotificationSeen, notificationSignature, readNotificationSeen } from '../../utils/notificationSeen'
import SleepTimerSheet from '../player/SleepTimerSheet'
import HomeMenuDrawer from './HomeMenuDrawer'

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

const LATEST_WHATS_NEW = WHATS_NEW[WHATS_NEW.length - 1] ?? null

const CHECK_TEXT: Record<UpdateCheckResult, string> = {
  available: 'Ada versi baru, lihat di atas.',
  latest: 'Aplikasi sudah versi terbaru.',
  error: 'Belum bisa memeriksa. Coba lagi nanti.',
  unsupported: '',
}

/** Isi lonceng: pembaruan aplikasi (dicek berkala di latar), tombol cek manual, dan fitur baru dari rilis terbaru. */
function NotificationPanel({ update, onClose }: { update: AppUpdateState | null; onClose: () => void }) {
  const [checkText, setCheckText] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const supported = updatesSupported()
  const unseen = unseenWhatsNewSteps().length > 0
  const features = LATEST_WHATS_NEW ? LATEST_WHATS_NEW.steps.slice(0, 3) : []

  // Lonceng dibuka = cek pembaruan lagi (ditahan bila baru saja dicek).
  useEffect(() => {
    if (supported) void checkForUpdate()
  }, [supported])

  const runCheck = () => {
    if (checking) return
    setChecking(true)
    setCheckText(null)
    void checkForUpdate().then((result) => {
      setChecking(false)
      setCheckText(CHECK_TEXT[result])
    })
  }

  return (
    <div className="max-h-[60vh] overflow-y-auto overscroll-contain">
      {/* Pengumuman migrasi: selalu ada di sini dan membuka kartunya lagi kapan pun diketuk. */}
      <button
        type="button"
        onClick={() => {
          onClose()
          openMigrationNotice()
        }}
        aria-haspopup="dialog"
        className="focus-ring tap-row flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left hover:bg-veil/10"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
          <Rocket className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-ink">Upgrade Besar MusicVerse</span>
          <span className="block truncate text-xs text-ink-muted">Dibangun ulang jadi app Android native. Ketuk untuk detail.</span>
        </span>
      </button>
      {update && (
        <Link to="/settings/update" onClick={onClose} className="focus-ring tap-row flex items-center gap-3 rounded-2xl px-3 py-2.5 hover:bg-veil/10">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
            <ArrowDownToLine className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-ink">Pembaruan tersedia</span>
            <span className="block truncate text-xs text-ink-muted">Versi {update.release.version}. Ketuk untuk memperbarui.</span>
          </span>
        </Link>
      )}
      {supported && (
        <button type="button" onClick={runCheck} disabled={checking} className="focus-ring tap-row flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left hover:bg-veil/10 disabled:opacity-70">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
            <RefreshCw className={`h-5 w-5 ${checking ? 'animate-spin motion-reduce:animate-none' : ''}`} aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-ink">Cek pembaruan</span>
            <span className="block truncate text-xs text-ink-muted">{checking ? 'Memeriksa…' : (checkText ?? 'Dicek otomatis tiap beberapa menit.')}</span>
          </span>
        </button>
      )}
      {features.length > 0 && (
        <>
          <p className="px-3 pb-1 pt-3 text-[0.7rem] font-semibold uppercase tracking-wider text-ink-faint">Fitur baru</p>
          {features.map((step) => {
            const body = (
              <>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
                  <Sparkles className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink">{step.title.replace(/^Baru:\s*/i, '')}</span>
                  <span className="line-clamp-2 text-xs text-ink-muted">{step.body}</span>
                </span>
              </>
            )
            // Yang belum pernah dilihat membuka tur "Yang baru"; sesudahnya hanya pengumuman.
            return unseen ? (
              <button
                key={step.id}
                type="button"
                onClick={() => {
                  onClose()
                  startWhatsNew()
                }}
                className="focus-ring tap-row flex w-full items-start gap-3 rounded-2xl px-3 py-2.5 text-left hover:bg-veil/10"
              >
                {body}
              </button>
            ) : (
              <div key={step.id} className="flex items-start gap-3 rounded-2xl px-3 py-2.5">
                {body}
              </div>
            )
          })}
        </>
      )}
          </div>
  )
}

/**
 * Kepala Beranda MusicVerse: avatar polos (membuka laci menu), sapaan kecil di atas nama aplikasi, sleep timer dan
 * notifikasi. Di bawahnya kolom cari berbentuk kapsul polos dan tombol filter bulat.
 * Kolom cari tetap hanya pintu ke tab Jelajah. Timer membuka lembar sleep timer yang sama dengan pemutar penuh.
 */
export default function HomeHeader() {
  const greeting = useGreeting()
  const navigate = useNavigate()
  const timer = useSleepTimer()
  // Lonceng tetap menampilkan pembaruan walau bannernya sudah ditutup; titiknya hilang saat lonceng dibuka.
  const update = useAppUpdate({ includeDismissed: true })
  const signature = notificationSignature(update?.release.version ?? null, LATEST_WHATS_NEW?.id ?? null, MIGRATION_NOTICE_ID)
  const [seenSignature, setSeenSignature] = useState(readNotificationSeen)
  const unread = seenSignature !== signature
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
    <header className="space-y-4">
      <div className="flex items-center gap-3">
        {/* Avatar membawa penanda tutorial Pengaturan: pengaturan ada di laci menu yang dibuka tombol ini. */}
        <button
          type="button"
          data-tour="settings-btn tour-restart"
          onClick={() => setDrawer(true)}
          aria-label="Buka menu"
          aria-haspopup="dialog"
          className="focus-ring tap-card flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-raised text-ink ring-1 ring-veil/10"
        >
          <UserRound className="h-5 w-5" aria-hidden="true" />
        </button>
        <div className="mv-in min-w-0 flex-1">
          <p className="truncate text-[0.78rem] leading-none text-ink-muted">{greeting}</p>
          <h1 id="home-title" className="mt-1 truncate font-display text-[1.4rem] font-bold leading-none tracking-[-0.02em] text-ink">
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
          <Timer className="h-6 w-6" aria-hidden="true" />
          {timer.active && <span aria-hidden="true" className="mv-pop absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-coral ring-2 ring-bg" />}
        </button>
        <div className="relative shrink-0">
          <button
            type="button"
            data-tour="home-notif"
            onClick={() => {
              setFilter(false)
              if (!bell) {
                markNotificationSeen(signature)
                setSeenSignature(signature)
              }
              setBell((v) => !v)
            }}
            aria-label={update ? 'Notifikasi, ada pembaruan' : unread ? 'Notifikasi, ada yang baru' : 'Notifikasi'}
            aria-expanded={bell}
            className="icon-btn relative text-ink"
          >
            <Bell className={`h-6 w-6 ${update && unread ? 'mv-ring' : ''}`} aria-hidden="true" />
            {unread && <span aria-hidden="true" className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-coral ring-2 ring-bg" />}
          </button>
          <Popover open={bell} onClose={() => setBell(false)} label="Notifikasi">
            <NotificationPanel update={update} onClose={() => setBell(false)} />
          </Popover>
        </div>
      </div>

      <div className="relative flex items-stretch gap-2.5">
        <Link
          to="/search"
          state={{ focus: true }}
          data-tour="home-search"
          aria-label="Buka pencarian"
          className="focus-ring tap-row group flex h-12 min-w-0 flex-1 items-center gap-3 rounded-full bg-raised pl-4 pr-4 text-ink-faint hover:bg-raised-hover"
        >
          <Search className="h-5 w-5 shrink-0 text-ink-muted" aria-hidden="true" />
          <span className="truncate text-[0.98rem]">Lagu, artis, atau tautan</span>
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
            className="focus-ring tap-card flex h-12 w-12 items-center justify-center rounded-full bg-raised text-ink hover:bg-raised-hover"
          >
            <SlidersHorizontal className={`h-5 w-5 transition-transform duration-300 motion-reduce:transition-none ${filter ? 'rotate-90' : ''}`} aria-hidden="true" />
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
