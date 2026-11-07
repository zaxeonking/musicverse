import { ArrowDownToLine, CheckCircle2, RefreshCw, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAppUpdate, type AppUpdateState } from '../../hooks/useAppUpdate'
import Presence from '../ui/Presence'

/**
 * Kartu pembaruan di dalam APK: melayang di bawah (di atas mini player / bilah navigasi), kaca gelap + blur, naik dengan animasi.
 * Opsional: "X" menutupnya sampai ada versi yang lebih baru. Saat diunduh, progres tampil di kartu dan di notifikasi sistem;
 * selesai -> installer terbuka otomatis.
 */
export default function UpdateBanner() {
  const update = useAppUpdate()
  const bottom = useFloatBottom(update !== null)
  // Penampung `fixed` ada DI LUAR Presence: Presence memakai transform, dan transform pada leluhur membuat `fixed` tidak lagi mengacu ke layar.
  return (
    <div
      style={{ bottom }}
      className="pointer-events-none fixed inset-x-0 z-40 flex justify-center px-3 transition-[bottom] duration-300 ease-out motion-reduce:transition-none"
    >
      <div className="w-full max-w-md">
        <Presence show={update !== null} mode="float">
          {update && <UpdateCard update={update} />}
        </Presence>
      </div>
    </div>
  )
}

/** Jarak kartu dari dasar layar: tepat di atas mini player bila ada, atau di atas bilah navigasi bila tidak. Diperbarui saat tata letak berubah. */
function useFloatBottom(active: boolean): string {
  const [bottom, setBottom] = useState('calc(var(--dock-offset, 0px) + 1rem)')
  useEffect(() => {
    if (!active) return
    const measure = () => {
      const dock = document.querySelector<HTMLElement>('[data-mini-dock]')
      const rect = dock?.getBoundingClientRect()
      if (rect && rect.height > 0 && rect.top < window.innerHeight) {
        setBottom(`${Math.max(0, Math.round(window.innerHeight - rect.top)) + 8}px`)
      } else {
        setBottom('calc(var(--dock-offset, 0px) + 1rem)')
      }
    }
    measure()
    const timer = window.setInterval(measure, 350)
    window.addEventListener('resize', measure)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('resize', measure)
    }
  }, [active])
  return bottom
}

function UpdateCard({ update }: { update: AppUpdateState }) {
  const { phase, release, progress } = update
  const percent = progress === null ? null : Math.round(progress * 100)
  const busy = phase === 'downloading'
  const install = phase === 'ready' || phase === 'needPermission'

  const message: Record<typeof phase, string> = {
    available: 'Opsional. Ditutup pun, kami ingatkan lagi saat app dibuka.',
    downloading: percent === null ? 'Mengunduh…' : `Mengunduh… ${percent}%`,
    ready: 'Unduhan selesai. Ketuk Pasang jika installer tidak terbuka.',
    failed: 'Unduhan gagal. Periksa koneksi, lalu coba lagi.',
    needPermission: 'Izinkan memasang aplikasi di pengaturan, lalu ketuk Pasang.',
  }
  const Icon = busy ? RefreshCw : install ? CheckCircle2 : ArrowDownToLine

  return (
    <div role="region" aria-label="Pembaruan aplikasi" className="pointer-events-auto">
      <div className="relative w-full overflow-hidden rounded-2xl border border-veil/10 bg-card/85 text-sm text-ink shadow-2xl shadow-black/60 backdrop-blur-xl backdrop-saturate-150">
        <div aria-hidden="true" className="pointer-events-none absolute -left-10 -top-10 h-28 w-28 rounded-full bg-accent/25 blur-2xl" />
        <div className="relative flex items-center gap-3 px-3 py-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/20 text-accent ring-1 ring-accent/30">
            <Icon className={`h-5 w-5 ${busy ? 'animate-spin motion-reduce:animate-none' : ''}`} aria-hidden="true" />
          </span>
          <p className="min-w-0 flex-1">
            <span className="block truncate font-semibold">Versi {release.version} tersedia</span>
            <span className="block truncate text-xs text-ink-muted" aria-live="polite">{message[phase]}</span>
          </p>
          {!busy && (
            <button
              type="button"
              onClick={install ? update.install : update.start}
              className="btn-primary h-9 px-4 text-sm"
            >
              {install ? 'Pasang' : phase === 'failed' ? 'Coba lagi' : 'Perbarui'}
            </button>
          )}
          {!busy && (
            <button type="button" onClick={update.dismiss} aria-label="Ingatkan lagi nanti" className="icon-btn -mr-1 h-9 w-9">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
        {busy && (
          <div className="relative h-1 bg-veil/10" role="progressbar" aria-label="Progres unduhan" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent ?? undefined}>
            <div
              className={`h-full rounded-full bg-accent ${percent === null ? 'w-1/3 animate-pulse' : 'transition-[width] duration-300'}`}
              style={percent === null ? undefined : { width: `${percent}%` }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
