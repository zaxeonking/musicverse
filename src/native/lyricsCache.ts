import type { LyricsResult } from '../services/lyricsApi'
import { providerSignature } from '../utils/lyricProviderPrefs'
import { parseResult } from './offlineLyrics'

/**
 * Cache lirik persisten untuk SEMUA lagu (bukan hanya unduhan), di IndexedDB, supaya lagu streaming tidak dicari ulang
 * tiap sesi. LRU ±LIMIT lagu, kedaluwarsa TTL_MS. Aturan:
 *  - "tidak ditemukan" TIDAK disimpan (supaya bisa dicari lagi), sama seperti cache offline;
 *  - entri menyimpan tanda provider (`sig`); bila pengaturan provider berubah, entri lama dianggap basi, jadi menyalakan
 *    "Lirik per kata" tidak tertahan oleh cache LRC lama;
 *  - SEMUA operasi best-effort: IndexedDB tidak ada / gagal = diam-diam dianggap tidak ada cache, tidak pernah melempar.
 */

const DB_NAME = 'musicverse-lyrics'
const STORE = 'lyrics'
const LIMIT = 500
const TTL_MS = 30 * 24 * 60 * 60 * 1000

interface Entry {
  key: string
  at: number
  sig: string
  result: unknown
}

let dbPromise: Promise<IDBDatabase | null> | null = null

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null)
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'key' }).createIndex('at', 'at')
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
      req.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  return dbPromise
}

function done<T>(req: IDBRequest<T>): Promise<T | null> {
  return new Promise((resolve) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => resolve(null)
  })
}

const storable = (r: LyricsResult) => r.kind === 'synced' || r.kind === 'plain' || r.kind === 'instrumental'

export async function readCachedLyrics(key: string): Promise<LyricsResult | null> {
  try {
    const db = await openDb()
    if (!db) return null
    const entry = (await done(db.transaction(STORE, 'readonly').objectStore(STORE).get(key))) as Entry | null | undefined
    if (!entry || typeof entry.at !== 'number') return null
    if (Date.now() - entry.at > TTL_MS || entry.sig !== providerSignature()) return null
    const result = parseResult(entry.result)
    if (!result) return null
    // Sentuh `at` agar entri yang sering dipakai tidak terbuang oleh LRU.
    void done(db.transaction(STORE, 'readwrite').objectStore(STORE).put({ ...entry, at: Date.now() }))
    return result
  } catch {
    return null
  }
}

export async function saveCachedLyrics(key: string, result: LyricsResult): Promise<void> {
  if (!storable(result)) return
  try {
    const db = await openDb()
    if (!db) return
    const store = db.transaction(STORE, 'readwrite').objectStore(STORE)
    const entry: Entry = { key, at: Date.now(), sig: providerSignature(), result }
    await done(store.put(entry))
    const count = (await done(db.transaction(STORE, 'readonly').objectStore(STORE).count())) ?? 0
    if (count > LIMIT) await trim(db, count - LIMIT)
  } catch {
    // Cache gagal = tidak masalah.
  }
}

/** Hapus `n` entri terlama (indeks `at` urut naik). */
function trim(db: IDBDatabase, n: number): Promise<void> {
  return new Promise((resolve) => {
    try {
      const req = db.transaction(STORE, 'readwrite').objectStore(STORE).index('at').openCursor()
      let left = n
      req.onsuccess = () => {
        const cursor = req.result
        if (!cursor || left <= 0) return resolve()
        cursor.delete()
        left -= 1
        cursor.continue()
      }
      req.onerror = () => resolve()
    } catch {
      resolve()
    }
  })
}

/** Kosongkan seluruh cache lirik persisten. */
export async function clearCachedLyrics(): Promise<void> {
  try {
    const db = await openDb()
    if (db) await done(db.transaction(STORE, 'readwrite').objectStore(STORE).clear())
  } catch {
    // abaikan
  }
}
