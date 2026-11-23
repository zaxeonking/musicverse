import { ArrowDown, Download, Gauge, Headphones, MemoryStick, PlayCircle, Rocket, Sparkles, type LucideIcon } from 'lucide-react'
import { APK_DOWNLOAD_URL, NATIVE_VERSION } from '../config/apk'
import EqBars from './EqBars'

const GREEN = '#1DB954'

/** Tujuan peningkatan dari membangun ulang MusicVerse sebagai aplikasi Android native. */
const GOALS: ReadonlyArray<{ icon: LucideIcon; title: string; text: string }> = [
  { icon: Gauge, title: 'Lebih responsif', text: 'Performa dan respons yang lebih baik di setiap ketukan.' },
  { icon: Sparkles, title: 'Lebih mulus', text: 'Animasi dan navigasi yang lebih halus.' },
  { icon: PlayCircle, title: 'Lebih stabil', text: 'Pemutaran musik yang lebih stabil.' },
  { icon: MemoryStick, title: 'Lebih hemat', text: 'Pemakaian memori dan sumber daya yang lebih efisien.' },
  { icon: Headphones, title: 'Lebih nyaman', text: 'Pengalaman mendengarkan yang lebih baik secara keseluruhan.' },
]

/** Lencana kecil di atas judul hero: versi + "100% Android native". */
export function NativeLaunchBadge() {
  return (
    <a
      href="#native"
      className="mb-6 inline-flex items-center gap-2 rounded-full bg-site-ink px-4 py-2 font-display text-sm font-bold text-white hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-green focus-visible:ring-offset-2 focus-visible:ring-offset-site-fog"
    >
      <EqBars color={GREEN} />
      {`Versi ${NATIVE_VERSION}: sekarang 100% Android native`}
      <ArrowDown className="h-4 w-4" aria-hidden="true" />
    </a>
  )
}

/** Bagian pengumuman lengkap (target `#native`): MusicVerse sudah dibangun ulang sebagai aplikasi Android native. */
export default function NativeAnnouncement() {
  return (
    <section id="native" aria-labelledby="judul-native" className="relative mt-20 scroll-mt-6 overflow-hidden bg-site-ink text-site-fog lg:mt-28">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-32 -top-40 h-[28rem] w-[28rem] rounded-full"
        style={{ background: 'radial-gradient(closest-side, rgba(29,185,84,0.22), transparent)' }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-48 -right-32 h-[30rem] w-[30rem] rounded-full"
        style={{ background: 'radial-gradient(closest-side, rgba(255,118,87,0.14), transparent)' }}
      />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-[#1DB954]/60 to-transparent" />

      <div className="relative mx-auto w-full max-w-6xl px-5 py-16 lg:px-8 lg:py-24">
        <p className="inline-flex items-center gap-2 rounded-full bg-[#1DB954]/15 px-3.5 py-1.5 font-display text-xs font-bold uppercase tracking-wider text-[#1DB954]">
          <Rocket className="h-3.5 w-3.5" aria-hidden="true" />
          {`Versi ${NATIVE_VERSION}`}
        </p>
        <h2 id="judul-native" className="mt-4 max-w-3xl font-display text-4xl font-extrabold leading-[1.02] tracking-[-0.035em] text-white sm:text-6xl">
          MusicVerse sekarang 100% Android native.
        </h2>
        <p className="mt-5 max-w-2xl text-lg leading-[1.6] text-[#C9D4D8]">
          Kami membangun ulang MusicVerse dari nol sebagai aplikasi Android yang sepenuhnya native. Ini perombakan besar, bukan pembaruan kecil, supaya pengalaman mendengarkanmu terasa jauh lebih baik.
        </p>

        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {GOALS.map(({ icon: Icon, title, text }) => (
            <li
              key={title}
              className="rounded-3xl bg-white/[0.06] p-6 ring-1 ring-inset ring-white/10 transition-[transform,background-color] duration-200 hover:-translate-y-0.5 hover:bg-white/[0.09] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#1DB954]/15 text-[#1DB954]">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 font-display text-xl font-bold tracking-tight text-white">{title}</h3>
              <p className="mt-1.5 text-base leading-[1.55] text-[#A9B7BC]">{text}</p>
            </li>
          ))}
          <li className="flex flex-col justify-center rounded-3xl bg-[#1DB954] p-6 text-black sm:col-span-2 lg:col-span-1">
            <p className="font-display text-xs font-bold uppercase tracking-wider text-black/70">Status</p>
            <p className="mt-1.5 font-display text-2xl font-extrabold leading-tight tracking-[-0.02em]">Tersedia sekarang.</p>
            <p className="mt-2 text-base leading-snug text-black/80">Versi terbaru langsung terunduh.</p>
            <a
              href={APK_DOWNLOAD_URL}
              download="musicverse.apk"
              className="mt-4 inline-flex h-11 w-fit items-center gap-2 rounded-full bg-black px-5 font-display text-[0.95rem] font-bold text-white hover:bg-site-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#1DB954]"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Unduh APK
            </a>
          </li>
        </ul>

        <div className="mt-12 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-stretch">
          <div className="rounded-3xl p-6 ring-1 ring-inset ring-white/15">
            <p className="font-display text-xs font-bold uppercase tracking-wider text-[#A9B7BC]">Sebelumnya</p>
            <p className="mt-2 font-display text-2xl font-extrabold tracking-[-0.02em] text-white">Aplikasi berbasis web</p>
            <p className="mt-1.5 text-base leading-snug text-[#A9B7BC]">React, TypeScript, dan Capacitor.</p>
          </div>
          <div aria-hidden="true" className="flex items-center justify-center text-[#1DB954]">
            <ArrowDown className="h-6 w-6 md:-rotate-90" />
          </div>
          <div className="rounded-3xl bg-[#1DB954]/12 p-6 ring-1 ring-inset ring-[#1DB954]/40">
            <p className="font-display text-xs font-bold uppercase tracking-wider text-[#1DB954]">Sekarang</p>
            <p className="mt-2 font-display text-2xl font-extrabold tracking-[-0.02em] text-white">100% Android native</p>
            <p className="mt-1.5 text-base leading-snug text-[#C9D4D8]">Kotlin dan Jetpack Compose.</p>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-white/15 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-display text-2xl font-extrabold leading-snug tracking-[-0.02em] text-white sm:text-3xl">Selamat datang di generasi berikutnya MusicVerse.</p>
          <EqBars color={GREEN} className="shrink-0 origin-right scale-150" />
        </div>
      </div>
    </section>
  )
}
