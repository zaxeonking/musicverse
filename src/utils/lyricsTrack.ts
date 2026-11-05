import type { PlaybackInfo, PlaylistTrack } from '../types/spotify'

/**
 * Lagu yang dipakai untuk mencari lirik: lagu yang BENAR-BENAR terdengar. Jika server memberi audio lagu lain, datanya
 * dipakai; dan durasinya durasi playlist (audio wajib sama dengan playlist).
 */
export function lyricsTrackFor(
  currentTrack: PlaylistTrack | null,
  playbackInfo: PlaybackInfo | null | undefined,
  sameTrack: (a: PlaylistTrack, b: PlaybackInfo) => boolean,
): PlaylistTrack | null {
  if (!currentTrack) return null
  let track: PlaylistTrack = currentTrack
  if (playbackInfo && !sameTrack(currentTrack, playbackInfo)) {
    track = { ...currentTrack, title: playbackInfo.title, artists: playbackInfo.artist, album: playbackInfo.album, duration: playbackInfo.duration }
  }
  // Durasi TIDAK diganti dengan durasi file audio: audio wajib sama dengan playlist, dan kunci pencarian yang berubah
  // di tengah jalan (saat durasi file baru terbaca) memicu pencarian lirik ulang sehingga lirik muncul telat.
  return track
}
