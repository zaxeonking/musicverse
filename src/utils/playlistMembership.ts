import type { MyPlaylist } from '../types/library'
import type { PlaylistTrack } from '../types/spotify'
import { trackIdentity } from './myPlaylistStorage'
import { isSameSong, songTitleKey } from './sameSong'

interface Entry {
  playlistId: string
  track: PlaylistTrack
}

/**
 * Indeks "lagu ini sudah ada di playlist mana" untuk seluruh playlist buatan pengguna (termasuk Lagu Disukai).
 * Dibangun sekali per perubahan playlist, lalu dipakai tiap baris lagu: pencarian per baris O(kandidat berjudul sama),
 * bukan menyisir semua lagu di semua playlist.
 *
 * Cocok bila ID Spotify / URL-nya sama, ATAU lagu yang sama menurut `isSameSong` (judul sama + artis beririsan), karena
 * lagu yang sama dari hasil Cari, album, daftar lagu artis, atau playlist bisa punya ID / URL berbeda.
 * Hasil: nama playlist (tanpa duplikat) menurut urutan `playlists`.
 */
export function buildPlaylistMembership(playlists: readonly MyPlaylist[]): (track: PlaylistTrack) => string[] {
  const byIdentity = new Map<string, Set<string>>()
  const byTitle = new Map<string, Entry[]>()
  const names = new Map<string, string>()
  const order: string[] = []

  for (const playlist of playlists) {
    names.set(playlist.id, playlist.name)
    order.push(playlist.id)
    for (const track of playlist.tracks) {
      const identity = trackIdentity(track)
      if (identity) {
        const set = byIdentity.get(identity) ?? new Set<string>()
        set.add(playlist.id)
        byIdentity.set(identity, set)
      }
      const key = songTitleKey(track)
      if (key) {
        const bucket = byTitle.get(key) ?? []
        bucket.push({ playlistId: playlist.id, track })
        byTitle.set(key, bucket)
      }
    }
  }

  return (track) => {
    const found = new Set<string>()
    const identity = trackIdentity(track)
    if (identity) byIdentity.get(identity)?.forEach((id) => found.add(id))
    const key = songTitleKey(track)
    if (key) {
      for (const entry of byTitle.get(key) ?? []) {
        if (!found.has(entry.playlistId) && isSameSong(entry.track, track)) found.add(entry.playlistId)
      }
    }
    if (found.size === 0) return []
    return order.filter((id) => found.has(id)).map((id) => names.get(id) ?? '').filter(Boolean)
  }
}
