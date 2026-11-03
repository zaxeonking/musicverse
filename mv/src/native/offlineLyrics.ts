import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { fetchLyrics, type LyricsResult } from '../services/lyricsApi'
import type { PlaylistTrack } from '../types/spotify'
import { findDownloaded, getOfflineState, LYRICS_DIR, toPlaylistTrack } from './offline'
import { isNativeApp } from './platform'

/**
 * Lirik offline (APK). Lirik lagu yang diunduh disimpan sebagai berkas JSON di
 *   Android/data/<nama paket>/files/download/lyrics/<kunci>.json
 * sehingga tampil (lengkap dengan sorotan baris berwaktu) tanpa internet. Sumbernya:
 *  1. saat lagu selesai diunduh,
 *  2. saat lirik lagu unduhan berhasil dimuat dari internet (mengisi lagu yang diunduh sebelum fitur ini),
 *  3. latar belakang: lagu unduhan yang belum punya lirik dicarikan saat ada koneksi.
 * Hasil "tidak ditemukan" tidak disimpan supaya bisa dicari lagi nanti.
 */

const FILE_VERSION = 1

function pathFor(key: string): string {
  return `${LYRICS_DIR}/${key}.json`
}

function isStorable(result: LyricsResult): boolean {
  return result.kind === 'synced' || result.kind === 'plain' || result.kind === 'instrumental'
}

function isLine(value: unknown): boolean {
  return typeof value === 'object' && value !== null && typeof (value as { time?: unknown }).time === 'number' && typeof (value as { text?: unknown }).text === 'string'
}

/** Memastikan isi berkas masih bentuk LyricsResult yang valid (berkas bisa rusak / diubah manual). */
function parseResult(value: unknown): LyricsResult | null {
  if (typeof value !== 'object' || value === null) return null
  const v = value as Record<string, unknown>
  if (v.kind === 'instrumental') return { kind: 'instrumental' }
  const duration = typeof v.duration === 'number' && Number.isFinite(v.duration) ? v.duration : null
  if (v.kind === 'plain') {
    if (!Array.isArray(v.lines) || v.lines.length === 0 || !v.lines.every((l) => typeof l === 'string')) return null
    return { kind: 'plain', lines: v.lines as string[], duration }
  }
  if (v.kind === 'synced') {
    if (!Array.isArray(v.lines) || v.lines.length === 0 || !v.lines.every(isLine)) return null
    const alternatives = Array.isArray(v.alternatives)
      ? v.alternatives
          .filter((a): a is { lines: unknown[]; duration: unknown } => typeof a === 'object' && a !== null && Array.isArray((a as { lines?: unknown }).lines))
          .filter((a) => a.lines.length > 0 && a.lines.every(isLine))
          .map((a) => ({
            lines: a.lines as { time: number; text: string }[],
            duration: typeof a.duration === 'number' && Number.isFinite(a.duration) ? a.duration : null,
          }))
      : []
    return { kind: 'synced', lines: v.lines as { time: number; text: string }[], duration, alternatives }
  }
  return null
}

/** Lirik tersimpan untuk lagu unduhan ini, atau null (bukan lagu unduhan / belum disimpan / rusak). */
export async function readOfflineLyrics(track: { title: string; artists?: string; url?: string }): Promise<LyricsResult | null> {
  if (!isNativeApp()) return null
  const item = findDownloaded(track)
  if (!item) return null
  try {
    const file = await Filesystem.readFile({ path: pathFor(item.key), directory: Directory.External, encoding: Encoding.UTF8 })
    const text = typeof file.data === 'string' ? file.data : ''
    return parseResult((JSON.parse(text) as { result?: unknown }).result)
  } catch {
    return null
  }
}

/** Menyimpan lirik lagu unduhan. Tidak melakukan apa pun untuk lagu yang belum diunduh atau hasil "tidak ditemukan". */
export async function saveOfflineLyrics(track: { title: string; artists?: string; url?: string }, result: LyricsResult): Promise<void> {
  if (!isNativeApp() || !isStorable(result)) return
  const item = findDownloaded(track)
  if (!item) return
  await writeLyricsFile(item.key, result)
}

async function writeLyricsFile(key: string, result: LyricsResult): Promise<void> {
  try {
    await Filesystem.writeFile({
      path: pathFor(key),
      directory: Directory.External,
      data: JSON.stringify({ version: FILE_VERSION, savedAt: Date.now(), result }),
      encoding: Encoding.UTF8,
      recursive: true,
    })
  } catch (error) {
    console.warn('[MusicVerse] Lirik offline gagal disimpan:', error)
  }
}

/** Dipanggil pengunduh setelah lagu selesai: cari lirik lalu simpan (usaha terbaik, tidak menggagalkan unduhan). */
export async function fetchAndSaveLyrics(track: PlaylistTrack, key: string): Promise<boolean> {
  if (!isNativeApp()) return false
  try {
    const result = await fetchLyrics(track, { signal: new AbortController().signal })
    if (!isStorable(result)) return false
    await writeLyricsFile(key, result)
    return true
  } catch {
    return false
  }
}

async function hasLyricsFile(key: string): Promise<boolean> {
  try {
    await Filesystem.stat({ path: pathFor(key), directory: Directory.External })
    return true
  } catch {
    return false
  }
}

let backfilling = false
let backfillInstalled = false
/** Lagu yang sudah dicoba pada sesi ini dan hasilnya tidak ada: jangan diulang terus-menerus. */
const triedWithoutLuck = new Set<string>()

/** Mencarikan lirik untuk lagu unduhan yang belum punya, satu per satu, hanya saat ada koneksi. */
export async function backfillOfflineLyrics(): Promise<void> {
  if (!isNativeApp() || backfilling || !navigator.onLine) return
  backfilling = true
  try {
    for (const item of getOfflineState().items) {
      if (!navigator.onLine) break
      if (triedWithoutLuck.has(item.key) || (await hasLyricsFile(item.key))) continue
      const saved = await fetchAndSaveLyrics(toPlaylistTrack(item), item.key)
      if (!saved) triedWithoutLuck.add(item.key)
    }
  } finally {
    backfilling = false
  }
}

/** Menjalankan backfill sekarang dan lagi setiap koneksi kembali. Aman dipanggil berulang. */
export function startLyricsBackfill(): void {
  if (!isNativeApp()) return
  void backfillOfflineLyrics()
  if (backfillInstalled) return
  backfillInstalled = true
  window.addEventListener('online', () => void backfillOfflineLyrics())
}
