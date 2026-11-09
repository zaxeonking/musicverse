import { Rocket } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useOverlayHistory } from '../../hooks/useOverlayHistory'
import { dismissMigrationNotice, isMigrationNoticeDismissed } from '../../utils/migrationNotice'
import { isTourDone, useTourState, whatsNewReady } from '../../tour/tourStore'
import OverlayPortal from '../ui/OverlayPortal'

/** Splash selesai ±3,4 dtk setelah dibuka (lihat main.tsx); pengumuman muncul sesudahnya, bukan di balik splash. */
const SHOW_AFTER_MS = 3900

/**
 * Pengumuman satu kali: MusicVerse sedang dibangun ulang sebagai aplikasi Android native. Lembar bawah memakai
 * OverlayPortal (animasi masuk/keluar, seret untuk tutup, tombol Back) dan kartu bertema yang sama dengan UpdateBanner.
 * Tidak memengaruhi pemutaran, unduhan, atau pustaka: musik tetap berjalan di belakang, dan ditutup lewat "Mengerti",
 * ketuk latar, geser turun, Back, atau Esc. Sekali ditutup tidak tampil lagi (utils/migrationNotice.ts).
 * Menunggu tutorial / "Yang baru" selesai dulu supaya tidak bertumpuk.
 */
export default function MigrationNotice() {
  const { active } = useTourState()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (open || active || isMigrationNoticeDismissed()) return
    // Tutorial utama belum selesai, atau "Yang baru" akan segera tampil di Beranda: tunggu sampai selesai.
    if (!isTourDone() || (pathname === '/' && whatsNewReady())) return
    const timer = window.setTimeout(() => setOpen(true), Math.max(600, SHOW_AFTER_MS - performance.now()))
    return () => window.clearTimeout(timer)
  }, [open, active, pathname])

  const close = useCallback(() => {
    dismissMigrationNotice()
    setOpen(false)
  }, [])

  return open ? <NoticeSheet onClose={close} /> : null
}

function NoticeSheet({ onClose }: { onClose: () => void }) {
  const sheetRef = useRef<HTMLDivElement>(null)
  useOverlayHistory(true, onClose)

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    sheetRef.current?.querySelector<HTMLElement>('button')?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      previous?.focus?.()
    }
  }, [onClose])

  return (
    <OverlayPortal>
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 animate-fade-in bg-black/60" />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mv-migration-title"
        aria-describedby="mv-migration-body"
        className="absolute inset-x-0 bottom-0 mx-auto max-h-[92dvh] w-full max-w-md animate-sheet-up overflow-y-auto overscroll-contain rounded-t-3xl border-t border-veil/10 bg-card pb-[max(1rem,var(--sab))] text-ink shadow-2xl shadow-black/60 lg:bottom-6 lg:rounded-3xl lg:border"
      >
        {/* Cahaya aksen di pojok + garis kilap di tepi atas (sama dengan UpdateBanner). */}
        <div aria-hidden="true" className="pointer-events-none absolute -right-14 -top-16 h-44 w-44 rounded-full mv-orb-accent" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-accent/70 to-transparent" />

        <div className="relative px-5 pb-1 pt-6">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-accent">
            <Rocket className="h-3 w-3" aria-hidden="true" />
            Pengumuman
          </span>
          <h2 id="mv-migration-title" className="mt-3 font-display text-2xl font-extrabold leading-tight tracking-tight">
            Upgrade Besar MusicVerse 🚀
          </h2>
          <div id="mv-migration-body" className="mt-3 space-y-3 text-sm leading-relaxed text-ink-muted">
            <p>MusicVerse sedang dibangun ulang sepenuhnya menjadi aplikasi Android native.</p>
            <p>Kami mengerjakan performa yang lebih baik, animasi yang lebih mulus, pemutaran yang lebih stabil, dan pengalaman mendengarkan yang lebih nyaman.</p>
            <p>Generasi berikutnya dari MusicVerse sedang dalam pengembangan.</p>
            <p className="font-semibold text-ink">Terima kasih atas kesabaran dan dukungan kamu!</p>
          </div>
          <p className="mt-3 text-xs text-ink-muted/80">Aplikasi yang sekarang tetap bisa dipakai seperti biasa.</p>
          <button type="button" onClick={onClose} className="btn-primary mt-5 h-12 w-full text-base">
            Mengerti
          </button>
        </div>
      </div>
    </OverlayPortal>
  )
}
