import type { LyricPriority } from './lyricProviderPrefs'

/** Bagian hasil lirik yang dipakai aturan ini (tipe lengkapnya `LyricsResult` di services/lyricsApi). */
type LegacyResult =
  | { kind: 'synced'; lines: readonly unknown[]; source?: string }
  | { kind: 'plain'; source?: string }
  | { kind: 'instrumental' }
  | { kind: 'none' }

/**
 * Hasil provider kata menang atas sumber lama hanya bila benar-benar lebih baik DAN tidak melawan sumber yang diutamakan
 * pengguna: teks lirik antar-sumber bisa berbeda (versi / edit lirik lain), jadi sumber yang diutamakan tidak ditimpa.
 */
export function shouldPreferWord(word: { lines: readonly unknown[]; wordSynced: boolean }, legacy: LegacyResult | null, priority: LyricPriority = 'ytmusic'): boolean {
  if (!legacy) return true
  if (legacy.kind === 'instrumental') return false // LRCLIB menandai instrumental: jangan dibantah oleh hasil kata yang meragukan
  if (legacy.kind === 'synced' || legacy.kind === 'plain') {
    if (priority === 'ytmusic' && legacy.source === 'ytmusic') return false
    if (priority === 'lrclib' && (legacy.source === 'lrclib' || legacy.source === 'netease')) return false
  }
  if (legacy.kind === 'synced') {
    // Hasil per baris dari provider kata tidak menambah apa-apa di atas sumber lama; hasil per kata menang bila cukup lengkap.
    return word.wordSynced && word.lines.length >= legacy.lines.length * 0.6
  }
  return true // sumber lama hanya lirik polos / tidak ada: lirik berwaktu dari provider kata lebih baik
}
