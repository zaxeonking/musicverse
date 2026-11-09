import { ChevronRight } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useLibrary } from '../../context/LibraryContext'
import { useAudioPlayer } from '../../hooks/useAudioPlayer'
import { recentKey } from '../../utils/libraryStorage'
import { getRowActivity } from '../../utils/playerStatus'
import { CompactTrackList, SectionTitle } from './HomeCards'

const MAX = 15
/** Berapa baris tampil di Beranda; sisanya ada di halaman Riwayat. */
const SHOWN = 5

/**
 * "Terakhir diputar": daftar ringkas lima lagu terbaru dalam satu panel (bukan carousel). Lagu yang sedang diputar disorot
 * dan bertanda equalizer. Ketuk baris = putar dari lagu itu (lima belas lagu terbaru jadi antrean); titik tiga = menu lagu.
 * Dari penyimpanan lokal, jadi tampil juga saat offline.
 */
export default function HomeRecently() {
  const { recent } = useLibrary()
  const player = useAudioPlayer()
  const activity = getRowActivity(player.status)

  const tracks = useMemo(() => {
    const seen = new Set<string>()
    const out = []
    for (const entry of recent) {
      const key = recentKey(entry.track)
      if (seen.has(key)) continue
      seen.add(key)
      out.push(entry.track)
      if (out.length >= MAX) break
    }
    return out
  }, [recent])

  if (tracks.length === 0) return null

  const currentKey = player.currentTrack !== null && player.status !== 'idle' ? recentKey(player.currentTrack) : null

  return (
    <section aria-label="Terakhir diputar">
      <SectionTitle
        title="Terakhir diputar"
        action={
          <Link to="/history" className="focus-ring tap-row mb-0.5 inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-1 text-sm font-semibold text-accent">
            Riwayat
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        }
      />
      <div className="rounded-[1.75rem_0.75rem_1.75rem_0.75rem] bg-card p-1.5 ring-1 ring-veil/[0.06]">
        <CompactTrackList tracks={tracks} limit={SHOWN} currentKey={currentKey} activity={activity} onPlay={(i) => player.playList(tracks, i)} />
      </div>
    </section>
  )
}
