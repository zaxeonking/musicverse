/**
 * Penanda notifikasi (lonceng di Beranda) yang sudah dilihat: tanda tangan isi notifikasi saat lonceng terakhir dibuka.
 * Ada pembaruan versi baru atau entri "Yang baru" baru = tanda tangan berubah = titik di lonceng muncul lagi.
 */
const KEY = 'mv:notif:seen'

export function notificationSignature(updateVersion: string | null, whatsNewId: string | null): string {
  return `${updateVersion ?? ''}|${whatsNewId ?? ''}`
}

export function readNotificationSeen(): string | null {
  try {
    return window.localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function markNotificationSeen(signature: string): void {
  try {
    window.localStorage.setItem(KEY, signature)
  } catch {
    /* abaikan */
  }
}
