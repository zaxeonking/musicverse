import { Loader2, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Cover } from '../../types'
import CoverArt from '../ui/CoverArt'

interface BrowseTileProps {
  title: string
  cover: Cover
  /** Gambar di pojok (genre). Tanpa ini pojok diisi `icon`, atau bentuk sampul bila keduanya kosong (suasana). */
  image?: string
  icon?: LucideIcon
  to?: string
  onClick?: () => void
  busy?: boolean
  /** Kotak lebar penuh dan lebih tinggi (mis. Kejutkan aku). */
  wide?: boolean
}

/**
 * Kotak jelajah tab Cari: warna sendiri, judul di kiri atas, hiasan miring di pojok kanan bawah (gaya mirip Spotify,
 * tapi hiasannya bentuk sampul MusicVerse sendiri, jadi tetap tampil rapi tanpa gambar dari jaringan).
 */
export default function BrowseTile({ title, cover, image, icon: Icon, to, onClick, busy = false, wide = false }: BrowseTileProps) {
  const className = `focus-ring relative block w-full overflow-hidden rounded-xl p-3 text-left text-white transition-transform duration-150 active:scale-[0.97] motion-reduce:active:scale-100 ${
    wide ? 'col-span-2 h-28' : 'h-24'
  }`
  const style = { background: `linear-gradient(135deg, ${cover.from}, ${cover.to})` }
  const body = (
    <>
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 to-transparent" />
      <span className={`relative block font-display font-bold leading-tight ${wide ? 'max-w-[65%] text-xl' : 'max-w-[62%] text-base'}`}>{title}</span>
      {busy ? (
        <Loader2 className="absolute bottom-3 right-3 h-6 w-6 animate-spin text-white/80 motion-reduce:animate-none" aria-hidden="true" />
      ) : Icon && !image ? (
        <Icon aria-hidden="true" className={`absolute -bottom-2 -right-1 rotate-12 text-white/30 ${wide ? 'h-24 w-24' : 'h-16 w-16'}`} />
      ) : (
        <span aria-hidden="true" className={`absolute -bottom-3 -right-3 rotate-[22deg] rounded-md shadow-lg shadow-black/40 ${wide ? 'w-24' : 'w-[4.5rem]'}`}>
          <CoverArt cover={{ from: cover.to, to: cover.from, shape: cover.shape }} src={image} />
        </span>
      )}
    </>
  )
  if (to) {
    return (
      <Link to={to} className={className} style={style}>
        {body}
      </Link>
    )
  }
  return (
    <button type="button" onClick={onClick} disabled={busy} className={className} style={style}>
      {body}
    </button>
  )
}
