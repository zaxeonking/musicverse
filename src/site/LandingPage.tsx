import { ChevronDown, ExternalLink, Pause, SkipBack, SkipForward, Wifi, BatteryCharging } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { DISTRIBUTION_PAUSED, NATIVE_VERSION, REPO_URL } from '../config/apk'
import FeedbackSection from './FeedbackSection'
import MigrationNotice, { MigrationUpgrade } from './MigrationNotice'
import NativeAnnouncement, { NativeLaunchBadge } from './NativeLaunch'
import PhoneMock from './PhoneMock'
import { DownloadButton, FOCUS, formatDate, formatSize, H2, Reveal, useLatestRelease, WRAP } from './ui'

const SCENARIOS: Readonly<Record<string, { title: string; text: string }>> = {
  jalan: {
    title: 'Di jalan',
    text: 'Layar mati, HP di saku, app di belakang: musik tetap jalan. Jeda, lanjut, dan pindah lagu dari notifikasi. Tombol Back hanya meminimalkan app, lagunya tidak berhenti.',
  },
  offline: {
    title: 'Tanpa sinyal',
    text: 'Simpan lagu sebelum berangkat, putar di terowongan atau pesawat. Unduhan bisa dibatasi hanya lewat Wi-Fi atau saat HP dicas, supaya kuota dan baterai aman.',
  },
  tautan: {
    title: 'Mulai dari tautan',
    text: 'Tempel tautan playlist atau lagu Spotify, atau cari lewat judul. MusicVerse menyusunnya jadi daftar putar dan mencarikan audionya. Playlist buatan sendiri juga bisa.',
  },
  suara: {
    title: 'Enak didengar',
    text: 'Equalizer 10 band dengan preset, crossfade antarlagu, dan lirik yang berjalan mengikuti lagu bila tersedia.',
  },
  tidur: { title: 'Sebelum tidur', text: 'Atur sleep timer, dan musik berhenti sendiri tepat waktu.' },
  pindah: {
    title: 'Ganti HP, data ikut',
    text: 'Playlist dan riwayat disimpan di penyimpanan aplikasi, tidak hilang saat cache dibersihkan. Ekspor cadangan, lalu pulihkan di HP baru.',
  },
  baru: {
    title: 'Selalu terbaru',
    text: 'Cek versi baru langsung dari dalam app. Pembaruannya bisa langsung diunduh dan dipasang dari sana.',
  },
}

const EQ_BANDS = [40, 55, 70, 60, 45, 52, 66, 78, 62, 48]

const PLATFORMS: ReadonlyArray<{ name: string; status: 'Tersedia' | 'Dibangun ulang' | 'Menyusul'; note: string }> = [
  DISTRIBUTION_PAUSED
    ? { name: 'Android', status: 'Dibangun ulang', note: 'Sedang dibangun ulang sebagai aplikasi Android native. Unduhan baru dijeda sementara.' }
    : { name: 'Android', status: 'Tersedia', note: `Versi ${NATIVE_VERSION}, aplikasi Android native. Unduh APK versi terbaru langsung dari situs ini.` },
  { name: 'Windows', status: 'Menyusul', note: 'Belum ada tanggal rilis.' },
  { name: 'iOS', status: 'Menyusul', note: 'Belum ada tanggal rilis.' },
]

const STEPS: readonly string[] = [
  'Ketuk tombol Unduh APK. Versi terbaru langsung terunduh, tanpa membuka halaman lain.',
  'Buka berkas yang terunduh (dari notifikasi unduhan atau folder Download). Android akan meminta izin memasang dari sumber ini: izinkan, lalu ketuk Pasang.',
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
    : [
        {
          q: `Apa yang baru di versi ${NATIVE_VERSION}?`,
          a: 'MusicVerse dibangun ulang dari nol sebagai aplikasi Android native (Kotlin dan Jetpack Compose) supaya lebih responsif, mulus, stabil, dan hemat. Ini perombakan besar, bukan pembaruan kecil.',
        },
        {
          q: 'Bagaimana memperbarui dari versi lama?',
          a: 'Unduh APK terbaru lalu pasang di atas aplikasi yang sudah ada. Untuk berjaga-jaga, ekspor cadangan playlist dari versi lama dulu sebelum memasang.',
        },
      ]),
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
    a: 'APK hanya dibagikan lewat situs ini, berkasnya diambil dari rilis resmi di GitHub. Android menampilkan peringatan untuk semua aplikasi yang dipasang dari luar toko aplikasi, dan itu normal. Jangan pasang berkas dari tempat lain.',
  },
  { q: 'Kapan Windows dan iOS?', a: 'Belum ada tanggal. Kabar terbarunya akan muncul di halaman ini.' },
]

