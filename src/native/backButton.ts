import { App } from '@capacitor/app'
import { isNativeApp } from './platform'

/**
 * Tombol Back Android: jika masih ada riwayat (overlay pemutar, antrean, halaman), mundur seperti biasa.
 * Jika sudah di halaman awal, aplikasi DIMINIMALKAN, bukan ditutup, supaya musik terus berjalan di
 * latar belakang (menutup activity akan menghancurkan WebView yang memutar audio).
 */
export function installNativeBackButton(): void {
  if (!isNativeApp()) return
  void App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) window.history.back()
    else void App.minimizeApp()
  })
}
