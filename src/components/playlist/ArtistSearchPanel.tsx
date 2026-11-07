import { ArrowLeft, ChevronRight, ListPlus, Loader2, Plus, Shuffle, UserRound } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { myPlaylistErrorText, useMyPlaylists } from '../../context/MyPlaylistsContext'
import { useTrackMenu } from '../../context/TrackMenuContext'
import { useAudioPlayer } from '../../hooks/useAudioPlayer'
import { usePlaylistPlayback } from '../../hooks/usePlaylistPlayback'
import { useOverlayHistory } from '../../hooks/useOverlayHistory'
import type { AlbumHit } from '../../services/artistApi'
import type { PlaylistTrack } from '../../types/spotify'
import { artistSearch, useArtistSearch } from '../../utils/artistSearchStore'
import { fallbackCover } from '../../utils/fallbackCover'
import { getRowActivity } from '../../utils/playerStatus'
import Chip from '../ui/Chip'
import CoverArt from '../ui/CoverArt'
import RoundAction from '../ui/RoundAction'
import EmptyState from '../ui/EmptyState'
import ArtistList from './ArtistList'
import ArtistPlaylistSheet, { addedMessage } from './ArtistPlaylistSheet'
import TrackList from './TrackList'

function Loading({ text }: { text: string }) {
  return (
    <p className="flex items-center gap-2 text-sm text-ink-muted" role="status">
      <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
      {text}
    </p>
  )
}

