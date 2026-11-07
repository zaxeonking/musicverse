import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { flushNativeStorage } from '../native/nativeStorage'
import { MusicVerseNative } from '../native/musicVerseNative'
import { isNativeApp } from '../native/platform'

/**
 * Cadangan data: semua kunci localStorage milik aplikasi (Koleksi, Playlist saya, riwayat, equalizer, pengaturan)
 * disimpan ke satu berkas JSON. Indeks unduhan dan antrean unduhan sengaja tidak ikut: keduanya diturunkan dari
 * isi folder di perangkat dan akan salah bila dipulihkan di perangkat lain.
 */

const PREFIXES = ['musicverse:', 'mv:'] as const
const EXCLUDED = new Set([
  'musicverse:downloads:v1',
  'musicverse:download-queue:v1',
  'musicverse:update-dismissed:v1',
  'musicverse:apk-promo:v1',
])

export interface BackupFile {
  app: 'musicverse'
  version: 1
  exportedAt: number
  items: Record<string, string>
}

export interface BackupSummary {
  keys: number
  savedPlaylists: number
  myPlaylists: number
  recent: number
  plays: number
}

function included(key: string): boolean {
  return PREFIXES.some((p) => key.startsWith(p)) && !EXCLUDED.has(key)
}

export function buildBackup(): BackupFile {
  const items: Record<string, string> = {}
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i)
      if (key === null || !included(key)) continue
      const value = window.localStorage.getItem(key)
      if (value !== null) items[key] = value
    }
  } catch {
    // localStorage tidak bisa diakses: cadangan kosong.
  }
  return { app: 'musicverse', version: 1, exportedAt: Date.now(), items }
}

function countIn(items: Record<string, string>, key: string, field: string): number {
  try {
    const parsed = JSON.parse(items[key] ?? 'null') as Record<string, unknown> | null
    const list = parsed?.[field]
    return Array.isArray(list) ? list.length : 0
  } catch {
    return 0
  }
}

export function summarize(file: BackupFile): BackupSummary {
  return {
    keys: Object.keys(file.items).length,
    savedPlaylists: countIn(file.items, 'musicverse:library:v1', 'playlists'),
    myPlaylists: countIn(file.items, 'musicverse:my-playlists:v1', 'playlists'),
    recent: countIn(file.items, 'musicverse:recent:v1', 'items'),
    plays: countIn(file.items, 'musicverse:play-log:v1', 'items'),
  }
}

export function parseBackup(text: string): BackupFile | null {
  try {
    const raw = JSON.parse(text) as Record<string, unknown>
    if (raw.app !== 'musicverse' || raw.version !== 1 || typeof raw.items !== 'object' || raw.items === null) return null
    const items: Record<string, string> = {}
    for (const [key, value] of Object.entries(raw.items as Record<string, unknown>)) {
      if (typeof value === 'string' && included(key)) items[key] = value
    }
    if (Object.keys(items).length === 0) return null
    return {
      app: 'musicverse',
      version: 1,
      exportedAt: typeof raw.exportedAt === 'number' ? raw.exportedAt : 0,
      items,
    }
  } catch {
    return null
  }
}

/** Mengganti data aplikasi dengan isi cadangan, lalu memuat ulang halaman supaya semua konteks membaca ulang. */
export async function applyBackup(file: BackupFile): Promise<void> {
  const storage = window.localStorage
  const existing: string[] = []
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i)
    if (key !== null && included(key)) existing.push(key)
  }
  for (const key of existing) storage.removeItem(key)
  for (const [key, value] of Object.entries(file.items)) storage.setItem(key, value)
  if (isNativeApp()) await flushNativeStorage()
  window.location.reload()
}

function stamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
}

export type ExportResult = { ok: true; where: string } | { ok: false; message: string }

/** Web: unduh berkas. APK: tulis ke files/backup/ lalu buka lembar bagikan (simpan ke Drive, kirim ke chat, dll.). */
export async function exportBackup(): Promise<ExportResult> {
  const data = JSON.stringify(buildBackup())
  const name = `musicverse-backup-${stamp()}.json`
  if (!isNativeApp()) {
    const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = name
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
    return { ok: true, where: name }
  }
  try {
    await Filesystem.writeFile({
      path: `backup/${name}`,
      directory: Directory.External,
      data,
      encoding: Encoding.UTF8,
      recursive: true,
    })
  } catch {
    return { ok: false, message: 'Gagal menulis berkas cadangan.' }
  }
  try {
    await MusicVerseNative.shareFile({ path: `backup/${name}`, title: 'Simpan cadangan MusicVerse' })
    return { ok: true, where: name }
  } catch {
    return {
      ok: true,
      where: `Android/data/<nama paket>/files/backup/${name} (lembar bagikan butuh APK terbaru)`,
    }
  }
}
