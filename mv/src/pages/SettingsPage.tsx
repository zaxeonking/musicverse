import { ChevronRight, Download, HardDriveDownload, SlidersHorizontal } from 'lucide-react'
import { Link, Navigate } from 'react-router-dom'
import { isNativeApp } from '../native/platform'

interface Category {
  to: string
  label: string
  hint: string
  icon: typeof Download
}

/** Kategori pengaturan. Pengaturan baru cukup menambah satu entri di sini dan satu halaman + rute. */
const CATEGORIES: readonly Category[] = [
  { to: '/settings/downloads', label: 'Unduhan', hint: 'Syarat unduhan: Wi-Fi, saat dicas', icon: Download },
  { to: '/settings/equalizer', label: 'Equalizer', hint: '10-band dengan preset', icon: SlidersHorizontal },
  { to: '/settings/backup', label: 'Cadangan', hint: 'Simpan dan pulihkan Koleksi, playlist, riwayat', icon: HardDriveDownload },
]

/** Pusat pengaturan (APK): daftar kategori, tiap kategori punya halaman sendiri. */
export default function SettingsPage() {
  if (!isNativeApp()) return <Navigate to="/" replace />
  return (
    <section aria-label="Pengaturan" className="px-4 pb-8 pt-2">
      <h1 className="mb-4 text-3xl font-extrabold text-ink">Pengaturan</h1>
      <ul className="space-y-2">
        {CATEGORIES.map(({ to, label, hint, icon: Icon }) => (
          <li key={to}>
            <Link to={to} className="flex items-center gap-3 rounded-lg bg-card px-4 py-3 text-ink focus-ring">
              <Icon className="h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{label}</span>
                <span className="block text-xs text-ink-muted">{hint}</span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-ink-muted" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
