import { ArrowLeft, PhoneCall, Radio, Volume2, Zap } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import LyricProviderSettings from '../components/settings/LyricProviderSettings'
import SettingSwitch from '../components/ui/SettingSwitch'
import { getAutoResume, getDirectMode, setAutoResume, setDirectMode } from '../native/engineSettings'
import { isNativeApp } from '../native/platform'
import { setRadioAuto, useRadioAuto } from '../services/radio'
import { setVolumeNorm, useVolumeNorm } from '../services/volumeNorm'

/** Pengaturan mesin pemutar (APK). */
export default function PlaybackSettingsPage() {
  const [direct, setDirect] = useState(getDirectMode)
  const [autoResume, setAutoResumeState] = useState(getAutoResume)
  const radioAuto = useRadioAuto()
  const volumeNorm = useVolumeNorm()
  if (!isNativeApp()) return <Navigate to="/" replace />
  return (
    <section aria-label="Pemutaran" className="px-4 pb-8 pt-2">
      <Link to="/settings" className="back-glass focus-ring mb-2 inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-ink">
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
        checked={volumeNorm}
        onChange={() => setVolumeNorm(!volumeNorm)}
        icon={Volume2}
        label="Normalisasi volume"
        hint="Meredam lagu yang lebih keras dari rata-rata supaya antar lagu terdengar rata. Lagu yang pelan tidak dinaikkan. Berlaku untuk lagu dari YouTube yang punya data kekerasan; unduhan dan lagu lokal tidak berubah."
      />
      <SettingSwitch
        checked={radioAuto}
        onChange={() => setRadioAuto(!radioAuto)}
        icon={Radio}
        label="Radio otomatis"
        hint="Menyala secara bawaan. Saat antrean hampir habis, lanjut memutar lagu rekomendasi yang cocok dengan lagu sebelumnya: genre yang sama dan tempo yang berdekatan (artis yang sama dan artis serupa dari Deezer; butuh internet, bila gagal memakai Riwayat). Antrean yang sudah ada tidak diubah."
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
      <LyricProviderSettings />
    </section>
  )
}
