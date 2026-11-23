import { ExternalLink, Mail, Star } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { REPO_URL } from '../config/apk'
import { CONTACT_EMAIL } from '../config/site'

type Kind = 'saran' | 'ulasan' | 'bug'

const KINDS: ReadonlyArray<{ id: Kind; label: string; label_gh: string }> = [
  { id: 'saran', label: 'Saran', label_gh: 'enhancement' },
  { id: 'ulasan', label: 'Ulasan', label_gh: 'review' },
  { id: 'bug', label: 'Laporan bug', label_gh: 'bug' },
]

const MAX_MESSAGE = 1000
const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-green focus-visible:ring-offset-2 focus-visible:ring-offset-site-fog'

/** Susun judul dan isi pesan dari isian formulir. Dipakai untuk email maupun GitHub Issue. */
function compose(kind: Kind, rating: number, message: string, name: string, device: string) {
  const label = KINDS.find((k) => k.id === kind)?.label ?? 'Masukan'
  const summary = message.trim().replace(/\s+/g, ' ').slice(0, 60)
  const title = `[${label}] ${summary}${message.trim().length > 60 ? '…' : ''}`
  const lines = [message.trim()]
  const meta: string[] = []
  if (kind === 'ulasan' && rating > 0) meta.push(`Nilai: ${rating}/5`)
  if (device.trim()) meta.push(`Versi/perangkat: ${device.trim()}`)
  if (name.trim()) meta.push(`Dari: ${name.trim()}`)
  if (meta.length) lines.push('', '---', ...meta)
  return { title, body: lines.join('\n') }
}

/**
 * Formulir saran dan ulasan. MusicVerse tidak punya server sendiri, jadi pesan tidak disimpan di sini:
 * tombol kirim membuka email (jika VITE_CONTACT_EMAIL diisi) atau GitHub Issue yang sudah terisi.
 * Pengguna masih bisa mengubah dan harus menekan kirim sendiri di tujuan itu.
 */
