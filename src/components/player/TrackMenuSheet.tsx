import { ArrowRightLeft, Copy, Download, ExternalLink, FolderInput, FolderPlus, Gauge, History, Radio, Share2, Link2, ListEnd, ListPlus, ListX, Play, RotateCcw, Trash2, Undo2 } from 'lucide-react'
import { writeClipboardText } from '../../native/clipboard'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { myPlaylistErrorText, useMyPlaylists } from '../../context/MyPlaylistsContext'
import type { ToastAction, TrackMenuPlace } from '../../context/TrackMenuContext'
import { useAudioPlayer } from '../../hooks/useAudioPlayer'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import { forgetAvailability } from '../../hooks/useTrackAvailability'
import { forgetManualPin, getManualPin } from '../../plugins/manualPins'
import { forgetResolved } from '../../plugins/registry'
import { removePlayLogEntry } from '../../utils/playLog'
import type { QueueAddResult } from '../../types/player'
import { QUEUE_RESULT_TEXT } from '../../utils/queueResultText'
import type { PlaylistTrack } from '../../types/spotify'
import { fallbackCover } from '../../utils/fallbackCover'
import { getUpcomingTracks } from '../../utils/playerQueue'
import { extractTrackId } from '../../utils/spotifyUrl'
import { downloadTrack } from '../../native/downloads'
import { isLocalTrackUrl } from '../../utils/localTrack'
import { removeDownload, trackKey, useOffline } from '../../native/offline'
import { isNativeApp } from '../../native/platform'
import CoverArt from '../ui/CoverArt'
import { useOverlayHistory } from '../../hooks/useOverlayHistory'
import PlaylistTransferPanel from '../library/PlaylistTransferPanel'
import AddToPlaylistPicker from './AddToPlaylistPicker'
import Action from './SheetAction'
import SpeedSheet from './SpeedSheet'
import { beginRadio, markRadioTracks } from '../../services/radio'
import { shareNowPlayingCard } from '../../utils/shareCard'
import { speedLabel, usePlaybackSpeed } from '../../services/playbackSpeed'
import OverlayPortal from '../ui/OverlayPortal'

const FOCUS = 'focus-ring'

interface TrackMenuSheetProps {
  track: PlaylistTrack
  /** Lagu ini dibuka dari hasil pencarian, jadi boleh dicampurkan ke antrean yang sedang berjalan. */
  fromSearch: boolean
  /** ID "Playlist saya" tempat lagu ini berada; menambah opsi salin / pindahkan ke playlist lain. */
  fromPlaylistId?: string
  /** Tempat menu dibuka (opsi tambahan menyesuaikan, mis. "Hapus dari riwayat" hanya dari Riwayat). */
  place?: TrackMenuPlace
  /** Waktu putar entri Riwayat yang ditekan lama; dipakai bersama place 'history'. */
  historyAt?: number
  onClose: () => void
  onToast: (message: string, action?: ToastAction) => void
}

/**
 * Menu opsi untuk satu lagu dari daftar mana pun (playlist, Cari, riwayat), muncul saat baris
 * ditahan lama atau diklik kanan. Antrean tidak dicampur: lagu di luar antrean yang sedang berjalan
 * hanya bisa dimasukkan ke antrean jika dibuka dari lagu satuan hasil pencarian (`fromSearch`: halaman Cari atau hasil cari judul/tautan lagu di Beranda), bukan dari playlist.
 * Mobile: bottom sheet. Desktop: kartu di tengah bawah.
 */
