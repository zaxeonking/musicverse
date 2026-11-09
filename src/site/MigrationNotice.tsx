import { Rocket } from 'lucide-react'

/** Poin peningkatan yang dikerjakan. Hanya hal yang memang menjadi tujuan migrasi ke Android native. */
const GOALS: readonly string[] = [
  'Performa dan respons yang lebih baik.',
  'Animasi dan navigasi yang lebih mulus.',
  'Pemutaran musik yang lebih stabil.',
  'Pemakaian memori dan sumber daya yang lebih hemat.',
  'Pengalaman mendengarkan yang lebih nyaman.',
]

/**
 * Pengumuman resmi di situs selama unduhan dijeda (lihat DISTRIBUTION_PAUSED di config/apk.ts). Menggantikan tombol
 * "Unduh APK". Memakai warna dan huruf situs yang sudah ada; tanpa gambar dan tanpa animasi.
 */
export default function MigrationNotice() {
  return (
    <aside
      id="upgrade"
      aria-labelledby="judul-upgrade"
      className="relative mt-8 max-w-[34rem] scroll-mt-6 overflow-hidden rounded-3xl bg-site-ink p-6 text-site-fog sm:p-7"
    >
      {/* Cahaya hijau halus di pojok: gradasi radial, bukan blur. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full"
        style={{ background: 'radial-gradient(closest-side, rgba(29,185,84,0.30), transparent)' }}
      />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[#1DB954]/70 to-transparent" />

      <div className="relative">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-[#1DB954]/15 px-3 py-1 font-display text-xs font-bold uppercase tracking-wider text-[#1DB954]">
          <Rocket className="h-3.5 w-3.5" aria-hidden="true" />
          Pengumuman
        </p>
        <h2 id="judul-upgrade" className="mt-3 font-display text-2xl font-extrabold leading-tight tracking-[-0.02em] text-white sm:text-[1.75rem]">
          MusicVerse akan naik level!
        </h2>
        <p className="mt-3 text-base leading-[1.6] text-[#C9D4D8]">
          Kami membangun ulang MusicVerse dari nol sebagai aplikasi Android yang sepenuhnya native. Fokus peningkatannya:
        </p>
        <ul className="mt-3 space-y-1.5 text-base leading-snug text-[#C9D4D8]">
          {GOALS.map((goal) => (
            <li key={goal} className="flex gap-2.5">
              <span aria-hidden="true" className="mt-[0.55rem] h-1.5 w-1.5 shrink-0 rounded-full bg-[#1DB954]" />
              {goal}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-base leading-[1.6] text-[#C9D4D8]">Unduhan baru dijeda sementara selama pengembangan berlangsung.</p>
        <p className="mt-4 font-display text-lg font-bold leading-snug text-white">MusicVerse tidak berhenti. Kami sedang membangun sesuatu yang lebih baik.</p>
        <p className="mt-1 text-base text-[#A9B7BC]">Nantikan generasi berikutnya dari MusicVerse.</p>
      </div>
    </aside>
  )
}
