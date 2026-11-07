import { normalizeSearchText } from './trackSearch'

function plain(value: string): string {
  return normalizeSearchText(value).replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim()
}

function artistList(artists: string): string[] {
  return normalizeSearchText(artists)
    .split(/\s*(?:,|&|;| feat\.? | ft\.? | and | x )\s*/)
    .map(plain)
    .filter(Boolean)
}

function isArtist(part: string, names: string[]): boolean {
  const p = plain(part)
  if (!p) return false
  return names.some((n) => p === n || (p.length >= 3 && n.includes(p)) || (n.length >= 3 && p.includes(n)))
}

/**
 * HANYA untuk pencocokan dan pencarian (lirik, verifikasi unduhan, pencarian audio): judul playlist kadang berformat
 * "Artis - Judul" sehingga bagian artis dibuang agar perbandingan adil. Hasilnya TIDAK PERNAH disimpan atau ditampilkan;
 * judul lagu selalu persis seperti dari server. Hanya membuang bagian yang jelas nama artis (nama utuh, minimal 3 huruf)
 * dan tidak pernah menghasilkan judul yang terlalu pendek (judul seperti "Ho-Kago Tea Time" tidak boleh menjadi "Ho").
 */
export function stripArtistPrefix(title: string, artists: string): string {
  const trimmed = title.trim()
  const names = artistList(artists)
  if (names.length === 0) return trimmed
  // Pemisah: " - ", " – ", " — ", " | " (dengan spasi di kedua sisi).
  const seps = [...trimmed.matchAll(/\s+[-\u2013\u2014|]\s+/g)]
  if (seps.length === 0) return trimmed
  const usable = (value: string) => plain(value).length >= 3
  // Nama artis yang sendiri memuat pemisah (\"Ho - Kago Tea Time\"): gabungan beberapa segmen di awal/akhir yang PERSIS sama
  // dengan nama artis dibuang, sisanya adalah judul. Contoh: \"Ho - Kago Tea Time - Pure Pure Heart\" -> \"Pure Pure Heart\".
  for (let k = 0; k < seps.length; k += 1) {
    const sep = seps[k]
    const lead = trimmed.slice(0, sep.index)
    const rest = trimmed.slice((sep.index ?? 0) + sep[0].length).trim()
    if (usable(rest) && names.includes(plain(lead))) return rest
  }
  for (let k = seps.length - 1; k >= 0; k -= 1) {
    const sep = seps[k]
    const head = trimmed.slice(0, sep.index).trim()
    const tail = trimmed.slice((sep.index ?? 0) + sep[0].length)
    if (usable(head) && names.includes(plain(tail))) return head
  }
  const first = seps[0]
  const lead = trimmed.slice(0, first.index)
  const rest = trimmed.slice(first.index + first[0].length).trim()
  // Kedua sisi sama-sama terbaca sebagai artis: ambigu, jangan dipotong.
  if (rest && usable(rest) && isArtist(lead, names) && !isArtist(rest, names)) return rest
  const last = seps[seps.length - 1]
  const head = trimmed.slice(0, last.index).trim()
  const tail = trimmed.slice(last.index + last[0].length)
  if (head && usable(head) && isArtist(tail, names) && !isArtist(head, names)) return head
  return trimmed
}

/** Judul untuk ditampilkan: persis seperti yang diterima dari server. */
export function displayTitle(title: string): string {
  return title.trim()
}
