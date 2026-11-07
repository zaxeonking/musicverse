import { Check, ChevronLeft, ListMusic, Plus } from 'lucide-react'
import { useRef, useState } from 'react'
import { myPlaylistErrorText, useMyPlaylists } from '../../context/MyPlaylistsContext'
import { useTrackMenu, type ToastAction } from '../../context/TrackMenuContext'
import type { PlaylistTrack } from '../../types/spotify'
import { trackIdentity } from '../../utils/myPlaylistStorage'
import NewPlaylistForm from '../library/NewPlaylistForm'
import Action from './SheetAction'

interface AddToPlaylistPickerProps {
  track: PlaylistTrack
  onBack: () => void
  /** `action` (mis. Urungkan) ikut ke toast bila ada. */
  onDone: (message: string, action?: ToastAction) => void
}

/** Jeda singkat sebelum sheet menutup supaya animasi ikon sempat terlihat. */
const CLOSE_DELAY_MS = 260

const buzz = (pattern: number | number[]) => navigator.vibrate?.(pattern)

/** Pilihan playlist untuk menyimpan satu lagu (ketuk lagi pada yang sudah berisi lagu ini untuk menghapusnya): pilih yang ada, atau buat baru langsung dengan lagu ini. */
export default function AddToPlaylistPicker({ track, onBack, onDone }: AddToPlaylistPickerProps) {
  const { playlists, addTrack, removeTrack, moveTrack, createPlaylist } = useMyPlaylists()
  const { showToast } = useTrackMenu()
  const [creating, setCreating] = useState(playlists.length === 0)
  const [flashId, setFlashId] = useState<string | null>(null)
  const busy = useRef(false)
  const identity = trackIdentity(track)

  /** Animasi ikon + getar, lalu tutup sheet sebentar kemudian (ketukan ganda diabaikan selama jeda). */
  const finish = (id: string | null, ok: boolean, message: string, action?: ToastAction) => {
    if (ok) buzz(id === null ? 12 : action ? [10, 40, 10] : 12)
    else buzz([30, 40, 30])
    setFlashId(id)
    window.setTimeout(() => onDone(message, action), ok ? CLOSE_DELAY_MS : 0)
  }

  const addTo = (id: string, name: string) => {
    if (busy.current) return
    busy.current = true
    const result = addTrack(id, track)
    finish(id, result.ok, result.ok ? `Disimpan ke “${name}”` : myPlaylistErrorText(result.reason))
  }

  /** Lagu sudah ada di playlist ini: ketukan kedua melepasnya lagi (hanya dari playlist itu). Toast punya tombol Urungkan. */
  const removeFrom = (id: string, name: string) => {
    if (busy.current) return
    busy.current = true
    const tracks = playlists.find((item) => item.id === id)?.tracks ?? []
    const index = tracks.findIndex((item) => trackIdentity(item) === identity)
    if (index === -1) return finish(null, false, myPlaylistErrorText('missing'))
    const stored = tracks[index]
    const result = removeTrack(id, stored.id)
    if (!result.ok) return finish(null, false, myPlaylistErrorText(result.reason))
    // Urungkan: simpan lagi ke playlist yang sama lalu kembalikan ke posisi semula (berjalan setelah sheet tertutup).
    const undo: ToastAction = {
      label: 'Urungkan',
      onClick: () => {
        const back = addTrack(id, stored)
        if (!back.ok) return showToast(myPlaylistErrorText(back.reason))
        const last = back.value.tracks.length - 1
        moveTrack(id, last, Math.min(index, last))
        buzz(12)
        showToast(`Dikembalikan ke “${name}”`)
      },
    }
    finish(id, true, `Dihapus dari “${name}”`, undo)
  }

  const create = (name: string): string | null => {
    const made = createPlaylist(name)
    if (!made.ok) return myPlaylistErrorText(made.reason)
    const added = addTrack(made.value.id, track)
    finish(null, added.ok, added.ok ? `Playlist “${made.value.name}” dibuat dan lagu disimpan` : myPlaylistErrorText(added.reason))
    return null
  }

  return (
    <div>
      <div className="flex items-center gap-1 px-2 pb-2">
        <button type="button" onClick={onBack} aria-label="Kembali ke opsi lagu" className="icon-btn">
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <p className="text-sm font-semibold text-ink">Simpan ke playlist saya</p>
      </div>
      <ul className="max-h-[40dvh] overflow-y-auto border-t border-line px-2 pt-2">
        {playlists.map((playlist) => {
          const has = playlist.tracks.some((item) => trackIdentity(item) === identity)
          return (
            <Action
              key={playlist.id}
              icon={has ? Check : ListMusic}
              iconClassName={flashId === playlist.id ? 'animate-pop' : undefined}
              label={playlist.name}
              hint={has ? 'Sudah ada di sini · ketuk untuk menghapus' : `${playlist.tracks.length} lagu`}
              onClick={() => (has ? removeFrom(playlist.id, playlist.name) : addTo(playlist.id, playlist.name))}
            />
          )
        })}
      </ul>
      <div className="border-t border-line px-4 pt-3">
        {creating ? (
          <NewPlaylistForm onCreate={create} onCancel={playlists.length > 0 ? () => setCreating(false) : undefined} submitLabel="Buat & simpan" />
        ) : (
          <button type="button" onClick={() => setCreating(true)} className="btn-secondary h-11 w-full text-sm">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Playlist baru
          </button>
        )}
      </div>
    </div>
  )
}
