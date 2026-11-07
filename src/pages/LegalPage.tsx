import { ArrowLeft } from 'lucide-react'
import { Link, Navigate } from 'react-router-dom'
import { isNativeApp } from '../native/platform'
import LegalDocument from '../legal/LegalDocument'
import { LEGAL_DOCS } from '../legal/content'

/** Pengaturan > Kebijakan Privasi / Ketentuan Layanan (APK). Isinya sama dengan halaman di situs web. */
export default function LegalPage({ kind }: { kind: keyof typeof LEGAL_DOCS }) {
  if (!isNativeApp()) return <Navigate to="/" replace />
  return (
    <section aria-label={LEGAL_DOCS[kind].title} className="px-4 pb-8 pt-2">
      <Link to="/settings" className="back-glass focus-ring mb-4 inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Pengaturan
      </Link>
      <LegalDocument doc={LEGAL_DOCS[kind]} />
    </section>
  )
}
