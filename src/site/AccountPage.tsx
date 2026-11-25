import { FormEvent, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { firebaseConfigured } from '../account/firebase'
import {
  changeDisplayName,
  deleteAccountForever,
  readSavedName,
  signInWithGoogle,
  signOutAccount,
  watchAccount,
  type AccountProfile,
} from '../account/firebaseAccount'
import { authErrorMessage, avatarThumb, initialsOf, resolveDisplayName } from '../account/profile'
import LegacyAccountPage from './LegacyAccountPage'
import { FOCUS, WRAP } from './ui'

/**
 * Halaman akun. Masuk memakai Google (Firebase Auth) dan profil di Firestore `users/{uid}`, sama seperti aplikasi Android 6.1.0.
 * Tautan email Supabase lama (`?mode=verify` / `?mode=reset`) tetap diarahkan ke halaman akun lama supaya tidak rusak.
 */
export default function AccountPage() {
  const [params] = useSearchParams()
  const mode = params.get('mode')
  if (mode === 'verify' || mode === 'reset') return <LegacyAccountPage />
  return <FirebaseAccountPage />
}

function Avatar({ profile }: { profile: AccountProfile }) {
  const [failed, setFailed] = useState(false)
  const src = avatarThumb(profile.photoURL, 96)
  useEffect(() => setFailed(false), [src])
  return (
    <span className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-site-green/20 font-display text-xl font-extrabold text-site-green" aria-hidden="true">
      {initialsOf(profile.displayName)}
      {src && !failed && (
        <img src={src} alt="" width={64} height={64} decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} className="absolute inset-0 h-full w-full object-cover" />
      )}
    </span>
  )
}

