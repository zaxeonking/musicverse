import { NavLink, useLocation } from 'react-router-dom'
import { getNavItems } from '../../config/navigation'
import { useKeyboardOpen } from '../../hooks/useKeyboardOpen'
import { activeNavIndex } from '../../utils/navActive'

/**
 * Bottom nav: bar pil solid melayang di dasar layar. Tab aktif ditandai blok datar `bg-raised` yang meluncur antar tab
 * (hanya `transform` yang dianimasikan), tanpa kaca, kilau, atau cahaya.
 *
 * Tata letak: pembungkus setinggi 0 (seperti dock mini player) dan bar diposisikan absolut di dasar. Ruang yang dipesan bar
 * dibagikan lewat variabel CSS `--dock-offset` (diatur AppShell), bernilai 0 saat keyboard terbuka / di layar lebar.
 * Keyboard layar terbuka: bar turun keluar layar sambil memudar, lalu naik lagi.
 */
export default function BottomNav() {
  const keyboardOpen = useKeyboardOpen()
  const { pathname } = useLocation()
  const items = getNavItems()
  const active = activeNavIndex(
    pathname,
    items.map((item) => item.to),
  )

  return (
    <div className="pointer-events-none relative z-30 h-0 shrink-0 lg:hidden" aria-hidden={keyboardOpen || undefined}>
      <div
        className={`absolute inset-x-0 bottom-0 flex justify-center pb-[max(0.5rem,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform motion-reduce:transition-none ${
          keyboardOpen ? 'translate-y-[130%] opacity-0' : 'translate-y-0 opacity-100'
        }`}
      >
        <nav
          aria-label="Navigasi utama"
          className={`relative w-full max-w-md rounded-full border border-line bg-card p-1 ${
            keyboardOpen ? 'pointer-events-none' : 'pointer-events-auto'
          }`}
        >
          {/* Penanda tab aktif: blok datar selebar ikon + label, meluncur antar tab; hilang bila tak ada tab aktif (mis. Pengaturan). */}
          <span aria-hidden="true" className="pointer-events-none absolute inset-y-1 left-1 right-1">
            {/* Lajur selebar satu tab; hanya `transform` yang dianimasikan (jalur GPU, tanpa layout ulang tiap frame). */}
            <span
              style={{
                width: `${100 / Math.max(items.length, 1)}%`,
                transform: `translate3d(${Math.max(active, 0) * 100}%, 0, 0)`,
              }}
              className="absolute inset-y-0 left-0 flex justify-center transition-transform duration-500 ease-[cubic-bezier(0.34,1.4,0.64,1)] will-change-transform motion-reduce:transition-none"
            >
              <span
                style={{ width: '4.5rem', opacity: active >= 0 ? 1 : 0 }}
                className="h-full rounded-2xl bg-raised transition-opacity duration-300 motion-reduce:transition-none"
              />
            </span>
          </span>
          <ul className="relative flex">
            {items.map(({ to, label, icon: Icon }) => (
              <li key={to} className="min-w-0 flex-1">
                <NavLink
                  to={to}
                  end={to === '/'}
                  tabIndex={keyboardOpen ? -1 : undefined}
                  className={({ isActive }) =>
                    `group flex h-14 flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] leading-none transition-[color,transform] duration-200 [-webkit-tap-highlight-color:transparent] active:scale-95 motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent ${
                      isActive ? 'font-semibold text-accent-soft' : 'font-medium text-ink/85 hover:text-ink'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        className={`h-6 w-6 transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
                          isActive ? 'scale-110' : ''
                        }`}
                        aria-hidden="true"
                      />
                      <span className="max-w-full truncate px-1">{label}</span>
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  )
}
