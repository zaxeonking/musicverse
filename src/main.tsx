import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { installNativeBackButton } from './native/backButton'
import { initDownloads } from './native/downloads'
import { startLiveUpdate } from './native/liveUpdate'
import { initOffline } from './native/offline'
import { initNativeStorage } from './native/nativeStorage'
import { startLyricsBackfill } from './native/offlineLyrics'
import { isNativeApp } from './native/platform'

/**
 * MusicVerse hanya berupa aplikasi (APK). Di dalam APK: muat data dari Android/data/<paket>/files/data sebelum render
 * pertama (context membaca localStorage saat mount), siapkan indeks unduhan, lalu render aplikasi penuh.
 * Di peramban: render situs informasi saja (landing untuk memasang APK, Kebijakan Privasi, Ketentuan Layanan); kode
 * pemutar tidak dimuat sama sekali (import dinamis), jadi tidak ada versi web yang bisa dipakai.
 */
async function bootstrap() {
  const root = createRoot(document.getElementById('root')!)
  if (isNativeApp()) {
    document.documentElement.classList.add('native-app')
    installNativeBackButton()
    await initNativeStorage()
    void initOffline().then(initDownloads).then(startLyricsBackfill)
    const { default: App } = await import('./App')
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
    // Pembaruan tampilan tanpa APK baru (hanya APK): cek paket OTA di latar belakang setelah UI tampil.
    startLiveUpdate()
    return
  }
  const { default: SiteApp } = await import('./site/SiteApp')
  root.render(
    <StrictMode>
      <SiteApp />
    </StrictMode>,
  )
}

void bootstrap()
