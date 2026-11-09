import { Link } from 'react-router-dom'
import { HOME_MOODS, type HomeMood } from '../../config/moods'
import { SectionTitle } from './HomeCards'

/** Bentuk dekoratif per suasana: SVG ringan di pojok kotak (tanpa gambar dari jaringan). */
function Motif({ shape }: { shape: HomeMood['shape'] }) {
  switch (shape) {
    case 'rings':
      return (
        <g fill="none" stroke="#fff" strokeOpacity="0.3" strokeWidth="2">
          <circle cx="88" cy="22" r="14" />
          <circle cx="88" cy="22" r="30" />
          <circle cx="88" cy="22" r="46" />
        </g>
      )
    case 'bars':
      return (
        <g fill="#fff" fillOpacity="0.28">
          {[26, 44, 62, 40, 76, 52].map((h, i) => (
            <rect key={i} x={46 + i * 9} y={100 - h} width="5.5" height={h} rx="2.75" />
          ))}
        </g>
      )
    case 'sun':
      return (
        <g fill="#fff" fillOpacity="0.26">
          <circle cx="82" cy="72" r="28" />
          <circle cx="82" cy="72" r="42" fillOpacity="0.1" />
        </g>
      )
    case 'dots':
      return (
        <g fill="#fff" fillOpacity="0.3">
          {[0, 1, 2, 3].flatMap((r) => [0, 1, 2, 3].map((c) => <circle key={`${r}-${c}`} cx={50 + c * 15} cy={14 + r * 15} r={r === c ? 4.5 : 2.2} />))}
        </g>
      )
  }
}

const SPAN: Record<HomeMood['span'], string> = { 2: 'col-span-2', 3: 'col-span-3', 4: 'col-span-4', 6: 'col-span-6' }

/**
 * "Jelajah suasana": grid enam kolom dengan kotak selebar 4 / 2 / 2 / 2 / 2 dan satu kotak tinggi, jadi komposisinya tidak
 * seragam. Tiap suasana punya warna dan motif sendiri. Ketuk = buka daftar lagu suasana itu di tab Jelajah (jalur yang sama
 * dengan kotak suasana di sana, jadi pemuatannya tidak diulang di sini).
 */
export default function HomeMoods() {
  return (
    <section aria-label="Jelajah suasana">
      <SectionTitle title="Pilih suasanamu" subtitle="Dari tenang sampai patah hati" />
      <ul className="grid grid-cols-6 grid-rows-[repeat(3,5.25rem)] gap-2.5 sm:grid-rows-[repeat(3,6.5rem)]">
        {HOME_MOODS.map((mood, i) => (
          <li key={mood.id} className={`${SPAN[mood.span]} ${mood.tall ? 'row-span-2' : ''}`} style={{ ['--mv-delay' as string]: `${i * 60}ms` }}>
            <Link
              to={`/search?view=mood&id=${mood.id}`}
              aria-label={`Suasana ${mood.label}: ${mood.hint}`}
              className="mv-in tap-card focus-ring group relative block h-full w-full overflow-hidden rounded-[1.4rem_0.6rem_1.4rem_0.6rem] p-3.5 text-white"
              style={{ background: `linear-gradient(140deg, ${mood.from}, ${mood.to})` }}
            >
              <svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="xMaxYMax meet" className="mv-art pointer-events-none absolute bottom-0 right-0 h-full max-h-[8.5rem] w-auto opacity-90">
                <Motif shape={mood.shape} />
              </svg>
              <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
              <span className="relative block font-display text-[1.2rem] font-extrabold leading-none tracking-[-0.02em]">{mood.label}</span>
              <span className="relative mt-1.5 block max-w-[70%] text-xs leading-tight text-white/80">{mood.hint}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
