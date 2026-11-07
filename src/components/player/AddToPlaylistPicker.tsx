import { Check, ChevronLeft, ListMusic, Plus } from 'lucide-react'
import { useState } from 'react'
import { myPlaylistErrorText, useMyPlaylists } from '../../context/MyPlaylistsContext'
import type { ToastAction } from '../../context/TrackMenuContext'
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

const buzz = (pattern: number | number[]) => navigator.vibrate?.(pattern)

/**
 * Pilihan playlist untuk menyimpan satu lagu. Sheet TETAP TERBUKA setelah diketuk: baris berubah jadi centang
 * dengan keterangan konfirmasi, jadi bisa memilih beberapa playlist sekaligus. Ketuk lagi pada yang sudah berisi
 * lagu ini untuk menghapusnya. "Selesai" menutup sheet dan merangkum perubahannya di toast.
 */
export default function AddToPlaylistPicker({ track, onBack, onDone }: AddToPlaylistPickerProps) {
  const { playlists, addTrack, removeTrack, createPlaylist } = useMyPlaylists()
  const [creating, setCreating] = useState(playlists.length === 0)
  const [flashId, setFlashId] = useState<string | null>(null)
  /** Konfirmasi terakhir per playlist (tampil di keterangan barisnya). */
  const [notes, setNotes] = useState<Record<string, string>>({})
  /** Status terbaca pembaca layar + teks di bawah daftar. */
  const [status, setStatus] = useState('')
  const [saved, setSaved] = useState<string[]>([])
  const [removed, setRemoved] = useState<string[]>([])
  const identity = trackIdentity(track)

  const confirm = (id: string | null, ok: boolean, message: string) => {
    buzz(ok ? 12 : [30, 40, 30])
    setFlashId(id)
    setStatus(message)
    if (id) setNotes((prev) => ({ ...prev, [id]: message }))
  }

  const addTo = (id: string, name: string) => {
    const result = addTrack(id, track)
    if (!result.ok) return confirm(id, false, myPlaylistErrorText(result.reason))
    setSaved((prev) => [...prev.filter((item) => item !== name), name])
    setRemoved((prev) => prev.filter((item) => item !== name))
    confirm(id, true, `Disimpan ke “${name}”`)
  }

  /** Lagu sudah ada di playlist ini: ketukan kedua melepasnya lagi (hanya dari playlist itu). */
  const removeFrom = (id: string, name: string) => {
    const tracks = playlists.find((item) => item.id === id)?.tracks ?? []
    const stored = tracks.find((item) => trackIdentity(item) === identity)
    if (!stored) return confirm(null, false, myPlaylistErrorText('missing'))
    const result = removeTrack(id, stored.id)
    if (!result.ok) return confirm(id, false, myPlaylistErrorText(result.reason))
    setRemoved((prev) => [...prev.filter((item) => item !== name), name])
    setSaved((prev) => prev.filter((item) => item !== name))
    confirm(id, true, `Dihapus dari “${name}”`)
  }

  const create = (name: string): string | null => {
    const made = createPlaylist(name)
    if (!made.ok) return myPlaylistErrorText(made.reason)
    const added = addTrack(made.value.id, track)
    if (!added.ok) return myPlaylistErrorText(added.reason)
    setSaved((prev) => [...prev, made.value.name])
    setCreating(false)
    confirm(made.value.id, true, `Playlist “${made.value.name}” dibuat dan lagu disimpan`)
    return null
  }

  const finish = () => {
    const parts: string[] = []
    if (saved.length > 0) parts.push(`Disimpan ke ${saved.map((name) => `“${name}”`).join(', ')}`)
    if (removed.length > 0) parts.push(`dihapus dari ${removed.map((name) => `“${name}”`).join(', ')}`)
    if (parts.length === 0) return onBack()
    const text = parts.join('; ')
    onDone(text.charAt(0).toUpperCase() + text.slice(1))
  }

  return (
    <div>
      <div className="flex items-center gap-1 px-2 pb-2">
        <button type="button" onClick={onBack} aria-label="Kembali ke opsi lagu" className="icon-btn">
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <p className="min-w-0 flex-1 text-sm font-semibold text-ink">Simpan ke playlist saya</p>
        <button type="button" onClick={finish} className="btn-primary mr-2 h-9 px-4 text-sm">
          Selesai
        </button>
      </div>
      <ul className="mv-list max-h-[40dvh] overflow-y-auto border-t border-line px-2 pt-2">
        {playlists.map((playlist) => {
          const has = playlist.tracks.some((item) => trackIdentity(item) === identity)
          return (
            <Action
              key={playlist.id}
              icon={has ? Check : ListMusic}
              iconClassName={flashId === playlist.id ? 'animate-pop' : undefined}
              label={playlist.name}
              hint={notes[playlist.id] ? `${notes[playlist.id]}${has ? ' · ketuk lagi untuk menghapus' : ''}` : has ? 'Sudah ada di sini · ketuk untuk menghapus' : `${playlist.tracks.length} lagu`}
              onClick={() => (has ? removeFrom(playlist.id, playlist.name) : addTo(playlist.id, playlist.name))}
            />
          )
        })}
      </ul>
      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>
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
