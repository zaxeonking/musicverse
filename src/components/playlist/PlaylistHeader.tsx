import { Download, ListChecks, ListEnd, ListPlus, Play, RotateCw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { fallbackCover } from '../../utils/fallbackCover'
import { isSafeHttpUrl } from '../../utils/spotifyUrl'
import CoverArt from '../ui/CoverArt'

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
      className="pointer-events-none absolute inset-0 -z-10 h-full w-full scale-125 object-cover opacity-30 blur-3xl"
    />
  )
}

interface PlaylistHeaderProps {
  title: string
  cover: string
  trackCount: number
  /** True jika playlist dipulihkan dari penyimpanan perangkat. */
  fromCache?: boolean
  /** Play All: memutar seluruh lagu playlist berurutan (lihat `playAll` di audio engine). */
  onPlayAll: () => void
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
  onPlayAll,
  onReload,
  addedAsPlaylist = false,
  onAddAsPlaylist,
  onDownloadAll,
  onAddToPlaylist,
  onAddToQueue,
}: PlaylistHeaderProps) {
  const fallback = useMemo(() => fallbackCover(title), [title])

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
            <button
              type="button"
              onClick={onPlayAll}
              disabled={trackCount === 0}
              className="btn-primary px-6"
            >
              <Play className="h-4 w-4" fill="currentColor" aria-hidden="true" />
              Putar semua
            </button>
            {onAddAsPlaylist && (
              <button type="button" onClick={onAddAsPlaylist} disabled={trackCount === 0} className="btn-secondary">
                {addedAsPlaylist ? (
                  <ListChecks className="h-4 w-4 text-accent" aria-hidden="true" />
                ) : (
                  <ListPlus className="h-4 w-4" aria-hidden="true" />
                )}
                {addedAsPlaylist ? 'Perbarui playlist' : 'Tambah ke playlist'}
              </button>
            )}
            {onDownloadAll && (
              <button type="button" onClick={onDownloadAll} disabled={trackCount === 0} className="btn-secondary">
                <Download className="h-4 w-4" aria-hidden="true" />
                Unduh semua
              </button>
            )}
            {onAddToQueue && (
              <button type="button" onClick={onAddToQueue} className="btn-secondary">
                <ListEnd className="h-4 w-4" aria-hidden="true" />
                Tambah ke antrean
              </button>
            )}
            {onAddToPlaylist && (
              <button type="button" onClick={onAddToPlaylist} aria-haspopup="dialog" className="btn-secondary">
                <ListPlus className="h-4 w-4" aria-hidden="true" />
                Tambah ke playlist
              </button>
            )}
            {onReload && (
              <button
                type="button"
                onClick={onReload}
                className="btn-secondary"
              >
                <RotateCw className="h-4 w-4" aria-hidden="true" />
                Muat ulang
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
