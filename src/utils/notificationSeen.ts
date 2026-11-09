/**
 * Penanda notifikasi (lonceng di Beranda) yang sudah dilihat: tanda tangan isi notifikasi saat lonceng terakhir dibuka.
 * Ada pembaruan versi baru, entri "Yang baru" baru, atau pengumuman baru (mis. migrasi) = tanda tangan berubah = titik di lonceng muncul lagi.
 */
const KEY = 'mv:notif:seen'

export function notificationSignature(updateVersion: string | null, whatsNewId: string | null, noticeId: string | null = null): string {
  return `${updateVersion ?? ''}|${whatsNewId ?? ''}|${noticeId ?? ''}`
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
