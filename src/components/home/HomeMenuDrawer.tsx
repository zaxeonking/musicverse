import { BarChart3, CircleHelp, Download, History, Home, Library, Palette, Search, Settings, X, type LucideIcon } from 'lucide-react'
import { createPortal } from 'react-dom'
import { NavLink } from 'react-router-dom'
import { useMountTransition } from '../../hooks/useMountTransition'
import { useOverlayHistory } from '../../hooks/useOverlayHistory'
import { isNativeApp } from '../../native/platform'
import { startTour } from '../../tour/tourStore'
import Logo from '../ui/Logo'

interface DrawerItem {
  to: string
  label: string
  icon: LucideIcon
  nativeOnly?: boolean
}

const ITEMS: DrawerItem[] = [
  { to: '/', label: 'Beranda', icon: Home },
  { to: '/search', label: 'Cari', icon: Search },
  { to: '/library', label: 'Playlist', icon: Library },
  { to: '/downloads', label: 'Unduhan', icon: Download, nativeOnly: true },
  { to: '/history', label: 'Riwayat', icon: History },
  { to: '/history/recap', label: 'Rekap dengar', icon: BarChart3 },
  { to: '/settings/theme', label: 'Tema', icon: Palette, nativeOnly: true },
  { to: '/settings', label: 'Pengaturan', icon: Settings, nativeOnly: true },
]

/** Isi laci; hanya dipasang saat laci terbuka, jadi Back menutup laci (useOverlayHistory) tanpa meninggalkan entri riwayat. */
function DrawerBody({ onClose }: { onClose: () => void }) {
  useOverlayHistory(true, onClose)
  return null
}

/**
 * Laci menu dari kiri (tombol hamburger di Beranda). Masuk dengan geser + latar meredup, daftar menu naik bergantian.
 * Ditutup lewat ketuk latar, tombol silang, Escape, atau Back.
 */
export default function HomeMenuDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { mounted, open: shown } = useMountTransition(open, 300)
  if (!mounted) return null
  const native = isNativeApp()

  return createPortal(
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Menu" onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      {open && <DrawerBody onClose={onClose} />}
      <button
        type="button"
        aria-label="Tutup menu"
        tabIndex={-1}
        onClick={onClose}
        className={`absolute inset-0 bg-black/60 transition-opacity duration-300 motion-reduce:transition-none ${shown ? 'opacity-100' : 'opacity-0'}`}
      />
      <aside
        className={`absolute inset-y-0 left-0 flex w-[82%] max-w-80 flex-col bg-bg pb-[max(1rem,var(--sab))] pt-[max(1rem,var(--sat))] shadow-2xl shadow-black/60 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
          shown ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-5 pb-3">
          <Logo />
          <button type="button" onClick={onClose} aria-label="Tutup menu" className="icon-btn text-ink-muted">
            <X className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>
        <nav aria-label="Menu" className="min-h-0 flex-1 overflow-y-auto px-3">
          <ul className="space-y-1">
            {ITEMS.filter((item) => !item.nativeOnly || native).map(({ to, label, icon: Icon }, i) => (
              <li key={to} className={shown ? 'mv-in' : 'opacity-0'} style={{ ['--mv-delay' as string]: `${80 + i * 40}ms` }}>
                <NavLink
                  to={to}
                  end={to === '/'}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `focus-ring tap-row flex h-12 items-center gap-4 rounded-2xl px-4 font-medium ${isActive ? 'bg-raised font-semibold text-accent' : 'text-ink hover:bg-raised/60'}`
                  }
                >
                  <Icon className="h-6 w-6" aria-hidden="true" />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="px-3">
          <button
            type="button"
            onClick={() => {
              onClose()
              startTour()
            }}
            className="focus-ring tap-row flex h-12 w-full items-center gap-4 rounded-2xl px-4 font-medium text-ink-muted hover:bg-raised/60 hover:text-ink"
          >
            <CircleHelp className="h-6 w-6" aria-hidden="true" />
            Tutorial
          </button>
        </div>
      </aside>
    </div>,
    document.body,
  )
}