function FirebaseAccountPage() {
  const [profile, setProfile] = useState<AccountProfile | null>(null)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [editing, setEditing] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmText, setConfirmText] = useState('')

  useEffect(() => {
    if (!firebaseConfigured) { setReady(true); return }
    let cancelled = false
    const stop = watchAccount((user) => {
      if (cancelled) return
      if (!user) { setProfile(null); setReady(true); return }
      // Tampilkan segera dari Firebase Auth, lalu ganti dengan nama tersimpan di Firestore bila ada.
      setProfile({ uid: user.uid, displayName: resolveDisplayName({ authName: user.displayName, email: user.email }), email: user.email, photoURL: user.photoURL })
      setReady(true)
      readSavedName(user.uid).then((saved) => {
        if (!cancelled && saved) setProfile((p) => (p && p.uid === user.uid ? { ...p, displayName: saved } : p))
      }).catch(() => { /* profil cloud tidak terbaca: tetap pakai nama Firebase Auth */ })
    })
    return () => { cancelled = true; stop() }
  }, [])

  async function login() {
    setBusy(true); setMessage('')
    try {
      const result = await signInWithGoogle()
      setProfile(result.profile)
      setMessage(result.profileSaved ? 'Berhasil masuk dengan Google.' : 'Berhasil masuk, tetapi profil cloud belum tersimpan. Periksa Firestore Rules dan koneksi.')
    } catch (error) { setMessage(authErrorMessage(error, 'Gagal masuk dengan Google. Coba lagi.')) }
    finally { setBusy(false) }
  }

  async function logout() {
    setBusy(true); setMessage('')
    try { await signOutAccount(); setMessage('Kamu sudah keluar.') }
    catch (error) { setMessage(authErrorMessage(error, 'Gagal keluar. Coba lagi.')) }
    finally { setBusy(false) }
  }

  async function saveName(event: FormEvent) {
    event.preventDefault()
    setBusy(true); setMessage('')
    try {
      const name = await changeDisplayName(nameDraft)
      setProfile((p) => (p ? { ...p, displayName: name } : p))
      setEditing(false); setMessage('Nama berhasil disimpan.')
    } catch (error) { setMessage(error instanceof Error && !('code' in error) ? error.message : authErrorMessage(error, 'Nama gagal disimpan. Periksa koneksi dan Firestore Rules.')) }
    finally { setBusy(false) }
  }

  async function removeAccount() {
    setBusy(true); setMessage('')
    try {
      await deleteAccountForever()
      setProfile(null); setConfirmDelete(false); setConfirmText('')
      setMessage('Akun berhasil dihapus.')
    } catch (error) {
      setMessage(authErrorMessage(error, 'Gagal menghapus akun. Pilih akun Google yang sama dengan yang sedang masuk, periksa koneksi, lalu coba lagi.'))
    } finally { setBusy(false) }
  }

  return <main className={`${WRAP} min-h-[70vh] py-16 sm:py-24`}>
    <div className="mx-auto max-w-md">
      <Link to="/" className={`text-sm text-site-slate hover:text-site-ink ${FOCUS}`}>← Kembali ke MusicVerse</Link>
      <p className="mt-10 text-xs font-bold uppercase tracking-[0.18em] text-site-green">MusicVerse Account</p>
      <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight text-site-ink">{profile ? 'Akun kamu' : 'Masuk ke MusicVerse'}</h1>
      <p className="mt-3 text-sm leading-6 text-site-slate">Satu akun Google untuk aplikasi Android dan layanan web MusicVerse.</p>

      {!firebaseConfigured ? <div className="mt-8 rounded-2xl border border-red-400/30 bg-red-400/5 p-4 text-sm text-red-200">Konfigurasi Firebase belum lengkap. Isi <code>VITE_FIREBASE_API_KEY</code> di environment deployment web.</div>
      : !ready ? <p role="status" className="mt-8 text-sm text-site-slate">Memeriksa sesi…</p>
      : profile ? <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex items-center gap-4">
          <Avatar profile={profile} />
          <div className="min-w-0">
            <p className="truncate font-display text-lg font-bold text-site-ink">{profile.displayName}</p>
            {profile.email && <p className="truncate text-sm text-site-slate">{profile.email}</p>}
          </div>
        </div>

        {editing
          ? <form onSubmit={saveName} className="mt-5">
            <label className="block text-sm font-medium">Nama tampilan
              <input required minLength={3} maxLength={40} autoFocus value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-black/30 px-4 text-site-ink outline-none focus:border-site-green" />
            </label>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <button type="submit" disabled={busy} className={`btn-primary ${FOCUS}`}>{busy ? 'Menyimpan…' : 'Simpan'}</button>
              <button type="button" disabled={busy} onClick={() => setEditing(false)} className={`btn-secondary ${FOCUS}`}>Batal</button>
            </div>
          </form>
          : <button type="button" onClick={() => { setNameDraft(profile.displayName); setEditing(true); setMessage('') }} className={`btn-secondary mt-5 w-full ${FOCUS}`}>Ubah nama</button>}

        <button type="button" disabled={busy} onClick={logout} className={`btn-secondary mt-3 w-full ${FOCUS}`}>Keluar</button>

        <div className="mt-6 border-t border-red-400/20 pt-5">
          <p className="text-sm font-semibold text-red-300">Zona berbahaya</p>
          <p className="mt-2 text-xs leading-5 text-site-slate">Menghapus akun menghapus profil cloud dan akun Google-mu dari MusicVerse secara permanen. Kamu akan diminta memilih akun Google lagi untuk verifikasi. Playlist dan data di aplikasi Android tidak ikut terhapus. Tindakan ini tidak bisa dibatalkan.</p>
          {!confirmDelete
            ? <button type="button" disabled={busy} onClick={() => { setConfirmDelete(true); setConfirmText('') }} className={`mt-4 w-full rounded-xl border border-red-400/40 px-4 py-3 text-sm font-semibold text-red-300 hover:bg-red-400/10 disabled:opacity-50 ${FOCUS}`}>Hapus akun</button>
            : <div className="mt-4 space-y-3">
              <label className="block text-xs font-medium text-site-slate">Ketik <b className="text-site-ink">HAPUS</b> untuk melanjutkan
                <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" className="mt-2 h-11 w-full rounded-xl border border-red-400/30 bg-black/30 px-4 text-site-ink outline-none focus:border-red-300" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" disabled={busy || confirmText !== 'HAPUS'} onClick={removeAccount} className={`rounded-xl border border-red-400/40 px-4 py-3 text-sm font-semibold text-red-300 hover:bg-red-400/10 disabled:opacity-40 ${FOCUS}`}>{busy ? 'Menghapus…' : 'Hapus permanen'}</button>
                <button type="button" disabled={busy} onClick={() => setConfirmDelete(false)} className={`btn-secondary ${FOCUS}`}>Batal</button>
              </div>
            </div>}
        </div>
      </div>
      : <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
        <button type="button" disabled={busy} onClick={login} className={`btn-primary w-full ${FOCUS}`}>{busy ? 'Membuka Google…' : 'Lanjutkan dengan Google'}</button>
        <p className="mt-5 border-t border-white/10 pt-4 text-xs leading-5 text-site-slate">Punya akun lama dengan email dan password? <Link to="/account/legacy" className="underline hover:text-site-ink">Masuk di sini</Link>.</p>
      </div>}

      {message && <p role="status" aria-live="polite" className="mt-4 text-sm leading-6 text-site-slate">{message}</p>}
      <p className="mt-6 text-xs leading-5 text-site-slate">Dengan masuk, kamu menyetujui <Link to="/terms" className="underline">Ketentuan Layanan</Link> dan <Link to="/privacy" className="underline">Kebijakan Privasi</Link>.</p>
    </div>
  </main>
}
