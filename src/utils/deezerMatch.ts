/** Baris hasil pencarian Deezer yang dibutuhkan untuk mencocokkan lagu (`/search`). */
export interface DeezerMatchRow {
  id?: number
  title?: string
  duration?: number
  artist?: { name?: string }
}

/** Selisih durasi terbesar (detik) antara lagu dan hasil Deezer yang masih dianggap rekaman yang sama. */
export const MAX_ISRC_DURATION_DIFF_S = 4

function norm(value: string, dropBrackets = true): string {
  const base = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  return (dropBrackets ? base.replace(/\s*[([][^)\]]*[)\]]/g, ' ') : base) // "(feat. X)", "[Remastered]"
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

/**
 * Pilih lagu Deezer yang BENAR-BENAR rekaman yang sama: judul sama persis (tanpa keterangan dalam kurung) DAN artis cocok,
 * dan durasi (bila diketahui kedua sisi) selisih <= 4 dtk. Berbeda dengan `findDeezerSeed`, tidak ada cadangan "artis sama
 * saja": ISRC lagu lain membuat Binimum mengembalikan lirik lagu yang salah, jadi lebih baik tanpa ISRC.
 * Yang durasinya paling dekat dipilih (judul persis tanpa keterangan menang seri). Tanpa durasi, hanya judul PERSIS (dengan
 * keterangan kurung ikut dibandingkan) yang diterima, karena "(Live)" / "(Remix)" itu rekaman lain dengan ISRC lain.
 */
export function pickDeezerTrackId(rows: readonly DeezerMatchRow[], title: string, artist: string, durationS?: number | null): string | undefined {
  const wantedTitle = norm(title)
  const wantedArtist = norm(artist)
  if (!wantedTitle || !wantedArtist) return undefined
  const known = typeof durationS === 'number' && Number.isFinite(durationS) && durationS > 0
  let best: { id: string; gap: number } | undefined
  for (const row of rows) {
    if (!row.id || norm(row.title ?? '') !== wantedTitle) continue
    const exact = norm(row.title ?? '', false) === wantedTitle
    if (!known && !exact) continue
    const got = norm(row.artist?.name ?? '')
    if (!got || !(got === wantedArtist || got.includes(wantedArtist) || wantedArtist.includes(got))) continue
    let gap = 0
    if (known && typeof row.duration === 'number' && row.duration > 0) {
      gap = Math.abs(row.duration - (durationS as number))
      if (gap > MAX_ISRC_DURATION_DIFF_S) continue
    }
    if (!exact) gap += 0.1
    if (!best || gap < best.gap) best = { id: String(row.id), gap }
  }
  return best?.id
}