/** Diskografi: satu baris per album/single (cover kotak, judul, tahun dan jenis). */
function AlbumList({ albums, onOpen }: { albums: readonly AlbumHit[]; onOpen: (album: AlbumHit) => void }) {
  return (
    <ul className="space-y-1" aria-label="Album">
      {albums.map((album) => (
        <li key={album.id}>
          <button
            type="button"
            onClick={() => onOpen(album)}
            className="focus-ring flex w-full items-center gap-3 rounded-lg px-1 py-1 text-left"
          >
            <div className="w-14 shrink-0 overflow-hidden rounded-md">
              <CoverArt cover={fallbackCover(album.title)} src={album.cover} />
            </div>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-ink">{album.title}</span>
              <span className="block truncate text-xs text-ink-muted">{album.year ? `${album.year} · ${album.kind}` : album.kind}</span>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-ink-muted" aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  )
}

/**
 * Hasil mode "Artis" di Beranda: daftar artis (foto profil) -> ketuk -> halaman artis dengan tab Lagu dan Album.
 * Statusnya ada di `artistSearchStore`, jadi tetap ada saat pindah halaman lalu kembali.
 * Artis TIDAK pernah dibungkus sebagai PlaylistTrack, jadi tidak bisa tertukar dengan lagu.
 */
export default function ArtistSearchPanel() {
  const player = useAudioPlayer()
  const { phase, artists, selected, songs, submitted, sort, recent, tab, albums, albumsPhase, album, albumSongs, albumPhase } =
    useArtistSearch()
  const { playlists, saveDownloadedPlaylist } = useMyPlaylists()
  const { showToast } = useTrackMenu()
  const [sheetOpen, setSheetOpen] = useState(false)
  // Urutan tampil = urutan putar: semua tombol dan ketuk baris memakai daftar yang sama.
  const sorted = useMemo(
    () => (sort === 'az' ? [...songs].sort((a, b) => a.title.localeCompare(b.title, 'id', { sensitivity: 'base' })) : songs),
    [songs, sort],
  )
  // Hook harus dipanggil sebelum return dini di bawah.
  const playback = usePlaylistPlayback(album !== null ? albumSongs : sorted)

  // Back (termasuk Back Android): dari album kembali ke daftar album, dari halaman artis kembali ke daftar artis.
  // Dua lapis; hanya yang paling atas yang menanggapi.
  useOverlayHistory(selected !== null, artistSearch.back)
  useOverlayHistory(album !== null, artistSearch.closeAlbum)

  if (phase === 'idle') {
    if (recent.length === 0) {
      return (
        <EmptyState
          compact
          icon={UserRound}
          title="Cari artis favoritmu"
          description="Ketik nama artis di atas, lalu pilih untuk melihat semua lagunya."
        />
      )
    }
    return (
      <ArtistList
        title="Terakhir dibuka"
        artists={recent}
        onOpen={(artist) => artistSearch.open(artist, true)}
        action={
          <button type="button" onClick={artistSearch.clearRecent} className="focus-ring rounded-md px-2 py-1 text-xs text-ink-muted">
            Hapus riwayat
          </button>
        }
      />
    )
  }

  if (phase === 'searching') return <Loading text="Mencari artis…" />

  if (phase === 'error') {
    return (
      <EmptyState
        compact
        icon={UserRound}
        title="Gagal memuat artis"
        action={
          <button
            type="button"
            className="btn-secondary"
            onClick={() => (selected ? artistSearch.open(selected) : artistSearch.search(submitted))}
          >
            Coba lagi
          </button>
        }
      />
    )
  }

  // Daftar artis hasil pencarian.
  if (!selected) {
    if (artists.length === 0) return <EmptyState compact icon={UserRound} title="Artis tidak ditemukan" />
    return <ArtistList title="Artis" artists={artists} onOpen={(artist) => artistSearch.open(artist)} />
  }

  /* ---------- Halaman artis / album ---------- */
  const inAlbum = album !== null
  const viewSongs: PlaylistTrack[] = inAlbum ? albumSongs : sorted
  const subject = inAlbum
    ? { name: album.title, picture: album.cover }
    : { name: selected.name, picture: selected.picture || songs[0]?.cover || '' }

  /** Satu ketukan: playlist bernama artis/album itu (dipakai lagi kalau sudah pernah dibuat dari yang sama). */
  const createViewPlaylist = () => {
    if (viewSongs.length === 0) return
    const sourceId = inAlbum ? `deezer-album-${album.id}` : `deezer-artist-${selected.id}`
    const name = inAlbum ? `${album.title} – ${selected.name}` : selected.name
    const existed = playlists.some((item) => item.sourceId === sourceId)
    const result = saveDownloadedPlaylist(sourceId, name, viewSongs)
    if (!result.ok) return showToast(myPlaylistErrorText(result.reason))
    const { playlist, added, skipped } = result.value
    showToast(existed ? addedMessage(playlist.name, { added, skipped }) : `Playlist “${playlist.name}” dibuat, ${added} lagu disimpan`)
  }

  const disabled = viewSongs.length === 0
  const actions = (
    <div className="flex items-center gap-3">
      <RoundAction primary fill icon={playback.icon} label={playback.label} disabled={disabled} onClick={() => playback.onPress(() => player.playList(viewSongs, 0))} />
      <RoundAction
        icon={Shuffle}
        label="Acak"
        disabled={disabled}
        onClick={() => player.playAll([...viewSongs].sort(() => Math.random() - 0.5))}
      />
      <RoundAction icon={ListPlus} label="Tambah ke playlist" disabled={disabled} haspopup onClick={() => setSheetOpen(true)} />
      <RoundAction icon={Plus} label="Buat playlist" disabled={disabled} onClick={createViewPlaylist} />
    </div>
  )

  const trackList = (
    <TrackList
      key={inAlbum ? `album-${album.id}` : selected.id}
      tracks={viewSongs}
      emptyState={<EmptyState compact icon={UserRound} title="Belum ada lagu" />}
      searchable
      onPlay={(_track, index) => player.playList(viewSongs, index)}
      playingTrackId={player.currentTrack?.id ?? null}
      playbackActivity={getRowActivity(player.status)}
    />
  )

  let body: ReactNode
  if (inAlbum) {
    if (albumPhase === 'error') {
      body = (
        <EmptyState
          compact
          icon={UserRound}
          title="Gagal memuat lagu album"
          action={
            <button type="button" className="btn-secondary" onClick={() => artistSearch.openAlbum(album)}>
              Coba lagi
            </button>
          }
        />
      )
    } else if (albumPhase !== 'ready') {
      body = <Loading text="Memuat lagu…" />
    } else {
      body = (
        <>
          {actions}
          {trackList}
        </>
      )
    }
  } else if (tab === 'albums') {
    if (albumsPhase === 'error') {
      body = (
        <EmptyState
          compact
          icon={UserRound}
          title="Gagal memuat album"
          action={
            <button type="button" className="btn-secondary" onClick={artistSearch.loadAlbums}>
              Coba lagi
            </button>
          }
        />
      )
    } else if (albumsPhase !== 'ready') {
      body = <Loading text="Memuat album…" />
    } else if (albums.length === 0) {
      body = <EmptyState compact icon={UserRound} title="Belum ada album" />
    } else {
      body = <AlbumList albums={albums} onOpen={artistSearch.openAlbum} />
    }
  } else if (phase !== 'songs') {
    body = <Loading text="Memuat lagu…" />
  } else {
    body = (
      <>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          {actions}
          <div className="flex items-center gap-2" role="group" aria-label="Urutkan lagu">
            <Chip active={sort === 'popular'} onClick={() => artistSearch.setSort('popular')}>
              Populer
            </Chip>
            <Chip active={sort === 'az'} onClick={() => artistSearch.setSort('az')}>
              A–Z
            </Chip>
          </div>
        </div>
        {trackList}
      </>
    )
  }

  const subtitle = inAlbum
    ? [album.year, album.kind, albumPhase === 'ready' ? `${albumSongs.length} lagu` : ''].filter(Boolean).join(' · ')
    : phase === 'songs'
      ? `${songs.length} lagu`
      : 'Memuat lagu…'

  return (
    <section aria-label={inAlbum ? `Album ${album.title}` : `Lagu ${selected.name}`} className="space-y-4">
      <button
        type="button"
        onClick={inAlbum ? artistSearch.closeAlbum : artistSearch.back}
        className="focus-ring -ml-1 inline-flex items-center gap-1 rounded-md p-1 text-sm text-ink-muted"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {inAlbum ? selected.name : 'Artis'}
      </button>

      <header className="flex items-center gap-4">
        <div className={`w-20 shrink-0 overflow-hidden ${inAlbum ? 'rounded-lg' : 'rounded-full'}`}>
          <CoverArt cover={fallbackCover(subject.name)} src={subject.picture} />
        </div>
        <div className="min-w-0">
          <h2 className="truncate font-display text-2xl font-extrabold text-ink">{inAlbum ? album.title : selected.name}</h2>
          <p className="text-sm text-ink-muted">{subtitle}</p>
        </div>
      </header>

      {!inAlbum && (
        <div className="flex gap-2" role="group" aria-label="Isi halaman artis">
          <Chip active={tab === 'songs'} onClick={() => artistSearch.setTab('songs')}>
            Lagu
          </Chip>
          <Chip active={tab === 'albums'} onClick={() => artistSearch.setTab('albums')}>
            Album
          </Chip>
        </div>
      )}

      {body}

      {sheetOpen && <ArtistPlaylistSheet artist={subject} songs={viewSongs} onClose={() => setSheetOpen(false)} onDone={showToast} />}
    </section>
  )
}
