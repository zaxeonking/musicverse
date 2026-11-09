import { useEffect, useState } from 'react'

/**
 * Menahan elemen tetap terpasang selama animasi keluar. `mounted` = pasang di DOM; `open` = keadaan terbuka (kelas transisi).
 * Dua frame antara pasang dan buka supaya keadaan "tertutup" sempat tergambar, jadi transisi masuknya benar-benar berjalan.
 */
export function useMountTransition(show: boolean, exitMs = 280): { mounted: boolean; open: boolean } {
  const [mounted, setMounted] = useState(show)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (show) {
      setMounted(true)
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

  return { mounted, open }
}
