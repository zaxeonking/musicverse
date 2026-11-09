import { Download, ListChecks, ListEnd, ListPlus, RotateCw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { usePlaylistPlayback } from '../../hooks/usePlaylistPlayback'
import type { PlaylistTrack } from '../../types/spotify'
import { fallbackCover } from '../../utils/fallbackCover'
import { isSafeHttpUrl } from '../../utils/spotifyUrl'
import CoverArt from '../ui/CoverArt'
import RoundAction from '../ui/RoundAction'

function HeaderBackdrop({ src }: { src: string }) {
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
  }, [src])

  if (!isSafeHttpUrl(src) || failed) return null
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="pointer-events-none absolute inset-0 -z-10 h-full w-full scale-125 transform-gpu object-cover opacity-30 blur-2xl"
    />
  )
}

interface PlaylistHeaderProps {
  title: string
  cover: string
  trackCount: number
  /** Lagu playlist ini: tombol utama menjadi Jeda / Lanjutkan saat lagu aktif ada di daftar ini. */
  tracks: readonly PlaylistTrack[]
  /** True jika playlist dipulihkan dari penyimpanan perangkat. */
  fromCache?: boolean
  /** Play All: memutar seluruh lagu playlist berurutan (lihat `playAll` di audio engine). */
  onPlayAll: () => void
  /** Tombol Putar semua dikunci (mis. saat pengecekan audio playlist berjalan). */
  playAllDisabled?: boolean
  /** Memuat ulang playlist dari API. */
  onReload?: () => void
  /** True bila playlist Spotify ini sudah dijadikan playlist (tab Playlist): tombolnya menjadi "Perbarui playlist". */
  addedAsPlaylist?: boolean
  /** Menjadikan playlist Spotify ini sebuah playlist di tab Playlist (tidak otomatis). Disembunyikan jika tidak diberikan. */
  onAddAsPlaylist?: () => void
  /** Mengunduh seluruh lagu playlist untuk offline (hanya di APK; tombol disembunyikan jika tidak diberikan). */
  onDownloadAll?: () => void
  /** Menambahkan lagu ke "Playlist saya" (dipakai untuk hasil pencarian lagu satuan). */
  onAddToPlaylist?: () => void
  /** Menambahkan lagu ke antrean pemutar (hanya untuk hasil pencarian lagu satuan, bukan playlist). */
  onAddToQueue?: () => void
}

export default function PlaylistHeader({
  title,
  cover,
  trackCount,
  tracks,
  onPlayAll,
  playAllDisabled = false,
  onReload,
  addedAsPlaylist = false,
  onAddAsPlaylist,
  onDownloadAll,
  onAddToPlaylist,
  onAddToQueue,
}: PlaylistHeaderProps) {
  const fallback = useMemo(() => fallbackCover(title), [title])
  const playback = usePlaylistPlayback(tracks)

  return (
    <header className="relative isolate overflow-hidden rounded-lg bg-card p-4 sm:p-6">
      <HeaderBackdrop src={cover} />
      <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:items-end sm:gap-6 sm:text-left">
        <div className="w-40 shrink-0 sm:w-48 lg:w-56">
          <CoverArt cover={fallback} src={cover} className="shadow-2xl shadow-black/60" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">Playlist</p>
          <h2 className="mt-1 line-clamp-3 text-balance break-words font-display text-2xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-6xl">
            {title}
          </h2>
          <p className="mt-3 text-sm text-ink">
            {trackCount} lagu
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3 sm:justify-start">
            <RoundAction primary fill icon={playback.icon} label={playback.label} onClick={() => playback.onPress(onPlayAll)} disabled={trackCount === 0 || playAllDisabled} />
            {onAddAsPlaylist && (
              <RoundAction
                icon={addedAsPlaylist ? ListChecks : ListPlus}
                iconClassName={addedAsPlaylist ? 'text-accent' : undefined}
                label={addedAsPlaylist ? 'Perbarui playlist' : 'Tambah ke playlist'}
                onClick={onAddAsPlaylist}
                disabled={trackCount === 0}
              />
            )}
            {onDownloadAll && <RoundAction icon={Download} label="Unduh semua" onClick={onDownloadAll} disabled={trackCount === 0} />}
            {onAddToQueue && <RoundAction icon={ListEnd} label="Tambah ke antrean" onClick={onAddToQueue} />}
            {onAddToPlaylist && <RoundAction icon={ListPlus} label="Tambah ke playlist" onClick={onAddToPlaylist} haspopup />}
            {onReload && <RoundAction icon={RotateCw} label="Muat ulang" onClick={onReload} />}
          </div>
        </div>
      </div>
    </header>
  )
}
