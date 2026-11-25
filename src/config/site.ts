/** Info umum situs dan dokumen hukum (dipakai halaman web). */
export const SITE_NAME = 'MusicVerse'

/** Tanggal terakhir Kebijakan Privasi dan Ketentuan Layanan diubah. Perbarui setiap isi dokumen berubah. */
export const LEGAL_UPDATED = '25 November 2026'

/** Email kontak untuk pertanyaan privasi/hak cipta. Isi lewat VITE_CONTACT_EMAIL; kosong = pakai halaman Issues di GitHub. */
export const CONTACT_EMAIL: string = (import.meta.env.VITE_CONTACT_EMAIL ?? '').trim()
