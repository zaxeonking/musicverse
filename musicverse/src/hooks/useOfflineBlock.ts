import { useMemo } from 'react'
import { trackKey, useOffline } from '../native/offline'
import type { PlaylistTrack } from '../types/spotify'
import { isLocalTrackUrl } from '../utils/localTrack'
import { useOnlineStatus } from './useOnlineStatus'

/** Pesan saat lagu yang belum diunduh ditekan ketika perangkat offline. */
export const OFFLINE_BLOCK_TEXT = 'Tidak ada internet. Lagu ini belum diunduh'

/**
 * Saat perangkat offline, lagu yang belum diunduh (dan bukan lagu dari folder Lokal) tidak bisa diputar.
 * Mengembalikan fungsi `(track) => boolean`: true = lagu ini diblokir. Saat online selalu false.
 */
export function useOfflineBlock(): (track: PlaylistTrack) => boolean {
  const online = useOnlineStatus()
  const { items } = useOffline()
  return useMemo(() => {
    if (online) return () => false
    const keys = new Set(items.map((item) => item.key))
    return (track: PlaylistTrack) => !isLocalTrackUrl(track.url) && !keys.has(trackKey(track))
  }, [online, items])
}
