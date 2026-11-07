import { useSyncExternalStore } from 'react'
import { getDisplayPrefs, subscribeDisplayPrefs, type LyricDisplayPrefs } from '../utils/lyricDisplayPrefs'

/** Preferensi tampilan terjemahan / romanisasi lirik; komponen ter-render ulang seketika saat pengaturan diubah. */
export function useLyricDisplayPrefs(): LyricDisplayPrefs {
  return useSyncExternalStore(subscribeDisplayPrefs, getDisplayPrefs, getDisplayPrefs)
}
