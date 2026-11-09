import { ChevronDown, Download } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { APK_RELEASE_URL, DISTRIBUTION_PAUSED } from '../config/apk'
import FeedbackSection from './FeedbackSection'
import MigrationNotice, { MigrationUpgrade } from './MigrationNotice'
import PhoneMock from './PhoneMock'

/** Fitur disusun menurut situasi pemakai, bukan daftar spesifikasi. Hanya fitur yang benar-benar ada di APK. */
const SCENARIOS: ReadonlyArray<{ title: string; text: string }> = [
  {
    title: 'Di jalan',
    text: 'Layar mati, HP di saku, app di belakang: musik tetap jalan. Jeda, lanjut, dan pindah lagu dari notifikasi. Tombol Back hanya meminimalkan app, lagunya tidak berhenti.',
  },
  {
    title: 'Tanpa sinyal',
    text: 'Simpan lagu sebelum berangkat, putar di terowongan atau pesawat. Unduhan bisa dibatasi hanya lewat Wi-Fi atau saat HP dicas, supaya kuota dan baterai aman.',
  },
  {
    title: 'Mulai dari tautan',
    text: 'Tempel tautan playlist atau lagu Spotify, atau cari lewat judul. MusicVerse menyusunnya jadi daftar putar dan mencarikan audionya. Playlist buatan sendiri juga bisa.',
  },
  {
    title: 'Enak didengar',
    text: 'Equalizer 10 band dengan preset, crossfade antarlagu, dan lirik yang berjalan mengikuti lagu bila tersedia.',
  },
  {
    title: 'Sebelum tidur',
    text: 'Atur sleep timer, dan musik berhenti sendiri tepat waktu.',
  },
  {
    title: 'Ganti HP, data ikut',
    text: 'Playlist dan riwayat disimpan di penyimpanan aplikasi, tidak hilang saat cache dibersihkan. Ekspor cadangan, lalu pulihkan di HP baru.',
  },
  {
    title: 'Selalu terbaru',
    text: 'Cek versi baru langsung dari dalam app. Pembaruan tampilan bisa masuk tanpa perlu mengunduh APK lagi.',
  },
]

const PLATFORMS: ReadonlyArray<{ name: string; status: 'Tersedia' | 'Dibangun ulang' | 'Menyusul'; note: string }> = [
  DISTRIBUTION_PAUSED
    ? { name: 'Android', status: 'Dibangun ulang', note: 'Sedang dibangun ulang sebagai aplikasi Android native. Unduhan baru dijeda sementara.' }
    : { name: 'Android', status: 'Tersedia', note: 'Pasang lewat berkas APK dari halaman rilis GitHub.' },
  { name: 'Windows', status: 'Menyusul', note: 'Belum ada tanggal rilis.' },
  { name: 'iOS', status: 'Menyusul', note: 'Belum ada tanggal rilis.' },
]

const STEPS: readonly string[] = [
  'Unduh berkas APK dari halaman rilis GitHub lewat tombol di atas.',
  'Buka berkasnya. Android akan meminta izin memasang dari sumber ini: izinkan, lalu ketuk Pasang.',
  'Buka MusicVerse, izinkan notifikasi, dan tempel tautan playlist pertamamu.',
]

