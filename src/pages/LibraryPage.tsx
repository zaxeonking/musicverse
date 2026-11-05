import { AlertCircle, History, X } from 'lucide-react'
import { useCallback, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import PlaylistsSection from '../components/library/PlaylistsSection'
import RecentlyPlayedList from '../components/library/RecentlyPlayedList'
import CoverArt from '../components/ui/CoverArt'
import EmptyState from '../components/ui/EmptyState'
import SectionHeader from '../components/ui/SectionHeader'
import { useLibrary } from '../context/LibraryContext'
import { usePlaylist } from '../context/PlaylistContext'
import { useAudioPlayer } from '../hooks/useAudioPlayer'
import type { RecentPlay } from '../types/library'
import { fallbackCover } from '../utils/fallbackCover'
import { noticeMessage } from '../utils/libraryNotice'
import { getRowActivity } from '../utils/playerStatus'

const primaryButton = 'btn-primary'

function NoticeBar({
  role,
  children,
  onDismiss,
}: {
  role: 'alert' | 'status'
  children: ReactNode
  onDismiss?: () => void
}) {
  return (
    <div role={role} className="flex items-start gap-3 rounded-lg bg-card px-4 py-3 text-sm text-ink">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
      <p className="min-w-0 flex-1">{children}</p>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Tutup pemberitahuan"
          className="icon-btn -my-2.5 -mr-2.5"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

export default function LibraryPage() {
  const { playlist: active } = usePlaylist()
  const { saved, recent, health, notice, savedIdFor, savePlaylist, clearRecent, dismissNotice } = useLibrary()
  const player = useAudioPlayer()
  const [recoveredDismissed, setRecoveredDismissed] = useState(false)
  const activeUnsaved = active !== null && active.source !== 'search' && savedIdFor(active) === null

  const currentTrack = player.currentTrack
  const handlePlayRecent = useCallback(
    (entry: RecentPlay) => {
      // Lagu yang sedang aktif: tombol berfungsi sebagai jeda/lanjut/ulang.
      if (currentTrack && currentTrack.url === entry.track.url) {
        player.selectTrack(currentTrack, player.currentIndex ?? 0)
        return
      }
      // Lagu ada di playlist yang sedang dibuka: putar di dalamnya agar queue-nya tetap playlist itu.
      const index = active ? active.tracks.findIndex((track) => track.url === entry.track.url) : -1
      if (active && index !== -1) {
        player.selectTrack(active.tracks[index], index)
        return
      }
      player.playAll([entry.track])
    },
    [active, currentTrack, player],
  )

  const showRecovered = health === 'recovered' && !recoveredDismissed

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Playlist</h1>
        </div>
        {saved.length > 0 && (
          <Link to="/" className={primaryButton}>
            Muat playlist
          </Link>
        )}
        <nav aria-label="Jelajah" className="flex w-full gap-2">
          <Link to="/history" className="btn-secondary">
            Riwayat
          </Link>
          <Link to="/browse" className="btn-secondary">
            Artis & Album
          </Link>
        </nav>
      </header>

      {(notice || health === 'unavailable' || showRecovered) && (
        <div className="space-y-2">
          {notice && (
            <NoticeBar role="alert" onDismiss={dismissNotice}>
              {noticeMessage(notice)}
            </NoticeBar>
          )}
          {health === 'unavailable' && (
            <NoticeBar role="status">
              Browser tidak mengizinkan penyimpanan lokal. Koleksi dan riwayat hanya bertahan selama tab ini terbuka.
            </NoticeBar>
          )}
          {showRecovered && (
            <NoticeBar role="status" onDismiss={() => setRecoveredDismissed(true)}>
              Sebagian data Koleksi di perangkat ini rusak atau tidak valid, jadi diabaikan. Data yang valid tetap tampil.
            </NoticeBar>
          )}
        </div>
      )}

      {activeUnsaved && active && (
        <section
          aria-label="Playlist yang sedang dibuka belum tersimpan"
          className="flex flex-col gap-3 rounded-lg bg-card p-3 sm:flex-row sm:items-center sm:gap-4"
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="w-14 shrink-0">
              <CoverArt cover={fallbackCover(active.title)} src={active.cover} />
            </div>
            <div className="min-w-0">
              <p className="truncate font-medium text-ink">{active.title}</p>
              <p className="text-sm text-ink-muted">
                {active.tracks.length} lagu · Sedang dibuka, belum ada di Koleksi
              </p>
            </div>
          </div>
          <button type="button" onClick={() => savePlaylist(active)} className={primaryButton}>
            Simpan ke Koleksi
          </button>
        </section>
      )}

      <PlaylistsSection />

      <section aria-label="Baru diputar">
        <SectionHeader
          title="Baru diputar"
          action={
            recent.length > 0 ? (
              <button
                type="button"
                onClick={clearRecent}
                className="inline-flex h-10 shrink-0 items-center rounded-full px-3 text-sm font-medium text-ink-muted transition-colors hover:bg-white/5 hover:text-ink active:bg-white/10 focus-ring"
              >
                Hapus riwayat
              </button>
            ) : undefined
          }
        />

        {recent.length === 0 ? (
          <EmptyState
            compact
            icon={History}
            title="Belum ada lagu yang diputar"
          />
        ) : (
          <RecentlyPlayedList
            items={recent}
            currentTrackUrl={currentTrack?.url ?? null}
            currentActivity={getRowActivity(player.status)}
            onPlay={handlePlayRecent}
          />
        )}
      </section>
    </div>
  )
}
