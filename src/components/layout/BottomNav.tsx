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
        className={`absolute inset-x-0 bottom-0 flex justify-center pb-[max(0.5rem,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform motion-reduce:transition-none ${
          keyboardOpen ? 'translate-y-[130%] opacity-0' : 'translate-y-0 opacity-100'
        }`}
      >
        <nav
          aria-label="Navigasi utama"
          style={{
            WebkitBackdropFilter: 'blur(16px) saturate(120%) brightness(0.55)',
            backdropFilter: 'blur(16px) saturate(120%) brightness(0.55)',
          }}
          className={`relative w-full max-w-md rounded-full border border-white/[0.12] bg-[#161616]/85 p-1 shadow-[0_14px_36px_rgba(0,0,0,0.45),0_2px_8px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.28),inset_0_-1px_0_rgba(255,255,255,0.06),inset_0_0_18px_rgba(255,255,255,0.05)] supports-[backdrop-filter]:bg-[#161616]/60 ${
            keyboardOpen ? 'pointer-events-none' : 'pointer-events-auto'
          }`}
        >
          {/* Kilau lengkung di tepi atas bar. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-b from-white/[0.08] via-transparent to-transparent"
          />
          {/* Penanda tab aktif: kotak kaca melengkung yang ringkas, hanya selebar ikon + label dan tetap di dalam bar,
              diwarnai aksen tema. Meluncur antar tab; hilang bila tak ada tab aktif (mis. Pengaturan). */}
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
                style={{
                  width: '4.5rem',
                  opacity: active >= 0 ? 1 : 0,
                  backgroundImage:
                    'radial-gradient(circle at 50% 38%, rgba(29,185,84,0.38) 0%, rgba(29,185,84,0.12) 38%, transparent 62%), linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.03) 50%, rgba(255,255,255,0.06) 100%)',
                }}
                className="h-full rounded-2xl border border-white/20 bg-accent/[0.12] shadow-[inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-1px_0_rgba(255,255,255,0.06)] transition-opacity duration-300 motion-reduce:transition-none"
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
