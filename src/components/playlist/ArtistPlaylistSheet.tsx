import { Check, ListMusic } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { myPlaylistErrorText, useMyPlaylists } from '../../context/MyPlaylistsContext'
import { useOverlayHistory } from '../../hooks/useOverlayHistory'
import type { PlaylistTrack } from '../../types/spotify'
import { trackIdentity, type BulkAddResult } from '../../utils/myPlaylistStorage'
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
  useOverlayHistory(true, onClose)

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    sheetRef.current?.querySelector<HTMLElement>('ul button, input')?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      previous?.focus?.()
    }
  }, [onClose])

  const [notes, setNotes] = useState<Record<string, string>>({})
  const [flashId, setFlashId] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const [summary, setSummary] = useState<string[]>([])
  const identities = useMemo(() => songs.map(trackIdentity), [songs])

  /** Berapa lagu dari daftar ini yang sudah ada di playlist tertentu. */
  const haveIn = (tracks: readonly PlaylistTrack[]) => {
    const known = new Set(tracks.map(trackIdentity))
    return identities.filter((identity) => known.has(identity)).length
  }

  const confirm = (id: string, ok: boolean, message: string) => {
    navigator.vibrate?.(ok ? 12 : [30, 40, 30])
    setFlashId(id)
    setStatus(message)
    setNotes((prev) => ({ ...prev, [id]: message }))
  }

  // Sheet tetap terbuka setelah diketuk: konfirmasi tampil di barisnya, jadi bisa memilih beberapa playlist.
  const addTo = (id: string, name: string) => {
    const result = addTracks(id, songs)
    if (!result.ok) return confirm(id, false, myPlaylistErrorText(result.reason))
    const message = addedMessage(name, result.value)
    if (result.value.added > 0) setSummary((prev) => [...prev.filter((item) => item !== name), name])
    confirm(id, true, message)
  }

  const create = (name: string): string | null => {
    const made = createPlaylist(name)
    if (!made.ok) return myPlaylistErrorText(made.reason)
    const filled = addTracks(made.value.id, songs)
    if (!filled.ok) return myPlaylistErrorText(filled.reason)
    setSummary((prev) => [...prev, made.value.name])
    confirm(made.value.id, true, `Playlist “${made.value.name}” dibuat, ${filled.value.added} lagu disimpan`)
    return null
  }

  const finish = () => {
    if (summary.length > 0) onDone(`${songs.length} lagu disimpan ke ${summary.map((name) => `“${name}”`).join(', ')}`)
    onClose()
  }

  return (
    <OverlayPortal>
      <div aria-hidden="true" onClick={finish} className="absolute inset-0 animate-fade-in bg-black/60" />
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
          <button type="button" onClick={finish} className="btn-primary h-9 shrink-0 px-4 text-sm">
            Selesai
          </button>
        </div>
        <p role="status" aria-live="polite" className="sr-only">
          {status}
        </p>
        {playlists.length > 0 && (
          <ul className="mv-list max-h-[40dvh] overflow-y-auto border-t border-line px-2 pt-2">
            {playlists.map((playlist) => {
              const have = haveIn(playlist.tracks)
              const all = songs.length > 0 && have >= songs.length
              return (
                <Action
                  key={playlist.id}
                  icon={all ? Check : ListMusic}
                  iconClassName={flashId === playlist.id ? 'animate-pop' : all ? 'text-accent' : undefined}
                  label={playlist.name}
                  hint={notes[playlist.id] ?? (have > 0 ? `${have} dari ${songs.length} lagu sudah ada` : `${playlist.tracks.length} lagu`)}
                  onClick={() => addTo(playlist.id, playlist.name)}
                />
              )
            })}
          </ul>
        )}
        <div className="border-t border-line px-4 pt-3">
          <NewPlaylistForm onCreate={create} autoFocus={playlists.length === 0} submitLabel="Buat & simpan" />
        </div>
      </div>
    </OverlayPortal>
  )
}