const dot = { Tersedia: 'bg-site-green', 'Dibangun ulang': 'bg-coral', Menyusul: 'bg-site-slate/60' } as const

function Faq() {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <div className="divide-y divide-site-line border-y border-site-line">
      {FAQ.map((item, i) => {
        const isOpen = open === i
        return (
          <div key={item.q}>
            <h3>
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={`faq-${i}`}
                onClick={() => setOpen(isOpen ? null : i)}
                className={`flex min-h-[3.5rem] w-full items-center justify-between gap-4 rounded-md py-3 text-left font-display text-lg font-bold tracking-tight transition-colors hover:text-site-green ${FOCUS}`}
              >
                {item.q}
                <ChevronDown className={`h-5 w-5 shrink-0 text-site-slate transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
              </button>
            </h3>
            <div id={`faq-${i}`} role="region" className={`grid transition-[grid-template-rows] duration-300 ease-out ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
              <div className={`overflow-hidden transition-[visibility] duration-300 ${isOpen ? 'visible' : 'invisible'}`}>
                <p className="max-w-[36rem] pb-5 text-[1.0625rem] leading-[1.65] text-site-slate">{item.a}</p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

const Toggle = ({ icon, label }: { icon: ReactNode; label: string }) => (
  <div aria-hidden="true" className="flex items-center justify-between rounded-lg bg-site-raise px-4 py-3 text-sm font-semibold">
    <span className="flex items-center gap-2.5">
      {icon}
      {label}
    </span>
    <span className="flex h-5 w-9 items-center justify-end rounded-full bg-site-green px-0.5">
      <span className="h-4 w-4 rounded-full bg-black" />
    </span>
  </div>
)

export default function LandingPage() {
  const release = useLatestRelease(!DISTRIBUTION_PAUSED)
  const specs: ReadonlyArray<readonly [string, string]> = [
    ['Versi', NATIVE_VERSION],
    ...(release ? ([['Rilis terbaru', release.date ? `${release.tag}, ${formatDate(release.date)}` : release.tag]] as const) : []),
    ['Ukuran APK', release?.size ? formatSize(release.size) : 'Tertera di halaman rilis GitHub'],
    ['Kompatibilitas', 'Android, dipasang lewat berkas APK'],
    ['Biaya', 'Gratis, tanpa akun, tanpa iklan'],
  ]

  return (
    <>
      {/* Hero */}
      <section aria-labelledby="judul" className={`${WRAP} grid items-center gap-14 pb-6 pt-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-10 lg:pt-14`}>
        <div>
          {!DISTRIBUTION_PAUSED && <NativeLaunchBadge />}
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
                <DownloadButton />
                <a href="#unduh" className={`rounded-md py-2 font-display text-base font-semibold underline decoration-site-line decoration-2 underline-offset-[6px] transition-colors hover:decoration-site-green ${FOCUS}`}>
                  Lihat cara pasang
                </a>
              </div>
              <p className="mt-4 text-sm text-site-slate">Gratis. Versi terbaru langsung terunduh. Windows dan iOS menyusul.</p>
            </>
          )}
        </div>
        <div className="relative pb-6 lg:pb-20">
          <div aria-hidden="true" className="absolute inset-x-0 bottom-0 top-10 rounded-lg bg-site-paper lg:-right-6 lg:left-8" />
          <div className="relative">
            <PhoneMock />
          </div>
        </div>
      </section>

      {/* Informasi produk: hanya fakta yang ada di konfigurasi */}
      <section aria-label="Informasi produk" className={`${WRAP} mt-14 lg:mt-20`}>
        <dl className="grid grid-cols-2 border-y border-site-line lg:grid-cols-4 [&>div]:border-site-line [&>div]:py-5 [&>div:nth-child(odd)]:pr-4 lg:[&>div:not(:first-child)]:border-l lg:[&>div:not(:first-child)]:pl-6">
          <div>
            <dt className="text-sm text-site-slate">Versi aplikasi</dt>
            <dd className="mt-1 font-display text-2xl font-extrabold">{NATIVE_VERSION}</dd>
          </div>
          <div>
            <dt className="text-sm text-site-slate">Status</dt>
            <dd className="mt-1 flex items-center gap-2 font-display text-2xl font-extrabold">
              <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${DISTRIBUTION_PAUSED ? 'bg-coral' : 'bg-site-green'}`} />
              {DISTRIBUTION_PAUSED ? 'Dibangun ulang' : 'Tersedia'}
            </dd>
          </div>
          <div className="col-span-2 border-t lg:col-span-1 lg:border-t-0">
            <dt className="text-sm text-site-slate">Platform</dt>
            <dd className="mt-1 font-display text-2xl font-extrabold">Android</dd>
            <dd className="text-sm text-site-slate">Windows dan iOS menyusul</dd>
          </div>
          <div className="col-span-2 border-t lg:col-span-1 lg:border-t-0">
            <dt className="text-sm text-site-slate">Pengembangan</dt>
            <dd className="mt-1 font-display text-2xl font-extrabold">Aplikasi native</dd>
            <dd className="text-sm text-site-slate">Kotlin dan Jetpack Compose</dd>
          </div>
        </dl>
      </section>

      {DISTRIBUTION_PAUSED ? <MigrationUpgrade /> : <NativeAnnouncement />}

      {/* Fitur: komposisi berbeda per kebutuhan */}
      <section id="fitur" aria-labelledby="judul-fitur" className={`${WRAP} mt-24 scroll-mt-16 lg:mt-32`}>
        <Reveal>
          <h2 id="judul-fitur" className={`${H2} max-w-2xl`}>
            Dipakai buat apa saja?
          </h2>
        </Reveal>

        <div className="mt-10 grid gap-4 lg:grid-cols-12">
          <Reveal className="lg:col-span-7">
            <article className="flex h-full flex-col justify-between gap-8 rounded-lg bg-accent p-6 text-accent-on sm:p-8">
              <div>
                <h3 className="font-display text-3xl font-extrabold tracking-[-0.02em]">{SCENARIOS.jalan.title}</h3>
                <p className="mt-3 max-w-lg text-[1.0625rem] leading-[1.6]">{SCENARIOS.jalan.text}</p>
              </div>
              <div aria-hidden="true" className="flex w-fit items-center gap-5 rounded-full bg-black px-5 py-3 text-white">
                <SkipBack className="h-5 w-5" fill="currentColor" />
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-coral text-black">
                  <Pause className="h-5 w-5" fill="currentColor" />
                </span>
                <SkipForward className="h-5 w-5" fill="currentColor" />
              </div>
            </article>
          </Reveal>
          <Reveal className="lg:col-span-5" delay={80}>
            <article className="flex h-full flex-col gap-6 rounded-lg bg-site-paper p-6 sm:p-8">
              <div>
                <h3 className="font-display text-2xl font-extrabold tracking-[-0.02em]">{SCENARIOS.offline.title}</h3>
                <p className="mt-3 text-[1.0625rem] leading-[1.6] text-site-slate">{SCENARIOS.offline.text}</p>
              </div>
              <div className="mt-auto space-y-2">
                <Toggle icon={<Wifi className="h-4 w-4 text-site-green" />} label="Unduh hanya lewat Wi-Fi" />
                <Toggle icon={<BatteryCharging className="h-4 w-4 text-site-green" />} label="Unduh hanya saat dicas" />
              </div>
            </article>
          </Reveal>

          <Reveal className="lg:col-span-5">
            <article className="flex h-full flex-col gap-6 rounded-lg p-6 ring-1 ring-inset ring-site-line sm:p-8">
              <div>
                <h3 className="font-display text-2xl font-extrabold tracking-[-0.02em]">{SCENARIOS.tautan.title}</h3>
                <p className="mt-3 text-[1.0625rem] leading-[1.6] text-site-slate">{SCENARIOS.tautan.text}</p>
              </div>
              <p aria-hidden="true" className="mt-auto truncate rounded-full bg-site-paper px-4 py-3 text-sm text-site-slate">
                open.spotify.com/playlist/…
              </p>
            </article>
          </Reveal>
          <Reveal className="lg:col-span-7" delay={80}>
            <article className="flex h-full flex-col gap-6 rounded-lg bg-site-paper p-6 sm:p-8 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-sm">
                <h3 className="font-display text-2xl font-extrabold tracking-[-0.02em]">{SCENARIOS.suara.title}</h3>
                <p className="mt-3 text-[1.0625rem] leading-[1.6] text-site-slate">{SCENARIOS.suara.text}</p>
              </div>
              <div aria-hidden="true" className="flex h-28 shrink-0 items-end gap-1.5 rounded-lg bg-site-raise px-4 pb-3 pt-4 lg:w-60">
                {EQ_BANDS.map((h, i) => (
                  <span key={i} className="flex-1 rounded-full bg-site-green" style={{ height: `${h}%` }} />
                ))}
              </div>
            </article>
          </Reveal>
        </div>

        <Reveal>
          <ul className="mt-10 grid gap-x-10 gap-y-8 border-t border-site-line pt-8 md:grid-cols-3">
            {(['tidur', 'pindah', 'baru'] as const).map((key) => (
              <li key={key}>
                <h3 className="font-display text-xl font-bold tracking-tight">{SCENARIOS[key].title}</h3>
                <p className="mt-2 max-w-sm text-base leading-[1.6] text-site-slate">{SCENARIOS[key].text}</p>
              </li>
            ))}
          </ul>
        </Reveal>
      </section>

      {/* Pusat unduhan */}
      <section id="unduh" aria-labelledby="judul-unduh" className="mt-24 scroll-mt-16 border-y border-site-line bg-site-paper lg:mt-32">
        <div className={`${WRAP} grid gap-10 py-16 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-16 lg:py-24`}>
          <Reveal>
            <h2 id="judul-unduh" className={H2}>
              {DISTRIBUTION_PAUSED ? 'Unduhan sedang dijeda.' : 'Unduh MusicVerse untuk Android.'}
            </h2>
            <dl className="mt-8 divide-y divide-site-line border-y border-site-line">
              <div className="flex items-center justify-between gap-4 py-3.5">
                <dt className="text-site-slate">Status unduhan</dt>
                <dd className="flex items-center gap-2 font-display font-bold">
                  <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${DISTRIBUTION_PAUSED ? 'bg-coral' : 'bg-site-green'}`} />
                  {DISTRIBUTION_PAUSED ? 'Dijeda sementara' : 'Tersedia, unduh langsung'}
                </dd>
              </div>
              {specs.map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-4 py-3.5">
                  <dt className="text-site-slate">{k}</dt>
                  <dd className="text-right font-display font-bold">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
              {DISTRIBUTION_PAUSED ? (
                <a href="#upgrade" className={`inline-flex h-12 items-center rounded-full bg-accent px-6 font-display font-bold text-accent-on transition-transform active:scale-[0.97] ${FOCUS}`}>
                  Lihat kabar upgrade
                </a>
              ) : (
                <>
                  <DownloadButton />
                  <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-1.5 rounded-md py-2 font-display font-semibold underline decoration-site-line decoration-2 underline-offset-[6px] hover:decoration-site-green ${FOCUS}`}>
                    Semua rilis di GitHub
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  </a>
                </>
              )}
            </div>
          </Reveal>

          <Reveal delay={80}>
            {DISTRIBUTION_PAUSED ? (
              <p className="max-w-md text-lg leading-[1.6] text-site-slate">Aplikasi yang sudah terpasang tetap bisa dipakai. Petunjuk pemasangan akan muncul di sini saat unduhan dibuka lagi.</p>
            ) : (
              <>
                <h3 className="font-display text-2xl font-extrabold tracking-[-0.02em]">Cara pasang</h3>
                <ol className="mt-6 space-y-6">
                  {STEPS.map((step, index) => (
                    <li key={step} className="flex gap-4">
                      <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-site-raise font-display text-sm font-bold text-site-green">
                        {index + 1}
                      </span>
                      <p className="max-w-[32rem] pt-1 text-[1.0625rem] leading-[1.6]">
                        <span className="sr-only">{`Langkah ${index + 1}: `}</span>
                        {step}
                      </p>
                    </li>
                  ))}
                </ol>
              </>
            )}
          </Reveal>
        </div>
      </section>

      {/* Platform */}
      <section id="platform" aria-labelledby="judul-platform" className={`${WRAP} mt-24 scroll-mt-16 lg:mt-32`}>
        <Reveal>
          <h2 id="judul-platform" className={`${H2} max-w-xl`}>
            Mulai dari Android.
          </h2>
          <ul className="mt-10 divide-y divide-site-line border-y border-site-line">
            {PLATFORMS.map((platform) => {
              const ready = platform.status !== 'Menyusul'
              return (
                <li key={platform.name} className="flex flex-col gap-3 py-6 sm:flex-row sm:items-center sm:gap-8 sm:py-8">
                  <p className={`font-display text-4xl font-extrabold tracking-[-0.03em] sm:w-[16rem] sm:text-6xl ${ready ? '' : 'text-site-ink/40'}`}>{platform.name}</p>
                  <p className="min-w-0 flex-1 text-[1.0625rem] leading-snug text-site-slate">{platform.note}</p>
                  <p className="flex w-fit items-center gap-2 font-display text-sm font-semibold">
                    <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${dot[platform.status]}`} />
                    {platform.status}
                  </p>
                </li>
              )
            })}
          </ul>
        </Reveal>
      </section>

      {/* Tanya jawab */}
      <section id="tanya" aria-labelledby="judul-tanya" className={`${WRAP} mt-24 grid scroll-mt-16 gap-10 lg:mt-32 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16`}>
        <Reveal>
          <h2 id="judul-tanya" className={H2}>
            Pertanyaan yang sering muncul
          </h2>
        </Reveal>
        <Faq />
      </section>

      {/* Bantuan: saran dan ulasan */}
      <div className="scroll-mt-16">
        <FeedbackSection />
      </div>
    </>
  )
}
