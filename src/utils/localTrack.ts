/**
 * Lagu LOKAL = audio yang sudah ada di HP (MediaStore) di luar unduhan MusicVerse. Identitasnya `url` = `local:<id MediaStore>`
 * (angka). Modul ini murni (tanpa impor native) supaya bisa dipakai `offline.ts` untuk kunci lagu tanpa siklus impor.
 */
export const LOCAL_URL_PREFIX = 'local:'
/** Awalan kunci lagu lokal (`trackKey`): tidak pernah bentrok dengan `sp-` / `tt-` milik unduhan. */
export const LOCAL_KEY_PREFIX = 'lc-'

/** ID MediaStore dari url lagu lokal; null bila bukan lagu lokal. */
export function localIdOf(url: string | undefined | null): string | null {
  if (!url || !url.startsWith(LOCAL_URL_PREFIX)) return null
  const id = url.slice(LOCAL_URL_PREFIX.length)
  return /^\d{1,18}$/.test(id) ? id : null
}

export function isLocalTrackUrl(url: string | undefined | null): boolean {
  return localIdOf(url) !== null
}

export function localUrlFor(id: string): string {
  return `${LOCAL_URL_PREFIX}${id}`
}

/** URI konten MediaStore yang dibaca langsung oleh ExoPlayer (izin audio dipegang aplikasi). */
export function localAudioUri(id: string): string {
  return `content://media/external/audio/media/${id}`
}
