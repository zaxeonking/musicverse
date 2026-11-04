import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import AppShell from './components/layout/AppShell'
import AutoResumeSync from './components/player/AutoResumeSync'
import MediaSessionSync from './components/player/MediaSessionSync'
import { AudioPlayerProvider } from './context/AudioPlayerContext'
import { LibraryProvider } from './context/LibraryContext'
import { MyPlaylistsProvider } from './context/MyPlaylistsContext'
import { PlayerUiProvider } from './context/PlayerUiContext'
import { PlaylistProvider } from './context/PlaylistContext'
import { SleepTimerProvider } from './context/SleepTimerContext'
import { TrackMenuProvider } from './context/TrackMenuContext'
import BackupPage from './pages/BackupPage'
import BrowsePage from './pages/BrowsePage'
import EqualizerPage from './pages/EqualizerPage'
import PlaybackSettingsPage from './pages/PlaybackSettingsPage'
import HistoryPage from './pages/HistoryPage'
import DownloadSettingsPage from './pages/DownloadSettingsPage'
import DownloadsPage from './pages/DownloadsPage'
import HomePage from './pages/HomePage'
import LibraryPage from './pages/LibraryPage'
import MyPlaylistPage from './pages/MyPlaylistPage'
import SearchPage from './pages/SearchPage'
import SettingsPage from './pages/SettingsPage'
import { installBackGuard, prepareHistory } from './utils/backGuard'

prepareHistory()

const router = createBrowserRouter([
  {
    element: (
      <PlayerUiProvider>
        <AppShell />
      </PlayerUiProvider>
    ),
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/search', element: <SearchPage /> },
      { path: '/library', element: <LibraryPage /> },
      { path: '/downloads', element: <DownloadsPage /> },
      { path: '/settings', element: <SettingsPage /> },
      { path: '/settings/downloads', element: <DownloadSettingsPage /> },
      { path: '/settings/playback', element: <PlaybackSettingsPage /> },
      { path: '/settings/equalizer', element: <EqualizerPage /> },
      { path: '/settings/backup', element: <BackupPage /> },
      { path: '/history', element: <HistoryPage /> },
      { path: '/browse', element: <BrowsePage /> },
      { path: '/my/:id', element: <MyPlaylistPage /> },
      { path: '*', element: <HomePage /> },
    ],
  },
])

installBackGuard(router)

export default function App() {
  return (
    <PlaylistProvider>
      <AudioPlayerProvider>
        <LibraryProvider>
          <MyPlaylistsProvider>
            <TrackMenuProvider>
              <SleepTimerProvider>
                <MediaSessionSync />
                <AutoResumeSync />
                <RouterProvider router={router} />
              </SleepTimerProvider>
            </TrackMenuProvider>
          </MyPlaylistsProvider>
        </LibraryProvider>
      </AudioPlayerProvider>
    </PlaylistProvider>
  )
}
