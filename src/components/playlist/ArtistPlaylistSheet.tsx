import { ListMusic } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { myPlaylistErrorText, useMyPlaylists } from '../../context/MyPlaylistsContext'
import { useOverlayHistory } from '../../hooks/useOverlayHistory'
import type { PlaylistTrack } from '../../types/spotify'
import type { BulkAddResult } from '../../utils/myPlaylistStorage'
import { fallbackCover } from '../../utils/fallbackCover'
import NewPlaylistForm from '../library/NewPlaylistForm'
import Action from '../player/SheetAction'
import CoverArt from '../ui/CoverArt'
import OverlayPortal from '../ui/OverlayPortal'

/** Teks hasil untuk toast; jujur soal lagu yang sudah ada atau tidak muat. */
export function addedMessage(name: string, result: BulkAddResult): string {
  if (result.added === 0) return result.skipped > 0 ? `Semua lagu sudah ada di “${name}”` : `Tidak ada lagu yang ditambahkan ke “${name}”`
  return `${result.added} lagu ditambahkan ke “${name}”${result.skipped > 0 ? `, ${result.skipped} dilewati` : ''}`
}

interface ArtistPlaylistSheetProps {
  /** Artis atau album yang lagunya akan disimpan. */
  artist: { name: string; picture: string }
  songs: readonly PlaylistTrack[]
  onClose: () => void
  onDone: (message: string) => void
}

/** Sheet bawah: simpan semua lagu artis ke playlist yang sudah ada, atau buat playlist baru dengan nama sendiri. */
export default function ArtistPlaylistSheet({ artist, songs, onClose, onDone }: ArtistPlaylistSheetProps) {
  const { playlists, addTracks, createPlaylist } = useMyPlaylists()
  const sheetRef = useRef<HTMLDivElement>(null)
  const busy = useRef(false)
  useOverlayHistory(true, onClose)

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    sheetRef.current?.querySelector<HTMLElement>('button, input')?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      previous?.focus?.()
    }
  }, [onClose])

  const addTo = (id: string, name: string) => {
    if (busy.current) return
    busy.current = true
    const result = addTracks(id, songs)
    onDone(result.ok ? addedMessage(name, result.value) : myPlaylistErrorText(result.reason))
    onClose()
  }

  const create = (name: string): string | null => {
    const made = createPlaylist(name)
    if (!made.ok) return myPlaylistErrorText(made.reason)
    const filled = addTracks(made.value.id, songs)
    onDone(filled.ok ? `Playlist “${made.value.name}” dibuat, ${filled.value.added} lagu disimpan` : myPlaylistErrorText(filled.reason))
    onClose()
    return null
  }

  return (
    <OverlayPortal>
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 animate-fade-in bg-black/60" />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Tambah lagu ${artist.name} ke playlist`}
        className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-md animate-sheet-up rounded-t-2xl border-t border-line bg-card pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-2xl shadow-black/60 lg:bottom-6 lg:rounded-2xl lg:border"
      >
        <div className="flex items-center gap-3 px-4 pb-3 pt-4">
          <span className="w-12 shrink-0 overflow-hidden rounded-full">
            <CoverArt cover={fallbackCover(artist.name)} src={artist.picture || songs[0]?.cover} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-ink">Tambah ke playlist</span>
            <span className="block truncate text-xs text-ink-muted">
              {artist.name} · {songs.length} lagu
            </span>
          </span>
        </div>
        {playlists.length > 0 && (
          <ul className="max-h-[40dvh] overflow-y-auto border-t border-line px-2 pt-2">
            {playlists.map((playlist) => (
              <Action
                key={playlist.id}
                icon={ListMusic}
                label={playlist.name}
                hint={`${playlist.tracks.length} lagu`}
                onClick={() => addTo(playlist.id, playlist.name)}
              />
            ))}
          </ul>
        )}
        <div className="border-t border-line px-4 pt-3">
          <NewPlaylistForm onCreate={create} autoFocus={playlists.length === 0} submitLabel="Buat & simpan" />
        </div>
      </div>
    </OverlayPortal>
  )
}
