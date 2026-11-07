/**
 * Penjaga rantai lagu native (0.4.18+). Saat native pindah lagu sendiri ia mengirim event `advanced` dengan indeks antrean
 * lagu baru. Event yang indeksnya SAMA dengan lagu yang sedang aktif tidak pernah sah: lagu itu baru saja diputar, dan rantai
 * hanya berisi lagu SESUDAH lagu aktif. Bila itu terjadi berulang, native sedang memutar ulang lagu yang sama (loop tanpa
 * ujung walau mode ulang mati) dan JS harus mengambil alih, bukan mengabaikannya.
 */

export interface AdvanceStreak {
  index: number
  /** Berapa kali event `advanced` dengan indeks ini datang beruntun (termasuk yang pertama diterima). */
  count: number
}

export type AdvanceVerdict =
  /** Indeks baru dan dikenal: samakan state dengan lagu itu. */
  | 'accept'
  /** Abaikan (indeks tak dikenal / daftar usang / pengulangan pertama yang mungkin ganda). */
  | 'ignore'
  /** Indeks yang sama datang lagi: native mengulang lagu yang sama. Matikan rantai, JS melanjutkan. */
  | 'loop'

/** Berapa kali indeks yang sama beruntun dianggap loop (1 = diterima normal, 2 = native memutar ulang sekali). */
export const LOOP_STREAK = 2

export function judgeNativeAdvance(args: {
  index: number
  currentIndex: number | null
  /** Indeks itu ada di antrean dan cocok dengan lagu yang diserahkan ke native. */
  mappable: boolean
  streak: AdvanceStreak | null
}): { verdict: AdvanceVerdict; streak: AdvanceStreak | null } {
  const { index, currentIndex, mappable, streak } = args
  if (index === currentIndex) {
    const count = streak !== null && streak.index === index ? streak.count + 1 : 1
    const next = { index, count }
    return { verdict: count >= LOOP_STREAK ? 'loop' : 'ignore', streak: next }
  }
  if (!mappable) return { verdict: 'ignore', streak }
  return { verdict: 'accept', streak: { index, count: 1 } }
}
