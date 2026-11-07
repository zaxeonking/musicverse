import { Heart, LayoutGrid, Library, List, Pin, Plus } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLibrary } from '../../context/LibraryContext'
import { myPlaylistErrorText, useMyPlaylists } from '../../context/MyPlaylistsContext'
import { usePlaylist } from '../../context/PlaylistContext'
import { useTrackMenu } from '../../context/TrackMenuContext'
import { useLongPress } from '../../hooks/useLongPress'
import { useSwipeSelect } from '../../hooks/useSwipeSelect'
import type { LibrarySort, LibraryView, MyPlaylist, SavedPlaylist } from '../../types/library'
import { fallbackCover } from '../../utils/fallbackCover'
import { toPlaylistDetail } from '../../utils/libraryStorage'
import { isLikedId } from '../../utils/myPlaylistStorage'
import Chip from '../ui/Chip'
import CoverArt from '../ui/CoverArt'
import EmptyState from '../ui/EmptyState'
import SectionHeader from '../ui/SectionHeader'
import NewPlaylistForm from './NewPlaylistForm'
import PlaylistMenuSheet from './PlaylistMenuSheet'
import { SelectableCard, SelectionBar } from './PlaylistSelection'
import SavedPlaylistCard from './SavedPlaylistCard'
import SavedPlaylistMenuSheet from './SavedPlaylistMenuSheet'

const sortOptions: { id: LibrarySort; label: string }[] = [
  { id: 'recent', label: 'Terbaru' },
  { id: 'name', label: 'Nama A–Z' },
]

const viewOptions: { id: LibraryView; label: string; icon: typeof LayoutGrid }[] = [
  { id: 'grid', label: 'Tampilan kisi', icon: LayoutGrid },
  { id: 'list', label: 'Tampilan daftar', icon: List },
]

type Entry =
  | { kind: 'mine'; id: string; title: string; at: number; playlist: MyPlaylist }
  | { kind: 'saved'; id: string; title: string; at: number; playlist: SavedPlaylist }

/** Kunci pilihan: awalan membedakan playlist buatanmu dan yang tersimpan, yang ID-nya bisa kebetulan sama. */
const keyOf = (entry: Entry) => `${entry.kind === 'mine' ? 'm' : 's'}:${entry.id}`

function MyPlaylistCard({ playlist, layout, onMenu }: { playlist: MyPlaylist; layout: LibraryView; onMenu: (playlist: MyPlaylist) => void }) {
  // Tahan lama (atau klik kanan) membuka menu kecil; klik/ketukan yang menyusul tidak ikut membuka playlist.
  const press = useLongPress(() => onMenu(playlist))
  const fallback = useMemo(() => fallbackCover(playlist.name), [playlist.name])
  const count = playlist.tracks.length
  const liked = isLikedId(playlist.id)
  const subtitle = `${liked ? 'Bawaan' : 'Buatanmu'} · ${count === 0 ? 'kosong' : `${count} lagu`}`
  const badge = liked ? (
    <Heart className="mr-1.5 inline h-4 w-4 align-[-2px] text-accent" fill="currentColor" aria-label="Bawaan" />
  ) : playlist.pinned ? (
    <Pin className="mr-1.5 inline h-4 w-4 align-[-2px] text-accent" fill="currentColor" aria-label="Disematkan" />
  ) : null

  if (layout === 'list') {
    return (
      <li {...press}>
        <Link
          to={`/my/${playlist.id}`}
          className="flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-raised focus-ring"
        >
          <span className="w-14 shrink-0">
            <CoverArt cover={fallback} src={playlist.tracks[0]?.cover} />
          </span>
          <span className="min-w-0 flex-1">
            <span title={playlist.name} className="block truncate font-medium text-ink">
              {badge}
              {playlist.name}
            </span>
            <span className="block truncate text-sm text-ink-muted">{subtitle}</span>
          </span>
        </Link>
      </li>
    )
  }

  return (
    <li {...press}>
      <Link
        to={`/my/${playlist.id}`}
        className="flex flex-col rounded-lg bg-card p-3 transition-colors hover:bg-raised focus-ring"
      >
        <span className="mb-3 block">
          <CoverArt cover={fallback} src={playlist.tracks[0]?.cover} className="shadow-lg shadow-black/40" />
        </span>
        <span title={playlist.name} className="line-clamp-2 break-words font-display text-base font-bold leading-snug text-ink">
          {badge}
          {playlist.name}
        </span>
        <span className="mt-1 text-sm text-ink-muted">{subtitle}</span>
      </Link>
    </li>
  )
}

