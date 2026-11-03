import { RefreshCw, X } from 'lucide-react'
import { useAppUpdate } from '../../hooks/useAppUpdate'

/**
 * Banner pembaruan di dalam APK. Opsional: "Nanti" menutupnya sampai ada versi yang lebih baru.
 * Saat diunduh, progres juga tampil di notifikasi sistem; selesai -> installer terbuka otomatis.
 */
export default function UpdateBanner() {
  const update = useAppUpdate()
  if (!update) return null
  const { phase, release, progress } = update
  const percent = progress === null ? null : Math.round(progress * 100)
  const busy = phase === 'downloading'

  const message: Record<typeof phase, string> = {
    available: 'Ada pembaruan. Memperbarui bersifat opsional.',
    downloading: percent === null ? 'Mengunduh pembaruan…' : `Mengunduh pembaruan… ${percent}%`,
    ready: 'Unduhan selesai. Ketuk Pasang jika installer tidak terbuka sendiri.',
    failed: 'Unduhan gagal. Periksa koneksi, lalu coba lagi.',
    needPermission: 'Izinkan MusicVerse memasang aplikasi di pengaturan yang terbuka, lalu ketuk Pasang.',
  }

  return (
    <div role="region" aria-label="Pembaruan aplikasi" className="mx-3 mt-2 rounded-lg bg-card px-4 py-3 text-sm text-ink">
      <div className="flex items-center gap-3">
        <RefreshCw className={`h-5 w-5 shrink-0 text-accent ${busy ? 'animate-spin' : ''}`} aria-hidden="true" />
        <p className="min-w-0 flex-1">
          <span className="block font-semibold">Pembaruan tersedia: v{release.version}</span>
          <span className="block text-xs text-ink-muted" aria-live="polite">{message[phase]}</span>
        </p>
        {!busy && (
          <button
            type="button"
            onClick={phase === 'ready' || phase === 'needPermission' ? update.install : update.start}
            className="btn-primary h-9 px-4"
          >
            {phase === 'ready' || phase === 'needPermission' ? 'Pasang' : phase === 'failed' ? 'Coba lagi' : 'Perbarui'}
          </button>
        )}
        {!busy && (
          <button type="button" onClick={update.dismiss} aria-label="Nanti saja" className="icon-btn -mr-2">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
      {busy && (
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent ?? undefined}>
          <div
            className={`h-full rounded-full bg-accent ${percent === null ? 'w-1/3 animate-pulse' : 'transition-[width] duration-300'}`}
            style={percent === null ? undefined : { width: `${percent}%` }}
          />
        </div>
      )}
    </div>
  )
}
