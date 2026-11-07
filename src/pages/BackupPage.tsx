import { ArrowLeft, Download, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { applyBackup, buildBackup, exportBackup, parseBackup, summarize, type BackupFile } from '../utils/backup'

/** Cadangan & pulihkan data (Koleksi, Playlist saya, riwayat, pengaturan). */
export default function BackupPage() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, setPending] = useState<BackupFile | null>(null)
  const [busy, setBusy] = useState(false)
  const current = summarize(buildBackup())

  async function onExport() {
    setBusy(true)
    const result = await exportBackup()
    setMessage(result.ok ? `Cadangan dibuat: ${result.where}` : result.message)
    setBusy(false)
  }

  async function onPick(file: File | undefined) {
    if (!file) return
    const parsed = parseBackup(await file.text())
    if (!parsed) {
      setPending(null)
      setMessage('Berkas ini bukan cadangan MusicVerse yang valid.')
      return
    }
    setMessage(null)
    setPending(parsed)
  }

  const sum = pending ? summarize(pending) : null

  return (
    <section aria-label="Cadangan dan pulihkan" className="px-4 pb-8 pt-2">
      <Link to="/settings" className="back-glass focus-ring mb-2 inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Pengaturan
      </Link>
      <h1 className="mb-4 text-3xl font-extrabold text-ink">Cadangan</h1>

      <div className="space-y-3 rounded-lg bg-card p-4 text-sm text-ink">
        <p className="text-ink-muted">
          Sekarang: {current.savedPlaylists} playlist tersimpan, {current.myPlaylists} playlist buatanmu, {current.plays} putaran di
          riwayat.
        </p>
        <button type="button" className="btn-primary w-full" disabled={busy} onClick={() => void onExport()}>
          <Download className="h-4 w-4" aria-hidden="true" />
          Buat cadangan
        </button>
        <button type="button" className="btn-secondary w-full" onClick={() => inputRef.current?.click()}>
          <Upload className="h-4 w-4" aria-hidden="true" />
          Pulihkan dari berkas
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            void onPick(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </div>

      {message && (
        <p role="status" className="mv-drop mt-3 rounded-lg bg-card px-4 py-3 text-sm text-ink">
          {message}
        </p>
      )}

      {pending && sum && (
        <div role="alertdialog" aria-label="Konfirmasi pulihkan" className="mv-drop mt-3 space-y-3 rounded-lg bg-card p-4 text-sm text-ink">
          <p className="font-semibold">Pulihkan cadangan ini?</p>
          <p className="text-ink-muted">
            {sum.savedPlaylists} playlist tersimpan, {sum.myPlaylists} playlist buatanmu, {sum.plays} putaran di riwayat
            {pending.exportedAt ? `, dibuat ${new Date(pending.exportedAt).toLocaleString('id-ID')}` : ''}. Data Koleksi,
            Playlist saya, riwayat, dan pengaturan saat ini akan <strong>diganti</strong>. File lagu unduhan tidak berubah.
          </p>
          <div className="flex gap-2">
            <button type="button" className="btn-danger flex-1" onClick={() => void applyBackup(pending)}>
              Ganti dan pulihkan
            </button>
            <button type="button" className="btn-secondary flex-1" onClick={() => setPending(null)}>
              Batal
            </button>
          </div>
        </div>
      )}

      <p className="mt-4 text-xs text-ink-muted">
        Data di APK juga otomatis disalin ke Android/data/&lt;nama paket&gt;/files/data. Cadangan berguna untuk pindah HP atau
        menyimpan salinan di tempat lain. Indeks unduhan tidak ikut karena dibaca ulang dari folder lagu.
      </p>
    </section>
  )
}
