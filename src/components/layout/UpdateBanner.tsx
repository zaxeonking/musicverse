import { ArrowDownToLine, CheckCircle2, RotateCw, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAppUpdate, type AppUpdateState } from '../../hooks/useAppUpdate'
import Presence from '../ui/Presence'

/**
 * Kartu pembaruan di dalam APK: melayang di bawah (di atas mini player / bilah navigasi), kaca + blur, naik dengan animasi.
 * Bercirikan "gelombang suara": saat ada versi baru batangnya menari, saat diunduh batang terisi aksen sesuai progres
 * (seperti waveform lagu yang sedang diputar), dan saat selesai semuanya menyala penuh. Catatan rilis baris pertama
 * ditampilkan sebagai "yang baru". Opsional: "X" menutupnya sampai ada versi yang lebih baru; selesai -> installer terbuka otomatis.
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

const BARS = 34
/** Tinggi batang (30..100%) dari dua gelombang sinus: bentuknya tetap, mirip waveform lagu. */
const BAR_HEIGHTS = Array.from({ length: BARS }, (_, i) => Math.round(30 + 70 * Math.abs(Math.sin(i * 0.52) * Math.cos(i * 0.21 + 0.6))))

/** Baris pertama catatan rilis (tanpa tanda markdown) sebagai ringkasan "yang baru"; null bila kosong. */
function whatsNew(notes: string): string | null {
  for (const raw of notes.split('\n')) {
    const line = raw
      .replace(/^[\s#>*\-+•]+/, '')
      .replace(/[*_`]/g, '')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .trim()
    if (line.length >= 4) return line
  }
  return null
}

/**
 * Gelombang batang. `fill` (0..1) = bagian yang menyala; null = semua menyala dan menari (menunggu / belum tahu ukuran).
 * Hanya berupa hiasan + indikator progres; angka persen tetap ada di teks.
 */
function Waveform({ fill, dancing, tone }: { fill: number | null; dancing: boolean; tone: 'accent' | 'danger' }) {
  return (
    <div aria-hidden="true" className="flex h-10 items-end gap-[3px]">
      {BAR_HEIGHTS.map((height, i) => {
        const lit = fill === null || (i + 0.5) / BARS <= fill
        const color = tone === 'danger' ? 'bg-danger' : 'bg-accent'
        return (
          <span
            key={i}
            style={{
              height: `${height}%`,
              animationDelay: `${(i % 9) * -130}ms`,
              animationDuration: `${900 + (i % 5) * 140}ms`,
              transformOrigin: 'bottom',
            }}
            className={`min-w-0 flex-1 rounded-full transition-[background-color,opacity] duration-300 ${
              lit ? `${color} opacity-100` : 'bg-veil/20 opacity-70'
            } ${dancing && lit ? 'animate-eq motion-reduce:animate-none' : ''}`}
          />
        )
      })}
    </div>
  )
}

function UpdateCard({ update }: { update: AppUpdateState }) {
  const { phase, release, progress } = update
  const percent = progress === null ? null : Math.round(progress * 100)
  const busy = phase === 'downloading'
  const install = phase === 'ready' || phase === 'needPermission'
  const failed = phase === 'failed'
  const news = whatsNew(release.notes)

  const message: Record<typeof phase, string> = {
    available: news ?? 'Pembaruan opsional. Ditutup pun, kami ingatkan lagi saat app dibuka.',
    downloading: percent === null ? 'Menyiapkan unduhan…' : 'Mengunduh pembaruan…',
    ready: 'Unduhan selesai. Ketuk Pasang jika installer tidak terbuka.',
    failed: 'Unduhan gagal. Periksa koneksi, lalu coba lagi.',
    needPermission: 'Izinkan memasang aplikasi di pengaturan, lalu ketuk Pasang.',
  }
  const eyebrow = busy ? 'Mengunduh' : install ? 'Siap dipasang' : failed ? 'Gagal' : 'Pembaruan baru'
  const fill = busy ? progress : install ? 1 : null

  return (
    <div role="region" aria-label="Pembaruan aplikasi" className="pointer-events-auto">
      <div className="relative w-full overflow-hidden rounded-3xl border border-veil/10 bg-card/80 text-sm text-ink shadow-2xl shadow-black/50 backdrop-blur-xl backdrop-saturate-150">
        {/* Cahaya aksen di pojok + garis kilap di tepi atas. */}
        <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-14 h-40 w-40 rounded-full bg-accent/30 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-accent/70 to-transparent" />

        <div className="relative space-y-3 p-4">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
                  failed ? 'bg-danger/15 text-danger' : 'bg-accent/15 text-accent'
                }`}
              >
                {install ? (
                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                ) : busy ? (
                  <RotateCw className="h-3 w-3 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                ) : (
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current motion-reduce:animate-none" aria-hidden="true" />
                )}
                {eyebrow}
              </span>
              <p className="mt-1.5 truncate font-display text-lg font-extrabold leading-tight tracking-tight">
                MusicVerse <span className="text-accent">{release.version}</span>
              </p>
            </div>
            {busy ? (
              <span className="font-display text-3xl font-extrabold tabular-nums leading-none text-accent" aria-hidden="true">
                {percent === null ? '…' : `${percent}%`}
              </span>
            ) : (
              <button type="button" onClick={update.dismiss} aria-label="Ingatkan lagi nanti" className="icon-btn -mr-1 -mt-1 h-9 w-9 shrink-0">
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>

          <div
            role="progressbar"
            aria-label="Progres unduhan"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={busy ? (percent ?? undefined) : install ? 100 : 0}
            aria-hidden={busy || install ? undefined : true}
          >
            <Waveform fill={fill} dancing={!install && !failed} tone={failed ? 'danger' : 'accent'} />
          </div>

          <div className="flex items-center gap-3">
            <p className="min-w-0 flex-1 truncate text-xs text-ink-muted" aria-live="polite">
              {message[phase]}
            </p>
            {!busy && (
              <button type="button" onClick={install ? update.install : update.start} className="btn-primary h-10 shrink-0 gap-1.5 px-5 text-sm">
                {install ? null : failed ? <RotateCw className="h-4 w-4" aria-hidden="true" /> : <ArrowDownToLine className="h-4 w-4" aria-hidden="true" />}
                {install ? 'Pasang' : failed ? 'Coba lagi' : 'Perbarui'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
