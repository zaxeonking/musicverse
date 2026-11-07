import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Akar semua menu bawah (sheet): dirender langsung di <body>, bukan di dalam wadah halaman atau pemutar, dengan lapisan
 * paling atas (z-90, di atas mini player, bottom nav, pemutar penuh, antrean, dan toast). Dengan begitu menu tidak pernah
 * tertutup, terpotong (overflow / transform wadah), atau tergeser keluar layar oleh elemen lain.
 */
export const OVERLAY_Z = 90

export default function OverlayPortal({ children }: { children: ReactNode }) {
  return createPortal(
    <div className="fixed inset-0 z-[90]" style={{ position: 'fixed', inset: 0, zIndex: OVERLAY_Z }}>
      {children}
    </div>,
    document.body,
  )
}
