import { ArrowLeft, Battery, BatteryCharging, Gauge, Music, Sparkles, Wifi, WifiOff } from 'lucide-react'
import { Link, Navigate } from 'react-router-dom'
import { DOWNLOAD_QUALITIES } from '../plugins/quality'
import SettingSwitch from '../components/ui/SettingSwitch'
import {
  setChargingOnlyEnabled,
  setDownloadQualityPreference,
  setExportMusicEnabled,
  setWifiOnlyEnabled,
  upgradeOldDownloads,
} from '../native/downloads'
import { useOffline } from '../native/offline'
import { isNativeApp } from '../native/platform'

/** Pengaturan unduhan (APK): syarat kapan antrean boleh berjalan. */
export default function DownloadSettingsPage() {
  const { wifiOnly, chargingOnly, exportMusic, downloadQuality, items, upgrade } = useOffline()
  const pending = items.filter((item) => item.tagged !== true).length
  const running = upgrade?.running === true
  if (!isNativeApp()) return <Navigate to="/" replace />
  return (
    <section aria-label="Pengaturan unduhan" className="px-4 pb-8 pt-2">
      <Link to="/settings" className="focus-ring -ml-1 mb-2 inline-flex items-center gap-1 rounded-md p-1 text-sm text-ink-muted">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Pengaturan
      </Link>
      <h1 className="mb-4 text-3xl font-extrabold text-ink">Unduhan</h1>
      <div className="mb-2 rounded-lg bg-card px-4 py-3 text-sm text-ink">
        <div className="flex items-center gap-3">
          <Gauge className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block">Kualitas unduhan</span>
            <span className="block text-xs text-ink-muted">
              Berlaku untuk unduhan baru dari sumber plugin. Lagu yang sudah diunduh tidak berubah.
            </span>
          </span>
        </div>
        <div role="radiogroup" aria-label="Kualitas unduhan" className="mt-3 grid grid-cols-3 gap-2">
          {DOWNLOAD_QUALITIES.map((option) => {
            const active = option.id === downloadQuality
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setDownloadQualityPreference(option.id)}
                className={`focus-ring rounded-lg px-2 py-2 text-center ${active ? 'bg-accent text-black' : 'bg-white/10 text-ink'}`}
              >
                <span className="block text-sm font-semibold">{option.label}</span>
                <span className={`block text-[11px] ${active ? 'text-black/70' : 'text-ink-muted'}`}>{option.hint}</span>
              </button>
            )
          })}
        </div>
      </div>
      <div className="mb-2 rounded-lg bg-card px-4 py-3 text-sm text-ink">
        <div className="flex items-center gap-3">
          <Sparkles className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block">Rapikan unduhan lama</span>
            <span className="block text-xs text-ink-muted" aria-live="polite">
              {running
                ? `Merapikan ${upgrade.done} dari ${upgrade.total} lagu…`
                : pending > 0
                  ? `${pending} lagu belum bertag dan masih bernama .mp3 walau isinya bisa M4A. Dirapikan otomatis di latar belakang; tanpa internet.`
                  : 'Semua unduhan sudah bertag dan berekstensi sesuai isinya.'}
              {!running && upgrade !== null && upgrade.failed > 0 ? ` ${upgrade.failed} lagu dilewati (isi bukan audio atau ruang penuh).` : ''}
            </span>
          </span>
          {pending > 0 && !running ? (
            <button
              type="button"
              onClick={() => void upgradeOldDownloads()}
              className="focus-ring shrink-0 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-ink"
            >
              Rapikan
            </button>
          ) : null}
        </div>
      </div>
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
        <SettingSwitch
          checked={exportMusic}
          onChange={() => setExportMusicEnabled(!exportMusic)}
          icon={Music}
          label="Salin ke folder Musik"
          hint="Lagu juga disalin ke Musik/MusicVerse agar muncul di pemutar musik dan pengelola berkas lain (Android 10+). Memakai ruang dua kali."
        />
      </div>
      <p className="mt-4 text-xs text-ink-muted">
        Lagu yang kamu pilih dengan tombol putar di antrean tetap diunduh sekarang walau syarat di atas belum terpenuhi. Unduhan baru
        disimpan dengan ekstensi sesuai isinya dan membawa judul, artis, album, serta sampul di dalam berkasnya. Bila sumber plugin gagal dan aplikasi memakai API cadangan, kualitasnya mengikuti API itu (tanpa pilihan bitrate).
      </p>
    </section>
  )
}