export default function FeedbackSection() {
  const [kind, setKind] = useState<Kind>('saran')
  const [rating, setRating] = useState(0)
  const [message, setMessage] = useState('')
  const [name, setName] = useState('')
  const [device, setDevice] = useState('')
  const [error, setError] = useState('')
  const [opened, setOpened] = useState(false)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (message.trim().length < 5) {
      setError('Tulis pesanmu dulu, minimal beberapa kata.')
      return
    }
    if (kind === 'ulasan' && rating === 0) {
      setError('Pilih nilai bintang untuk ulasan.')
      return
    }
    setError('')
    const { title, body } = compose(kind, rating, message, name, device)
    const url = CONTACT_EMAIL
      ? `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`MusicVerse ${title}`)}&body=${encodeURIComponent(body)}`
      : `${REPO_URL}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}&labels=${encodeURIComponent(KINDS.find((k) => k.id === kind)?.label_gh ?? '')}`
    if (CONTACT_EMAIL) window.location.href = url
    else window.open(url, '_blank', 'noopener,noreferrer')
    setOpened(true)
  }

  const field = 'mt-1 w-full rounded-lg border border-site-line bg-site-fog px-3 py-2.5 text-base text-site-ink placeholder:text-site-slate/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-green'

  return (
    <section id="masukan" aria-labelledby="judul-masukan" className="mx-auto mt-24 grid w-full max-w-6xl scroll-mt-16 gap-10 px-5 lg:mt-32 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16 lg:px-8">
      <div>
        <h2 id="judul-masukan" className="font-display text-3xl font-extrabold leading-[1.05] tracking-[-0.03em] sm:text-5xl">
          Saran dan ulasan
        </h2>
        <p className="mt-4 max-w-[28rem] text-[1.0625rem] leading-[1.65] text-site-slate">
          Ada fitur yang kamu mau, atau sesuatu yang belum pas? Tulis di sini. Pesanmu dikirim lewat {CONTACT_EMAIL ? 'email' : 'GitHub Issues'}, jadi kamu bisa
          memeriksanya dulu sebelum menekan kirim.
        </p>
        {!CONTACT_EMAIL && (
          <a
            href={`${REPO_URL}/issues`}
            target="_blank"
            rel="noopener noreferrer"
            className={`mt-4 inline-flex items-center gap-1.5 rounded-md py-1 font-display text-base font-semibold underline decoration-site-line decoration-2 underline-offset-[6px] hover:decoration-site-ink ${focusRing}`}
          >
            Lihat masukan dari pengguna lain
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </a>
        )}
      </div>

      <form onSubmit={submit} noValidate className="space-y-5 rounded-lg bg-site-paper p-5 sm:p-6">
        <fieldset>
          <legend className="font-display text-sm font-bold">Jenis</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                aria-pressed={kind === k.id}
                onClick={() => setKind(k.id)}
                className={`h-10 rounded-full px-4 font-display text-sm font-semibold transition-colors ${focusRing} ${
                  kind === k.id ? 'bg-accent text-accent-on' : 'bg-site-raise text-site-slate hover:text-site-ink'
                }`}
              >
                {k.label}
              </button>
            ))}
          </div>
        </fieldset>

        {kind === 'ulasan' && (
          <fieldset>
            <legend className="font-display text-sm font-bold">Nilai</legend>
            <div className="mt-2 flex gap-1" role="radiogroup" aria-label="Nilai bintang">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={rating === n}
                  aria-label={`${n} dari 5 bintang`}
                  onClick={() => setRating(n)}
                  className={`flex h-11 w-11 items-center justify-center rounded-full ${focusRing}`}
                >
                  <Star className={`h-7 w-7 ${n <= rating ? 'fill-site-green text-site-green' : 'text-site-slate'}`} aria-hidden="true" />
                </button>
              ))}
            </div>
          </fieldset>
        )}

        <div>
          <label htmlFor="fb-pesan" className="font-display text-sm font-bold">
            Pesan
          </label>
          <textarea
            id="fb-pesan"
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE))}
            rows={5}
            placeholder={kind === 'bug' ? 'Apa yang terjadi, dan langkah untuk mengulanginya?' : kind === 'ulasan' ? 'Apa yang kamu suka atau kurang dari MusicVerse?' : 'Fitur atau perbaikan apa yang kamu inginkan?'}
            aria-describedby="fb-hitung"
            className={`${field} resize-y`}
          />
          <p id="fb-hitung" className="mt-1 text-right text-xs text-site-slate">
            {message.length}/{MAX_MESSAGE}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="fb-nama" className="font-display text-sm font-bold">
              Nama <span className="font-normal text-site-slate">(opsional)</span>
            </label>
            <input id="fb-nama" value={name} onChange={(e) => setName(e.target.value.slice(0, 60))} autoComplete="nickname" className={field} />
          </div>
          <div>
            <label htmlFor="fb-perangkat" className="font-display text-sm font-bold">
              Versi / perangkat <span className="font-normal text-site-slate">(opsional)</span>
            </label>
            <input id="fb-perangkat" value={device} onChange={(e) => setDevice(e.target.value.slice(0, 80))} placeholder="mis. 0.5.15, Android 14" className={field} />
          </div>
        </div>

        {error && (
          <p role="alert" className="text-sm font-semibold text-danger">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-4">
          <button
            type="submit"
            className={`inline-flex h-12 items-center gap-2 rounded-full bg-accent px-6 font-display text-base font-bold text-accent-on transition-[transform,background-color] hover:bg-accent-soft active:scale-[0.97] ${focusRing}`}
          >
            {CONTACT_EMAIL ? <Mail className="h-5 w-5" aria-hidden="true" /> : <ExternalLink className="h-5 w-5" aria-hidden="true" />}
            {CONTACT_EMAIL ? 'Buka email' : 'Lanjut ke GitHub'}
          </button>
          {opened && (
            <p role="status" className="max-w-[22rem] text-sm text-site-slate">
              {CONTACT_EMAIL
                ? 'Aplikasi emailmu terbuka dengan pesan yang sudah terisi. Tekan kirim di sana.'
                : 'Halaman GitHub terbuka dengan pesan yang sudah terisi. Tekan "Submit new issue" di sana (perlu akun GitHub; isinya tampil publik).'}
            </p>
          )}
        </div>
      </form>
    </section>
  )
}
