import { Menu, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { DISTRIBUTION_PAUSED, REPO_URL } from '../config/apk'
import { CONTACT_EMAIL } from '../config/site'
import SiteLogo from './SiteLogo'
import { DownloadButton, FOCUS, WRAP } from './ui'

const FONTS_ID = 'mv-site-fonts'
const FONTS_HREF = 'https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap'
const BG = '#111111'

const NAV: ReadonlyArray<readonly [string, string]> = [
  ['Fitur', 'fitur'],
  ['Unduh', 'unduh'],
  ['Platform', 'platform'],
  ['Tanya jawab', 'tanya'],
  ['Bantuan', 'masukan'],
]

/**
 * Kerangka situs: header, konten, footer. Area scroll ada di wadah ini (bukan window) karena index.css mengunci
 * html/body/#root. Situs memakai tema gelap (index.html juga gelap).
 */
export default function SiteLayout() {
  const { pathname, hash } = useLocation()
  const scroller = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const anchor = (id: string) => (pathname === '/' ? `#${id}` : `/#${id}`)

  useEffect(() => {
    const root = document.documentElement
    const previous = { scheme: root.style.colorScheme, bg: document.body.style.backgroundColor }
    root.style.colorScheme = 'dark'
    document.body.style.backgroundColor = BG
    const theme = document.querySelector('meta[name="theme-color"]')
    const prevTheme = theme?.getAttribute('content') ?? null
    theme?.setAttribute('content', BG)
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
    }
  }, [])

  useEffect(() => {
    if (hash) return
    scroller.current?.scrollTo({ top: 0 })
  }, [pathname, hash])

  useEffect(() => setOpen(false), [pathname, hash])
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const link = `rounded-full px-3 py-2 text-site-slate transition-colors hover:text-site-ink ${FOCUS}`
  const ghUrl = DISTRIBUTION_PAUSED ? `${REPO_URL}/issues` : REPO_URL

  return (
    <div
      ref={scroller}
      onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 8)}
      className="fixed inset-0 overflow-y-auto overflow-x-hidden bg-site-fog font-sans text-site-ink scroll-smooth"
    >
      <a href="#konten" className="sr-only rounded-full bg-accent px-4 py-2 font-display text-sm font-semibold text-accent-on focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50">
        Lewati ke konten
      </a>

      <header className={`sticky top-0 z-40 bg-site-fog transition-shadow duration-200 ${scrolled || open ? 'shadow-[0_1px_0_rgba(255,255,255,0.1)]' : ''}`}>
        <div className={`${WRAP} flex h-16 items-center justify-between gap-3`}>
          <Link to="/" aria-label="MusicVerse, ke halaman utama" className={`-ml-1 rounded-md p-1 ${FOCUS}`}>
            <SiteLogo />
          </Link>
          <nav aria-label="Navigasi situs" className="flex items-center gap-1 font-display text-[0.95rem] font-semibold">
            <div className="hidden items-center md:flex">
              {NAV.map(([label, id]) => (
                <a key={id} href={anchor(id)} className={link}>
                  {label}
                </a>
              ))}
            </div>
            {DISTRIBUTION_PAUSED ? (
              <a href={anchor('upgrade')} className={`ml-1 inline-flex h-10 items-center rounded-full bg-accent px-4 font-bold text-accent-on transition-transform active:scale-[0.97] ${FOCUS}`}>
                Kabar upgrade
              </a>
            ) : (
              <DownloadButton label="Unduh APK" className="!ml-1 !h-10 !px-4 !text-[0.95rem]" />
            )}
            <button
              type="button"
              aria-expanded={open}
              aria-controls="menu-mobile"
              aria-label={open ? 'Tutup menu' : 'Buka menu'}
              onClick={() => setOpen((v) => !v)}
              className={`flex h-10 w-10 items-center justify-center rounded-full text-site-ink transition-colors hover:bg-site-raise md:hidden ${FOCUS}`}
            >
              {open ? <X className="h-6 w-6" aria-hidden="true" /> : <Menu className="h-6 w-6" aria-hidden="true" />}
            </button>
          </nav>
        </div>
        <div id="menu-mobile" className={`grid transition-[grid-template-rows] duration-300 ease-out md:hidden ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
          <div className={`overflow-hidden transition-[visibility] duration-300 ${open ? 'visible' : 'invisible'}`}>
            <ul className={`${WRAP} pb-4 font-display text-xl font-bold`}>
              {NAV.map(([label, id]) => (
                <li key={id} className="border-t border-site-line">
                  <a href={anchor(id)} className={`flex min-h-[3.25rem] items-center rounded-md ${FOCUS}`}>
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </header>

      <main id="konten" tabIndex={-1} className="outline-none">
        <Outlet />
      </main>

      <footer className="mt-24 border-t border-site-line bg-site-paper">
        <div className={`${WRAP} grid gap-10 py-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]`}>
          <div className="max-w-xs">
            <SiteLogo />
            <p className="mt-4 text-sm leading-relaxed text-site-slate">
              MusicVerse tidak berafiliasi dengan Spotify, Google, atau YouTube. Semua nama dan merek milik pemiliknya masing-masing.
            </p>
          </div>
          {(
            [
              ['Produk', [<a key="f" href={anchor('fitur')}>Fitur</a>, <a key="u" href={anchor('unduh')}>Unduh</a>, <a key="p" href={anchor('platform')}>Platform</a>]],
              [
                'Bantuan',
                [
                  <a key="t" href={anchor('tanya')}>Tanya jawab</a>,
                  <a key="m" href={anchor('masukan')}>Kirim masukan</a>,
                  <a key="g" href={ghUrl} target="_blank" rel="noopener noreferrer">{DISTRIBUTION_PAUSED ? 'GitHub Issues' : 'GitHub'}</a>,
                  CONTACT_EMAIL ? <a key="e" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> : <a key="e" href={`${REPO_URL}/issues`} target="_blank" rel="noopener noreferrer">Kontak lewat Issues</a>,
                ],
              ],
              ['Hukum', [<Link key="pv" to="/privacy">Kebijakan Privasi</Link>, <Link key="tm" to="/terms">Ketentuan Layanan</Link>]],
            ] as const
          ).map(([title, items]) => (
            <nav key={title} aria-label={title}>
              <p className="font-display text-sm font-bold text-site-ink">{title}</p>
              <ul className="mt-3 space-y-0.5 text-[0.95rem] text-site-slate [&_a]:inline-block [&_a]:rounded-md [&_a]:py-1.5 [&_a]:transition-colors [&_a]:hover:text-site-ink [&_a]:focus-visible:outline-none [&_a]:focus-visible:ring-2 [&_a]:focus-visible:ring-site-green">
                {items.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <p className={`${WRAP} border-t border-site-line py-6 text-sm text-site-slate`}>© 2026 MusicVerse</p>
      </footer>
    </div>
  )
}
