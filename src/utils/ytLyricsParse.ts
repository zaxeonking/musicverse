/**
 * Pengurai respons lirik YouTube Music (murni, tanpa jaringan). Bentuk JSON YouTube berubah-ubah, jadi dicari
 * berdasarkan nama kunci di mana pun posisinya, bukan lewat jalur tetap. Gagal membaca = null (sumber berikutnya dipakai).
 */

/** Mencari nilai pertama dari kunci `key` di seluruh pohon JSON. */
function findKey(node: unknown, key: string, depth = 0): unknown {
  if (depth > 40 || node === null || typeof node !== 'object') return undefined
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findKey(child, key, depth + 1)
      if (found !== undefined) return found
    }
    return undefined
  }
  const record = node as Record<string, unknown>
  if (key in record) return record[key]
  for (const child of Object.values(record)) {
    const found = findKey(child, key, depth + 1)
    if (found !== undefined) return found
  }
  return undefined
}

/** browseId tab lirik (awalan "MPLYt") dari respons `next`. null = lagu ini tidak punya lirik di YouTube Music. */
export function parseLyricsBrowseId(next: unknown): string | null {
  let text: string
  try {
    text = JSON.stringify(next)
  } catch {
    return null
  }
  return /"browseId":"(MPLYt[^"]+)"/.exec(text)?.[1] ?? null
}

/** Lirik biasa (tanpa waktu) dari respons `browse` klien web. */
export function parsePlainLyrics(browse: unknown): string | null {
  const shelf = findKey(browse, 'musicDescriptionShelfRenderer')
  const runs = (shelf as { description?: { runs?: unknown } } | undefined)?.description?.runs
  if (!Array.isArray(runs)) return null
  const text = runs.map((run) => (typeof (run as { text?: unknown })?.text === 'string' ? (run as { text: string }).text : '')).join('')
  return text.trim() === '' ? null : text.replace(/\r\n/g, '\n').trim()
}

function stamp(ms: number): string {
  const total = Math.max(0, ms) / 1000
  const minutes = Math.floor(total / 60)
  const seconds = total - minutes * 60
  return `[${String(minutes).padStart(2, '0')}:${seconds.toFixed(2).padStart(5, '0')}]`
}

/** Lirik bertanda waktu (klien ANDROID_MUSIC) diubah ke teks LRC `[mm:ss.xx] teks`. null bila tidak ada. */
export function parseTimedLyricsToLrc(browse: unknown): string | null {
  const data = findKey(browse, 'timedLyricsData')
  if (!Array.isArray(data)) return null
  const rows: string[] = []
  for (const raw of data) {
    const item = raw as { lyricLine?: unknown; cueRange?: { startTimeMilliseconds?: unknown } } | null
    const line = typeof item?.lyricLine === 'string' ? item.lyricLine.replace(/\s+/g, ' ').trim() : null
    const start = Number(item?.cueRange?.startTimeMilliseconds)
    if (line === null || !Number.isFinite(start)) continue
    rows.push(`${stamp(start)}${line}`)
  }
  // Satu dua baris saja bukan lirik utuh (mis. hanya judul): abaikan.
  return rows.length >= 3 ? rows.join('\n') : null
}
