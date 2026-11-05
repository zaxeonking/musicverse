import { NavLink, useLocation } from 'react-router-dom'
import { getNavItems } from '../../config/navigation'
import { useKeyboardOpen } from '../../hooks/useKeyboardOpen'
import { activeNavIndex } from '../../utils/navActive'

/**
 * Bottom nav "kaca cair" (liquid glass): pil melayang dengan latar kaca tembus pandang (blur + saturasi, jadi warnanya
 * mengikuti konten yang lewat di belakangnya), tepi berkilau, dan satu "lensa" kaca beraksen di belakang tab aktif yang
 * meluncur antar tab. Warna aksen dan permukaan memakai token tema (accent, raised), bukan warna tetap.
 *
 * Tata letak: pembungkus setinggi 0 (seperti dock mini player) dan bar diposisikan absolut di dasar, jadi `<main>` meluas sampai
 * ke tepi bawah dan konten tampak lewat di bawah kaca. Ruang yang dipesan bar dibagikan lewat variabel CSS `--dock-offset`
 * (diatur AppShell): padding konten dan posisi mini player memakainya, dan nilainya 0 saat keyboard terbuka / di layar lebar.
 *
 * Keyboard layar terbuka: bar turun keluar layar sambil memudar, lalu naik lagi saat keyboard hilang.
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
        className={`absolute inset-x-0 bottom-0 flex justify-center pb-[max(0.5rem,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
          keyboardOpen ? 'translate-y-[130%] opacity-0' : 'translate-y-0 opacity-100'
        }`}
      >
        <nav
          aria-label="Navigasi utama"
          style={{
            WebkitBackdropFilter: 'blur(26px) saturate(210%) brightness(1.05)',
            backdropFilter: 'blur(26px) saturate(210%) brightness(1.05)',
          }}
          className={`relative w-full max-w-md rounded-full border border-white/[0.18] bg-raised/80 p-1 shadow-[0_14px_36px_rgba(0,0,0,0.45),0_2px_8px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.28),inset_0_-1px_0_rgba(255,255,255,0.06),inset_0_0_18px_rgba(255,255,255,0.05)] supports-[backdrop-filter]:bg-white/[0.07] ${
            keyboardOpen ? 'pointer-events-none' : 'pointer-events-auto'
          }`}
        >
          {/* Kilau lengkung di tepi atas bar. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-b from-white/[0.16] via-transparent to-white/[0.04]"
          />
          {/* Kapsul kaca tab aktif (gaya iOS 26): lebih tinggi & lebar dari selnya sehingga sedikit keluar dari bar, tepinya
              berkilau dan diwarnai aksen tema. Meluncur antar tab; hilang bila tak ada tab aktif (mis. Pengaturan). */}
          <span
            aria-hidden="true"
            style={{
              width: `calc((100% - 0.5rem) / ${Math.max(items.length, 1)} + 0.5rem)`,
              left: `calc(0rem + (100% - 0.5rem) * ${Math.max(active, 0)} / ${Math.max(items.length, 1)})`,
              opacity: active >= 0 ? 1 : 0,
              backgroundImage:
                'linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.05) 45%, rgba(255,255,255,0.10) 100%)',
            }}
            className="pointer-events-none absolute -inset-y-[0.3rem] rounded-full border border-white/35 bg-accent/[0.20] shadow-[0_6px_18px_rgba(0,0,0,0.4),inset_0_1.5px_0_rgba(255,255,255,0.55),inset_0_-1.5px_0_rgba(255,255,255,0.15),inset_0_0_14px_rgba(255,255,255,0.12)] transition-[left,opacity] duration-500 ease-[cubic-bezier(0.34,1.4,0.64,1)] motion-reduce:transition-none"
          />
          <ul className="relative flex">
            {items.map(({ to, label, icon: Icon }) => (
              <li key={to} className="min-w-0 flex-1">
                <NavLink
                  to={to}
                  end={to === '/'}
                  tabIndex={keyboardOpen ? -1 : undefined}
                  className={({ isActive }) =>
                    `group flex h-14 flex-col items-center justify-center gap-0.5 rounded-full text-[11px] leading-none transition-[color,transform] duration-200 active:scale-95 motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent ${
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