const FAQ: ReadonlyArray<{ q: string; a: ReactNode }> = [
  ...(DISTRIBUTION_PAUSED
    ? [
        {
          q: 'Kenapa unduhan dijeda?',
          a: 'MusicVerse sedang dibangun ulang sebagai aplikasi Android native supaya lebih cepat, mulus, dan stabil. Ini perombakan besar, bukan pembaruan kecil, jadi unduhan baru dijeda selama pengembangan. MusicVerse tidak berhenti; kabar terbarunya akan muncul di halaman ini.',
        },
      ]
    : []),
  {
    q: 'Kenapa tidak ada versi web?',
    a: 'Memutar dan mengunduh lagu butuh akses yang tidak diberikan peramban, dan musik di latar belakang juga tidak bisa seandal di aplikasi. Karena itu MusicVerse hanya ada sebagai aplikasi.',
  },
  { q: 'Perlu daftar akun?', a: 'Tidak. Buka app, tempel tautan, putar.' },
  {
    q: 'Lagunya diambil dari mana?',
    a: (
      <>
        Judul, artis, dan sampul diambil dari tautan Spotify. Audionya dicari di YouTube Music dan YouTube. Hak cipta tetap milik pemiliknya; baca juga{' '}
        <Link to="/terms" className="text-site-green underline underline-offset-2">
          Ketentuan Layanan
        </Link>
        .
      </>
    ),
  },
  {
    q: 'Data apa yang disimpan?',
    a: (
      <>
        Playlist, riwayat, dan pengaturan tinggal di HP-mu, tidak dikirim ke server kami. Rinciannya ada di{' '}
        <Link to="/privacy" className="text-site-green underline underline-offset-2">
          Kebijakan Privasi
        </Link>
        .
      </>
    ),
  },
  {
    q: 'Aman dipasang?',
    a: 'APK hanya dibagikan lewat halaman rilis GitHub yang ditautkan di situs ini (saat ini unduhan baru dijeda). Android menampilkan peringatan untuk semua aplikasi yang dipasang dari luar toko aplikasi, dan itu normal. Jangan pasang berkas dari tempat lain.',
  },
  { q: 'Kapan Windows dan iOS?', a: 'Belum ada tanggal. Kabar terbarunya akan muncul di halaman ini.' },
]

const primaryBtn =
  'inline-flex h-12 items-center gap-2.5 rounded-full bg-site-ink px-6 font-display text-base font-semibold text-white hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-green focus-visible:ring-offset-2 focus-visible:ring-offset-site-fog'

