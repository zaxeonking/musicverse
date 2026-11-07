import type { PlaylistTrack } from '../types/spotify'
import { formatDurationMs } from '../plugins/spotifyImporter'
import { MusicVerseNative, type NativeRadioExtra } from './musicVerseNative'
import { isNativeApp } from './platform'

/**
 * Tambahan radio yang dicari native saat JS beku (APK 0.5.42+, langkah 2b). Native memberi lagu-lagu itu indeks antrean
 * `tailIndex`, `tailIndex + 1`, ... (panjang antrean JS saat itu). Begitu app bangun, JS HARUS memasukkannya ke antrean
 * lebih dulu: kalau tidak, indeks / id lagu yang dipakai native tidak cocok dengan antrean JS dan pemulihan sesi salah.
 */

/** Membaca daftar tambahan native (urut indeks). APK lama, web, atau kosong: daftar kosong. */
export async function readRadioExtras(): Promise<NativeRadioExtra[]> {
  if (!isNativeApp()) return []
  try {
    const { items } = await MusicVerseNative.radioExtrasRead()
    if (!Array.isArray(items)) return []
    return items
      .filter((x) => typeof x === 'object' && x !== null && Number.isInteger(x.index) && typeof x.id === 'string' && x.id && typeof x.title === 'string' && x.title)
      .sort((a, b) => a.index - b.index)
  } catch {
    return []
  }
}

/** Mengosongkan daftar di native setelah masuk antrean JS (atau dibuang). Gagal tidak masalah: dibaca ulang berikutnya. */
export async function ackRadioExtras(): Promise<void> {
  if (!isNativeApp()) return
  try {
    await MusicVerseNative.radioExtrasClear()
  } catch {
    // diabaikan
  }
}

/**
 * Lagu yang harus ditambahkan ke ujung `queue`, atau null bila daftar tidak cocok dengan antrean ini.
 * Cocok = lagu pertama bernomor tepat `queue.length` (antrean JS tidak berubah sejak native mencari) dan indeksnya berurutan.
 * Lagu yang idnya sudah ada di antrean dilewati (JS sudah menambahkannya sendiri).
 */
export function extrasToAppend(queue: readonly PlaylistTrack[], extras: readonly NativeRadioExtra[]): PlaylistTrack[] | null {
  if (extras.length === 0) return []
  if (extras[0].index !== queue.length) return null
  for (let i = 1; i < extras.length; i += 1) if (extras[i].index !== extras[i - 1].index + 1) return null
  const have = new Set(queue.map((track) => track.id))
  const out: PlaylistTrack[] = []
  for (const x of extras) {
    if (have.has(x.id)) continue
    have.add(x.id)
    out.push({
      id: x.id,
      title: x.title,
      artists: typeof x.artists === 'string' ? x.artists : '',
      album: typeof x.album === 'string' ? x.album : '',
      duration: typeof x.durationSec === 'number' && x.durationSec > 0 ? formatDurationMs(x.durationSec * 1000) : '',
      cover: typeof x.cover === 'string' ? x.cover : '',
      url: typeof x.url === 'string' ? x.url : '',
    })
  }
  return out
}

let merger: (() => Promise<boolean>) | null = null

/** Pemutar mendaftarkan fungsi yang memasukkan tambahan native ke antrean JS (lihat `mergeRadioExtras`). */
export function registerExtrasMerger(fn: (() => Promise<boolean>) | null): void {
  merger = fn
}

/**
 * Pengisi radio JS memanggil ini sebelum mencari: tambahan native yang belum masuk antrean harus masuk dulu, kalau tidak
 * radio JS menambah lagu yang sama / bentrok indeks. true = ada lagu ditambahkan (antrean berubah, pengisi mengulang nanti).
 */
export async function mergePendingExtras(): Promise<boolean> {
  return merger ? merger() : false
}
