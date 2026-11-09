import { useEffect, useRef } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { consumeFeedReturn } from '../components/home/homeNav'
import AllSongsView from '../components/search/AllSongsView'
import BrowseDetail from '../components/search/BrowseDetail'
import SearchBrowse from '../components/search/SearchBrowse'
import ArtistSearchPanel from '../components/playlist/ArtistSearchPanel'
import PlaylistImportForm from '../components/playlist/PlaylistImportForm'
import PlaylistView from '../components/playlist/PlaylistView'
import { usePlaylist } from '../context/PlaylistContext'
import { artistSearch, useArtistSearch } from '../utils/artistSearchStore'
import { searchResults } from '../utils/searchResultsFlag'

/**
 * Halaman Cari. Kolom di atas menampung semua pencarian (judul lagu, nama artis, tautan lagu/playlist Spotify). Di bawahnya:
 *  - ada hasil (playlist/lagu/artis yang dibuka): hasilnya;
 *  - kosong: jelajah ala Spotify (Kejutkan aku, pintasan perangkat, suasana, genre), atau isi satu kotak jelajah
 *    lewat alamat `?view=all|mood|genre`.
 */
export default function SearchPage() {
  const [params] = useSearchParams()
  const location = useLocation()
  const { mode, phase } = useArtistSearch()
  const { status, fromCache } = usePlaylist()

  // Hasil "dibuka" = pengguna sendiri yang memintanya. Playlist yang cuma dipulihkan saat aplikasi dibuka tidak menutup jelajah.
  const fresh = status === 'loading' || status === 'error' || (status === 'success' && !fromCache)
  useEffect(() => {
    if (fresh) searchResults.set(true)
    else if (status === 'idle') searchResults.set(false)
  }, [fresh, status])
  const artistActive = mode === 'artist'
  const playlistActive = mode !== 'artist' && status !== 'idle' && (fresh || searchResults.isOpen())
  const showResults = artistActive || playlistActive

  // Kembali dari halaman artis yang dibuka lewat Beranda/jelajah: pulihkan mode Lagu supaya jelajah tampil lagi.
  useEffect(() => {
    if (mode === 'artist' && phase === 'idle' && consumeFeedReturn()) artistSearch.setMode('track')
  }, [mode, phase])

  // Datang dari kolom cari di Beranda: langsung fokus ke kolom, sekali saja.
  const focusDone = useRef(false)
  const wantsFocus = (location.state as { focus?: boolean } | null)?.focus === true
  useEffect(() => {
    if (!wantsFocus || focusDone.current) return
    focusDone.current = true
    const timer = window.setTimeout(() => document.querySelector<HTMLInputElement>('[data-tour="import-input"]')?.focus(), 80)
    return () => window.clearTimeout(timer)
  }, [wantsFocus])

  const view = params.get('view')
  const id = params.get('id')

  let body
  if (showResults) {
    // Ganti kategori (Lagu / Artis): isi baru memudar masuk, bukan muncul mendadak.
    body = <div key={mode} className="mv-swap">{mode === 'artist' ? <ArtistSearchPanel /> : <PlaylistView />}</div>
  } else if (view === 'all') {
    body = <AllSongsView />
  } else if ((view === 'mood' || view === 'genre') && id) {
    body = <BrowseDetail key={`${view}-${id}`} view={view} id={id} name={params.get('name') ?? undefined} />
  } else {
    body = <SearchBrowse />
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-4xl">Cari</h1>

      {/* Tanpa latar pekat: cahaya latar (mv-glow di AppShell) tetap menyambung di belakang kolom cari. Lapisan blur tanpa warna, memudar di
          atas dan bawah (tanpa tepi keras), hanya menjaga daftar yang tergulir tidak menabrak kolom cari. */}
      <div className="sticky top-0 z-10 -mx-4 px-4 py-2 lg:-mx-8 lg:px-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 -top-6 -z-10 bottom-[-14px] backdrop-blur-md [-webkit-mask-image:linear-gradient(to_bottom,transparent,black_35%,black_65%,transparent)] [mask-image:linear-gradient(to_bottom,transparent,black_35%,black_65%,transparent)]"
        />
        <PlaylistImportForm
          mode={mode}
          onModeChange={artistSearch.setMode}
          onArtistSearch={(q) => (q ? artistSearch.search(q) : artistSearch.clear())}
        />
      </div>

      {body}
    </div>
  )
}
