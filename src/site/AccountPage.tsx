import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { createClient, type Session } from '@supabase/supabase-js'
import { FOCUS, WRAP } from './ui'

const url = import.meta.env.VITE_SUPABASE_ACCOUNT_URL?.trim() ?? ''
const key = import.meta.env.VITE_SUPABASE_ACCOUNT_KEY?.trim() ?? ''
const configured = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url) && key.startsWith('sb_publishable_')
const supabase = configured ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null

type Mode = 'login' | 'register' | 'forgot' | 'new-password'

export default function AccountPage() {
  const [params] = useSearchParams()
  const [mode, setMode] = useState<Mode>(params.get('mode') === 'reset' ? 'new-password' : 'login')
  const [session, setSession] = useState<Session | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const client = useMemo(() => supabase, [])

  useEffect(() => {
    if (!client) return
    client.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = client.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [client])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!client) return
    setBusy(true); setMessage('')
    try {
      if (mode === 'register') {
        const clean = username.trim().toLowerCase()
        if (!/^[a-z0-9_]{3,24}$/.test(clean)) throw new Error('Username harus 3–24 karakter: huruf kecil, angka, atau garis bawah.')
        const { data, error } = await client.auth.signUp({ email: email.trim(), password, options: { data: { username: clean } } })
        if (error) throw error
        if (data.session) setSession(data.session)
        setMessage('Pendaftaran diterima. Periksa email untuk verifikasi akun jika verifikasi diaktifkan.')
      } else if (mode === 'login') {
        const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
        setSession(data.session); setMessage('Berhasil masuk.')
      } else if (mode === 'forgot') {
        const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/account?mode=reset` })
        if (error) throw error
        setMessage('Jika alamat email terdaftar, tautan pengaturan ulang akan dikirim.')
      } else {
        const { error } = await client.auth.updateUser({ password })
        if (error) throw error
        setMode('login'); setPassword(''); setMessage('Password berhasil diperbarui. Silakan masuk kembali.')
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Permintaan gagal. Coba lagi.') }
    finally { setBusy(false) }
  }

  async function logout() { if (!client) return; const { error } = await client.auth.signOut(); setMessage(error?.message ?? 'Kamu sudah keluar.') }

  const title = mode === 'register' ? 'Buat akun' : mode === 'forgot' ? 'Reset password' : mode === 'new-password' ? 'Password baru' : 'Masuk ke MusicVerse'
  return <main className={`${WRAP} min-h-[70vh] py-16 sm:py-24`}>
    <div className="mx-auto max-w-md">
      <Link to="/" className={`text-sm text-site-slate hover:text-site-ink ${FOCUS}`}>← Kembali ke MusicVerse</Link>
      <p className="mt-10 text-xs font-bold uppercase tracking-[0.18em] text-site-green">MusicVerse Account</p>
      <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight text-site-ink">{session ? 'Akun kamu' : title}</h1>
      <p className="mt-3 text-sm leading-6 text-site-slate">Satu akun untuk aplikasi Android dan layanan web MusicVerse.</p>
      {!configured ? <div className="mt-8 rounded-2xl border border-red-400/30 bg-red-400/5 p-4 text-sm text-red-200">Konfigurasi Supabase Account belum lengkap. Isi <code>VITE_SUPABASE_ACCOUNT_URL</code> dan <code>VITE_SUPABASE_ACCOUNT_KEY</code> di environment deployment web.</div> : session ? <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <p className="text-sm text-site-slate">Sedang masuk sebagai</p><p className="mt-1 break-all font-semibold text-site-ink">{session.user.email}</p>
        <p className="mt-5 text-xs text-site-slate">User ID</p><p className="mt-1 break-all font-mono text-xs text-site-slate">{session.user.id}</p>
        <button onClick={logout} className={`btn-secondary mt-6 w-full ${FOCUS}`}>Keluar</button>
      </div> : <form onSubmit={submit} className="mt-8 space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
        {mode === 'register' && <label className="block text-sm font-medium">Username<input required minLength={3} maxLength={24} autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-black/30 px-4 text-site-ink outline-none focus:border-site-green" placeholder="nama_pengguna" /></label>}
        {mode !== 'new-password' && <label className="block text-sm font-medium">Email<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-black/30 px-4 text-site-ink outline-none focus:border-site-green" placeholder="nama@email.com" /></label>}
        {mode !== 'forgot' && <label className="block text-sm font-medium">{mode === 'new-password' ? 'Password baru' : 'Password'}<input required type="password" minLength={8} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} value={password} onChange={e=>setPassword(e.target.value)} className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-black/30 px-4 text-site-ink outline-none focus:border-site-green" placeholder="Minimal 8 karakter" /></label>}
        <button disabled={busy || !client} className={`btn-primary w-full ${FOCUS}`}>{busy ? 'Memproses…' : mode === 'register' ? 'Buat akun' : mode === 'forgot' ? 'Kirim tautan reset' : mode === 'new-password' ? 'Simpan password' : 'Masuk'}</button>
        {message && <p role="status" className="text-sm leading-6 text-site-slate">{message}</p>}
        <div className="flex flex-wrap justify-between gap-3 border-t border-white/10 pt-4 text-sm text-site-slate">
          {mode === 'login' ? <><button type="button" onClick={()=>{setMode('register');setMessage('')}} className="hover:text-site-ink">Buat akun</button><button type="button" onClick={()=>{setMode('forgot');setMessage('')}} className="hover:text-site-ink">Lupa password?</button></> : <button type="button" onClick={()=>{setMode('login');setMessage('')}} className="hover:text-site-ink">Kembali ke login</button>}
        </div>
      </form>}
      {message && session && <p role="status" className="mt-4 text-sm text-site-slate">{message}</p>}
      <p className="mt-6 text-xs leading-5 text-site-slate">Dengan membuat akun, kamu menyetujui <Link to="/terms" className="underline">Ketentuan Layanan</Link> dan <Link to="/privacy" className="underline">Kebijakan Privasi</Link>.</p>
    </div>
  </main>
}
