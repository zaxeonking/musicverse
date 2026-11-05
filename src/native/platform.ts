import { Capacitor } from '@capacitor/core'

/**
 * True hanya saat berjalan di dalam APK (WebView Capacitor). Di browser/Vercel selalu false,
 * jadi semua fitur khusus APK (notifikasi native, unduhan offline, penyimpanan di Android/data,
 * tautan disembunyikan) tidak aktif dan perilaku web tidak berubah.
 */
export function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform()
  } catch {
    return false
  }
}

export function isAndroidApp(): boolean {
  try {
    return Capacitor.getPlatform() === 'android'
  } catch {
    return false
  }
}
