import type { PlaylistTrack } from '../types/spotify'

/**
 * Sumber sampul untuk shared element transition: thumbnail lagu di daftar yang baru diketuk.
 * Baris menandai thumbnail-nya (`data-cover-thumb`) tepat sebelum membuka pemutar penuh; FullPlayer mengambilnya sekali saat
 * dipasang dan menerbangkan sampul besar dari posisi thumbnail itu (dan kembali ke sana saat ditutup). Tanda kedaluwarsa
 * cepat, jadi membuka pemutar lewat mini player / seretan tidak pernah memakai thumbnail lama.
 */
export interface CoverOrigin {
  el: HTMLElement
  track: PlaylistTrack
  at: number
}

const FRESH_MS = 1200
let origin: CoverOrigin | null = null

/** Panggil dari onClick baris, sebelum `openFullPlayer()`. `row` = elemen baris yang memuat `[data-cover-thumb]`. */
export function markCoverOrigin(row: HTMLElement, track: PlaylistTrack): void {
  const el = row.querySelector<HTMLElement>('[data-cover-thumb]')
  origin = el ? { el, track, at: performance.now() } : null
}

/** Ambil (dan kosongkan) tanda yang masih segar; null bila tidak ada atau sudah lewat. */
export function takeCoverOrigin(): CoverOrigin | null {
  const taken = origin
  origin = null
  return taken && performance.now() - taken.at < FRESH_MS ? taken : null
}
