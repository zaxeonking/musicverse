import { myPlaylistErrorText, useMyPlaylists } from '../context/MyPlaylistsContext'
import { useTrackMenu } from '../context/TrackMenuContext'
import type { PlaylistTrack } from '../types/spotify'
import { QUEUE_RESULT_TEXT } from '../utils/queueResultText'
import { usePlayerActions } from './useAudioPlayer'
import { OFFLINE_BLOCK_TEXT, useOfflineBlock } from './useOfflineBlock'
import { useSwipeSelect, type SwipeHint } from './useSwipeSelect'

interface TrackSwipeOptions {
  /** Baris ini hasil pencarian: boleh dicampur ke antrean yang sedang berjalan (sama seperti menu lagu). */
  fromSearch?: boolean
  /** Mode pilih banyak aktif: geser (kanan atau kiri) memilih / batal pilih lagu, bukan antrean / suka. */
  selecting?: boolean
  onToggleSelect?: (track: PlaylistTrack) => void
  /** ID lagu yang sedang terpilih (mode pilih): petunjuk berganti jadi "Batal" untuk lagu itu. */
  selectedIds?: ReadonlySet<string>
}

/**
 * Geser pada baris lagu (pola sama dengan geser pada playlist, animasi sama):
 * kanan = tambah ke antrean, kiri = suka / batal suka (Lagu Disukai).
 * Dalam mode pilih banyak: kedua arah = pilih / batal pilih.
 * `resolve(index)` = lagu pada baris ke-`index` dari `<ul>` yang digeser.
 */
export function useTrackSwipe(resolve: (index: number) => PlaylistTrack | undefined, options: TrackSwipeOptions = {}) {
  const { fromSearch = false, selecting = false, onToggleSelect, selectedIds } = options
  const actions = usePlayerActions()
  const { toggleLike, isLiked } = useMyPlaylists()
  const { showToast } = useTrackMenu()
  const blocked = useOfflineBlock()

  const hint = (index: number, direction: 1 | -1): SwipeHint | null => {
    const track = resolve(index)
    if (!track) return null
    if (selecting) return { icon: selectedIds?.has(track.id) ? 'unselect' : 'select', label: selectedIds?.has(track.id) ? 'Batal' : 'Pilih' }
    if (direction > 0) return blocked(track) ? { icon: 'blocked', label: 'Offline' } : { icon: 'queue', label: 'Antrean' }
    return isLiked(track) ? { icon: 'unlike', label: 'Batal suka' } : { icon: 'like', label: 'Suka' }
  }

  return useSwipeSelect((index, direction) => {
    const track = resolve(index)
    if (!track) return
    if (selecting) return onToggleSelect?.(track)
    if (direction > 0) {
      // Offline dan belum diunduh: tidak bisa diputar, jadi tidak ditambahkan ke antrean.
      if (blocked(track)) return showToast(OFFLINE_BLOCK_TEXT)
      const added = actions.addToQueue(track, { fromSearch })
      return showToast(QUEUE_RESULT_TEXT[added], undefined, added === 'added' || added === 'moved' ? 'added' : undefined)
    }
    const result = toggleLike(track)
    if (!result.ok) return showToast(myPlaylistErrorText(result.reason))
    showToast(result.value.liked ? 'Ditambahkan ke Lagu Disukai' : 'Dihapus dari Lagu Disukai', undefined, result.value.liked ? 'like' : 'unlike')
  }, hint)
}
