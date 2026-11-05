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
    </section>
  )
}
