import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { useNavigationType, useOutlet } from 'react-router-dom'
import { getNavItems } from '../../config/navigation'

/** Lama halaman lama memudar sebelum halaman baru masuk (ms). Harus sama dengan `.page-exit` di index.css. */
const EXIT_MS = 130

/**
 * Arah geser: +1 = maju (halaman baru masuk dari kanan), -1 = mundur (dari kiri).
 * Antar tab bawah mengikuti urutan tab; halaman yang lebih dalam = maju; kembali ke induknya / tombol Kembali = mundur.
 */
function directionBetween(from: string, to: string, popped: boolean): 1 | -1 {
  const tabs = getNavItems().map((item) => item.to)
  const a = tabs.indexOf(from)
  const b = tabs.indexOf(to)
  if (a >= 0 && b >= 0) return b > a ? 1 : -1
  if (to.startsWith(`${from === '/' ? '' : from}/`)) return 1
  if (from.startsWith(`${to === '/' ? '' : to}/`)) return -1
  // Dari halaman dalam ke tab = mundur; dari tab ke halaman dalam = maju.
  if (a >= 0) return 1
  if (b >= 0) return -1
  return popped ? -1 : 1
}

const reducedMotion = () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

interface PageTransitionProps {
  pathname: string
  className: string
  /** Dipanggil (sebelum digambar) tepat saat halaman baru terpasang, mis. untuk mengembalikan scroll ke atas. */
  onSwap: () => void
}

/**
 * Pergantian halaman: halaman lama memudar sambil bergeser tipis, lalu halaman baru masuk dengan geseran horizontal lembut.
 * Hanya `pathname` yang memicu (membuka pemutar penuh / antrean tidak mengubahnya). Halaman lama dibekukan
 * (outlet terakhir) selama animasi keluar, jadi tidak ada kedipan atau lompatan konten.
 */
export default function PageTransition({ pathname, className, onSwap }: PageTransitionProps) {
  const outlet = useOutlet()
  const navType = useNavigationType()
  // `animate` baru true setelah pergantian halaman pertama: render pertama (setelah splash) tidak memakai animasi masuk.
  const [view, setView] = useState({ path: pathname, animate: false })
  const frozen = useRef(outlet)
  const dir = useRef<1 | -1>(1)
  const mounted = useRef(false)
  const shown = view.path
  const exiting = pathname !== shown

  if (exiting) dir.current = directionBetween(shown, pathname, navType === 'POP')
  else frozen.current = outlet

  // Animasi keluar selesai -> pasang halaman baru.
  useLayoutEffect(() => {
    if (!exiting) return
    const swap = () => setView({ path: pathname, animate: true })
    if (reducedMotion()) {
      swap()
      return
    }
    const timer = window.setTimeout(swap, EXIT_MS)
    return () => window.clearTimeout(timer)
  }, [exiting, pathname])

  // Halaman baru terpasang: scroll kembali ke atas sebelum digambar.
  useLayoutEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      return
    }
    onSwap()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown])

  const style = { '--page-dx': dir.current } as CSSProperties
  const phase = exiting ? 'page-exit' : view.animate ? 'page-enter' : ''
  return (
    <div key={shown} style={style} className={`${className} ${phase}`}>
      {exiting ? frozen.current : outlet}
    </div>
  )
}
