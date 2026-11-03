import { ArrowLeft, History, Play } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import CoverArt from '../components/ui/CoverArt'
import EmptyState from '../components/ui/EmptyState'
import SectionHeader from '../components/ui/SectionHeader'
import { useAudioPlayer } from '../hooks/useAudioPlayer'
import { fallbackCover } from '../utils/fallbackCover'
import { clearPlayLog, computeStats, readPlayLog } from '../utils/playLog'

function dayLabel(at: number): string {
  const d = new Date(at)
  const today = new Date()
  const y = new Date()
  y.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Hari ini'
  if (d.toDateString() === y.toDateString()) return 'Kemarin'
  return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

/** Riwayat putar lengkap + statistik sederhana. */
export default function HistoryPage() {
  const player = useAudioPlayer()
  const [log, setLog] = useState(readPlayLog)
  const stats = useMemo(() => computeStats(log), [log])
  const groups = useMemo(() => {
    const out: Array<{ label: string; items: typeof log }> = []
    for (const entry of log) {
      const label = dayLabel(entry.at)
      const last = out[out.length - 1]
      if (last && last.label === label) last.items.push(entry)
      else out.push({ label, items: [entry] })
    }
    return out
  }, [log])

  return (
    <div className="space-y-6 px-4 pb-8 pt-2 sm:px-0">
      <Link to="/library" className="focus-ring -ml-1 inline-flex items-center gap-1 rounded-md p-1 text-sm text-ink-muted">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Playlist
      </Link>
      <header>
        <h1 className="text-3xl font-extrabold text-ink">Riwayat</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {stats.total} putaran · {stats.unique} lagu berbeda
        </p>
      </header>

      {log.length === 0 ? (
        <EmptyState
          compact
          icon={History}
          title="Belum ada riwayat"
          description="Setiap lagu yang kamu putar dicatat di sini (maksimal 500 putaran terakhir)."
        />
      ) : (
        <>
          <section aria-label="Statistik" className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-card p-4">
              <h2 className="mb-2 text-sm font-semibold text-ink">Lagu terbanyak</h2>
              <ol className="space-y-1 text-sm">
                {stats.topTracks.map(({ track, count }) => (
                  <li key={track.url} className="flex justify-between gap-3">
                    <span className="min-w-0 truncate text-ink">{track.title}</span>
                    <span className="shrink-0 text-ink-muted">{count}×</span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="rounded-lg bg-card p-4">
              <h2 className="mb-2 text-sm font-semibold text-ink">Artis terbanyak</h2>
              <ol className="space-y-1 text-sm">
                {stats.topArtists.map(({ name, count }) => (
                  <li key={name} className="flex justify-between gap-3">
                    <Link to={`/browse?tab=artist&g=${encodeURIComponent(name)}`} className="min-w-0 truncate text-ink">
                      {name}
                    </Link>
                    <span className="shrink-0 text-ink-muted">{count}×</span>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          {groups.map((group) => (
            <section key={group.label} aria-label={group.label}>
              <SectionHeader title={group.label} />
              <ul className="space-y-1">
                {group.items.map((entry) => (
                  <li key={`${entry.at}-${entry.track.url}`} className="flex items-center gap-3 rounded-lg px-1 py-1">
                    <div className="w-12 shrink-0">
                      <CoverArt cover={fallbackCover(`${entry.track.title}${entry.track.album}`)} src={entry.track.cover} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{entry.track.title}</p>
                      <p className="truncate text-xs text-ink-muted">
                        {entry.track.artists} · {new Date(entry.at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Putar ${entry.track.title}`}
                      onClick={() => player.playAll([entry.track])}
                    >
                      <Play className="h-5 w-5" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              clearPlayLog()
              setLog([])
            }}
          >
            Hapus seluruh riwayat
          </button>
        </>
      )}
    </div>
  )
}
