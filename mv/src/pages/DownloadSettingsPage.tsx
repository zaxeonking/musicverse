import { ArrowLeft, Battery, BatteryCharging, Wifi, WifiOff } from 'lucide-react'
import { Link, Navigate } from 'react-router-dom'
import SettingSwitch from '../components/ui/SettingSwitch'
import { setChargingOnlyEnabled, setWifiOnlyEnabled } from '../native/downloads'
import { useOffline } from '../native/offline'
import { isNativeApp } from '../native/platform'

/** Pengaturan unduhan (APK): syarat kapan antrean boleh berjalan. */
export default function DownloadSettingsPage() {
  const { wifiOnly, chargingOnly } = useOffline()
  if (!isNativeApp()) return <Navigate to="/" replace />
  return (
    <section aria-label="Pengaturan unduhan" className="px-4 pb-8 pt-2">
      <Link to="/settings" className="focus-ring -ml-1 mb-2 inline-flex items-center gap-1 rounded-md p-1 text-sm text-ink-muted">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Pengaturan
      </Link>
      <h1 className="mb-4 text-3xl font-extrabold text-ink">Unduhan</h1>
      <div className="space-y-2">
        <SettingSwitch
          checked={wifiOnly}
          onChange={() => setWifiOnlyEnabled(!wifiOnly)}
          icon={wifiOnly ? Wifi : WifiOff}
          label="Unduh hanya lewat Wi-Fi"
          hint="Antrean berhenti saat memakai data seluler dan lanjut sendiri saat Wi-Fi tersambung."
        />
        <SettingSwitch
          checked={chargingOnly}
          onChange={() => setChargingOnlyEnabled(!chargingOnly)}
          icon={chargingOnly ? BatteryCharging : Battery}
          label="Unduh hanya saat dicas"
          hint="Antrean berhenti saat HP tidak dicas dan lanjut sendiri saat dicolok."
        />
      </div>
      <p className="mt-4 text-xs text-ink-muted">
        Lagu yang kamu pilih dengan tombol putar di antrean tetap diunduh sekarang walau syarat di atas belum terpenuhi.
      </p>
    </section>
  )
}
