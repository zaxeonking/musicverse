import { useNavigate } from 'react-router-dom'
import { HOME_SHELVES } from '../../config/homeShelves'
import { usePlaylist } from '../../context/PlaylistContext'
import { useAudioPlayer } from '../../hooks/useAudioPlayer'
import type { FavArtist, HomeFeed } from '../../hooks/useHomeFeed'
import { artistSearch } from '../../utils/artistSearchStore'
import { searchResults } from '../../utils/searchResultsFlag'
import ErrorBoundary from '../ui/ErrorBoundary'
import Reveal from '../ui/Reveal'
import { ArtistBubble, HomeRow, PlaylistTile, TrackCard } from './HomeCards'
import HomeRecently from './HomeRecently'
import HomeShelf from './HomeShelf'
import { openArtistFromFeed, searchArtistFromFeed } from './homeNav'

/** Deretan yang tampil sebelum rekomendasi pribadi dan sesudahnya; sisanya (indeks >= ini) menyusul di bawah. */
const SHELVES_BEFORE_REC = 3

/**
 * Deretan Beranda di bawah banner. Urutan: Recently, playlist dan artis favorit, deretan kurasi (rilisan baru, hits), rekomendasi
 * dari riwayat, deretan kurasi lanjutan, lalu Dengar lagi. Deretan tanpa isi tidak tampil, jadi pengguna baru tidak melihat kotak kosong.
 * Tiap blok memudar masuk saat tergulir ke layar; deretan kurasi baru dimuat saat sudah dekat layar.
 */
export default function HomeSections({ feed }: { feed: HomeFeed }) {
  const player = useAudioPlayer()
  const navigate = useNavigate()
  const { loadPlaylist } = usePlaylist()

  const openArtist = (fav: FavArtist) => {
    if (fav.hit) openArtistFromFeed(fav.hit)
    else searchArtistFromFeed(fav.name)
    navigate('/search')
  }

  return (
    <div className="space-y-9">
      <ErrorBoundary>
        <HomeRecently />
      </ErrorBoundary>

      {feed.favPlaylists.length > 0 && (
        <Reveal>
          <HomeRow title="Playlist yang sering kamu dengar">
            {feed.favPlaylists.map((p, i) => (
              <PlaylistTile
                key={p.id}
                index={i}
                title={p.title}
                cover={p.cover}
                plays={p.plays}
                onOpen={() => {
                  if (p.mineId) navigate(`/my/${p.mineId}`)
                  else if (p.savedUrl) {
                    artistSearch.setMode('track')
                    searchResults.set(true)
                    void loadPlaylist(p.savedUrl)
                    navigate('/search')
                  }
                }}
              />
            ))}
          </HomeRow>
        </Reveal>
      )}

      {feed.favArtists.length > 0 && (
        <Reveal>
          <HomeRow title="Artis favoritmu" subtitle="Dari lagu yang sering kamu putar">
            {feed.favArtists.map((a, i) => (
              <ArtistBubble key={a.name} index={i} name={a.name} picture={a.hit?.picture} onOpen={() => openArtist(a)} />
            ))}
          </HomeRow>
        </Reveal>
      )}

      {HOME_SHELVES.slice(0, SHELVES_BEFORE_REC).map((def) => (
        <ErrorBoundary key={def.id}>
          <HomeShelf def={def} />
        </ErrorBoundary>
      ))}

      {feed.sections.map((section) => (
        <Reveal key={section.id}>
          <HomeRow title={section.title} subtitle={section.subtitle}>
            {section.tracks.map((track, i) => (
              <TrackCard key={track.id} index={i} track={track} onPlay={() => player.playList(section.tracks, i)} />
            ))}
          </HomeRow>
        </Reveal>
      ))}

      {HOME_SHELVES.slice(SHELVES_BEFORE_REC).map((def) => (
        <ErrorBoundary key={def.id}>
          <HomeShelf def={def} />
        </ErrorBoundary>
      ))}

      {feed.replay.length >= 4 && (
        <Reveal>
          <HomeRow title="Dengar lagi" subtitle="Sudah beberapa hari tidak kamu putar">
            {feed.replay.map((track, i) => (
              <TrackCard key={track.id} index={i} track={track} onPlay={() => player.playList(feed.replay, i)} />
            ))}
          </HomeRow>
        </Reveal>
      )}
    </div>
  )
}
