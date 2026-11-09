import { Award, ChevronRight, CircleHelp, Download, FileText, HardDriveDownload, ListMusic, Palette, Play, RefreshCw, ShieldCheck, SlidersHorizontal } from 'lucide-react'
import { Link, Navigate } from 'react-router-dom'
import { isQuizPassed, startTour } from '../tour/tourStore'
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
  { to: '/settings/playback', label: 'Pemutaran', hint: 'Mode langsung (eksperimen)', icon: Play },
  { to: '/settings/playlist', label: 'Playlist', hint: 'Tambah otomatis, konfirmasi pindah lagu', icon: ListMusic },
  { to: '/settings/theme', label: 'Tema', hint: 'Warna aksen dan latar, tema siap pakai atau kustom, kurangi gerakan', icon: Palette },
  { to: '/settings/equalizer', label: 'Equalizer', hint: '10-band dengan preset', icon: SlidersHorizontal },
  { to: '/settings/backup', label: 'Cadangan', hint: 'Simpan dan pulihkan Koleksi, playlist, riwayat', icon: HardDriveDownload },
  { to: '/settings/update', label: 'Pembaruan', hint: 'Cek apakah ada versi aplikasi yang baru', icon: RefreshCw },
]

/** Dokumen hukum: tampil sebagai kelompok terpisah di bawah pengaturan. */
const LEGAL: readonly Category[] = [
  { to: '/settings/privacy', label: 'Kebijakan Privasi', hint: 'Data apa yang disimpan dan dikirim', icon: ShieldCheck },
  { to: '/settings/terms', label: 'Ketentuan Layanan', hint: 'Aturan pemakaian aplikasi', icon: FileText },
]

/** Pusat pengaturan (APK): daftar kategori, tiap kategori punya halaman sendiri. */
export default function SettingsPage() {
  if (!isNativeApp()) return <Navigate to="/" replace />
  return (
    <section aria-label="Pengaturan" className="px-4 pb-8 pt-2">
      <h1 className="mb-4 text-3xl font-extrabold text-ink">Pengaturan</h1>
      <div data-tour="settings-list">
        <CategoryList items={CATEGORIES} />
      </div>
      <button
        type="button"
        data-tour="tutorial-btn"
        onClick={startTour}
        className="mt-2 flex w-full items-center gap-3 rounded-lg bg-card px-4 py-3 text-left text-ink focus-ring"
      >
        <CircleHelp className="h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Tutorial</span>
          <span className="block text-xs text-ink-muted">Ulangi panduan penggunaan aplikasi</span>
          {isQuizPassed() && (
            <span className="mv-pop mt-1.5 inline-flex items-center gap-1 rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-semibold text-accent">
              <Award className="h-3.5 w-3.5" aria-hidden="true" />
              Lulus tutorial
            </span>
          )}
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-ink-muted" aria-hidden="true" />
      </button>
      <h2 className="mb-2 mt-8 text-sm font-semibold text-ink-muted">Tentang</h2>
      <CategoryList items={LEGAL} />
    </section>
  )
}

function CategoryList({ items }: { items: readonly Category[] }) {
  return (
    <ul className="mv-list space-y-2">
      {items.map(({ to, label, hint, icon: Icon }) => (
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
  )
}
