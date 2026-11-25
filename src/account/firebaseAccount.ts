import {
  GoogleAuthProvider,
  deleteUser,
  onAuthStateChanged,
  reauthenticateWithPopup,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth'
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { getDb, getFirebaseAuth } from './firebase'
import { buildProfileDoc, resolveDisplayName, validateDisplayName } from './profile'

/** Profil yang ditampilkan di halaman akun. */
export type AccountProfile = {
  uid: string
  displayName: string
  email: string | null
  photoURL: string | null
}

function googleProvider(): GoogleAuthProvider {
  const p = new GoogleAuthProvider()
  p.setCustomParameters({ prompt: 'select_account' })
  return p
}

function profileOf(user: User, displayName = resolveDisplayName({ authName: user.displayName, email: user.email })): AccountProfile {
  return { uid: user.uid, displayName, email: user.email, photoURL: user.photoURL }
}

/** Mengikuti perubahan sesi. Callback pertama datang setelah Firebase selesai memulihkan sesi (null = belum masuk). */
export function watchAccount(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(getFirebaseAuth(), callback)
}

/** Nama tersimpan di Firestore (hasil edit pengguna) untuk uid ini, atau null. Galat dilempar ke pemanggil. */
export async function readSavedName(uid: string): Promise<string | null> {
  const snap = await getDoc(doc(getDb(), 'users', uid))
  const name = snap.exists() ? snap.get('displayName') : null
  return typeof name === 'string' && name.trim() ? name.trim() : null
}

export type SignInResult = { profile: AccountProfile; profileSaved: boolean }

/** Masuk dengan Google. Nama hasil edit sebelumnya dipertahankan; dokumen `users/{uid}` dibuat/diperbarui (merge). */
export async function signInWithGoogle(): Promise<SignInResult> {
  const auth = getFirebaseAuth()
  const { user } = await signInWithPopup(auth, googleProvider())
  const ref = doc(getDb(), 'users', user.uid)

  let existsAlready = false
  let savedName: string | null = null
  let profileSaved = true
  try {
    const snap = await getDoc(ref)
    existsAlready = snap.exists()
    const n = existsAlready ? snap.get('displayName') : null
    savedName = typeof n === 'string' && n.trim() ? n.trim() : null
  } catch {
    profileSaved = false
  }

  const displayName = resolveDisplayName({ savedName, authName: user.displayName, email: user.email })
  if (user.displayName !== displayName) await updateProfile(user, { displayName })

  if (profileSaved) {
    try {
      await setDoc(
        ref,
        {
          ...buildProfileDoc({ uid: user.uid, displayName, email: user.email, photoURL: user.photoURL }),
          updatedAt: serverTimestamp(),
          ...(existsAlready ? {} : { createdAt: serverTimestamp() }),
        },
        { merge: true },
      )
    } catch {
      profileSaved = false
    }
  }
  return { profile: profileOf(user, displayName), profileSaved }
}

/** Ubah nama tampilan: Firebase Auth lalu Firestore. Mengembalikan nama bersih. */
export async function changeDisplayName(raw: string): Promise<string> {
  const checked = validateDisplayName(raw)
  if (!checked.ok) throw new Error(checked.error)
  const user = getFirebaseAuth().currentUser
  if (!user) throw new Error('Silakan masuk kembali.')
  await updateProfile(user, { displayName: checked.name })
  await setDoc(
    doc(getDb(), 'users', user.uid),
    {
      ...buildProfileDoc({ uid: user.uid, displayName: checked.name, email: user.email, photoURL: user.photoURL }),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
  return checked.name
}

export async function signOutAccount(): Promise<void> {
  await signOut(getFirebaseAuth())
}

/**
 * Hapus akun permanen, urutan sama dengan Android: (1) login ulang dengan Google (Firebase mewajibkannya),
 * (2) hapus `users/{uid}`, (3) hapus pengguna Firebase Auth. Bila langkah 3 gagal, bisa diulang karena menghapus
 * dokumen yang sudah hilang tidak menimbulkan galat. Data Supabase lama dan snapshot R2 tidak ikut terhapus.
 */
export async function deleteAccountForever(): Promise<void> {
  const user = getFirebaseAuth().currentUser
  if (!user) throw new Error('Silakan masuk kembali.')
  await reauthenticateWithPopup(user, googleProvider())
  await deleteDoc(doc(getDb(), 'users', user.uid))
  await deleteUser(user)
}
