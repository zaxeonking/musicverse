import { ChevronLeft, ListMusic, Plus } from 'lucide-react'
import { useState } from 'react'
import { myPlaylistErrorText, useMyPlaylists } from '../../context/MyPlaylistsContext'
import { usePlaylistPrefs } from '../../hooks/usePlaylistPrefs'
import type { MyPlaylist } from '../../types/library'
import type { TransferResult } from '../../utils/myPlaylistStorage'
import Action from '../player/SheetAction'
import NewPlaylistForm from './NewPlaylistForm'

interface PlaylistTransferPanelProps {
  /** Playlist asal. */
  source: MyPlaylist
  /** ID lagu di `source` yang diproses; null = semua lagunya. */
  trackIds: readonly string[] | null
  mode: 'copy' | 'move'
  onBack: () => void
  onDone: (message: string) => void
}

/** Teks hasil untuk toast; jujur soal lagu yang sudah ada atau tak muat. */
export function transferMessage(mode: 'copy' | 'move', targetName: string, result: TransferResult): string {
  const { added, duplicates, kept } = result
  if (mode === 'copy') {
    if (added === 0) return kept > 0 ? `Playlist “${targetName}” penuh, tidak ada lagu yang disalin` : `Semua lagu sudah ada di “${targetName}”`
    return `${added} lagu disalin ke “${targetName}”${duplicates > 0 ? `, ${duplicates} sudah ada` : ''}${kept > 0 ? `, ${kept} tidak muat` : ''}`
  }
  const moved = added + duplicates
  if (moved === 0) return `Playlist “${targetName}” penuh, tidak ada lagu yang dipindahkan`
  return `${moved} lagu dipindahkan ke “${targetName}”${kept > 0 ? `. ${kept} tetap di sini karena playlist tujuan penuh` : ''}`
}

/**
 * Memilih playlist tujuan untuk menyalin / memindahkan lagu (atau semua lagu) dari `source`. Pindah menghapus
 * lagu dari playlist asal, jadi (kecuali dimatikan di Pengaturan) diminta konfirmasi dulu.
 */
export default function PlaylistTransferPanel({ source, trackIds, mode, onBack, onDone }: PlaylistTransferPanelProps) {
  const { playlists, createPlaylist, transferTracks } = useMyPlaylists()
  const [prefs] = usePlaylistPrefs()
  const others = playlists.filter((item) => item.id !== source.id)
  const [creating, setCreating] = useState(others.length === 0)
  const [pending, setPending] = useState<{ id: string; name: string } | null>(null)

  const count = trackIds === null ? source.tracks.length : trackIds.length
  const verb = mode === 'copy' ? 'Salin' : 'Pindahkan'
  const title = `${verb} ${count === 1 ? '1 lagu' : `${count} lagu`} ke…`

  const run = (id: string, name: string) => {
    const result = transferTracks(source.id, id, trackIds, mode)
    onDone(result.ok ? transferMessage(mode, name, result.value) : myPlaylistErrorText(result.reason))
  }

  const choose = (item: MyPlaylist) => {
    if (mode === 'move' && prefs.confirmMove) setPending({ id: item.id, name: item.name })
    else run(item.id, item.name)
  }

  const create = (name: string): string | null => {
    const made = createPlaylist(name)
    if (!made.ok) return myPlaylistErrorText(made.reason)
    // Playlist yang baru dibuat dan masih kosong: tidak ada lagu yang hilang, jadi tidak perlu konfirmasi.
    run(made.value.id, made.value.name)
    return null
  }

  if (pending) {
    return (
      <div className="px-4 pb-2">
        <p className="text-sm text-ink">
          Pindahkan {count === 1 ? '1 lagu' : `${count} lagu`} ke “{pending.name}”?
        </p>
        <p className="mt-1 text-xs text-ink-muted">Lagunya dihapus dari “{source.name}”. Ini bisa dimatikan di Pengaturan &gt; Playlist.</p>
        <div className="mt-3 flex items-center justify-end gap-2">
          <button type="button" onClick={() => setPending(null)} className="btn-secondary px-4">
            Batal
          </button>
          <button type="button" onClick={() => run(pending.id, pending.name)} className="btn-primary px-4">
            Pindahkan
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-1 px-2 pb-2">
        <button type="button" onClick={onBack} aria-label="Kembali" className="icon-btn">
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <p className="text-sm font-semibold text-ink">{title}</p>
      </div>
      <ul className="max-h-[40dvh] overflow-y-auto border-t border-line px-2 pt-2">
        {others.map((item) => (
          <Action key={item.id} icon={ListMusic} label={item.name} hint={`${item.tracks.length} lagu`} onClick={() => choose(item)} />
        ))}
      </ul>
      <div className="border-t border-line px-4 pt-3">
        {creating ? (
          <NewPlaylistForm onCreate={create} onCancel={others.length > 0 ? () => setCreating(false) : undefined} submitLabel={mode === 'copy' ? 'Buat & salin' : 'Buat & pindahkan'} />
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