export default function TrackMenuSheet({ track, fromSearch, fromPlaylistId, place, historyAt, onClose, onToast }: TrackMenuSheetProps) {
  const player = useAudioPlayer()
  const online = useOnlineStatus()
  const { getPlaylist, removeTrack } = useMyPlaylists()
  const sourcePlaylist = fromPlaylistId ? getPlaylist(fromPlaylistId) : undefined
  const inSource = sourcePlaylist?.tracks.some((item) => item.id === track.id) === true
  const [relocate, setRelocate] = useState<{ mode: 'copy' | 'move'; all: boolean } | null>(null)
  useOverlayHistory(true, onClose)
  const sheetRef = useRef<HTMLDivElement>(null)
  const [picking, setPicking] = useState(false)
  const [speedOpen, setSpeedOpen] = useState(false)
  const [sharing, setSharing] = useState(false)
  const speed = usePlaybackSpeed()
  // Lagu ini pernah dipilih sumbernya secara manual (Cari manual): tampilkan opsi untuk melepasnya.
  const [pinned] = useState(() => getManualPin(track) !== null)
  const fallback = useMemo(() => fallbackCover(`${track.title}${track.album}`), [track.title, track.album])
  const native = isNativeApp()
  // Di APK tautan Spotify (buka/salin) disembunyikan.
  const href = !native && extractTrackId(track.url) ? track.url : undefined
  const offline = useOffline()
  const dlKey = trackKey(track)
  // Lagu dari folder "Lokal" sudah ada di HP: tidak bisa diunduh/dihapus dari sini (berkasnya bukan milik MusicVerse).
  const isLocal = isLocalTrackUrl(track.url)
  const downloaded = offline.items.some((item) => item.key === dlKey)
  const transfer = offline.transfers.get(dlKey)
  const downloading = transfer !== undefined && transfer.status !== 'error'

  const hasQueue = player.currentTrack !== null && player.currentIndex !== null
  const isCurrent = player.currentTrack?.id === track.id
  const upcomingPosition = useMemo(
    () =>
      getUpcomingTracks(player.queue, player.currentIndex, player.shuffleOrder).findIndex(
        (item) => item.track.id === track.id,
      ),
    [player.queue, player.currentIndex, player.shuffleOrder, track.id],
  )
  const inQueue = upcomingPosition !== -1
  const belongsToQueue = useMemo(() => player.queue.some((item) => item.id === track.id), [player.queue, track.id])
  // Tanpa antrean, opsi antrean sekadar memutar lagu ini. Dengan antrean, hanya lagu yang sudah ada di
  // dalamnya atau lagu satuan dari halaman Cari yang boleh ditambahkan/diatur.
  const canQueue = !hasQueue || fromSearch || belongsToQueue

  // Fokus masuk ke menu, dan kembali ke baris asal saat menu ditutup.
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    sheetRef.current?.querySelector<HTMLElement>('button:not([disabled])')?.focus()
    return () => previous?.focus?.()
  }, [])

  // Berpindah antara opsi lagu dan pilihan playlist: fokus ke elemen pertama tampilan baru.
  useEffect(() => {
    sheetRef.current?.querySelector<HTMLElement>('input, button:not([disabled])')?.focus()
  }, [picking, relocate])

  const run = (action: () => QueueAddResult) => {
    onToast(QUEUE_RESULT_TEXT[action()])
    onClose()
  }

  const copyLink = async () => {
    const copied = await writeClipboardText(track.url)
    onToast(copied ? 'Tautan Spotify disalin' : 'Tidak bisa menyalin tautan di perangkat ini')
    onClose()
  }

  const startDownload = () => {
    const result = downloadTrack(track)
    onToast(
      result === 'queued' ? 'Mengunduh… lihat progres di Unduhan' : result === 'already' ? 'Lagu sudah diunduh' : 'Sedang diunduh',
    )
    onClose()
  }

  const removeFromPlaylist = () => {
    if (!sourcePlaylist) return
    const result = removeTrack(sourcePlaylist.id, track.id)
    onToast(result.ok ? 'Dihapus dari playlist' : myPlaylistErrorText(result.reason))
    onClose()
  }

  const releaseManualPin = () => {
    forgetManualPin(track)
    forgetResolved(track)
    forgetAvailability(track)
    onToast('Pilihan manual dilepas. Lagu dicari otomatis lagi')
    onClose()
  }

  const removeFromHistory = () => {
    onToast(historyAt !== undefined && removePlayLogEntry(historyAt, track.id) ? 'Dihapus dari riwayat' : 'Entri riwayat tidak ditemukan')
    onClose()
  }

  const deleteDownload = () => {
    void removeDownload(dlKey)
    onToast('Unduhan dihapus')
    onClose()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      onClose()
      return
    }
    if (event.key !== 'Tab') return
    const items = Array.from(
      sheetRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled])') ?? [],
    )
    if (items.length === 0) return
    const first = items[0]
    const last = items[items.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <OverlayPortal>
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 animate-fade-in bg-black/60" />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Opsi untuk ${track.title}`}
        onKeyDown={onKeyDown}
        className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-md animate-sheet-up rounded-t-2xl border-t border-line bg-card pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] shadow-2xl shadow-black/60 lg:bottom-6 lg:rounded-2xl lg:border"
      >
        <div className="flex items-center gap-3 px-4 pb-3 pt-4">
          <span className="w-12 shrink-0">
            <CoverArt cover={fallback} src={track.cover} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-ink">{track.title}</span>
            <span className="block truncate text-xs text-ink-muted">{track.artists}</span>
          </span>
        </div>

        {relocate && sourcePlaylist ? (
          <PlaylistTransferPanel
            source={sourcePlaylist}
            trackIds={relocate.all ? null : [track.id]}
            mode={relocate.mode}
            onBack={() => setRelocate(null)}
            onDone={(message) => {
              onToast(message)
              onClose()
            }}
          />
        ) : picking ? (
          <AddToPlaylistPicker
            track={track}
            onBack={() => setPicking(false)}
            onDone={(message, action) => {
              onToast(message, action)
              onClose()
            }}
          />
        ) : (
          <>
            {!hasQueue && (
              <p className="mx-4 mb-2 rounded-md bg-raised px-3 py-2 text-xs text-ink-muted">
                Belum ada antrean. Memilih salah satu opsi antrean akan memutar lagu ini lebih dulu.
              </p>
            )}

            {!canQueue && (
              <p className="mx-4 mb-2 rounded-md bg-raised px-3 py-2 text-xs text-ink-muted">
                Antrean sedang berisi lagu dari playlist lain. Cari lagu ini lewat halaman Cari untuk menambahkannya ke antrean.
              </p>
            )}

            <ul className="border-t border-line px-2 pt-2">
              <Action
                icon={isCurrent ? RotateCcw : Play}
                label={isCurrent ? 'Putar ulang dari awal' : 'Putar sekarang'}
                hint={!online && !downloaded && !isCurrent ? 'Tidak ada internet dan lagu ini belum diunduh' : undefined}
                onClick={() => {
                  player.playTrack(track, -1)
                  onClose()
                }}
              />
              {canQueue && (
                <Action
                  icon={ListEnd}
                  label="Putar berikutnya"
                  hint={hasQueue ? 'Tepat setelah lagu yang sedang diputar' : undefined}
                  onClick={() => run(() => player.playNextInQueue(track, { fromSearch }))}
                  disabled={isCurrent}
                />
              )}
              {inQueue ? (
                <Action
                  icon={ListX}
                  label="Hapus dari antrean"
                  onClick={() => {
                    player.removeUpcoming(upcomingPosition)
                    onToast('Dihapus dari antrean')
                    onClose()
                  }}
                  danger
                />
              ) : (
                canQueue && (
                  <Action
                    icon={ListPlus}
                    label="Tambah ke antrean"
                    hint={hasQueue ? 'Di urutan paling akhir' : undefined}
                    onClick={() => run(() => player.addToQueue(track, { fromSearch }))}
                    disabled={isCurrent}
                  />
                )
              )}
              <Action icon={FolderPlus} label="Simpan ke playlist saya" onClick={() => setPicking(true)} />
              {sourcePlaylist && inSource && (
                <>
                  <Action
                    icon={Copy}
                    label="Salin ke playlist lain"
                    hint="Lagu tetap ada di playlist ini"
                    onClick={() => setRelocate({ mode: 'copy', all: false })}
                  />
                  <Action
                    icon={ArrowRightLeft}
                    label="Pindahkan ke playlist lain"
                    hint="Dihapus dari playlist ini"
                    onClick={() => setRelocate({ mode: 'move', all: false })}
                  />
                  <Action
                    icon={FolderInput}
                    label={`Pindahkan semua lagu (${sourcePlaylist.tracks.length})`}
                    hint="Seluruh isi playlist ini ke playlist lain"
                    onClick={() => setRelocate({ mode: 'move', all: true })}
                  />
                  <Action
                    icon={Trash2}
                    label="Hapus dari playlist ini"
                    hint="Lagu tetap ada di playlist lain"
                    onClick={removeFromPlaylist}
                    danger
                  />
                </>
              )}
              {pinned && (
                <Action
                  icon={Undo2}
                  label="Lepas pilihan manual"
                  hint="Kembali ke pencarian otomatis untuk lagu ini"
                  onClick={releaseManualPin}
                />
              )}
              <Action
                icon={Radio}
                label="Mulai radio dari lagu ini"
                hint="Lagu ini diputar, lalu dilanjut lagu mirip (artis sama dan serupa). Antrean diganti."
                onClick={() => {
                  // Lagu mirip ditambahkan oleh AutoRadioSync begitu lagu ini mulai diputar (antrean hanya berisi lagu ini).
                  beginRadio(track)
                  markRadioTracks([track])
                  player.playAll([track])
                  onToast('Radio dimulai, mencari lagu mirip…')
                  onClose()
                }}
              />
              {place === 'player' && (
                <Action
                  icon={Share2}
                  label={sharing ? 'Membuat kartu…' : 'Bagikan kartu lagu'}
                  hint="Gambar sampul, judul, dan warna aksen untuk status atau story"
                  disabled={sharing}
                  onClick={() => {
                    setSharing(true)
                    void shareNowPlayingCard(track).then((result) => {
                      setSharing(false)
                      if (result.message) onToast(result.message)
                      if (result.ok) onClose()
                    })
                  }}
                />
              )}
              {place === 'player' && (
                <Action
                  icon={Gauge}
                  label={`Kecepatan putar (${speedLabel(speed)})`}
                  hint="Nada tetap, berlaku untuk semua lagu"
                  onClick={() => setSpeedOpen(true)}
                />
              )}
              {place === 'history' && historyAt !== undefined && (
                <Action icon={History} label="Hapus dari riwayat" hint="Hanya entri putar ini" onClick={removeFromHistory} danger />
              )}
              {native &&
                !isLocal &&
                (downloaded ? (
                  <Action icon={Trash2} label="Hapus unduhan" hint="Lagu ini bisa diputar offline" onClick={deleteDownload} danger />
                ) : (
                  <Action
                    icon={Download}
                    label={downloading ? 'Sedang diunduh…' : 'Unduh untuk offline'}
                    hint={
                      downloading
                        ? undefined
                        : !online
                          ? 'Perlu internet untuk mengunduh'
                          : 'Simpan di perangkat agar bisa diputar tanpa internet'
                    }
                    onClick={startDownload}
                    disabled={downloading || !online}
                  />
                ))}
              {href && <Action icon={Link2} label="Salin tautan Spotify" onClick={() => void copyLink()} />}
              {href && (
                <li>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={onClose}
                    className={`flex min-h-[3rem] w-full items-center gap-4 rounded-md px-3 text-sm font-medium text-ink transition-colors hover:bg-raised active:bg-raised ${FOCUS}`}
                  >
                    <ExternalLink className="h-5 w-5 shrink-0" aria-hidden="true" />
                    Buka di Spotify
                  </a>
                </li>
              )}
            </ul>
          </>
        )}
      </div>
      {speedOpen && <SpeedSheet onClose={() => setSpeedOpen(false)} />}
    </OverlayPortal>
  )
}
