import { Download, X } from 'lucide-react'
import { useState } from 'react'
import { APK_ONLY_FEATURES, APK_RELEASE_URL } from '../../config/apk'
import { isNativeApp } from '../../native/platform'
import { readJson, writeJson } from '../../utils/safeStorage'

const KEY = 'musicverse:apk-promo:v1'
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000

function snoozed(): boolean {
  const out = readJson(KEY)
  const until = out.status === 'ok' && typeof out.value === 'object' && out.value !== null ? (out.value as { until?: unknown }).until : 0
  return typeof until === 'number' && until > Date.now()
}

/**
 * Banner di web (bukan di APK) yang mengajak pasang APK Android. Hanya tampil di perangkat Android,
 * dan hilang 7 hari setelah ditutup. Tombol unduh membuka halaman Releases terbaru di GitHub (bukan link langsung ke .apk).
 */
export default function ApkPromo() {
  const eligible = APK_RELEASE_URL !== '' && !isNativeApp() && /Android/i.test(navigator.userAgent)
  const [hidden, setHidden] = useState(() => !eligible || snoozed())
  const [open, setOpen] = useState(false)
  if (hidden) return null

  const close = () => {
    writeJson(KEY, { until: Date.now() + SNOOZE_MS })
    setHidden(true)
  }

  return (
    <div role="region" aria-label="Aplikasi Android MusicVerse" className="mx-3 mt-2 rounded-lg bg-card px-4 py-3 text-sm text-ink">
      <div className="flex items-center gap-3">
        <Download className="h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
        <p className="min-w-0 flex-1">
          <span className="block font-semibold">Pasang aplikasi Android</span>
          <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="text-xs text-ink-muted underline focus-ring">
            {open ? 'Sembunyikan fitur' : 'Lihat fitur yang tidak ada di web'}
          </button>
        </p>
        <a href={APK_RELEASE_URL} target="_blank" rel="noopener noreferrer" className="btn-primary h-9 px-4">
          Unduh
        </a>
        <button type="button" onClick={close} aria-label="Tutup" className="icon-btn -mr-2">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      {open && (
        <ul className="mt-3 list-disc space-y-1 pl-9 text-xs text-ink-muted">
          {APK_ONLY_FEATURES.map((feature) => (
            <li key={feature}>{feature}</li>
          ))}
          <li className="list-none pt-1 text-ink-faint">Android akan meminta izin “pasang dari sumber ini” saat pertama kali memasang.</li>
        </ul>
      )}
    </div>
  )
}
