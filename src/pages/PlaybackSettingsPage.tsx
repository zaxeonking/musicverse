import { ArrowLeft, PhoneCall, Zap } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import SettingSwitch from '../components/ui/SettingSwitch'
import { getAutoResume, getDirectMode, setAutoResume, setDirectMode } from '../native/engineSettings'
import { isNativeApp } from '../native/platform'

/** Pengaturan mesin pemutar (APK). */
export default function PlaybackSettingsPage() {
  const [direct, setDirect] = useState(getDirectMode)
  const [autoResume, setAutoResumeState] = useState(getAutoResume)
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
        hint="Putar kembali otomatis setelah gangguan selesai (maksimal 24 jam)."
      />
      <SettingSwitch
        checked={direct}
        onChange={() => {
          setDirect(!direct)
          setDirectMode(!direct)
        }}
        icon={Zap}
        label="Mode langsung (eksperimen)"
        hint="Berlaku mulai lagu berikutnya. Matikan jika sering buffering."
      />
    </section>
  )
}
