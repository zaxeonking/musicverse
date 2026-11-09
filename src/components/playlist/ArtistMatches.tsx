import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ArtistHit } from '../../services/artistApi'
import { artistSearch, cachedArtistSearch } from '../../utils/artistSearchStore'
import ArtistList from './ArtistList'

const MAX_SHOWN = 3

/**
 * Blok "Artis" di atas hasil lagu pada tab Cari: nama artis tampil sebagai baris artis (foto bulat), bukan sebagai lagu.
 * Ketuk membuka halaman artis di tab Cari. Pencarian online (hanya jalan di APK); kalau gagal atau kosong, blok ini tidak tampil.
 */
export default function ArtistMatches({ query }: { query: string }) {
  const navigate = useNavigate()
  const [found, setFound] = useState<ArtistHit[]>([])

  useEffect(() => {
    const text = query.trim()
    if (text.length < 2) {
      setFound([])
      return
    }
    const controller = new AbortController()
    const timer = setTimeout(() => {
      cachedArtistSearch(text, controller.signal)
        .then((hits) => {
          if (!controller.signal.aborted) setFound(hits.slice(0, MAX_SHOWN))
        })
        .catch(() => {
          if (!controller.signal.aborted) setFound([])
        })
    }, 400)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  if (found.length === 0) return null

  return (
    <ArtistList
      title="Artis"
      artists={found}
      onOpen={(artist) => {
        artistSearch.setMode('artist')
        artistSearch.open(artist, true)
        navigate('/search')
      }}
    />
  )
}
