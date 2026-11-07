import { WifiOff } from 'lucide-react'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import Presence from '../ui/Presence'

/** Pita kecil di atas konten saat perangkat offline. Lagu di Unduhan tetap bisa diputar. */
export default function OfflineBanner() {
  const online = useOnlineStatus()
  return (
    <Presence show={!online}>
    <div role="status" aria-live="polite" className="mx-3 mt-2 flex items-center gap-3 rounded-lg bg-card px-4 py-2.5 text-sm text-ink">
      <WifiOff className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
      <p className="min-w-0 flex-1">
        <span className="font-semibold">You&apos;re offline</span>
        <span className="block text-xs text-ink-muted">Lagu di Unduhan tetap bisa diputar.</span>
      </p>
    </div>
    </Presence>
  )
}
