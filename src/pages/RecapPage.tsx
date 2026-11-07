import { ArrowLeft, BarChart3 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import CoverArt from '../components/ui/CoverArt'
import EmptyState from '../components/ui/EmptyState'
import { fallbackCover } from '../utils/fallbackCover'
import { readPlayLog } from '../utils/playLog'
import { computeRecap, formatListening, RECAP_PERIODS, WEEKDAYS, type RecapPeriod } from '../utils/recap'

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg bg-card p-4">
      <p className="text-xs text-ink-muted">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold leading-tight text-ink">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-muted">{hint}</p>}
    </div>
  )
}

function dayText(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })
}

/** Rangkuman mendengarkan (seperti "Wrapped"), dihitung lokal dari log Riwayat. */
export default function RecapPage() {
  const [period, setPeriod] = useState<RecapPeriod>('30d')
  const log = useMemo(readPlayLog, [])
  const recap = useMemo(() => computeRecap(log, period), [log, period])
  const maxDay = Math.max(1, ...recap.perWeekday)
  const hourText = recap.busiestHour >= 0 ? `${String(recap.busiestHour).padStart(2, '0')}.00` : '-'

  return (
    <div className="space-y-6 px-4 pb-8 pt-2 sm:px-0">
      <Link to="/history" className="focus-ring -ml-1 inline-flex items-center gap-1 rounded-md p-1 text-sm text-ink-muted">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Riwayat
      </Link>
      <header>
        <h1 className="text-3xl font-extrabold text-ink">Rangkuman</h1>
        <p className="mt-1 text-sm text-ink-muted">Dihitung di perangkatmu dari Riwayat. Tidak ada data yang dikirim.</p>
      </header>

      <div role="tablist" aria-label="Periode" className="flex gap-2">
        {RECAP_PERIODS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={period === item.id}
            onClick={() => setPeriod(item.id)}
            className={`focus-ring h-9 rounded-full px-4 text-sm font-semibold transition-colors ${
              period === item.id ? 'bg-accent text-black' : 'bg-raised text-ink'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {recap.plays === 0 ? (
        <EmptyState compact icon={BarChart3} title="Belum ada data di periode ini" />
      ) : (
        <>
          <section aria-label="Ringkasan" className="grid grid-cols-2 gap-3">
            <Stat label="Total waktu dengar" value={formatListening(recap.totalSeconds)} hint="Perkiraan dari durasi lagu" />
            <Stat label="Putaran" value={String(recap.plays)} hint={`${recap.uniqueTracks} lagu · ${recap.uniqueArtists} artis`} />
            <Stat
              label="Hari paling aktif"
              value={recap.busiestWeekday >= 0 ? WEEKDAYS[recap.busiestWeekday] : '-'}
              hint={recap.busiestDay ? `Rekor: ${dayText(recap.busiestDay.date)} (${recap.busiestDay.plays}×)` : undefined}
            />
            <Stat label="Jam favorit" value={hourText} hint="Waktu paling sering memutar" />
          </section>

          <section aria-label="Per hari" className="rounded-lg bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold text-ink">Putaran per hari</h2>
            <div className="flex h-28 items-end gap-2" role="img" aria-label={WEEKDAYS.map((d, i) => `${d} ${recap.perWeekday[i]}`).join(', ')}>
              {recap.perWeekday.map((count, i) => (
                <div key={WEEKDAYS[i]} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                  <div
                    className={`w-full rounded-t ${i === recap.busiestWeekday ? 'bg-accent' : 'bg-white/25'}`}
                    style={{ height: `${Math.max(count > 0 ? 6 : 0, (count / maxDay) * 100)}%` }}
                  />
                  <span className="text-[10px] text-ink-muted">{WEEKDAYS[i].slice(0, 3)}</span>
                </div>
              ))}
            </div>
          </section>

          <section aria-label="Lagu teratas" className="rounded-lg bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold text-ink">Lagu teratas</h2>
            <ol className="mv-list space-y-3">
              {recap.topTracks.map(({ track, count }, i) => (
                <li key={track.url} className="flex items-center gap-3">
                  <span className="w-4 text-center text-sm font-bold text-ink-muted">{i + 1}</span>
                  <div className="w-11 shrink-0">
                    <CoverArt cover={fallbackCover(`${track.title}${track.album}`)} src={track.cover} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{track.title}</p>
                    <p className="truncate text-xs text-ink-muted">{track.artists}</p>
                  </div>
                  <span className="shrink-0 text-sm text-ink-muted">{count}×</span>
                </li>
              ))}
            </ol>
          </section>

          <section aria-label="Artis teratas" className="rounded-lg bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold text-ink">Artis teratas</h2>
            <ol className="mv-list space-y-2">
              {recap.topArtists.map(({ name, count }, i) => (
                <li key={name} className="flex items-center gap-3 text-sm">
                  <span className="w-4 text-center font-bold text-ink-muted">{i + 1}</span>
                  <Link to={`/browse?tab=artist&g=${encodeURIComponent(name)}`} className="min-w-0 flex-1 truncate text-ink">
                    {name}
                  </Link>
                  <span className="shrink-0 text-ink-muted">{count}×</span>
                </li>
              ))}
            </ol>
          </section>
        </>
      )}
    </div>
  )
}
