import { ArrowDown, ArrowRight, Gauge, Headphones, MemoryStick, PlayCircle, Sparkles, type LucideIcon } from 'lucide-react'
import { NATIVE_VERSION } from '../config/apk'
import EqBars from './EqBars'
import { DownloadButton, FOCUS, H2, Reveal, WRAP } from './ui'

/** Tujuan peningkatan dari membangun ulang MusicVerse sebagai aplikasi Android native. */
export const GOALS: ReadonlyArray<{ icon: LucideIcon; title: string; text: string }> = [
  { icon: Gauge, title: 'Lebih responsif', text: 'Performa dan respons yang lebih baik di setiap ketukan.' },
  { icon: Sparkles, title: 'Lebih mulus', text: 'Animasi dan navigasi yang lebih halus.' },
  { icon: PlayCircle, title: 'Lebih stabil', text: 'Pemutaran musik yang lebih stabil.' },
  { icon: MemoryStick, title: 'Lebih hemat', text: 'Pemakaian memori dan sumber daya yang lebih efisien.' },
  { icon: Headphones, title: 'Lebih nyaman', text: 'Pengalaman mendengarkan yang lebih baik secara keseluruhan.' },
]

/** Daftar tujuan + garis "sebelumnya → sekarang", dipakai pengumuman native dan pengumuman jeda. */
export function GoalsList({ from, fromNote, fromTech, to, toNote, toTech }: { from: string; fromNote: string; fromTech: string; to: string; toNote: string; toTech: string }) {
  return (
    <div>
      <ul className="divide-y divide-site-line border-y border-site-line">
        {GOALS.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex items-start gap-4 py-4">
            <Icon className="mt-1 h-5 w-5 shrink-0 text-site-green" aria-hidden="true" />
            <div>
              <h3 className="font-display text-lg font-bold tracking-tight">{title}</h3>
              <p className="text-[0.95rem] leading-snug text-site-slate">{text}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-6 grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
        <div className="rounded-lg bg-site-raise p-4">
          <p className="text-sm text-site-slate">{from}</p>
          <p className="font-display text-lg font-bold">{fromNote}</p>
          <p className="text-sm text-site-slate">{fromTech}</p>
        </div>
        <ArrowRight className="mx-auto hidden h-5 w-5 text-site-green sm:block" aria-hidden="true" />
        <ArrowDown className="mx-auto h-5 w-5 text-site-green sm:hidden" aria-hidden="true" />
        <div className="rounded-lg bg-site-green/10 p-4 ring-1 ring-inset ring-site-green/40">
          <p className="text-sm text-site-green">{to}</p>
          <p className="font-display text-lg font-bold">{toNote}</p>
          <p className="text-sm text-site-slate">{toTech}</p>
        </div>
      </div>
    </div>
  )
}

/** Lencana kecil di atas judul hero: versi + "100% Android native". */
export function NativeLaunchBadge() {
  return (
    <a href="#native" className={`mb-6 inline-flex items-center gap-2.5 rounded-full bg-site-raise py-2 pl-4 pr-3 font-display text-sm font-semibold transition-colors hover:bg-[#2a2a2a] ${FOCUS}`}>
      <EqBars color="#1DB954" className="!h-4" />
      {`Versi ${NATIVE_VERSION}: sekarang 100% Android native`}
      <ArrowDown className="h-4 w-4 text-site-slate" aria-hidden="true" />
    </a>
  )
}

/** Bagian pengumuman (target `#native`): MusicVerse sudah dibangun ulang sebagai aplikasi Android native. */
export default function NativeAnnouncement() {
  return (
    <section id="native" aria-labelledby="judul-native" className="mt-20 scroll-mt-16 bg-site-paper lg:mt-28">
      <div className={`${WRAP} grid gap-10 py-16 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16 lg:py-24`}>
        <Reveal>
          <p className="font-display text-base font-bold text-site-green">{`Versi ${NATIVE_VERSION}`}</p>
          <h2 id="judul-native" className={`${H2} mt-3`}>
            MusicVerse sekarang 100% Android native.
          </h2>
          <p className="mt-5 max-w-md text-lg leading-[1.6] text-site-slate">
            Kami membangun ulang MusicVerse dari nol sebagai aplikasi Android yang sepenuhnya native. Ini perombakan besar, bukan pembaruan kecil, supaya pengalaman mendengarkanmu terasa jauh lebih baik.
          </p>
          <DownloadButton className="mt-8" />
        </Reveal>
        <Reveal delay={80}>
          <GoalsList from="Sebelumnya" fromNote="Aplikasi berbasis web" fromTech="React, TypeScript, dan Capacitor." to="Sekarang" toNote="100% Android native" toTech="Kotlin dan Jetpack Compose." />
        </Reveal>
      </div>
    </section>
  )
}
