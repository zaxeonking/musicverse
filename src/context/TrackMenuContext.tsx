/* eslint-disable react-refresh/only-export-components */
import { Check, Heart, HeartOff, Trash2 } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import TrackMenuSheet from '../components/player/TrackMenuSheet'
import type { PlaylistTrack } from '../types/spotify'
import Presence from '../components/ui/Presence'

/** Dari mana menu dibuka; menu menyesuaikan opsinya dengan tempat (selain kondisi lagunya). */
export type TrackMenuPlace =
  | 'playlist' // daftar lagu playlist Spotify
  | 'search' // halaman Cari / hasil cari judul atau tautan lagu
  | 'my-playlist' // halaman playlist buatan sendiri
  | 'downloads' // daftar Unduhan
  | 'history' // Riwayat / Baru diputar
  | 'browse' // detail Artis & Album
  | 'player' // lagu yang sedang diputar (mini player, pemutar penuh, antrean)
  | 'queue' // baris di "Berikutnya"

export interface TrackMenuOptions {
  /** Baris itu hasil pencarian: hanya dari sana lagu di luar antrean boleh dimasukkan ke antrean. */
  fromSearch?: boolean
  /** ID "Playlist saya" tempat baris itu berada: menu menambah opsi salin / pindahkan / hapus dari playlist itu. */
  fromPlaylistId?: string
  place?: TrackMenuPlace
  /** Waktu putar entri Riwayat (PlayLogEntry.at): dengan place 'history' menu menambah "Hapus dari riwayat". */
  historyAt?: number
}

/** Jenis umpan balik toast: ikon kecil yang membal di depan pesan (suka, batal suka, ditambahkan, dihapus). Tanpa `tone` = pesan biasa. */
export type ToastTone = 'added' | 'removed' | 'like' | 'unlike'

const TONE_ICON = { added: Check, removed: Trash2, like: Heart, unlike: HeartOff } as const

/** Tombol di dalam toast (mis. Urungkan). Toast yang punya tombol tampil lebih lama. */
export interface ToastAction {
  label: string
  onClick: () => void
}

interface TrackMenuApi {
  /** Membuka menu opsi untuk satu lagu dari daftar mana pun. Identitasnya stabil. */
  openTrackMenu: (track: PlaylistTrack, options?: TrackMenuOptions) => void
  /** Menampilkan pesan singkat di bawah layar. */
  showToast: (message: string, action?: ToastAction, tone?: ToastTone) => void
}

const TrackMenuContext = createContext<TrackMenuApi | null>(null)

const TOAST_MS = 2400
const TOAST_ACTION_MS = 6000

/**
 * Pemilik satu-satunya menu opsi lagu (tahan lama pada baris lagu di seluruh aplikasi) dan toast.
 * Harus berada di dalam <AudioPlayerProvider>. State menu/toast hanya dirender di sini, sehingga
 * daftar lagu tidak ikut render ulang saat menu dibuka atau ditutup.
 */
export function TrackMenuProvider({ children }: { children: ReactNode }) {
  const [menu, setMenu] = useState<{
    track: PlaylistTrack
    fromSearch: boolean
    fromPlaylistId?: string
    place?: TrackMenuPlace
    historyAt?: number
  } | null>(null)
  const [toast, setToast] = useState<{ id: number; message: string; action?: ToastAction; tone?: ToastTone } | null>(null)
  const toastTimer = useRef<number | null>(null)

  const openTrackMenu = useCallback(
    (next: PlaylistTrack, options?: TrackMenuOptions) =>
      setMenu({
        track: next,
        fromSearch: options?.fromSearch === true,
        fromPlaylistId: options?.fromPlaylistId,
        place: options?.place,
        historyAt: options?.historyAt,
      }),
    [],
  )
  const closeMenu = useCallback(() => setMenu(null), [])

  const showToast = useCallback((message: string, action?: ToastAction, tone?: ToastTone) => {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
    setToast({ id: Date.now(), message, action, tone })
    toastTimer.current = window.setTimeout(() => setToast(null), action ? TOAST_ACTION_MS : TOAST_MS)
  }, [])
  useEffect(
    () => () => {
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
    },
    [],
  )

  const api = useMemo<TrackMenuApi>(() => ({ openTrackMenu, showToast }), [openTrackMenu, showToast])

  return (
    <TrackMenuContext.Provider value={api}>
      {children}
      {menu && (
        <TrackMenuSheet
          track={menu.track}
          fromSearch={menu.fromSearch}
          fromPlaylistId={menu.fromPlaylistId}
          place={menu.place}
          historyAt={menu.historyAt}
          onClose={closeMenu}
          onToast={showToast}
        />
      )}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(9.5rem+var(--sab))] z-[65] flex justify-center px-4 lg:bottom-28"
      >
        <Presence show={toast !== null} mode="float">
          {toast && (
          <div
            key={toast.id}
            className="mv-pop flex max-w-sm items-center gap-2 rounded-full bg-raised py-2.5 pl-4 pr-4 text-center text-sm font-medium text-ink shadow-xl shadow-black/50"
          >
            {toast.tone && (() => {
              const ToneIcon = TONE_ICON[toast.tone]
              return (
                <ToneIcon
                  aria-hidden="true"
                  style={{ '--mv-delay': '90ms' } as CSSProperties}
                  className={`mv-pop -ml-1 h-4 w-4 shrink-0 ${toast.tone === 'removed' || toast.tone === 'unlike' ? 'text-ink-muted' : 'text-accent'}`}
                  fill={toast.tone === 'like' ? 'currentColor' : 'none'}
                />
              )
            })()}
            <p className="min-w-0">{toast.message}</p>
            {toast.action && (
              <button
                type="button"
                onClick={() => {
                  const { onClick } = toast.action as ToastAction
                  if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
                  setToast(null)
                  onClick()
                }}
                className="pointer-events-auto -my-1 -mr-2 shrink-0 rounded-full px-3 py-1.5 font-semibold text-accent hover:bg-veil/10 active:bg-veil/15 focus-ring"
              >
                {toast.action.label}
              </button>
            )}
          </div>
          )}
        </Presence>
      </div>
    </TrackMenuContext.Provider>
  )
}

export function useTrackMenu(): TrackMenuApi {
  const api = useContext(TrackMenuContext)
  if (!api) throw new Error('useTrackMenu harus dipakai di dalam <TrackMenuProvider>.')
  return api
}
