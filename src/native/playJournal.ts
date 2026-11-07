import type { PlaylistTrack } from '../types/spotify'
import { formatTime } from '../utils/formatTime'
import { MusicVerseNative } from './musicVerseNative'
import { isNativeApp } from './platform'

/**
 * Jurnal putar native (APK 0.5.46+): lagu yang diputar rantai native saat JS beku atau activity sudah dihancurkan.
 * JS tidak melihat lagu itu mulai, jadi Riwayat / "Baru diputar" bolong tanpa jurnal ini.
 */

export interface NativePlay {
  track: PlaylistTrack
  /** Epoch ms native memulai lagu itu. */
  at: number
}

/** Membaca jurnal. APK lama (tanpa fitur) atau web: daftar kosong. */
export async function readNativePlays(): Promise<{ plays: NativePlay[]; through: number }> {
  if (!isNativeApp()) return { plays: [], through: 0 }
  try {
    const { items } = await MusicVerseNative.playJournalRead()
    const plays: NativePlay[] = []
    let through = 0
    for (const raw of Array.isArray(items) ? items : []) {
      if (typeof raw !== 'object' || raw === null) continue
      if (typeof raw.at !== 'number' || typeof raw.id !== 'string' || !raw.id || typeof raw.title !== 'string' || !raw.title) continue
      through = Math.max(through, raw.at)
      plays.push({
        at: raw.at,
        track: {
          id: raw.id,
          title: raw.title,
          url: typeof raw.url === 'string' ? raw.url : '',
          artists: typeof raw.artist === 'string' ? raw.artist : '',
          album: typeof raw.album === 'string' ? raw.album : '',
          duration: typeof raw.durationMs === 'number' && raw.durationMs > 0 ? formatTime(raw.durationMs / 1000) : '',
          cover: typeof raw.cover === 'string' ? raw.cover : '',
        },
      })
    }
    return { plays, through }
  } catch {
    return { plays: [], through: 0 }
  }
}

/** Menghapus entri jurnal sampai `through` setelah masuk Riwayat. */
export async function ackNativePlays(through: number): Promise<void> {
  if (!isNativeApp() || through <= 0) return
  try {
    await MusicVerseNative.playJournalClear({ through })
  } catch {
    // Dicoba lagi pada sinkron berikutnya; entri yang sama dilewati oleh mergeNativePlays.
  }
}
