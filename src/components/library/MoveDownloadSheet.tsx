import { Check, ListMusic, Music2, Plus } from 'lucide-react'
import { useRef, useState, type KeyboardEvent } from 'react'
import { myPlaylistErrorText, useMyPlaylists } from '../../context/MyPlaylistsContext'
import { useOverlayHistory } from '../../hooks/useOverlayHistory'
import { trackKey } from '../../native/offline'
import type { PlaylistTrack } from '../../types/spotify'
import { trackIdentity } from '../../utils/myPlaylistStorage'
import Action from '../player/SheetAction'
import NewPlaylistForm from './NewPlaylistForm'
import OverlayPortal from '../ui/OverlayPortal'

interface MoveDownloadSheetProps {
  track: PlaylistTrack
  /** Playlist tempat lagu ini sekarang (grup di tab Unduhan); kosong jika lagu satuan. */
  fromPlaylistId?: string
  onClose: () => void
  onToast: (message: string) => void
}

/**
 * Memindahkan lagu yang sudah diunduh ke playlist pilihan. Berkas unduhan tidak disentuh: yang berubah
 * hanya keanggotaan playlist. Memindah = masuk ke playlist tujuan lalu keluar dari playlist asal.
 */
export default function MoveDownloadSheet({ track, fromPlaylistId, onClose, onToast }: MoveDownloadSheetProps) {
  useOverlayHistory(true, onClose)
  const { playlists, getPlaylist, addTrack, removeTrack, createPlaylist } = useMyPlaylists()
  const [creating, setCreating] = useState(playlists.filter((p) => p.id !== fromPlaylistId).length === 0)
  const sheetRef = useRef<HTMLDivElement>(null)
  const identity = trackIdentity(track)
  const key = trackKey(track)

  /** Keluarkan dari playlist asal (salinan di playlist itu punya id berbeda, jadi dicari lewat kunci unduhan). */
  const leaveSource = (): void => {
    if (!fromPlaylistId) return
    const copy = getPlaylist(fromPlaylistId)?.tracks.find((item) => trackKey(item) === key)
    if (copy) removeTrack(fromPlaylistId, copy.id)
  }

  const moveTo = (id: string, name: string) => {
    const added = addTrack(id, track)
    // 'duplicate' = sudah ada di tujuan; tetap lanjut keluarkan dari asal supaya terasa dipindah.
    if (!added.ok && added.reason !== 'duplicate') {
      onToast(myPlaylistErrorText(added.reason))
      return
    }
    leaveSource()
    onToast(`Dipindahkan ke “${name}”`)
    onClose()
  }

  const create = (name: string): string | null => {
    const made = createPlaylist(name)
    if (!made.ok) return myPlaylistErrorText(made.reason)
    const added = addTrack(made.value.id, track)
    if (!added.ok) return myPlaylistErrorText(added.reason)
    leaveSource()
    onToast(`Playlist “${made.value.name}” dibuat dan lagu dipindahkan`)
    onClose()
    return null
  }

  const detach = () => {
    leaveSource()
    onToast('Dikeluarkan dari playlist, jadi lagu satuan')
    onClose()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      onClose()
    }
  }

  const targets = playlists.filter((playlist) => playlist.id !== fromPlaylistId)

  return (
    <OverlayPortal>
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 animate-fade-in bg-black/60" />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Pindahkan ${track.title} ke playlist`}
        onKeyDown={onKeyDown}
        className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-md animate-sheet-up rounded-t-2xl border-t border-line bg-card pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] shadow-2xl shadow-black/60 lg:bottom-6 lg:rounded-2xl lg:border"
      >
        <div className="px-4 pb-3 pt-4">
          <p className="text-sm font-semibold text-ink">Pindahkan ke playlist</p>
          <p className="truncate text-xs text-ink-muted">{track.title} · {track.artists}</p>
        </div>
        <ul className="max-h-[40dvh] overflow-y-auto border-t border-line px-2 pt-2">
          {fromPlaylistId && <Action icon={Music2} label="Lagu satuan" hint="Keluarkan dari playlist ini" onClick={detach} />}
          {targets.map((playlist) => {
            const has = playlist.tracks.some((item) => trackIdentity(item) === identity)
            return (
              <Action
                key={playlist.id}
                icon={has ? Check : ListMusic}
                label={playlist.name}
                hint={has ? 'Sudah ada di sini (pindah = keluar dari yang lama)' : `${playlist.tracks.length} lagu`}
                onClick={() => moveTo(playlist.id, playlist.name)}
              />
            )
          })}
        </ul>
        <div className="border-t border-line px-4 pt-3">
          {creating ? (
            <NewPlaylistForm onCreate={create} onCancel={targets.length > 0 ? () => setCreating(false) : undefined} submitLabel="Buat & pindahkan" />
          ) : (
            <button type="button" onClick={() => setCreating(true)} className="btn-secondary h-11 w-full text-sm">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Playlist baru
            </button>
          )}
        </div>
      </div>
    </OverlayPortal>
  )
}
