/**
 * Deteksi keyboard layar (IME) di WebView/browser seluler tanpa plugin native. Di Android, WebView mengecil saat keyboard
 * muncul (tinggi `window.innerHeight` turun), jadi keyboard dianggap terbuka bila:
 *   - tinggi layar turun cukup jauh dari tinggi terbesar yang pernah terlihat (baseline), DAN
 *   - ada kolom isian yang sedang fokus, DAN
 *   - perangkatnya layar sentuh dan tidak sedang di-zoom (pinch).
 * Syarat fokus mencegah salah deteksi (mis. jendela dikecilkan / split-screen); histeresis mencegah berkedip di ambang.
 */

export interface KeyboardInput {
  width: number
  /** Tinggi area yang benar-benar terlihat (px CSS). */
  height: number
  /** Skala pinch-zoom (1 = tidak di-zoom). */
  scale: number
  /** Ada <input> teks / <textarea> / contenteditable yang sedang fokus. */
  editableFocused: boolean
  coarsePointer: boolean
}

export interface KeyboardState {
  open: boolean
  baselineWidth: number
  baselineHeight: number
}

export const INITIAL_KEYBOARD_STATE: KeyboardState = { open: false, baselineWidth: 0, baselineHeight: 0 }

/** Penurunan tinggi minimum (px) agar dianggap keyboard; keyboard ponsel jauh di atas ini. */
export const KEYBOARD_MIN_SHRINK_PX = 140
/** ...atau persentase tinggi baseline, mana yang lebih besar. */
export const KEYBOARD_MIN_SHRINK_RATIO = 0.18

export function nextKeyboardState(prev: KeyboardState, input: KeyboardInput): KeyboardState {
  // Di-zoom: tinggi visual mengecil karena zoom, bukan karena keyboard. Abaikan pengukuran ini.
  if (input.scale > 1.01) return prev
  // Perangkat tanpa layar sentuh (desktop): mengubah ukuran jendela tidak boleh dianggap keyboard.
  if (!input.coarsePointer) return prev.open ? { ...prev, open: false } : prev

  // Lebar berubah = rotasi / ukuran jendela lain: ukur ulang baseline dari tinggi sekarang.
  const widthChanged = Math.abs(input.width - prev.baselineWidth) > 1
  const baselineHeight =
    widthChanged || prev.baselineHeight === 0 ? input.height : Math.max(prev.baselineHeight, input.height)

  const shrink = baselineHeight - input.height
  const openAt = Math.max(KEYBOARD_MIN_SHRINK_PX, baselineHeight * KEYBOARD_MIN_SHRINK_RATIO)
  const closeAt = openAt * 0.5
  // Sudah terbuka: tetap terbuka sampai tinggi benar-benar pulih (tidak bergantung fokus: fokus bisa lepas dulu).
  // Belum terbuka: butuh turun jauh DAN ada isian yang fokus.
  const open = prev.open && !widthChanged ? shrink >= closeAt : shrink >= openAt && input.editableFocused

  return { open, baselineWidth: input.width, baselineHeight }
}
