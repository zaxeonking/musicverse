import { REPO_URL } from '../config/apk'
import { CONTACT_EMAIL } from '../config/site'
import type { LegalDoc } from './content'

const TONES = {
  /** Di dalam APK (tema gelap aplikasi). */
  app: {
    root: 'text-ink',
    muted: 'text-ink-muted',
    body: 'text-ink/85',
    link: 'text-accent',
    marker: 'marker:text-accent',
    box: 'bg-card',
    heading: 'font-display',
  },
  /** Di situs web (tema terang, huruf bacaan serif). */
  site: {
    root: 'font-reading text-site-ink',
    muted: 'text-site-slate',
    body: 'text-site-ink/90',
    link: 'text-site-green',
    marker: 'marker:text-site-green',
    box: 'bg-site-paper ring-1 ring-site-line',
    heading: 'font-display',
  },
} as const

/** Isi dokumen hukum. Dipakai halaman web (/privacy, /terms) dan halaman Pengaturan di APK, jadi tidak membawa kerangka halaman sendiri. */
export default function LegalDocument({ doc, tone = 'app' }: { doc: LegalDoc; tone?: keyof typeof TONES }) {
  const t = TONES[tone]
  const base = tone === 'site' ? 'text-[1.0625rem] leading-[1.7]' : 'text-[15px] leading-relaxed'
  return (
    <article className={`${t.root} ${base}`}>
      <h1 className={`${t.heading} text-3xl font-extrabold tracking-tight sm:text-4xl`}>{doc.title}</h1>
      <p className={`mt-2 text-sm ${t.muted}`}>Terakhir diperbarui {doc.updated}</p>
      <p className={`mt-6 ${t.body}`}>{doc.intro}</p>

      {doc.sections.map((section) => (
        <section key={section.id} aria-labelledby={`${doc.slug}-${section.id}`} className="mt-10">
          <h2 id={`${doc.slug}-${section.id}`} className={`${t.heading} text-xl font-bold tracking-tight`}>
            {section.title}
          </h2>
          <div className={`mt-2 space-y-3 ${t.body}`}>
            {section.body.map((block, index) =>
              typeof block === 'string' ? (
                <p key={index}>{block}</p>
              ) : (
                <ul key={index} className={`list-disc space-y-2 pl-5 ${t.marker}`}>
                  {block.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ),
            )}
          </div>
        </section>
      ))}

      <section aria-labelledby={`${doc.slug}-kontak`} className={`mt-10 rounded-lg px-5 py-4 ${t.box}`}>
        <h2 id={`${doc.slug}-kontak`} className={`${t.heading} text-xl font-bold tracking-tight`}>
          Kontak
        </h2>
        <p className={`mt-1 ${t.body}`}>
          {CONTACT_EMAIL ? (
            <>
              Email:{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className={`${t.link} underline underline-offset-2 focus-ring`}>
                {CONTACT_EMAIL}
              </a>
            </>
          ) : (
            <>
              Tulis lewat halaman{' '}
              <a href={`${REPO_URL}/issues`} target="_blank" rel="noopener noreferrer" className={`${t.link} underline underline-offset-2 focus-ring`}>
                Issues di GitHub
              </a>
              .
            </>
          )}
        </p>
      </section>
    </article>
  )
}
