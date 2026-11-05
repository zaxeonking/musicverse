import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { isNativeApp } from './platform'

/**
 * Penyimpanan data di APK: seluruh isi localStorage dicerminkan ke satu berkas JSON di
 *   Android/data/<nama paket>/files/data/musicverse-data.json
 * (Directory.External = getExternalFilesDir). Kode lain tetap memakai localStorage seperti biasa
 * (sinkron); berkas ini adalah salinan yang tahan terhadap "hapus cache" dan bisa dicadangkan.
 *
 * Alur:
 * 1. Saat start (sebelum React dirender): jika berkas ada, isinya dimuat ke localStorage (berkas menang).
 *    Jika belum ada (pertama kali / pindah dari versi lama), isi localStorage yang ada ditulis ke berkas.
 * 2. Setiap setItem/removeItem/clear pada localStorage dijadwalkan tulis ulang (ditunda 400 ms).
 * 3. Saat app disembunyikan/ditutup, tulis segera.
 */

const DATA_DIR = 'data'
const DATA_FILE = `${DATA_DIR}/musicverse-data.json`
const TMP_FILE = `${DATA_DIR}/musicverse-data.json.tmp`
const FLUSH_DELAY_MS = 400

let timer: number | null = null
let writing: Promise<void> = Promise.resolve()
let dirty = false
let installed = false

function snapshot(): Record<string, string> {
  const out: Record<string, string> = {}
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i)
      if (key === null) continue
      const value = window.localStorage.getItem(key)
      if (value !== null) out[key] = value
    }
  } catch {
    // localStorage tidak bisa diakses: tidak ada yang bisa disalin.
  }
  return out
}

async function writeSnapshot(): Promise<void> {
  const data = JSON.stringify({ version: 1, savedAt: Date.now(), items: snapshot() })
  // Tulis ke berkas sementara lalu ganti nama, supaya berkas utama tidak pernah setengah tertulis.
  await Filesystem.writeFile({
    path: TMP_FILE,
    directory: Directory.External,
    data,
    encoding: Encoding.UTF8,
    recursive: true,
  })
  try {
    await Filesystem.deleteFile({ path: DATA_FILE, directory: Directory.External })
  } catch {
    // Belum ada: tidak apa-apa.
  }
  await Filesystem.rename({
    from: TMP_FILE,
    to: DATA_FILE,
    directory: Directory.External,
    toDirectory: Directory.External,
  })
}

/** Menulis sekarang (berurutan, tidak pernah dua tulisan bersamaan). */
export function flushNativeStorage(): Promise<void> {
  if (timer !== null) {
    window.clearTimeout(timer)
    timer = null
  }
  if (!dirty) return writing
  dirty = false
  writing = writing
    .then(writeSnapshot)
    .catch((error: unknown) => {
      dirty = true
      console.warn('[MusicVerse] Gagal menulis data ke Android/data:', error)
    })
  return writing
}

function schedule(): void {
  dirty = true
  if (timer !== null) return
  timer = window.setTimeout(() => {
    timer = null
    void flushNativeStorage()
  }, FLUSH_DELAY_MS)
}

function installMirror(): void {
  if (installed) return
  installed = true
  const proto = Storage.prototype
  const { setItem, removeItem, clear } = proto
  proto.setItem = function patchedSetItem(this: Storage, key: string, value: string) {
    setItem.call(this, key, value)
    if (this === window.localStorage) schedule()
  }
  proto.removeItem = function patchedRemoveItem(this: Storage, key: string) {
    removeItem.call(this, key)
    if (this === window.localStorage) schedule()
  }
  proto.clear = function patchedClear(this: Storage) {
    clear.call(this)
    if (this === window.localStorage) schedule()
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flushNativeStorage()
  })
  window.addEventListener('pagehide', () => void flushNativeStorage())
}

/**
 * Panggil sekali sebelum render pertama. Tidak pernah melempar error: jika berkas tidak bisa dibaca,
 * aplikasi lanjut memakai localStorage biasa.
 */
export async function initNativeStorage(): Promise<void> {
  if (!isNativeApp()) return
  try {
    let restored = false
    try {
      const file = await Filesystem.readFile({ path: DATA_FILE, directory: Directory.External, encoding: Encoding.UTF8 })
      const text = typeof file.data === 'string' ? file.data : await file.data.text()
      const parsed = JSON.parse(text) as { items?: Record<string, unknown> }
      if (parsed && typeof parsed.items === 'object' && parsed.items !== null) {
        for (const [key, value] of Object.entries(parsed.items)) {
          if (typeof value === 'string') window.localStorage.setItem(key, value)
        }
        restored = true
      }
    } catch {
      // Berkas belum ada atau rusak: pakai isi localStorage saat ini.
    }
    installMirror()
    if (!restored) schedule()
  } catch (error) {
    console.warn('[MusicVerse] Penyimpanan Android/data tidak aktif:', error)
  }
}
