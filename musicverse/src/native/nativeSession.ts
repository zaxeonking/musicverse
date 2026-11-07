import type { PlaylistTrack } from '../types/spotify'
import { MusicVerseNative, type NativeSessionInfo } from './musicVerseNative'
import { isNativeApp } from './platform'

/**
 * Sesi pemutaran native (APK 0.5.49+). Saat activity dihancurkan Android (JS mati) pemutar native bisa terus jalan dan
 * pindah lagu sendiri, sedangkan penyimpanan JS tertinggal di lagu / posisi lama. Native mencatat lagu aktif + posisinya;
 * JS membacanya saat app dibuka lagi dan menyamakan diri.
 */

/** Membaca catatan sesi native. APK lama (tanpa fitur), web, atau tidak ada catatan: null. */
export async function readNativeSession(): Promise<NativeSessionInfo | null> {
  if (!isNativeApp()) return null
  try {
    const info = await MusicVerseNative.nativeSessionRead()
    if (!info || info.found !== true) return null
    if (typeof info.title !== 'string' || !info.title) return null
    return info
  } catch {
    return null
  }
}

/** Menghapus catatan setelah diadopsi. Gagal tidak masalah: pembaca berikutnya membandingkan waktu lagi. */
export async function ackNativeSession(): Promise<void> {
  if (!isNativeApp()) return
  try {
    await MusicVerseNative.nativeSessionClear()
  } catch {
    // diabaikan
  }
}

function norm(text: string): string {
  return text.trim().toLowerCase()
}

/**
 * Mencari indeks lagu di antrean yang sama dengan catatan native. Urutan kepercayaan: id lagu, lalu judul + artis
 * (lagu yang dimuat JS tidak punya id di native), dengan indeks petunjuk dipakai untuk memilih bila ada beberapa yang sama.
 * null = tidak ketemu: jangan mengubah apa pun.
 */
export function matchSessionIndex(queue: readonly PlaylistTrack[], session: NativeSessionInfo, current: number | null): number | null {
  if (session.trackId) {
    const byId = queue.findIndex((t) => t.id === session.trackId)
    if (byId !== -1) return byId
  }
  const title = norm(session.title ?? '')
  if (!title) return null
  const artist = norm(session.artist ?? '')
  const hits: number[] = []
  queue.forEach((t, i) => {
    if (norm(t.title) !== title) return
    if (artist && t.artists && norm(t.artists) !== artist) return
    hits.push(i)
  })
  if (hits.length === 0) return null
  if (hits.length === 1) return hits[0]
  const hint = session.index
  if (typeof hint === 'number' && hits.includes(hint)) return hint
  return current !== null && hits.includes(current) ? current : hits[0]
}
