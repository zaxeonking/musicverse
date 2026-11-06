import { useEffect, useRef } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { APK_RELEASE_URL, REPO_URL } from '../config/apk'
import SiteLogo from './SiteLogo'

const FONTS_ID = 'mv-site-fonts'
const FONTS_HREF = 'https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap'

/**
 * Kerangka situs: header, konten, footer. Area scroll ada di wadah ini (bukan window) karena index.css mengunci
 * html/body/#root. Tema terang diterapkan di sini (index.html bawaannya gelap untuk APK).
 */
export default function SiteLayout() {
  const { pathname, hash } = useLocation()
  const scroller = useRef<HTMLDivElement>(null)
  // Di landing cukup "#bagian" (tanpa memuat ulang); dari halaman lain kembali ke "/" dulu.
  const anchor = (id: string) => (pathname === '/' ? `#${id}` : `/#${id}`)

  useEffect(() => {
    const root = document.documentElement
    const previous = { scheme: root.style.colorScheme, bg: document.body.style.backgroundColor }
    root.style.colorScheme = 'light'
    document.body.style.backgroundColor = '#E8EDEE'
    const theme = document.querySelector('meta[name="theme-color"]')
    const colorScheme = document.querySelector('meta[name="color-scheme"]')
    const prevTheme = theme?.getAttribute('content') ?? null
    const prevScheme = colorScheme?.getAttribute('content') ?? null
    theme?.setAttribute('content', '#E8EDEE')
    colorScheme?.setAttribute('content', 'light')

    // Huruf bacaan hanya dimuat di situs; APK tidak memerlukannya.
    if (!document.getElementById(FONTS_ID)) {
      const link = document.createElement('link')
      link.id = FONTS_ID
      link.rel = 'stylesheet'
      link.href = FONTS_HREF
      document.head.appendChild(link)
    }
    return () => {
      root.style.colorScheme = previous.scheme
      document.body.style.backgroundColor = previous.bg
      if (prevTheme !== null) theme?.setAttribute('content', prevTheme)
      if (prevScheme !== null) colorScheme?.setAttribute('content', prevScheme)
    }
  }, [])

  // Pindah halaman: ke atas. Tautan #bagian: biarkan peramban menggulung ke elemennya.
  useEffect(() => {
    if (hash) return
    scroller.current?.scrollTo({ top: 0 })
  }, [pathname, hash])

  return (
    <div ref={scroller} className="fixed inset-0 overflow-y-auto overflow-x-hidden bg-site-fog font-reading text-site-ink scroll-smooth">
      <a
        href="#konten"
        className="sr-only rounded-full bg-site-ink px-4 py-2 font-display text-sm font-semibold text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50"
      >
        Lewati ke konten
      </a>

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-4 lg:px-8 lg:py-6">
        <Link to="/" aria-label="MusicVerse, ke halaman utama" className="-ml-1 rounded-md p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-green">
          <SiteLogo />
        </Link>
        <nav aria-label="Navigasi situs" className="flex items-center gap-1 font-display text-[0.95rem] font-semibold">
          <a href={anchor('fitur')} className="hidden rounded-full px-3 py-2 text-site-slate hover:text-site-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-green sm:block">
            Fitur
          </a>
          <a href={anchor('platform')} className="hidden rounded-full px-3 py-2 text-site-slate hover:text-site-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-green sm:block">
            Platform
          </a>
          <a href={anchor('tanya')} className="hidden rounded-full px-3 py-2 text-site-slate hover:text-site-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-green sm:block">
            Tanya jawab
          </a>
          <a
            href={APK_RELEASE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-1 inline-flex h-10 items-center rounded-full bg-site-ink px-4 text-white hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-green focus-visible:ring-offset-2 focus-visible:ring-offset-site-fog"
          >
            Unduh APK
          </a>
        </nav>
      </header>

      <main id="konten" tabIndex={-1} className="outline-none">
        <Outlet />
      </main>

      <footer className="mx-auto mt-24 w-full max-w-6xl border-t border-site-line px-5 py-10 lg:px-8">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-sm">
            <SiteLogo />
            <p className="mt-3 text-sm leading-relaxed text-site-slate">
              MusicVerse tidak berafiliasi dengan Spotify, Google, atau YouTube. Semua nama dan merek milik pemiliknya masing-masing.
            </p>
          </div>
          <nav aria-label="Tautan hukum dan rilis" className="flex flex-col gap-2 font-display text-[0.95rem] font-semibold">
            <Link to="/privacy" className="rounded-md py-1 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-green">
              Kebijakan Privasi
            </Link>
            <Link to="/terms" className="rounded-md py-1 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-green">
              Ketentuan Layanan
            </Link>
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="rounded-md py-1 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-green">
              Rilis di GitHub
            </a>
          </nav>
        </div>
        <p className="mt-8 text-sm text-site-slate">© 2026 MusicVerse</p>
      </footer>
    </div>
  )
}