export default function LandingPage() {
  return (
    <>
      {/* Hero */}
      <section aria-labelledby="judul" className="mx-auto grid w-full max-w-6xl items-center gap-14 px-5 pb-4 pt-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-8 lg:px-8 lg:pt-10">
        <div>
          <h1 id="judul" className="font-display text-[2.9rem] font-extrabold leading-[0.96] tracking-[-0.035em] sm:text-[4.25rem] lg:text-[5.25rem]">
            Tempel tautan playlist.
            <br />
            Putar.
            <br />
            Simpan buat offline.
          </h1>
          <p className="mt-6 max-w-[34rem] text-xl leading-[1.55] text-site-slate">
            MusicVerse adalah pemutar musik untuk Android. Tanpa akun, tanpa iklan, dan musiknya tetap jalan saat layar mati.
          </p>
          {DISTRIBUTION_PAUSED ? (
            <MigrationNotice />
          ) : (
            <>
              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
                <a href={APK_RELEASE_URL} target="_blank" rel="noopener noreferrer" className={primaryBtn}>
                  <Download className="h-5 w-5" aria-hidden="true" />
                  Unduh APK
                </a>
                <a href="#pasang" className="rounded-md py-2 font-display text-base font-semibold underline decoration-site-line decoration-2 underline-offset-[6px] hover:decoration-site-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-green">
                  Lihat cara pasang
                </a>
              </div>
              <p className="mt-4 text-sm text-site-slate">Gratis. Diunduh dari halaman rilis GitHub. Windows dan iOS menyusul.</p>
            </>
          )}
        </div>

        <div className="lg:pb-16 lg:pl-6">
          <PhoneMock />
        </div>
      </section>

      {/* Kabar upgrade lengkap (hanya selama unduhan dijeda) */}
      {DISTRIBUTION_PAUSED && <MigrationUpgrade />}

      {/* Fitur */}
      <section id="fitur" aria-labelledby="judul-fitur" className="mx-auto mt-20 grid w-full max-w-6xl gap-10 px-5 lg:mt-28 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16 lg:px-8">
        <div>
          <h2 id="judul-fitur" className="font-display text-3xl font-extrabold leading-[1.05] tracking-[-0.03em] sm:text-5xl lg:sticky lg:top-8">
            Dipakai buat apa saja?
          </h2>
        </div>
        <ul className="divide-y divide-site-line border-y border-site-line">
          {SCENARIOS.map((item) => (
            <li key={item.title} className="py-6 sm:grid sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-6">
              <h3 className="font-display text-xl font-bold leading-snug tracking-tight">{item.title}</h3>
              <p className="mt-1.5 max-w-[34rem] text-[1.0625rem] leading-[1.65] text-site-slate sm:mt-0.5">{item.text}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Platform */}
      <section id="platform" aria-labelledby="judul-platform" className="mt-24 bg-site-ink text-site-fog lg:mt-32">
        <div className="mx-auto w-full max-w-6xl px-5 py-16 lg:px-8 lg:py-24">
          <h2 id="judul-platform" className="max-w-xl font-display text-3xl font-extrabold leading-[1.05] tracking-[-0.03em] sm:text-5xl">
            Mulai dari Android.
          </h2>
          <ul className="mt-10 divide-y divide-white/15 border-y border-white/15">
            {PLATFORMS.map((platform) => {
              const ready = platform.status !== 'Menyusul'
              return (
                <li key={platform.name} className="flex flex-col gap-3 py-6 sm:flex-row sm:items-center sm:gap-8 sm:py-8">
                  <p className={`font-display text-4xl font-extrabold tracking-[-0.03em] sm:w-[16rem] sm:text-6xl ${ready ? '' : 'text-white/45'}`}>{platform.name}</p>
                  <p className="min-w-0 flex-1 text-[1.0625rem] leading-snug text-[#A9B7BC]">{platform.note}</p>
                  <p
                    className={`w-fit rounded-full px-3.5 py-1.5 font-display text-sm font-semibold ${
                      platform.status === 'Tersedia' ? 'bg-[#1DB954] text-black' : 'text-[#A9B7BC] ring-1 ring-inset ring-white/30'
                    }`}
                  >
                    {platform.status}
                  </p>
                </li>
              )
            })}
          </ul>
        </div>
      </section>

      {/* Cara pasang (disembunyikan selama unduhan dijeda; tidak ada tombol unduh yang bisa diikuti langkahnya) */}
      {!DISTRIBUTION_PAUSED && (
        <section id="pasang" aria-labelledby="judul-pasang" className="mx-auto mt-20 grid w-full max-w-6xl gap-10 px-5 lg:mt-28 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16 lg:px-8">
          <h2 id="judul-pasang" className="font-display text-3xl font-extrabold leading-[1.05] tracking-[-0.03em] sm:text-5xl">
            Cara pasang di Android
          </h2>
          <div>
            <ol className="space-y-6">
              {STEPS.map((step, index) => (
                <li key={step} className="flex gap-5">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-site-ink font-display text-base font-bold text-white" aria-hidden="true">
                    {index + 1}
                  </span>
                  <p className="max-w-[34rem] pt-1 text-[1.0625rem] leading-[1.6]">
                    <span className="sr-only">{`Langkah ${index + 1}: `}</span>
                    {step}
                  </p>
                </li>
              ))}
            </ol>
            <a href={APK_RELEASE_URL} target="_blank" rel="noopener noreferrer" className={`${primaryBtn} mt-9`}>
              <Download className="h-5 w-5" aria-hidden="true" />
              Unduh APK
            </a>
          </div>
        </section>
      )}

      {/* Tanya jawab */}
      <section id="tanya" aria-labelledby="judul-tanya" className="mx-auto mt-20 grid w-full max-w-6xl gap-10 px-5 lg:mt-28 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16 lg:px-8">
        <h2 id="judul-tanya" className="font-display text-3xl font-extrabold leading-[1.05] tracking-[-0.03em] sm:text-5xl">
          Pertanyaan yang sering muncul
        </h2>
        <div className="divide-y divide-site-line border-y border-site-line">
          {FAQ.map((item) => (
            <details key={item.q} className="group py-1">
              <summary className="flex min-h-[3.5rem] cursor-pointer list-none items-center justify-between gap-4 rounded-md py-3 font-display text-lg font-bold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-green [&::-webkit-details-marker]:hidden">
                {item.q}
                <ChevronDown className="h-5 w-5 shrink-0 text-site-slate transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
              </summary>
              <p className="max-w-[34rem] pb-4 text-[1.0625rem] leading-[1.65] text-site-slate">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Saran dan ulasan */}
      <FeedbackSection />
    </>
  )
}
