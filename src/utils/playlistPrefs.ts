import { readJson, writeJson } from './safeStorage'

const KEY = 'musicverse:playlist-prefs:v1'

export interface PlaylistPrefs {
  /** Playlist Spotify yang baru berhasil dibuka langsung dibuat sebagai playlist (tab Playlist). Bawaan: mati. */
  autoAddOpened: boolean
  /** Minta konfirmasi sebelum memindahkan lagu (pindah = dihapus dari playlist asal). Bawaan: menyala. */
  confirmMove: boolean
}

const DEFAULTS: PlaylistPrefs = { autoAddOpened: false, confirmMove: true }

function load(): PlaylistPrefs {
  const out = readJson(KEY)
  if (out.status !== 'ok' || typeof out.value !== 'object' || out.value === null) return DEFAULTS
  const value = out.value as Record<string, unknown>
  return {
    autoAddOpened: value.autoAddOpened === true,
    confirmMove: value.confirmMove !== false,
  }
}

let prefs = load()
const listeners = new Set<() => void>()

export function getPlaylistPrefs(): PlaylistPrefs {
  return prefs
}

export function setPlaylistPrefs(patch: Partial<PlaylistPrefs>): void {
  prefs = { ...prefs, ...patch }
  writeJson(KEY, prefs)
  for (const listener of [...listeners]) listener()
}

export function subscribePlaylistPrefs(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
