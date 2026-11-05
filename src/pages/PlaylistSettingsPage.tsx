import { ArrowLeft, ArrowRightLeft, ListPlus } from 'lucide-react'
import { Link, Navigate } from 'react-router-dom'
import SettingSwitch from '../components/ui/SettingSwitch'
import { usePlaylistPrefs } from '../hooks/usePlaylistPrefs'
import { isNativeApp } from '../native/platform'

/** Pengaturan playlist (APK): kapan playlist Spotify dijadikan playlist, dan konfirmasi saat memindahkan lagu. */
export default function PlaylistSettingsPage() {
  const [prefs, setPrefs] = usePlaylistPrefs()
  if (!isNativeApp()) return <Navigate to="/" replace />
  return (
    <section aria-label="Playlist" className="px-4 pb-8 pt-2">
      <Link to="/settings" className="focus-ring -ml-1 mb-2 inline-flex items-center gap-1 rounded-md p-1 text-sm text-ink-muted">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Pengaturan
      </Link>
      <h1 className="mb-4 text-3xl font-extrabold text-ink">Playlist</h1>
      <div className="space-y-2">
        <SettingSwitch
          checked={prefs.autoAddOpened}
          onChange={() => setPrefs({ autoAddOpened: !prefs.autoAddOpened })}
          icon={ListPlus}
          label="Tambah otomatis saat playlist dibuka"
          hint="Aktif: playlist otomatis ditambahkan saat berhasil dimuat."
        />
        <SettingSwitch
          checked={prefs.confirmMove}
          onChange={() => setPrefs({ confirmMove: !prefs.confirmMove })}
          icon={ArrowRightLeft}
          label="Tanya dulu sebelum memindahkan lagu"
          hint="Memindahkan lagu akan menghapusnya dari playlist asal. Menyalin tidak."
        />
      </div>
    </section>
  )
}
