import { useEffect, useRef, useState, type ReactNode } from 'react'

interface PresenceProps {
  show: boolean
  children: ReactNode
  /**
   * `collapse`: tinggi tumbuh/menyusut mulus (banner di alur halaman; konten di bawahnya ikut turun/naik, bukan melompat).
   * `float`: hanya naik/turun + memudar (toast dan elemen melayang yang tidak memengaruhi tata letak).
   */
  mode?: 'collapse' | 'float'
  exitMs?: number
}

/**
 * Menahan anak tetap terpasang sebentar setelah `show` menjadi false supaya animasi keluarnya sempat diputar.
 * Selama keluar, isi terakhir dibekukan (tidak menerima ketukan) dan dilepas setelah `exitMs`.
 */
export default function Presence({ show, children, mode = 'collapse', exitMs = 320 }: PresenceProps) {
  const [mounted, setMounted] = useState(show)
  const [open, setOpen] = useState(false)
  const last = useRef<ReactNode>(children)
  if (show) last.current = children

  useEffect(() => {
    if (show) {
      setMounted(true)
      // Dua frame supaya keadaan "tertutup" sempat tergambar dulu; baru setelah itu transisi ke terbuka berjalan.
      let second = 0
      const first = requestAnimationFrame(() => {
        second = requestAnimationFrame(() => setOpen(true))
      })
      return () => {
        cancelAnimationFrame(first)
        cancelAnimationFrame(second)
      }
    }
    setOpen(false)
    const timer = window.setTimeout(() => setMounted(false), exitMs)
    return () => window.clearTimeout(timer)
  }, [show, exitMs])

  if (!show && !mounted) return null

  if (mode === 'float') {
    return (
      <div
        aria-hidden={show ? undefined : true}
        className={`transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.34,1.4,0.64,1)] motion-reduce:transition-none ${
          open ? 'translate-y-0 scale-100 opacity-100' : 'pointer-events-none translate-y-3 scale-95 opacity-0'
        }`}
      >
        {show ? children : last.current}
      </div>
    )
  }

  return (
    <div
      aria-hidden={show ? undefined : true}
      className={`grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
        open ? 'grid-rows-[1fr] opacity-100' : 'pointer-events-none grid-rows-[0fr] opacity-0'
      }`}
    >
      <div
        className={`min-h-0 overflow-hidden transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
          open ? 'translate-y-0' : '-translate-y-2'
        }`}
      >
        {show ? children : last.current}
      </div>
    </div>
  )
}
