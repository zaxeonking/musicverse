import { useSyncExternalStore } from 'react'
import { getPlaylistPrefs, setPlaylistPrefs, subscribePlaylistPrefs, type PlaylistPrefs } from '../utils/playlistPrefs'

/** Pengaturan playlist; semua pemakai ikut berubah begitu satu tempat mengubahnya. */
export function usePlaylistPrefs(): readonly [PlaylistPrefs, (patch: Partial<PlaylistPrefs>) => void] {
  const prefs = useSyncExternalStore(subscribePlaylistPrefs, getPlaylistPrefs, getPlaylistPrefs)
  return [prefs, setPlaylistPrefs] as const
}
