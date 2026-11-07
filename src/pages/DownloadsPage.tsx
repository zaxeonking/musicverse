import { Navigate } from 'react-router-dom'
import DownloadsSection from '../components/library/DownloadsSection'
import { isNativeApp } from '../native/platform'

/** Halaman Unduhan (APK), tab sendiri di navigasi: seluruh lagu yang diunduh dan progresnya. */
export default function DownloadsPage() {
  if (!isNativeApp()) return <Navigate to="/library" replace />
  return <DownloadsSection />
}
