import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { installNativeBackButton } from './native/backButton'
import { initDownloads } from './native/downloads'
import { startLiveUpdate } from './native/liveUpdate'
import { initOffline } from './native/offline'
import { initNativeStorage } from './native/nativeStorage'
import { startLyricsBackfill } from './native/offlineLyrics'
import { isNativeApp } from './native/platform'

/**
 * Di APK: muat data dari Android/data/<paket>/files/data sebelum render pertama (context membaca
 * localStorage saat mount), lalu siapkan indeks unduhan. Di browser langsung render.
 */
async function bootstrap() {
  if (isNativeApp()) {
    document.documentElement.classList.add('native-app')
    installNativeBackButton()
    await initNativeStorage()
    void initOffline().then(initDownloads).then(startLyricsBackfill)
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
  // Pembaruan tampilan tanpa APK baru (hanya APK): cek paket OTA di latar belakang setelah UI tampil.
  startLiveUpdate()
}

void bootstrap()
