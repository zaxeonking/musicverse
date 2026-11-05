import { MusicVerseNative } from './musicVerseNative'
import { isNativeApp } from './platform'

export type ConnectionType = 'wifi' | 'ethernet' | 'cellular' | 'other' | 'none' | 'unknown'

const KNOWN: readonly ConnectionType[] = ['wifi', 'ethernet', 'cellular', 'other', 'none']

/**
 * Jenis koneksi aktif. Di APK dibaca dari ConnectivityManager (plugin native); bila tidak tersedia (APK lama / browser)
 * dicoba `navigator.connection.type`. 'unknown' = tidak bisa ditentukan, dan TIDAK dianggap seluler.
 */
export async function readConnectionType(): Promise<ConnectionType> {
  if (isNativeApp()) {
    try {
      const result = await MusicVerseNative.getNetworkType()
      const type = result?.type as ConnectionType
      if (KNOWN.includes(type)) return type
    } catch {
      // Plugin lama tanpa metode ini: pakai cadangan di bawah.
    }
  }
  const connection = (navigator as Navigator & { connection?: { type?: string } }).connection
  const type = connection?.type as ConnectionType | undefined
  return type && KNOWN.includes(type) ? type : 'unknown'
}

/** Memanggil `listener` saat koneksi berubah (event online/offline dan, bila ada, navigator.connection). */
export function onConnectionChange(listener: () => void): () => void {
  window.addEventListener('online', listener)
  window.addEventListener('offline', listener)
  const connection = (navigator as Navigator & { connection?: EventTarget }).connection
  connection?.addEventListener?.('change', listener)
  return () => {
    window.removeEventListener('online', listener)
    window.removeEventListener('offline', listener)
    connection?.removeEventListener?.('change', listener)
  }
}

/**
 * Apakah HP sedang dicas: true / false, atau null bila tidak bisa dibaca (null TIDAK memblokir unduhan).
 * Di APK dari BatteryManager (plugin native); cadangan: navigator.getBattery().
 */
export async function readCharging(): Promise<boolean | null> {
  if (isNativeApp()) {
    try {
      const result = await MusicVerseNative.getPowerState()
      if (result?.known) return Boolean(result.charging)
    } catch {
      // Plugin lama tanpa metode ini: pakai cadangan di bawah.
    }
  }
  try {
    const nav = navigator as Navigator & { getBattery?: () => Promise<{ charging: boolean }> }
    if (typeof nav.getBattery === 'function') return (await nav.getBattery()).charging
  } catch {
    // Tidak tersedia.
  }
  return null
}
