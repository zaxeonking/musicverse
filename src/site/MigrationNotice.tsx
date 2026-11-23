import { ArrowDown, Rocket } from 'lucide-react'
import EqBars from './EqBars'
import { GoalsList } from './NativeLaunch'
import { FOCUS, H2, Reveal, WRAP } from './ui'

/**
 * Kartu ringkas di hero selama unduhan dijeda (lihat DISTRIBUTION_PAUSED di config/apk.ts). Menggantikan tombol "Unduh APK"
 * dan mengantar ke bagian lengkap `#upgrade` (MigrationUpgrade).
 */
export default function MigrationNotice() {
  return (
    <aside aria-labelledby="judul-upgrade-ringkas" className="mt-8 max-w-[34rem] rounded-lg border-l-4 border-coral bg-site-paper p-5 sm:p-6">
      <p className="flex items-center gap-2.5 font-display text-sm font-bold text-coral">
        <EqBars color="#FF7657" className="!h-4" />
        Sedang dibangun ulang
      </p>
      <h2 id="judul-upgrade-ringkas" className="mt-2 font-display text-2xl font-extrabold leading-tight tracking-[-0.02em]">
        MusicVerse akan naik level!
      </h2>
      <p className="mt-2 text-base leading-[1.6] text-site-slate">
        Kami membangun ulang MusicVerse dari nol sebagai aplikasi Android yang sepenuhnya native. Unduhan baru dijeda sementara selama pengembangan berlangsung.
      </p>
      <a
        href="#upgrade"
        className={`mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-accent px-5 font-display text-[0.95rem] font-bold text-accent-on transition-[transform,background-color] hover:bg-accent-soft active:scale-[0.97] ${FOCUS}`}
      >
        Lihat kabar upgrade
        <ArrowDown className="h-4 w-4" aria-hidden="true" />
      </a>
    </aside>
  )
}

/** Bagian lengkap kabar upgrade (target `#upgrade` dan tombol "Kabar upgrade" di header). Tanpa tombol atau tautan unduh. */
export function MigrationUpgrade() {
  return (
    <section id="upgrade" aria-labelledby="judul-upgrade" className="mt-20 scroll-mt-16 bg-site-paper lg:mt-28">
      <div className={`${WRAP} grid gap-10 py-16 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16 lg:py-24`}>
        <Reveal>
          <p className="flex items-center gap-2 font-display text-base font-bold text-coral">
            <Rocket className="h-4 w-4" aria-hidden="true" />
            Pengumuman
          </p>
          <h2 id="judul-upgrade" className={`${H2} mt-3`}>
            MusicVerse sedang naik level.
          </h2>
          <p className="mt-5 max-w-md text-lg leading-[1.6] text-site-slate">
            Kami membangun ulang MusicVerse dari nol sebagai aplikasi Android yang sepenuhnya native. Ini perombakan besar, bukan pembaruan kecil, supaya pengalaman mendengarkanmu terasa jauh lebih baik.
          </p>
          <div className="mt-8 rounded-lg bg-accent p-5 text-accent-on">
            <p className="font-display text-xl font-extrabold leading-tight">Unduhan baru dijeda sementara.</p>
            <p className="mt-1 text-base leading-snug opacity-80">Selama pengembangan berlangsung. Aplikasi yang sudah terpasang tetap bisa dipakai.</p>
          </div>
        </Reveal>
        <Reveal delay={80}>
          <GoalsList from="Sekarang" fromNote="Aplikasi berbasis web" fromTech="React, TypeScript, dan Capacitor." to="Berikutnya" toNote="100% Android native" toTech="Kotlin, Jetpack Compose, dan Material 3." />
          <p className="mt-8 font-display text-xl font-bold leading-snug">MusicVerse tidak berhenti. Kami sedang membangun sesuatu yang lebih baik.</p>
          <p className="mt-1 text-site-slate">Nantikan generasi berikutnya dari MusicVerse.</p>
        </Reveal>
      </div>
    </section>
  )
}
