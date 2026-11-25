/**
 * Logika profil akun yang murni (tanpa Firebase/DOM) supaya bisa diuji dengan `npm run test:account`.
 * Aturannya disamakan dengan Android 6.1.0 (AccountAuthModel.kt / ProfileAvatar.kt).
 */

export const NAME_MIN = 3
export const NAME_MAX = 40
export const FALLBACK_NAME = 'MusicVerse User'

/** Nama valid = 3-40 karakter setelah dirapikan. Mengembalikan nama bersih atau pesan galat. */
export function validateDisplayName(raw: string): { ok: true; name: string } | { ok: false; error: string } {
  const name = raw.trim().replace(/\s+/g, ' ')
  if (name.length < NAME_MIN || name.length > NAME_MAX) {
    return { ok: false, error: `Nama harus terdiri dari ${NAME_MIN}–${NAME_MAX} karakter.` }
  }
  return { ok: true, name }
}

/**
 * Nama yang dipakai: nama tersimpan di Firestore (hasil edit pengguna) menang, lalu nama Firebase Auth,
 * lalu bagian depan email (titik -> garis bawah), lalu "MusicVerse User".
 */
export function resolveDisplayName(input: {
  savedName?: string | null
  authName?: string | null
  email?: string | null
}): string {
  const clean = (v?: string | null) => (v && v.trim() ? v.trim() : null)
  const fromEmail = clean(input.email?.split('@')[0]?.replace(/\./g, '_'))
  return clean(input.savedName) ?? clean(input.authName) ?? fromEmail ?? FALLBACK_NAME
}

/** Inisial untuk avatar cadangan: maks. 2 huruf (huruf pertama dua kata pertama), huruf besar. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/[\s_.-]+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const letters = parts.length === 1 ? Array.from(parts[0]).slice(0, 2) : [Array.from(parts[0])[0], Array.from(parts[1])[0]]
  return letters.join('').toLocaleUpperCase()
}

/**
 * Thumbnail foto Google: googleusercontent memakai akhiran `=sN-c` (persegi N px). Foto lama berakhiran `=s96-c`
 * diganti, URL tanpa parameter diberi akhiran. URL lain dikembalikan apa adanya.
 */
export function avatarThumb(url: string | null | undefined, size: number): string | null {
  if (!url) return null
  if (!/^https:\/\/[^/]*googleusercontent\.com\//i.test(url)) return url
  const px = [96, 192, 288, 384].find((s) => s >= size) ?? 384
  const stripped = url.replace(/=[sw]\d+(-[a-z0-9-]+)?$/i, '')
  return `${stripped}=s${px}-c`
}

/** Dokumen `users/{uid}`: bidang yang sama dengan Android (createdAt hanya ditulis saat dokumen belum ada). */
export function buildProfileDoc(input: {
  uid: string
  displayName: string
  email?: string | null
  photoURL?: string | null
}): Record<string, string> {
  const doc: Record<string, string> = { uid: input.uid, displayName: input.displayName, provider: 'google.com' }
  if (input.email) doc.email = input.email
  if (input.photoURL) doc.photoURL = input.photoURL
  return doc
}

/** Galat Firebase Auth -> pesan Indonesia. Kode yang tidak dikenal memakai pesan umum. */
export function authErrorMessage(error: unknown, fallback: string): string {
  const code = typeof error === 'object' && error && 'code' in error ? String((error as { code: unknown }).code) : ''
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return ''
    case 'auth/popup-blocked':
      return 'Peramban memblokir jendela masuk. Izinkan pop-up untuk situs ini lalu coba lagi.'
    case 'auth/network-request-failed':
      return 'Koneksi bermasalah. Periksa internet lalu coba lagi.'
    case 'auth/unauthorized-domain':
      return 'Domain situs ini belum diizinkan di Firebase Authentication (Authorized domains).'
    case 'auth/user-mismatch':
      return 'Pilih akun Google yang sama dengan yang sedang masuk.'
    case 'auth/too-many-requests':
      return 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.'
    case 'permission-denied':
      return 'Akses ditolak oleh Firestore Rules. Pastikan rules terbaru sudah dipublikasikan.'
    default:
      return fallback
  }
}
