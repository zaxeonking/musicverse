import { Download } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { APK_DOWNLOAD_URL, GITHUB_REPO } from '../config/apk'

export const WRAP = 'mx-auto w-full max-w-6xl px-5 lg:px-8'
export const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-green focus-visible:ring-offset-2 focus-visible:ring-offset-site-fog'
export const H2 = 'font-display text-3xl font-extrabold leading-[1.05] tracking-[-0.03em] sm:text-5xl'

/** Tombol unduh APK (satu-satunya gaya tombol utama di situs). Hanya dirender saat unduhan tidak dijeda. */
export function DownloadButton({ className = '', label = 'Unduh APK' }: { className?: string; label?: string }) {
  return (
    <a
      href={APK_DOWNLOAD_URL}
      download="musicverse.apk"
      className={`inline-flex h-12 items-center justify-center gap-2.5 rounded-full bg-accent px-6 font-display text-base font-bold text-accent-on transition-[transform,background-color] duration-150 hover:bg-accent-soft active:scale-[0.97] ${FOCUS} ${className}`}
    >
      <Download className="h-5 w-5" aria-hidden="true" />
      {label}
    </a>
  )
}

/** Muncul sekali saat masuk layar (fade + geser 16px). Langsung tampil bila gerakan dikurangi atau IntersectionObserver tidak ada. */
export function Reveal({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(
    () => typeof IntersectionObserver === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    const el = ref.current
    if (shown || !el) return undefined
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true)
          io.disconnect()
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -6% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [shown])
  return (
    <div
      ref={ref}
      style={{ transitionDelay: shown ? `${delay}ms` : '0ms' }}
      className={`transition-[opacity,transform] duration-700 ease-out motion-reduce:transition-none ${shown ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'} ${className}`}
    >
      {children}
    </div>
  )
}

export interface Release {
  tag: string
  size: number | null
  date: string | null
}

/** Data rilis asli dari GitHub (tag, ukuran musicverse.apk, tanggal). Null bila belum termuat atau gagal: UI tidak menampilkan angka karangan. */
export function useLatestRelease(enabled: boolean): Release | null {
  const [release, setRelease] = useState<Release | null>(null)
  useEffect(() => {
    if (!enabled) return undefined
    const ctl = new AbortController()
    fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, { signal: ctl.signal, headers: { Accept: 'application/vnd.github+json' } })
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { tag_name?: unknown; published_at?: unknown; assets?: Array<{ name?: string; size?: unknown }> } | null) => {
        if (!json || typeof json.tag_name !== 'string') return
        const apk = Array.isArray(json.assets) ? json.assets.find((a) => a.name === 'musicverse.apk') : undefined
        setRelease({
          tag: json.tag_name,
          size: typeof apk?.size === 'number' ? apk.size : null,
          date: typeof json.published_at === 'string' ? json.published_at : null,
        })
      })
      .catch(() => undefined)
    return () => ctl.abort()
  }, [enabled])
  return release
}

export const formatSize = (bytes: number) => `${(bytes / 1048576).toFixed(1).replace('.', ',')} MB`
export const formatDate = (iso: string) => new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
