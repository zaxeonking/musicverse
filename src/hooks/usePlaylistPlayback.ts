import { Pause, Play, type LucideIcon } from 'lucide-react'
import { useAudioPlayer } from './useAudioPlayer'
import { getRowActivity } from '../utils/playerStatus'
import type { PlaylistTrack } from '../types/spotify'

/**
 * Tombol utama (Putar semua) ikut keadaan pemutar: bila lagu yang sedang aktif ada di daftar ini, ikonnya menjadi Jeda saat
 * memutar dan mengetuknya menjeda; saat dijeda ikonnya Putar dan mengetuknya melanjutkan (bukan mengulang dari awal).
 * Daftar lain / pemutar berhenti / selesai / galat: Putar semua seperti biasa.
 */
export function usePlaylistPlayback(tracks: readonly PlaylistTrack[]): {
  icon: LucideIcon
  label: string
  /** Ketuk: jeda / lanjut bila daftar ini sedang aktif, selain itu `playFresh`. */
  onPress: (playFresh: () => void) => void
} {
  const player = useAudioPlayer()
  const currentId = player.currentTrack?.id ?? null
  const inThisList = currentId !== null && tracks.some((track) => track.id === currentId)
  const activity = inThisList ? getRowActivity(player.status) : 'none'
  const running = activity === 'playing' || activity === 'loading'
  const resumable = running || activity === 'paused'
  return {
    icon: running ? Pause : Play,
    label: running ? 'Jeda' : activity === 'paused' ? 'Lanjutkan' : 'Putar semua',
    onPress: (playFresh) => (resumable ? player.togglePlayPause() : playFresh()),
  }
}
