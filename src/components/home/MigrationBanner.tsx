import { ChevronRight, Rocket } from 'lucide-react'
import { openMigrationNotice } from '../../utils/migrationNotice'

/**
 * Banner tetap di Beranda untuk pengumuman migrasi ke Android native. Tidak punya tombol tutup: tugasnya memastikan kartu
 * pengumuman selalu bisa dibuka lagi, walau lembar otomatisnya sudah pernah ditutup. Ketuk = buka kartu (utils/migrationNotice.ts).
 * Hanya hiasan statis (gradasi radial + garis kilap), tanpa animasi berulang, jadi tidak membebani pemutaran.
 */
export default function MigrationBanner() {
  return (
    <button
      type="button"
      onClick={openMigrationNotice}
      aria-haspopup="dialog"
      className="mv-in focus-ring tap-card relative flex w-full items-center gap-3.5 overflow-hidden rounded-3xl bg-raised p-3.5 pr-3 text-left ring-1 ring-veil/10"
    >
      <span aria-hidden="true" className="pointer-events-none absolute -right-12 -top-14 h-40 w-40 rounded-full mv-orb-accent" />
      <span aria-hidden="true" className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-accent/70 to-transparent" />
      <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-accent">
        <Rocket className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="relative min-w-0 flex-1">
        <span className="block text-[0.68rem] font-bold uppercase tracking-wider text-accent">Pengumuman</span>
        <span className="mt-0.5 block truncate font-display text-[0.98rem] font-bold leading-tight text-ink">Upgrade Besar MusicVerse 🚀</span>
        <span className="mt-0.5 line-clamp-1 text-xs text-ink-muted">Sedang dibangun ulang jadi aplikasi Android native.</span>
      </span>
      <ChevronRight className="relative h-5 w-5 shrink-0 text-ink-muted" aria-hidden="true" />
    </button>
  )
}
