import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { installNativeBackButton } from './native/backButton'
import { initOffline } from './native/offline'
import { initNativeStorage } from './native/nativeStorage'
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
    void initOffline()
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void bootstrap()