/**
 * Satu daftar "Playlist" di Koleksi: playlist buatan sendiri + playlist Spotify yang pernah dimuat
 * (tersimpan), dengan satu pengurutan dan satu pilihan tampilan, dan satu tombol "Buat playlist".
 */
export default function PlaylistsSection() {
  const navigate = useNavigate()
  const { playlist: active, restorePlaylist: restoreActivePlaylist } = usePlaylist()
  const { saved, prefs, removePlaylist, removePlaylists, savePlaylist, setPrefs } = useLibrary()
  const { playlists: mine, createPlaylist, deletePlaylists, restorePlaylist } = useMyPlaylists()
  const { showToast } = useTrackMenu()
  const [creating, setCreating] = useState(false)
  const [menuId, setMenuId] = useState<string | null>(null)
  const [savedMenuId, setSavedMenuId] = useState<string | null>(null)
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const savedMenuPlaylist = savedMenuId === null ? undefined : saved.find((item) => item.id === savedMenuId)
  const menuPlaylist = menuId === null ? undefined : mine.find((item) => item.id === menuId)
  const sectionRef = useRef<HTMLDivElement>(null)
  const activeId = active?.id ?? null

  const entries = useMemo<Entry[]>(() => {
    // Playlist Spotify yang sudah diunduh ("Unduh semua") sudah menjadi playlist buatanmu (sourceId = ID Spotify-nya):
    // tampilkan satu kartu saja, jangan dobel dengan kartu tersimpannya.
    const converted = new Set(mine.flatMap((playlist) => (playlist.sourceId ? [playlist.sourceId] : [])))
    const all: Entry[] = [
      ...mine.map((playlist): Entry => ({ kind: 'mine', id: playlist.id, title: playlist.name, at: playlist.updatedAt, playlist })),
      ...saved
        .filter((playlist) => !converted.has(playlist.id))
        .map((playlist): Entry => ({ kind: 'saved', id: playlist.id, title: playlist.title, at: playlist.savedAt, playlist })),
    ]
    // Urutan tetap: "Lagu Disukai" (bawaan) -> yang disematkan -> sisanya menurut pilihan urutan.
    const rank = (entry: Entry) => (entry.kind === 'mine' ? (isLikedId(entry.id) ? 0 : entry.playlist.pinned ? 1 : 2) : 2)
    const within =
      prefs.sort === 'name'
        ? (a: Entry, b: Entry) => a.title.localeCompare(b.title, 'id', { sensitivity: 'base' })
        : (a: Entry, b: Entry) => b.at - a.at
    return all.sort((a, b) => rank(a) - rank(b) || within(a, b))
  }, [mine, saved, prefs.sort])

  /** Membuka playlist tersimpan di Beranda. Playlist yang sudah aktif dan playback-nya tidak disentuh. */
  const handleOpen = useCallback(
    (playlist: SavedPlaylist) => {
      restoreActivePlaylist(toPlaylistDetail(playlist))
      navigate('/')
    },
    [restoreActivePlaylist, navigate],
  )

  /** Hanya menghapus dari daftar; playlist aktif dan pemutaran yang berjalan tidak ikut berhenti. */
  const handleRemove = useCallback(
    (playlist: SavedPlaylist) => {
      removePlaylist(playlist.id)
      // Kartu yang difokuskan hilang; pindahkan fokus ke bagian ini agar pengguna keyboard/pembaca layar tidak "jatuh" ke awal halaman.
      requestAnimationFrame(() => sectionRef.current?.focus())
    },
    [removePlaylist],
  )

  const selectable = useMemo(() => entries.filter((entry) => !(entry.kind === 'mine' && isLikedId(entry.id))), [entries])
  // Playlist yang sudah hilang (mis. dihapus di tab lain) tidak ikut terhitung.
  const chosen = useMemo(() => selectable.filter((entry) => selected.has(keyOf(entry))), [selectable, selected])

  const exitSelecting = useCallback(() => {
    setSelecting(false)
    setSelected(new Set())
  }, [])
  // Tidak ada lagi yang bisa dipilih (mis. semua dihapus dari tab lain): keluar dari mode pilih.
  useEffect(() => {
    if (selecting && selectable.length === 0) exitSelecting()
  }, [selecting, selectable.length, exitSelecting])

  const toggleSelected = (entry: Entry) => {
    const next = new Set(selected)
    const key = keyOf(entry)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setSelected(next)
    // Pilihan terakhir dibatalkan: tidak ada lagi yang dipilih, tutup mode pilih.
    if (next.size === 0) setSelecting(false)
  }

  /** Geser kanan/kiri pada playlist = mulai memilih (atau pilih/batal pilih kalau sudah dalam mode pilih). */
  const swipeHandlers = useSwipeSelect((index) => {
    const entry = entries[index]
    if (!entry || (entry.kind === 'mine' && isLikedId(entry.id))) return
    setSelecting(true)
    toggleSelected(entry)
  }, (index) => {
    // Petunjuk saat menggeser: Lagu Disukai tidak bisa dipilih; selain itu "Pilih" atau "Batal" kalau sudah terpilih.
    const entry = entries[index]
    if (!entry) return null
    if (entry.kind === 'mine' && isLikedId(entry.id)) return { icon: 'blocked', label: 'Bawaan' }
    return selecting && selected.has(keyOf(entry)) ? { icon: 'unselect', label: 'Batal' } : { icon: 'select', label: 'Pilih' }
  })

  /** Menghapus semua yang dipilih sekaligus (satu penulisan per jenis), dengan Urungkan. Berkas unduhan dan antrean tidak disentuh. */
  const handleDeleteSelected = () => {
    const mineChosen = chosen.flatMap((entry) => (entry.kind === 'mine' ? [entry.playlist] : []))
    const savedChosen = chosen.flatMap((entry) => (entry.kind === 'saved' ? [entry.playlist] : []))
    if (mineChosen.length + savedChosen.length === 0) return

    let removedMine: MyPlaylist[] = []
    if (mineChosen.length > 0) {
      const result = deletePlaylists(mineChosen.map((item) => item.id))
      if (!result.ok) {
        showToast(myPlaylistErrorText(result.reason))
        return
      }
      removedMine = result.value
    }
    // Playlist hasil "Unduh semua" ikut melepas kartu Spotify-nya (sama seperti hapus satuan).
    const savedIds = [...savedChosen.map((item) => item.id), ...removedMine.flatMap((item) => (item.sourceId ? [item.sourceId] : []))]
    const savedSnapshots = saved.filter((item) => savedIds.includes(item.id))
    if (savedIds.length > 0) removePlaylists(savedIds)

    const total = removedMine.length + savedChosen.length
    exitSelecting()
    // Fokus ke bagian ini agar pengguna keyboard/pembaca layar tidak "jatuh" ke awal halaman.
    requestAnimationFrame(() => sectionRef.current?.focus())
    showToast(`${total} playlist dihapus`, {
      label: 'Urungkan',
      onClick: () => {
        let failed = false
        for (const item of removedMine) if (!restorePlaylist(item).ok) failed = true
        for (const item of savedSnapshots) if (!savePlaylist(toPlaylistDetail(item))) failed = true
        showToast(failed ? 'Sebagian playlist tidak bisa dikembalikan' : `${total} playlist dikembalikan`)
      },
    })
  }

  const create = (name: string): string | null => {
    const result = createPlaylist(name)
    if (!result.ok) return myPlaylistErrorText(result.reason)
    setCreating(false)
    navigate(`/my/${result.value.id}`)
    return null
  }

  const subtitle =
    entries.length > 0
      ? `${entries.length} playlist${mine.length > 0 ? ` · ${mine.length} buatanmu` : ''}`
      : 'Playlist buatanmu dan yang pernah kamu muat'

  return (
    <section aria-label="Playlist">
      <div ref={sectionRef} tabIndex={-1} className="outline-none">
        <SectionHeader
          title="Playlist"
          subtitle={subtitle}
          action={
            !creating && !selecting ? (
              <button type="button" onClick={() => setCreating(true)} className="btn-secondary h-10 shrink-0 px-4 text-sm">
                <Plus className="h-4 w-4" aria-hidden="true" />
                Buat playlist
              </button>
            ) : undefined
          }
        />
      </div>

      {creating && (
        <div className="mb-4 rounded-lg bg-card p-3">
          <NewPlaylistForm onCreate={create} onCancel={() => setCreating(false)} />
        </div>
      )}

      {entries.length === 0 ? (
        !creating && (
          <EmptyState
            icon={Library}
            title="Belum ada playlist"
            action={
              <Link to="/" className="btn-primary">
                Muat playlist
              </Link>
            }
          />
        )
      ) : (
        <div className="space-y-4">
          {selecting && (
            <SelectionBar
              count={chosen.length}
              total={selectable.length}
              onSelectAll={() => setSelected(new Set(selectable.map(keyOf)))}
              onClear={() => setSelected(new Set())}
              onCancel={exitSelecting}
              onDelete={handleDeleteSelected}
            />
          )}
          <div className="flex items-center justify-between gap-3">
            <div className="no-scrollbar -m-1 flex gap-2 overflow-x-auto p-1" role="group" aria-label="Urutkan playlist">
              {sortOptions.map((option) => (
                <Chip key={option.id} active={prefs.sort === option.id} onClick={() => setPrefs({ sort: option.id })}>
                  {option.label}
                </Chip>
              ))}
            </div>

            <div className="flex shrink-0 rounded-full bg-raised p-1" role="group" aria-label="Tampilan">
              {viewOptions.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  aria-label={label}
                  aria-pressed={prefs.view === id}
                  onClick={() => setPrefs({ view: id })}
                  className={`flex h-9 w-11 items-center justify-center rounded-full transition-colors active:scale-95 focus-ring motion-reduce:active:scale-100 ${
                    prefs.view === id ? 'bg-bg text-accent' : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>

          <ul
            {...swipeHandlers}
            className={`touch-pan-y ${
              prefs.view === 'grid'
                ? 'grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5'
                : '-mx-2'
            }`}
          >
            {entries.map((entry) =>
              selecting ? (
                <SelectableCard
                  key={entry.id}
                  title={entry.title}
                  subtitle={
                    entry.kind === 'mine'
                      ? `${isLikedId(entry.id) ? 'Bawaan' : 'Buatanmu'} · ${entry.playlist.tracks.length === 0 ? 'kosong' : `${entry.playlist.tracks.length} lagu`}`
                      : `Tersimpan · ${entry.playlist.tracks.length} lagu`
                  }
                  cover={entry.kind === 'mine' ? entry.playlist.tracks[0]?.cover : entry.playlist.cover}
                  layout={prefs.view}
                  locked={entry.kind === 'mine' && isLikedId(entry.id)}
                  selected={selected.has(keyOf(entry))}
                  onToggle={() => toggleSelected(entry)}
                />
              ) : entry.kind === 'mine' ? (
                <MyPlaylistCard key={entry.id} playlist={entry.playlist} layout={prefs.view} onMenu={(item) => setMenuId(item.id)} />
              ) : (
                <SavedPlaylistCard
                  key={entry.id}
                  playlist={entry.playlist}
                  layout={prefs.view}
                  active={entry.id === activeId}
                  onOpen={handleOpen}
                  onRemove={handleRemove}
                  onMenu={(item) => setSavedMenuId(item.id)}
                />
              ),
            )}
          </ul>

        </div>
      )}
      {savedMenuPlaylist && (
        <SavedPlaylistMenuSheet
          playlist={savedMenuPlaylist}
          onClose={() => setSavedMenuId(null)}
          onOpen={handleOpen}
          onRemove={(item) => {
            handleRemove(item)
            showToast(`"${item.title}" dihapus dari Koleksi`)
          }}
        />
      )}
      {menuPlaylist && <PlaylistMenuSheet playlist={menuPlaylist} onClose={() => setMenuId(null)} onToast={showToast} />}
    </section>
  )
}
