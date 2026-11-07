import { App } from '@capacitor/app'
import { readJson, writeJson } from '../utils/safeStorage'
import { MusicVerseNative } from './musicVerseNative'
import { isNativeApp } from './platform'

/**
 * Izin agar pemutaran latar belakang tidak dibunuh/dibekukan sistem:
 *  1. Penghemat baterai: dialog sistem "Izinkan selalu berjalan di latar belakang".
 *  2. Android 11+: "Jeda aktivitas aplikasi jika tidak digunakan" harus dimatikan, kalau tidak sistem
 *     membekukan app (dan mencabut izin) ketika lama tidak dibuka, lalu musik mati sendiri.
 * Keduanya hanya bisa diubah pengguna, jadi kita arahkan langsung ke layarnya. Ditanya paling banyak
 * MAX_ASKS kali per jenis (jika pengguna menolak terus, tidak mengganggu selamanya).
 */

const ASKS_KEY = 'musicverse:bgGuardAsks'
const MAX_ASKS = 3

interface Asks {
  battery: number
  unused: number
}

function readAsks(): Asks {
  const out = readJson(ASKS_KEY)
  const raw = out.status === 'ok' && out.value && typeof out.value === 'object' ? (out.value as Partial<Asks>) : {}
  return { battery: Number(raw.battery) || 0, unused: Number(raw.unused) || 0 }
}

let running = false
let askedThisSession = false

async function ensureBackgroundPermissions(): Promise<void> {
  if (running || askedThisSession) return
  running = true
  try {
    const asks = readAsks()

    if (asks.battery < MAX_ASKS) {
      const { ignoring } = await MusicVerseNative.isIgnoringBatteryOptimizations()
      if (!ignoring) {
        writeJson(ASKS_KEY, { ...asks, battery: asks.battery + 1 })
        askedThisSession = true
        await MusicVerseNative.openBatterySettings()
        return // satu layar per kesempatan; yang berikutnya ditanya saat app dibuka lagi
      }
    }

    if (asks.unused < MAX_ASKS) {
      const { exempt } = await MusicVerseNative.isUnusedAppRestrictionExempt()
      if (!exempt) {
        const ok = window.confirm(
          'Agar musik tetap jalan di latar belakang, matikan "Jeda aktivitas aplikasi jika tidak digunakan" untuk MusicVerse.\n\n' +
            'Di layar berikutnya, matikan saklar tersebut, lalu kembali ke aplikasi.',
        )
        writeJson(ASKS_KEY, { ...asks, unused: asks.unused + 1 })
        askedThisSession = true
        if (ok) await MusicVerseNative.openUnusedAppRestrictionSettings()
      }
    }
  } catch {
    // APK lama (UNIMPLEMENTED) atau layar pengaturan tidak ada: abaikan
  } finally {
    running = false
  }
}

/** Dipanggil sekali saat app mulai; juga memeriksa lagi tiap app kembali dibuka (sampai izin diberikan). */
export function installBackgroundGuard(): void {
  if (!isNativeApp()) return
  window.setTimeout(() => void ensureBackgroundPermissions(), 4_000)
  void App.addListener('appStateChange', ({ isActive }) => {
    if (!isActive) return
    askedThisSession = false
    window.setTimeout(() => void ensureBackgroundPermissions(), 1_500)
  })
}
