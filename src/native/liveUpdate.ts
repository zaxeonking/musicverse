import { GITHUB_REPO } from '../config/apk'
import { MusicVerseNative } from './musicVerseNative'
import { isNativeApp } from './platform'

/**
 * Pembaruan tampilan tanpa APK baru (OTA). Tiap push ke GitHub, .github/workflows/ota.yml membuat paket web (dist) dan
 * mengunggahnya ke Release `ota` di repo rilis. Di sini aplikasi:
 *  1. memanggil notifyAppReady (tanda "paket ini berjalan"; tanpa ini plugin mundur ke paket sebelumnya),
 *  2. memeriksa ota.json, mengunduh paket yang lebih baru di latar belakang,
 *  3. menjadwalkannya untuk dipakai saat aplikasi dibuka ulang (tidak memuat ulang di tengah lagu).
 * Paket hanya dipasang bila (a) lebih baru dari paket yang sedang berjalan dan (b) sidik jari native-nya sama dengan APK
 * ini; berbeda = ada perubahan native, perlu APK baru (urusan banner pembaruan APK, bukan di sini).
 */

const CHECK_EVERY_MS = 30 * 60_000
const FIRST_CHECK_DELAY_MS = 8_000
const READY_DELAY_MS = 2_500

interface UpdaterBundle {
  id: string
  version: string
}

/** Bagian API @capgo/capacitor-updater yang dipakai (diketik sendiri supaya build tidak rusak oleh perbedaan tipe antarversi). */
interface UpdaterLike {
  notifyAppReady(): Promise<unknown>
  download(options: { url: string; version: string }): Promise<UpdaterBundle>
  next(options: { id: string }): Promise<unknown>
  list(): Promise<{ bundles: UpdaterBundle[] }>
  current(): Promise<{ bundle: UpdaterBundle }>
  delete(options: { id: string }): Promise<unknown>
}

interface OtaManifest {
  builtAt: number
  nativeHash: string
}

const BASE = GITHUB_REPO ? `https://github.com/${GITHUB_REPO}/releases/download/ota` : ''

let started = false
let lastCheckAt = 0
let busy = false

async function loadUpdater(): Promise<UpdaterLike> {
  const mod = await import('@capgo/capacitor-updater')
  return mod.CapacitorUpdater as unknown as UpdaterLike
}

async function fetchManifest(): Promise<OtaManifest | null> {
  const response = await fetch(`${BASE}/ota.json?t=${Date.now()}`, { cache: 'no-store' })
  if (!response.ok) return null
  const data = (await response.json()) as Partial<OtaManifest>
  if (typeof data.builtAt !== 'number' || !Number.isFinite(data.builtAt)) return null
  if (typeof data.nativeHash !== 'string' || data.nativeHash.length === 0) return null
  return { builtAt: data.builtAt, nativeHash: data.nativeHash }
}

async function check(updater: UpdaterLike): Promise<void> {
  if (busy) return
  busy = true
  lastCheckAt = Date.now()
  try {
    const manifest = await fetchManifest()
    if (!manifest) return
    // Jangan pernah mundur: paket yang sedang berjalan (bawaan APK atau OTA sebelumnya) sudah sama baru atau lebih baru.
    if (manifest.builtAt <= __BUILD_TIME__) return
    const mine = await MusicVerseNative.nativeHash().catch(() => null)
    if (!mine || !mine.hash || mine.hash !== manifest.nativeHash) return
    const version = String(manifest.builtAt)
    const known = await updater.list().catch(() => ({ bundles: [] as UpdaterBundle[] }))
    if (known.bundles.some((bundle) => bundle.version === version)) return // sudah diunduh, menunggu aplikasi dibuka ulang
    const bundle = await updater.download({ url: `${BASE}/bundle.zip`, version })
    await updater.next({ id: bundle.id })
    // Rapikan paket lama supaya tidak menumpuk di penyimpanan.
    const current = await updater.current().catch(() => null)
    const after = await updater.list().catch(() => ({ bundles: [] as UpdaterBundle[] }))
    for (const old of after.bundles) {
      if (old.id === bundle.id || old.id === current?.bundle.id || old.id === 'builtin') continue
      await updater.delete({ id: old.id }).catch(() => undefined)
    }
    console.info(`[MusicVerse] Pembaruan tampilan ${version} diunduh; dipakai saat aplikasi dibuka ulang.`)
  } catch (error) {
    console.warn('[MusicVerse] Cek pembaruan tampilan gagal:', error)
  } finally {
    busy = false
  }
}

/** Dipanggil sekali setelah render pertama. Tanpa plugin / repo rilis / di web: tidak melakukan apa pun. */
export function startLiveUpdate(): void {
  if (started || !isNativeApp() || !BASE) return
  started = true
  void (async () => {
    let updater: UpdaterLike
    try {
      updater = await loadUpdater()
    } catch {
      return
    }
    // Harus dipanggil setelah UI benar-benar tampil; bila paket baru macet sebelum ini, plugin otomatis mundur.
    window.setTimeout(() => void updater.notifyAppReady().catch(() => undefined), READY_DELAY_MS)
    window.setTimeout(() => void check(updater), FIRST_CHECK_DELAY_MS)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && Date.now() - lastCheckAt > CHECK_EVERY_MS) void check(updater)
    })
  })()
}
