import { ChevronDown, Download, Ellipsis, Pause, SkipBack, SkipForward } from 'lucide-react'
import { useEffect, useState } from 'react'
import EqBars from './EqBars'

/** Lirik karangan sendiri, hanya untuk ilustrasi. */
const LYRICS = [
  'Lampu kota menyala satu-satu',
  'Kita jalan pelan di malam ini',
  'Tak ada yang menunggu di sana',
  'Hanya radio dan sisa hujan',
  'Biar jalan ini tak berujung',
]
const LINE_H = 30
const BASE_SECONDS = 84
const TOTAL_SECONDS = 221

function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

/**
 * Tampilan pemutar MusicVerse (ilustrasi statis, bukan layar tangkapan). Satu-satunya gerak di halaman:
 * lirik berpindah baris tiap beberapa detik. Tidak bergerak bila pengguna meminta gerakan dikurangi.
 */
export default function PhoneMock() {
  const [line, setLine] = useState(1)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined
    const timer = window.setInterval(() => setLine((current) => (current + 1) % LYRICS.length), 3200)
    return () => window.clearInterval(timer)
  }, [])

  const elapsed = BASE_SECONDS + line * 4
  const progress = (elapsed / TOTAL_SECONDS) * 100

  return (
    <div aria-hidden="true" className="relative mx-auto w-[17.75rem] select-none font-sans sm:w-[19rem]">
      <div className="rounded-[2.6rem] bg-[#2a2a2a] p-[7px] shadow-[0_30px_60px_-24px_rgba(0,0,0,0.7)] ring-1 ring-white/10">
        <div className="relative flex h-[36rem] flex-col overflow-hidden rounded-[2.1rem] bg-bg px-5 pb-6 pt-4 text-ink sm:h-[38rem]">
          <span className="absolute left-1/2 top-3 h-2 w-2 -translate-x-1/2 rounded-full bg-black ring-1 ring-white/10" />

          <div className="mt-5 flex items-center justify-between text-ink-muted">
            <ChevronDown className="h-6 w-6" />
            <span className="font-display text-xs font-semibold text-ink">Sedang diputar</span>
            <Ellipsis className="h-6 w-6" />
          </div>

          {/* Sampul: lingkaran bergaris seperti label piringan hitam. */}
          <div
            className="mx-auto mt-5 aspect-square w-[82%] shrink-0 rounded-lg"
            style={{
              backgroundColor: '#17494D',
              backgroundImage:
                'radial-gradient(circle at 50% 50%, #17494D 0 4%, #F0B84B 4% 31%, #D9552B 31% 33%, #17494D 33% 36%, #F0B84B 36% 37%, #17494D 37% 41%, #F0B84B 41% 42%, #17494D 42% 100%)',
            }}
          />

          <div className="mt-5 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-display text-xl font-extrabold tracking-tight">Lampu Kota</p>
              <p className="truncate text-sm text-ink-muted">Nara &amp; Teduh</p>
            </div>
            <span className="mt-1 inline-flex shrink-0 items-center gap-1 rounded-full bg-raised px-2.5 py-1 text-[11px] font-semibold text-accent">
              <Download className="h-3 w-3" />
              Offline
            </span>
          </div>

          {/* Lirik: jendela tiga baris, baris aktif putih. */}
          <div className="mt-4 shrink-0 overflow-hidden" style={{ height: LINE_H * 3 }}>
            <div className="transition-transform duration-500 ease-out" style={{ transform: `translateY(${-(line - 1) * LINE_H}px)` }}>
              {LYRICS.map((text, index) => (
                <p
                  key={text}
                  className={`truncate text-[15px] font-semibold leading-[30px] transition-colors duration-500 ${index === line ? 'text-ink' : 'text-ink-faint'}`}
                >
                  {text}
                </p>
              ))}
            </div>
          </div>

          <div className="mt-auto">
            <div className="h-1 w-full rounded-full bg-raised">
              <div className="h-full rounded-full bg-ink transition-[width] duration-500 ease-out" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-1.5 flex justify-between text-[11px] text-ink-muted">
              <span>{clock(elapsed)}</span>
              <span>{clock(TOTAL_SECONDS)}</span>
            </div>
            <div className="mt-3 flex items-center justify-between px-5">
              <SkipBack className="h-6 w-6 text-ink" fill="currentColor" />
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-ink text-black">
                <Pause className="h-6 w-6" fill="currentColor" />
              </span>
              <SkipForward className="h-6 w-6 text-ink" fill="currentColor" />
            </div>
          </div>
        </div>
      </div>

      {/* Notifikasi pemutar: menunjukkan musik tetap bisa dikendalikan dari luar app. */}
      <div className="absolute -bottom-16 -left-10 hidden w-[15.5rem] rounded-2xl bg-[#242424] p-3 text-ink shadow-[0_18px_40px_-16px_rgba(0,0,0,0.6)] ring-1 ring-white/10 lg:block">
        <div className="flex items-center gap-2 text-[10px] text-ink-muted">
          <EqBars className="!h-3" />
          <span>MusicVerse</span>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <div
            className="h-10 w-10 shrink-0 rounded-md"
            style={{
              backgroundColor: '#17494D',
              backgroundImage: 'radial-gradient(circle at 50% 50%, #17494D 0 4%, #F0B84B 4% 31%, #D9552B 31% 33%, #17494D 33% 100%)',
            }}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold">Lampu Kota</p>
            <p className="truncate text-[11px] text-ink-muted">Nara &amp; Teduh</p>
          </div>
          <div className="flex items-center gap-2.5 text-ink">
            <SkipBack className="h-4 w-4" fill="currentColor" />
            <Pause className="h-4 w-4" fill="currentColor" />
            <SkipForward className="h-4 w-4" fill="currentColor" />
          </div>
        </div>
      </div>
    </div>
  )
}
