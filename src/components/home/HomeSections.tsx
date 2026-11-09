import { useNavigate } from 'react-router-dom'
import { usePlaylist } from '../../context/PlaylistContext'
import { useAudioPlayer } from '../../hooks/useAudioPlayer'
import type { FavArtist, HomeFeed } from '../../hooks/useHomeFeed'
import { artistSearch } from '../../utils/artistSearchStore'
import { searchResults } from '../../utils/searchResultsFlag'
import { ArtistBubble, HomeRow, PlaylistTile, TrackCard } from './HomeCards'
import { openArtistFromFeed, searchArtistFromFeed } from './homeNav'

/** Deretan Beranda di bawah banner dan tombol cari. Deretan tanpa isi tidak tampil, jadi pengguna baru tidak melihat kotak kosong. */
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
    <div className="space-y-8">
      {feed.favPlaylists.length > 0 && (
        <HomeRow title="Playlist yang sering kamu dengar">
          {feed.favPlaylists.map((p) => (
            <PlaylistTile
              key={p.id}
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
      )}

      {feed.favArtists.length > 0 && (
        <HomeRow title="Artis favoritmu" subtitle="Dari lagu yang sering kamu putar">
          {feed.favArtists.map((a) => (
            <ArtistBubble key={a.name} name={a.name} picture={a.hit?.picture} onOpen={() => openArtist(a)} />
          ))}
        </HomeRow>
      )}

      {feed.sections.map((section) => (
        <HomeRow key={section.id} title={section.title} subtitle={section.subtitle}>
          {section.tracks.map((track, i) => (
            <TrackCard key={track.id} track={track} onPlay={() => player.playList(section.tracks, i)} />
          ))}
        </HomeRow>
      ))}

      {feed.replay.length >= 4 && (
        <HomeRow title="Dengar lagi" subtitle="Sudah beberapa hari tidak kamu putar">
          {feed.replay.map((track, i) => (
            <TrackCard key={track.id} track={track} onPlay={() => player.playList(feed.replay, i)} />
          ))}
        </HomeRow>
      )}
    </div>
  )
}
