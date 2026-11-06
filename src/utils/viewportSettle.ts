/**
 * Menunggu ukuran layar berhenti berubah (keyboard layar selesai naik), lalu memanggil `onSettled` satu kali.
 * Selesai bila ukuran tidak berubah selama `quietMs`, atau paling lama `maxMs` sejak dipanggil (jaga-jaga bila ukuran
 * tidak pernah tenang). Mengembalikan fungsi pembatal. Dipakai MiniPlayer: gelembung baru muncul setelah keyboard naik.
 */
export interface SettleOptions {
  quietMs?: number
  maxMs?: number
  pollMs?: number
  /** Pembaca ukuran (diganti saat tes). Dua pembacaan sama = tidak berubah. */
  read?: () => string
}

function readViewport(): string {
  const vv = window.visualViewport
  return `${Math.round(window.innerHeight)}|${vv ? Math.round(vv.height) : ''}`
}

export function waitForViewportSettled(onSettled: () => void, options: SettleOptions = {}): () => void {
  const { quietMs = 140, maxMs = 800, pollMs = 40, read = readViewport } = options
  const start = Date.now()
  let last = read()
  let changedAt = start
  const id = setInterval(() => {
    const now = Date.now()
    const current = read()
    if (current !== last) {
      last = current
      changedAt = now
    }
    if (now - changedAt >= quietMs || now - start >= maxMs) {
      clearInterval(id)
      onSettled()
    }
  }, pollMs)
  return () => clearInterval(id)
}
