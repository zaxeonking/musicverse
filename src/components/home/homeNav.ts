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
