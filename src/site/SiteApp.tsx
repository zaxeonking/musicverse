import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import LandingPage from './LandingPage'
import SiteLayout from './SiteLayout'
import SiteLegalPage from './SiteLegalPage'
import AccountPage from './AccountPage'
import LegacyAccountPage from './LegacyAccountPage'

/**
 * Aplikasi untuk peramban biasa. MusicVerse tidak punya versi web: satu-satunya halaman adalah landing untuk
 * memasang APK, ditambah Kebijakan Privasi dan Ketentuan Layanan. Alamat lain (/search, /library, dst.)
 * dialihkan ke "/". Versi lengkap (pemutar, pengaturan) hanya dimuat di APK lewat src/App.tsx.
 */
const router = createBrowserRouter([
  {
    element: <SiteLayout />,
    children: [
      { path: '/', element: <LandingPage /> },
      { path: '/privacy', element: <SiteLegalPage kind="privacy" /> },
      { path: '/terms', element: <SiteLegalPage kind="terms" /> },
      { path: '/account', element: <AccountPage /> },
      { path: '/account/legacy', element: <LegacyAccountPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])

export default function SiteApp() {
  return <RouterProvider router={router} />
}
