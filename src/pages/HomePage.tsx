import { useState } from 'react'
import ArtistSearchPanel, { type ArtistRequest } from '../components/playlist/ArtistSearchPanel'
import PlaylistImportForm, { type SearchMode } from '../components/playlist/PlaylistImportForm'
import PlaylistView from '../components/playlist/PlaylistView'
import { useGreeting } from '../hooks/greeting'

export default function HomePage() {
  const greeting = useGreeting()
  const [mode, setMode] = useState<SearchMode>('track')
  const [artistRequest, setArtistRequest] = useState<ArtistRequest | null>(null)

  return (
    <div className="space-y-8">
      <section aria-labelledby="home-title" className="space-y-5">
        <div>
          <h1
            id="home-title"
            className="font-display text-2xl font-extrabold tracking-tight sm:text-4xl"
          >
            {greeting}
          </h1>
          <p className="mt-1 text-ink-muted">
            Cari lagu atau artis, atau tempel tautan lagu/playlist Spotify.
          </p>
        </div>
        <PlaylistImportForm
          mode={mode}
          onModeChange={(next) => {
            setMode(next)
            if (next === 'track') setArtistRequest(null)
          }}
          onArtistSearch={(q) => setArtistRequest(q ? { q, n: Date.now() } : null)}
        />
      </section>

      {mode === 'artist' ? <ArtistSearchPanel request={artistRequest} /> : <PlaylistView />}
    </div>
  )
}
