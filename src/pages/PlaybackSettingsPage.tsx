import { ArrowLeft, ClipboardCopy, PhoneCall, Trash2, Zap } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import SettingSwitch from '../components/ui/SettingSwitch'
import { getAutoResume, getDirectMode, setAutoResume, setDirectMode } from '../native/engineSettings'
import { isNativeApp } from '../native/platform'
import { clearPlaybackLog, getPlaybackLog } from '../utils/playbackLog'

/** Pengaturan mesin pemutar (APK). */
export default function PlaybackSettingsPage() {
  const [direct, setDirect] = useState(getDirectMode)
  const [autoResume, setAutoResumeState] = useState(getAutoResume)
  const [logNote, setLogNote] = useState('')
  const copyLog = async () => {
    const text = getPlaybackLog()
    if (!text) {
      setLogNote('Log masih kosong. Putar lagu dulu, ulangi masalahnya, lalu salin.')
      return
    }
    try {
      await navigator.clipboard.writeText(text)
      setLogNote(`Log disalin (${text.split('\n').length} baris). Tempel ke chat.`)
    } catch {
      setLogNote('Gagal menyalin otomatis ke papan klip.')
    }
  }
  if (!isNativeApp()) return <Navigate to="/" replace />
  return (
    <section aria-label="Pemutaran" className="px-4 pb-8 pt-2">
      <Link to="/settings" className="focus-ring -ml-1 mb-2 inline-flex items-center gap-1 rounded-md p-1 text-sm text-ink-muted">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Pengaturan
      </Link>
      <h1 className="mb-4 text-3xl font-extrabold text-ink">Pemutaran</h1>
      <SettingSwitch
        checked={autoResume}
        onChange={() => {
          setAutoResumeState(!autoResume)
          setAutoResume(!autoResume)
        }}
        icon={PhoneCall}
        label="Putar otomatis setelah gangguan"
        hint="Musik berhenti karena panggilan atau aplikasi lain? Lanjut sendiri begitu gangguannya selesai, berapa pun lamanya (maksimal 24 jam). Jeda dari tombol, notifikasi, atau headset dicabut tidak pernah diputar ulang."
      />
      <SettingSwitch
        checked={direct}
        onChange={() => {
          setDirect(!direct)
          setDirectMode(!direct)
        }}
        icon={Zap}
        label="Mode langsung (eksperimen)"
        hint="ExoPlayer mengambil audio langsung dari sumber, tanpa proxy lokal. Berlaku mulai lagu berikutnya. Matikan bila sering buffering atau macet setelah digeser."
      />
      <div className="mt-6 rounded-xl bg-card p-4">
        <p className="text-sm font-semibold text-ink">Log pemutaran</p>
        <p className="mt-1 text-xs text-ink-muted">
          Mencatat keputusan pemutar (lagu selesai, pindah, geser posisi, galat). Bila lagu berulang atau tidak lanjut: ulangi
          masalahnya, tekan Salin, lalu kirim.
        </p>
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={copyLog} className="btn-secondary h-11 flex-1 text-sm">
            <ClipboardCopy className="h-4 w-4" aria-hidden="true" />
            Salin log
          </button>
          <button
            type="button"
            onClick={() => {
              clearPlaybackLog()
              setLogNote('Log dihapus.')
            }}
            className="btn-secondary h-11 px-4 text-sm"
            aria-label="Hapus log pemutaran"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        {logNote && <p className="mt-2 text-xs text-ink-muted">{logNote}</p>}
      </div>
    </section>
  )
}
