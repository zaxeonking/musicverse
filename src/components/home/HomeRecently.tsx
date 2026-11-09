import { EllipsisVertical } from 'lucide-react'
import { useMemo } from 'react'
import { useLibrary } from '../../context/LibraryContext'
import { useTrackMenu } from '../../context/TrackMenuContext'
import { useAudioPlayer } from '../../hooks/useAudioPlayer'
import { fallbackCover } from '../../utils/fallbackCover'
import { recentKey } from '../../utils/libraryStorage'
import { getRowActivity } from '../../utils/playerStatus'
import CoverArt from '../ui/CoverArt'
import { CoverPlayingBadge } from '../ui/PlayingBars'

const MAX = 15

/**
 * "Recently": lagu yang baru diputar, tersusun tiga baris menyamping (geser ke kanan untuk lebih banyak) dengan judul tegak
 * di kirinya. Lagu yang sedang diputar disorot dan bertanda equalizer. Ketuk baris = putar dari lagu itu; ikon titik tiga =
 * menu lagu. Dari penyimpanan lokal, jadi tampil juga saat offline.
 */
export default function HomeRecently() {
  const { recent } = useLibrary()
  const player = useAudioPlayer()
  const { openTrackMenu } = useTrackMenu()
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

  return (
    <section aria-label="Recently" className="flex items-stretch gap-1">
      <h2 className="shrink-0 pr-1 font-display text-[1.65rem] font-extrabold leading-none tracking-tight text-ink [text-orientation:mixed] [writing-mode:vertical-rl] rotate-180">
        Recently
      </h2>
      <div className="no-scrollbar -mr-4 min-w-0 flex-1 snap-x snap-mandatory overflow-x-auto pr-4 lg:-mr-8 lg:pr-8">
        <ul className="grid auto-cols-[88%] grid-flow-col grid-rows-3 gap-x-3 gap-y-2.5 sm:auto-cols-[45%]">
          {tracks.map((track, i) => {
            const current = player.currentTrack !== null && recentKey(player.currentTrack) === recentKey(track) && player.status !== 'idle'
            return (
              <li
                key={recentKey(track)}
                style={{ ['--mv-delay' as string]: `${Math.min(Math.floor(i / 3), 5) * 70 + (i % 3) * 40}ms` }}
                className={`mv-in snap-start rounded-3xl transition-colors duration-300 motion-reduce:transition-none ${current ? 'bg-raised' : ''}`}
              >
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => player.playList(tracks, i)}
                    aria-label={`Putar ${track.title}${track.artists ? ` oleh ${track.artists}` : ''}`}
                    className="focus-ring tap-row flex min-w-0 flex-1 items-center gap-3.5 rounded-3xl p-1.5 text-left"
                  >
                    <div className="relative w-14 shrink-0">
                      <CoverArt cover={fallbackCover(`${track.title}${track.album}`)} src={track.cover} className="!rounded-2xl shadow-md shadow-black/40" />
                      {current && <CoverPlayingBadge activity={activity} className="rounded-2xl" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`truncate font-display text-[1.05rem] font-semibold ${current ? 'text-accent' : 'text-ink'}`}>{track.title}</p>
                      <p className="truncate text-sm text-ink-muted">{track.artists}</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => openTrackMenu(track, { place: 'browse' })}
                    aria-label={`Opsi untuk ${track.title}`}
                    aria-haspopup="dialog"
                    className="icon-btn shrink-0 text-ink"
                  >
                    <EllipsisVertical className="h-6 w-6" aria-hidden="true" />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
