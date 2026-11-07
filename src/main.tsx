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
/**
 * Splash (index.html): logo -> nama -> zoom pelan, jadi tampil minimal ±3,4 dtk sejak dibuka (animasi masuk selesai ±1,7 dtk, lalu ditahan sebentar) (setelah itu zoom menembus keluar,
 * Beranda masuk bersamaan). Tanpa gerakan (preferensi "kurangi gerakan"): cukup ±0,5 dtk.
 */
const SPLASH_MIN_MS = 3400
function dismissSplash() {
  const html = document.documentElement
  const splash = document.getElementById('splash')
  const reveal = () => {
    html.classList.add('app-ready')
    if (!splash) return
    splash.classList.add('splash-hide')
    // transitionend dari anak (zoom keluar) ikut naik ke sini: hanya opacity splash sendiri yang menghapusnya.
    splash.addEventListener('transitionend', (event) => {
      if (event.target === splash) splash.remove()
    })
    window.setTimeout(() => splash.remove(), 1400)
  }
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const wait = Math.max(0, (reduced ? 500 : SPLASH_MIN_MS) - performance.now())
  // Dua frame supaya render pertama sudah digambar di balik splash sebelum fade dimulai.
  window.setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(reveal)), wait)
}

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
    dismissSplash()
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
