import { useNavigate } from 'react-router-dom'
import { HOME_SHELVES } from '../../config/homeShelves'
import { usePlaylist } from '../../context/PlaylistContext'
import { useAudioPlayer } from '../../hooks/useAudioPlayer'
import type { FavArtist, HomeFeed } from '../../hooks/useHomeFeed'
import { artistSearch } from '../../utils/artistSearchStore'
import { recentKey } from '../../utils/libraryStorage'
import { getRowActivity } from '../../utils/playerStatus'
import { fallbackCover } from '../../utils/fallbackCover'
import ErrorBoundary from '../ui/ErrorBoundary'
import CoverArt from '../ui/CoverArt'
import Reveal from '../ui/Reveal'
import { CompactTrackList, HomeRow, SectionTitle, TrackCard } from './HomeCards'
import HomeArtists from './HomeArtists'
import HomeMoods from './HomeMood'
import HomeRecently from './HomeRecently'
import HomeShelf from './HomeShelf'
import { openArtistFromFeed, searchArtistFromFeed } from './homeNav'
import { searchResults } from '../../utils/searchResultsFlag'

/** Deretan yang tampil sebelum rekomendasi pribadi dan sesudahnya; sisanya (indeks >= ini) menyusul di bawah. */
const SHELVES_BEFORE_REC = 3

/**
 * Deretan Beranda di bawah banner. Urutan dan bentuknya sengaja berganti-ganti (bukan deretan carousel yang sama):
 * suasana (grid asimetris) -> terakhir diputar (daftar ringkas) -> playlist favorit (petak ringkas) -> rilisan baru (kartu fitur)
 * -> sorotan artis -> kurasi -> rekomendasi dari riwayat -> kurasi lanjutan (majalah, tangga lagu) -> dengar lagi.
 * Deretan tanpa isi tidak tampil, jadi pengguna baru tidak melihat kotak kosong. Blok pribadi memudar masuk saat tergulir ke layar;
 * deretan kurasi baru dimuat saat sudah dekat layar.
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

  const currentKey = player.currentTrack !== null && player.status !== 'idle' ? recentKey(player.currentTrack) : null
  const activity = getRowActivity(player.status)

  return (
    <div className="space-y-10">
      <Reveal>
        <HomeMoods />
      </Reveal>

      <ErrorBoundary>
        <HomeRecently />
      </ErrorBoundary>

      {feed.favPlaylists.length > 0 && (
        <Reveal>
          <section aria-label="Playlist yang sering kamu dengar">
            <SectionTitle title="Sering kamu dengar" subtitle="Playlist yang paling sering kamu buka" />
            <ul className="grid grid-cols-2 gap-2.5">
              {feed.favPlaylists.slice(0, 6).map((p, i) => (
                <li key={p.id} style={{ ['--mv-delay' as string]: `${Math.min(i, 5) * 55}ms` }} className="mv-in min-w-0">
                  <button
                    type="button"
                    aria-label={`Buka playlist ${p.title}`}
                    onClick={() => {
                      if (p.mineId) navigate(`/my/${p.mineId}`)
                      else if (p.savedUrl) {
                        artistSearch.setMode('track')
                        searchResults.set(true)
                        void loadPlaylist(p.savedUrl)
                        navigate('/search')
                      }
                    }}
                    className="focus-ring tap-card group flex w-full items-center gap-2.5 rounded-[1.2rem_0.5rem_1.2rem_0.5rem] bg-card p-1.5 pr-3 text-left ring-1 ring-veil/[0.06]"
                  >
                    <span className="w-12 shrink-0">
                      <CoverArt cover={fallbackCover(p.title)} src={p.cover} className="mv-art !rounded-[0.9rem_0.35rem_0.9rem_0.35rem]" />
                    </span>
                    <span className="min-w-0">
                      <span className="line-clamp-2 block font-display text-[0.9rem] font-bold leading-tight tracking-tight text-ink">{p.title}</span>
                      <span className="mt-0.5 block truncate text-xs text-ink-muted">{p.plays} lagu didengar</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </Reveal>
      )}

      {HOME_SHELVES.slice(0, SHELVES_BEFORE_REC).map((def) => (
        <ErrorBoundary key={def.id}>
          <HomeShelf def={def} />
        </ErrorBoundary>
      ))}

      {feed.favArtists.length > 0 && (
        <Reveal>
          <HomeArtists artists={feed.favArtists} onOpen={openArtist} />
        </Reveal>
      )}

      {feed.sections.map((section, si) => (
        <Reveal key={section.id}>
          {si === 0 ? (
            // Rekomendasi pertama berupa daftar ringkas; sisanya menyamping supaya ritme tampilannya berganti.
            <section aria-label={section.title}>
              <SectionTitle title={section.title} subtitle={section.subtitle} />
              <CompactTrackList tracks={section.tracks} limit={5} currentKey={currentKey} activity={activity} onPlay={(i) => player.playList(section.tracks, i)} />
            </section>
          ) : (
            <HomeRow title={section.title} subtitle={section.subtitle}>
              {section.tracks.map((track, i) => (
                <TrackCard key={track.id} index={i} track={track} onPlay={() => player.playList(section.tracks, i)} />
              ))}
            </HomeRow>
          )}
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
