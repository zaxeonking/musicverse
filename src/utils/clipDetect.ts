/** Audio sepanjang ini atau kurang dianggap kandidat klip/cuplikan (bukan lagu penuh). */
export const CLIP_MAX_S = 35
/** Selisih minimal dengan durasi lagu yang diharapkan agar audio dianggap klip. */
export const CLIP_MIN_GAP_S = 20
/** Audio di bawah rasio ini dari durasi lagu (dengan selisih >= CLIP_FAR_GAP_S) dianggap salah lagu/cuplikan. */
export const CLIP_MAX_RATIO = 0.6
export const CLIP_FAR_GAP_S = 45
/** Audio yang lebih pendek dari lagu dengan selisih melebihi batas ini (detik atau persen, mana yang lebih besar) ditolak. */
export const SHORT_TOLERANCE_S = 25
export const SHORT_TOLERANCE_RATIO = 0.12

/**
 * Apakah audio yang benar-benar termuat (`actual`, detik) BUKAN lagu yang ada di playlist: klip/cuplikan, lagu lain, atau
 * versi lain (radio edit, live, extended) yang durasinya beda dari lagu di playlist (`expected`, detik dari data playlist)?
 * Pemutaran harus mengikuti playlist, jadi selisih dihitung dua arah dan toleransinya ketat (sama dengan unduhan).
 * Durasi di metadata API tidak bisa dipercaya untuk ini (sering durasi lagu asli), jadi yang
 * dibandingkan adalah durasi file audio sebenarnya.
 */
export function isLikelyClip(actual: number | null, expected: number | null): boolean {
  if (actual === null || expected === null) return false
  if (!Number.isFinite(actual) || actual <= 0) return false
  const gap = expected - actual
  if (actual <= CLIP_MAX_S && gap >= CLIP_MIN_GAP_S) return true
  if (actual < expected * CLIP_MAX_RATIO && gap >= CLIP_FAR_GAP_S) return true
  return strictDurationProblem(actual, expected) !== null
}

/**
 * Kecocokan durasi audio sebenarnya dengan durasi lagu di playlist, 0..1 (null jika salah satu tidak diketahui).
 * 1 = selisih <= 1,5 dtk (sama); 0.5 = <= 5 dtk; selebihnya 0 (versi lain).
 */
export function durationFit(actual: number | null, expected: number | null): number | null {
  if (actual === null || expected === null) return null
  if (!Number.isFinite(actual) || !Number.isFinite(expected) || actual <= 0 || expected <= 0) return null
  const diff = Math.abs(actual - expected)
  if (diff <= STRICT_DIFF_S) return 1
  if (diff <= 5) return 0.5
  return 0
}

/** Mode unduhan: selisih durasi maksimum antara berkas dan lagu di playlist (detik, atau persen; mana yang lebih besar). */
/** Tanpa toleransi persentase: durasi audio harus sama dengan playlist. Hanya 1,5 dtk yang diberikan untuk pembulatan
 * (playlist dalam detik utuh, durasi file berupa desimal) dan padding encoder MP3; selisih lebih dari itu = versi lain. */
export const STRICT_DIFF_S = 1.5
export const STRICT_DIFF_RATIO = 0
/** Tanpa durasi acuan dari playlist, berkas sependek ini atau kurang ditolak. */
export const STRICT_MIN_UNKNOWN_S = 60

/**
 * Pemeriksaan durasi ketat untuk unduhan (dua arah: lebih pendek DAN lebih panjang ditolak, mis. versi live,
 * extended, atau lagu lain). null = lolos; selain itu alasan penolakan. `actual` null (tak terbaca) TIDAK dianggap
 * lolos di sini: pemanggil menentukan cara lain memverifikasinya.
 */
export function strictDurationProblem(actual: number | null, expected: number | null): string | null {
  if (actual === null || !Number.isFinite(actual) || actual <= 0) return 'Durasi berkas tidak bisa dibaca.'
  if (expected === null || !Number.isFinite(expected) || expected <= 0) {
    return actual <= STRICT_MIN_UNKNOWN_S ? `Berkas hanya ${Math.round(actual)} dtk, kemungkinan cuplikan.` : null
  }
  const diff = Math.abs(actual - expected)
  const tolerance = Math.max(STRICT_DIFF_S, expected * STRICT_DIFF_RATIO)
  if (diff <= tolerance) return null
  return `Durasi audio (${Math.round(actual)} dtk) berbeda ${Math.round(diff)} dtk dari lagu di playlist (${Math.round(expected)} dtk).`
}
