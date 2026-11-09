import { ArrowDown, Gauge, Headphones, MemoryStick, PlayCircle, Rocket, Sparkles, type LucideIcon } from 'lucide-react'
import EqBars from './EqBars'

/** Poin peningkatan yang dikerjakan. Hanya hal yang memang menjadi tujuan migrasi ke Android native. */
const GOALS: ReadonlyArray<{ icon: LucideIcon; title: string; text: string }> = [
  { icon: Gauge, title: 'Lebih responsif', text: 'Performa dan respons yang lebih baik di setiap ketukan.' },
  { icon: Sparkles, title: 'Lebih mulus', text: 'Animasi dan navigasi yang lebih halus.' },
  { icon: PlayCircle, title: 'Lebih stabil', text: 'Pemutaran musik yang lebih stabil.' },
  { icon: MemoryStick, title: 'Lebih hemat', text: 'Pemakaian memori dan sumber daya yang lebih efisien.' },
  { icon: Headphones, title: 'Lebih nyaman', text: 'Pengalaman mendengarkan yang lebih baik secara keseluruhan.' },
]

const GREEN = '#1DB954'

/**
 * Kartu ringkas di hero selama unduhan dijeda (lihat DISTRIBUTION_PAUSED di config/apk.ts). Menggantikan tombol "Unduh APK"
 * dan mengantar ke bagian lengkap `#upgrade` (MigrationUpgrade). Memakai warna dan huruf situs; satu-satunya gerak adalah
 * batang EQ kecil (statis bila pengguna meminta gerakan dikurangi).
 */
export default function MigrationNotice() {
  return (
    <aside aria-labelledby="judul-upgrade-ringkas" className="relative mt-8 max-w-[34rem] overflow-hidden rounded-3xl bg-site-ink p-6 text-site-fog shadow-[0_24px_48px_-24px_rgba(17,24,27,0.55)] sm:p-7">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full"
        style={{ background: 'radial-gradient(closest-side, rgba(29,185,84,0.30), transparent)' }}
      />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[#1DB954]/70 to-transparent" />
      <div className="relative">
        <p className="inline-flex items-center gap-2 rounded-full bg-[#1DB954]/15 px-3 py-1 font-display text-xs font-bold uppercase tracking-wider text-[#1DB954]">
          <EqBars color={GREEN} />
          Sedang dibangun ulang
        </p>
        <h2 id="judul-upgrade-ringkas" className="mt-3 font-display text-2xl font-extrabold leading-tight tracking-[-0.02em] text-white sm:text-[1.75rem]">
          MusicVerse akan naik level!
        </h2>
        <p className="mt-3 text-base leading-[1.6] text-[#C9D4D8]">
          Kami membangun ulang MusicVerse dari nol sebagai aplikasi Android yang sepenuhnya native. Unduhan baru dijeda sementara selama pengembangan berlangsung.
        </p>
        <a
          href="#upgrade"
          className="mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-[#1DB954] px-5 font-display text-[0.95rem] font-bold text-black hover:bg-[#3BD16F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-site-ink"
        >
          Lihat kabar upgrade
          <ArrowDown className="h-4 w-4" aria-hidden="true" />
        </a>
        <p className="mt-4 font-display text-base font-bold leading-snug text-white">MusicVerse tidak berhenti. Kami sedang membangun sesuatu yang lebih baik.</p>
      </div>
    </aside>
  )
}

/**
 * Bagian lengkap kabar upgrade (target tautan `#upgrade` dan tombol "Kabar upgrade" di header): lima tujuan peningkatan,
 * ringkasan "dari web ke native", dan penutup. Latar gelap penuh supaya jadi sorotan di antara bagian terang. Tanpa gambar
 * dan tanpa animasi; kartu hanya mengangkat sedikit saat disorot pointer.
 */
export function MigrationUpgrade() {
  return (
    <section id="upgrade" aria-labelledby="judul-upgrade" className="relative mt-20 scroll-mt-6 overflow-hidden bg-site-ink text-site-fog lg:mt-28">
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
          Pengumuman
        </p>
        <h2 id="judul-upgrade" className="mt-4 max-w-3xl font-display text-4xl font-extrabold leading-[1.02] tracking-[-0.035em] text-white sm:text-6xl">
          MusicVerse sedang naik level.
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
            <p className="mt-1.5 font-display text-2xl font-extrabold leading-tight tracking-[-0.02em]">Unduhan baru dijeda sementara.</p>
            <p className="mt-2 text-base leading-snug text-black/80">Selama pengembangan berlangsung. Aplikasi yang sudah terpasang tetap bisa dipakai.</p>
          </li>
        </ul>

        <div className="mt-12 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-stretch">
          <div className="rounded-3xl p-6 ring-1 ring-inset ring-white/15">
            <p className="font-display text-xs font-bold uppercase tracking-wider text-[#A9B7BC]">Sekarang</p>
            <p className="mt-2 font-display text-2xl font-extrabold tracking-[-0.02em] text-white">Aplikasi berbasis web</p>
            <p className="mt-1.5 text-base leading-snug text-[#A9B7BC]">React, TypeScript, dan Capacitor.</p>
          </div>
          <div aria-hidden="true" className="flex items-center justify-center text-[#1DB954]">
            <ArrowDown className="h-6 w-6 md:-rotate-90" />
          </div>
          <div className="rounded-3xl bg-[#1DB954]/12 p-6 ring-1 ring-inset ring-[#1DB954]/40">
            <p className="font-display text-xs font-bold uppercase tracking-wider text-[#1DB954]">Berikutnya</p>
            <p className="mt-2 font-display text-2xl font-extrabold tracking-[-0.02em] text-white">100% Android native</p>
            <p className="mt-1.5 text-base leading-snug text-[#C9D4D8]">Kotlin, Jetpack Compose, dan Material 3.</p>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-white/15 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-display text-2xl font-extrabold leading-snug tracking-[-0.02em] text-white sm:text-3xl">MusicVerse tidak berhenti. Kami sedang membangun sesuatu yang lebih baik.</p>
            <p className="mt-2 text-lg text-[#A9B7BC]">Nantikan generasi berikutnya dari MusicVerse.</p>
          </div>
          <EqBars color={GREEN} className="shrink-0 origin-right scale-150" />
        </div>
      </div>
    </section>
  )
}
