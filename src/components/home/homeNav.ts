import type { ArtistHit } from '../../services/artistApi'
import { artistSearch } from '../../utils/artistSearchStore'

/**
 * Membuka halaman artis dari Beranda atau jelajah. Hasil artis tampil di tab Cari, jadi pemanggil dari luar tab Cari
 * menyusulinya dengan `navigate('/search')`. Artis yang dibuka dari sini diingat (`fromFeed`), supaya saat pengguna
 * kembali dari halaman artis, tab Cari kembali ke jelajah (bukan daftar "Terakhir dibuka" mode Artis).
 */
let fromFeed = false

export function openArtistFromFeed(hit: ArtistHit): void {
  fromFeed = true
  artistSearch.setMode('artist')
  artistSearch.open(hit, true)
}

export function searchArtistFromFeed(name: string): void {
  fromFeed = true
  artistSearch.setMode('artist')
  artistSearch.search(name)
}

/** True sekali bila halaman artis yang dibuka lewat Beranda/jelajah sudah ditutup. */
export function consumeFeedReturn(): boolean {
  const was = fromFeed
  fromFeed = false
  return was
}

/** Alamat detail playlist Deezer (isi lagunya tampil di tab Cari, seperti suasana dan genre). */
export function playlistPath(id: string, title: string): string {
  return `/search?view=playlist&id=${encodeURIComponent(id)}&name=${encodeURIComponent(title)}`
}

/** Alamat detail album; judul, artis, dan sampul ikut di alamat supaya halaman tidak perlu memuat ulang infonya. */
export function albumPath(album: { id: string; title: string; artist: string; cover: string }): string {
  const q = new URLSearchParams({ view: 'album', id: album.id, name: album.title, artist: album.artist, cover: album.cover })
  return `/search?${q.toString()}`
}
