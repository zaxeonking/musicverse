import { ClipboardPaste, Link2, Loader2, X } from 'lucide-react'
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { usePlaylist } from '../../context/PlaylistContext'
import { readClipboardText } from '../../native/clipboard'
import { getSearchSuggestions } from '../../plugins/suggestions'
import { classifyImportInput, validateSpotifyPlaylistUrl } from '../../utils/spotifyUrl'
import { getArtistSearchState, type SearchMode } from '../../utils/artistSearchStore'
import Chip from '../ui/Chip'

interface PlaylistImportFormProps {
  mode: SearchMode
  onModeChange: (mode: SearchMode) => void
  /** Teks artis yang dicari; null = hapus hasil artis. */
  onArtistSearch: (query: string | null) => void
}

export default function PlaylistImportForm({ mode, onModeChange, onArtistSearch }: PlaylistImportFormProps) {
  const { status, loadPlaylist, reset } = usePlaylist()
  // Kembali ke Beranda saat mode Artis: kolom berisi kata kunci artis terakhir, sesuai hasil yang tampil.
  const [value, setValue] = useState(() => {
    const saved = getArtistSearchState()
    return saved.mode === 'artist' ? saved.submitted : ''
  })
  const [validationError, setValidationError] = useState<string | null>(null)
  const inputId = useId()
  const errorId = `${inputId}-error`
  const loading = status === 'loading'
  const inputKind = classifyImportInput(value).kind
  const inputRef = useRef<HTMLInputElement>(null)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [focused, setFocused] = useState(false)

  // Saran judul (YouTube Music) saat mengetik judul; ditunda 300 ms dan dibatalkan bila teks berubah lagi.
  useEffect(() => {
    if (!focused || loading || inputKind !== 'search' || mode === 'artist') {
      setSuggestions([])
      return
    }
    const controller = new AbortController()
    const timer = setTimeout(() => {
      void getSearchSuggestions(value, { signal: controller.signal, limit: 6 }).then((found) => {
        if (!controller.signal.aborted) setSuggestions(found)
      })
    }, 300)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [value, focused, loading, inputKind, mode])

  // Mode Artis: hasil muncul saat mengetik (ditunda 400 ms). Kata kunci yang sudah dicari tidak diulang,
  // jadi kembali ke Beranda dengan artis terbuka tidak menimpanya.
  const artistSearchRef = useRef(onArtistSearch)
  useEffect(() => {
    artistSearchRef.current = onArtistSearch
  })
  useEffect(() => {
    if (mode !== 'artist' || inputKind !== 'search') return
    const text = value.trim()
    if (text.length < 2 || text === getArtistSearchState().submitted) return
    const timer = setTimeout(() => artistSearchRef.current(text), 400)
    return () => clearTimeout(timer)
  }, [value, mode, inputKind])

  async function pickSuggestion(text: string) {
    setSuggestions([])
    setValue(text)
    setValidationError(null)
    await loadPlaylist(text)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (loading) return

    const input = classifyImportInput(value)
    if (input.kind === 'empty') {
      setValidationError(
        mode === 'artist' ? 'Ketik nama artis.' : 'Ketik judul lagu, atau tempel tautan lagu/playlist Spotify.',
      )
      return
    }
    if (mode === 'artist') {
      if (input.kind === 'search') {
        // Nama artis: cari daftar artis (tanpa menyentuh playlist/hasil lagu yang sedang tampil).
        setValidationError(null)
        onArtistSearch(input.query)
        return
      }
      // Tautan Spotify ditempel saat mode Artis: pakai alur lama (lagu/playlist).
      onModeChange('track')
    }
    if (input.kind === 'playlist') {
      const result = validateSpotifyPlaylistUrl(value)
      if (!result.valid) {
        setValidationError(result.message)
        return
      }
    }
    setValidationError(null)
    await loadPlaylist(value)
  }

  /** Kosongkan input dan langsung kembali ke beranda: batalkan permintaan yang berjalan, hapus hasil. */
  function handleReset() {
    if (mode === 'artist') onArtistSearch(null)
    reset()
    setValue('')
    setValidationError(null)
  }

  /** Tempel teks dari clipboard; pencarian tetap manual (tekan tombol/Enter). */
  async function handlePaste() {
    const raw = await readClipboardText()
    if (raw === null) {
      // Tidak bisa dibaca sama sekali: arahkan ke tempel manual (tekan lama di kolom, pilih Tempel).
      inputRef.current?.focus()
      setValidationError('Tidak bisa membaca clipboard. Tekan lama di kolom ini lalu pilih Tempel.')
      return
    }
    const text = raw.trim()
    if (!text) {
      setValidationError('Clipboard kosong. Salin judul atau tautan lagu dulu.')
      return
    }
    setValue(text)
    setValidationError(null)
    inputRef.current?.focus()
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-busy={loading} className="space-y-2" aria-label="Impor playlist Spotify">
      <label htmlFor={inputId} className="sr-only">
        Judul lagu, tautan lagu, atau tautan playlist Spotify
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Link2
            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted"
            aria-hidden="true"
          />
          <input
            data-tour="import-input"
            id={inputId}
            ref={inputRef}
            type="text"
            inputMode="search"
            enterKeyHint="search"
            value={value}
            onChange={(e) => {
              const next = e.target.value
              if (next.trim() === '') {
                // Dihapus sampai kosong: tidak mungkin ada hasil, jadi langsung kembali tanpa menunggu.
                handleReset()
                return
              }
              setValue(next)
              if (validationError) setValidationError(null)
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={mode === 'artist' ? 'Nama artis' : 'Judul lagu, tautan lagu, atau tautan playlist'}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={validationError ? true : undefined}
            aria-describedby={validationError ? errorId : undefined}
            className={`h-12 w-full rounded-full bg-raised pl-12 pr-14 text-base text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 ${
              validationError ? 'ring-2 ring-danger focus:ring-danger' : 'focus:ring-accent'
            }`}
          />
          {value.length > 0 ? (
            <button
              type="button"
              onClick={handleReset}
              aria-label="Hapus pencarian"
              className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-ink-muted transition-colors hover:text-ink active:bg-white/10 focus-ring"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handlePaste()}
              aria-label="Tempel dari clipboard"
              className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-ink-muted transition-colors hover:text-ink active:bg-white/10 focus-ring"
            >
              <ClipboardPaste className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
          {suggestions.length > 0 && (
            <ul
              role="listbox"
              aria-label="Saran judul"
              className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-2xl bg-raised py-1 shadow-lg ring-1 ring-white/10"
            >
              {suggestions.map((text) => (
                <li key={text} role="option" aria-selected={false}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => void pickSuggestion(text)}
                    className="block w-full truncate px-4 py-2.5 text-left text-sm text-ink active:bg-white/10"
                  >
                    {text}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="btn-primary h-12 flex-1 px-6 text-base sm:flex-none"
          >
            {loading && (
              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            )}
            {loading
              ? 'Memuat…'
              : inputKind === 'playlist'
                ? 'Muat playlist'
                : inputKind === 'track'
                  ? 'Muat lagu'
                  : mode === 'artist'
                    ? 'Cari artis'
                    : 'Cari lagu'}
          </button>
        </div>
      </div>
      <div data-tour="search-mode" className="flex gap-2" role="group" aria-label="Jenis pencarian">
        <Chip active={mode === 'track'} onClick={() => onModeChange('track')}>
          Lagu
        </Chip>
        <Chip active={mode === 'artist'} onClick={() => onModeChange('artist')}>
          Artis
        </Chip>
      </div>
      {validationError && (
        <p id={errorId} role="alert" className="text-sm text-danger">
          {validationError}
        </p>
      )}
    </form>
  )
}
