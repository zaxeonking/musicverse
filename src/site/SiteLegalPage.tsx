import { useEffect } from 'react'
import LegalDocument from '../legal/LegalDocument'
import { LEGAL_DOCS } from '../legal/content'

/** /privacy dan /terms di situs web. Isi sama dengan Pengaturan > Kebijakan Privasi / Ketentuan Layanan di APK. */
export default function SiteLegalPage({ kind }: { kind: keyof typeof LEGAL_DOCS }) {
  const doc = LEGAL_DOCS[kind]
  useEffect(() => {
    const previous = document.title
    document.title = `${doc.title} | MusicVerse`
    return () => {
      document.title = previous
    }
  }, [doc.title])

  return (
    <div className="mx-auto w-full max-w-2xl px-5 pb-8 pt-6 lg:pt-12">
      <LegalDocument doc={doc} tone="site" />
    </div>
  )
}
