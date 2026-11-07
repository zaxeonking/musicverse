import ArtistSearchPanel from '../components/playlist/ArtistSearchPanel'
import PlaylistImportForm from '../components/playlist/PlaylistImportForm'
import PlaylistView from '../components/playlist/PlaylistView'
import { useGreeting } from '../hooks/greeting'
import { artistSearch, useArtistSearch } from '../utils/artistSearchStore'

export default function HomePage() {
  const greeting = useGreeting()
  // Mode dan hasil artis disimpan di luar halaman, jadi tetap ada saat pindah tab lalu kembali ke Beranda.
  const { mode } = useArtistSearch()

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
          onModeChange={artistSearch.setMode}
          onArtistSearch={(q) => (q ? artistSearch.search(q) : artistSearch.clear())}
        />
      </section>

      {mode === 'artist' ? <ArtistSearchPanel /> : <PlaylistView />}
    </div>
  )
}
