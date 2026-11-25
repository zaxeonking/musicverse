import assert from 'node:assert/strict'
import { validateDisplayName, resolveDisplayName, initialsOf, avatarThumb, buildProfileDoc, authErrorMessage } from '../src/account/profile.ts'

// validasi nama (3-40, spasi dirapikan)
assert.equal(validateDisplayName('ab').ok, false)
assert.equal(validateDisplayName('x'.repeat(41)).ok, false)
assert.deepEqual(validateDisplayName('  Budi   Santoso '), { ok: true, name: 'Budi Santoso' })
assert.equal(validateDisplayName('   a   ').ok, false)

// urutan nama: tersimpan > auth > email > bawaan
assert.equal(resolveDisplayName({ savedName: 'Edit', authName: 'Google', email: 'a@b.c' }), 'Edit')
assert.equal(resolveDisplayName({ savedName: ' ', authName: 'Google' }), 'Google')
assert.equal(resolveDisplayName({ email: 'john.doe@x.com' }), 'john_doe')
assert.equal(resolveDisplayName({}), 'MusicVerse User')

// inisial
assert.equal(initialsOf('Budi Santoso'), 'BS')
assert.equal(initialsOf('john_doe'), 'JD')
assert.equal(initialsOf('zaxeon'), 'ZA')
assert.equal(initialsOf('  '), '?')

// thumbnail foto Google
const g = 'https://lh3.googleusercontent.com/a/abc123=s96-c'
assert.equal(avatarThumb(g, 64), 'https://lh3.googleusercontent.com/a/abc123=s96-c')
assert.equal(avatarThumb(g, 150), 'https://lh3.googleusercontent.com/a/abc123=s192-c')
assert.equal(avatarThumb('https://lh3.googleusercontent.com/a/abc123', 500), 'https://lh3.googleusercontent.com/a/abc123=s384-c')
assert.equal(avatarThumb('https://example.com/x.png', 96), 'https://example.com/x.png')
assert.equal(avatarThumb(null, 96), null)

// dokumen profil
assert.deepEqual(buildProfileDoc({ uid: 'u1', displayName: 'N', email: null, photoURL: 'p' }), { uid: 'u1', displayName: 'N', provider: 'google.com', photoURL: 'p' })

// galat: tutup popup = senyap
assert.equal(authErrorMessage({ code: 'auth/popup-closed-by-user' }, 'x'), '')
assert.match(authErrorMessage({ code: 'auth/unauthorized-domain' }, 'x'), /Authorized domains/)
assert.equal(authErrorMessage(new Error('?'), 'umum'), 'umum')
console.log('test:account OK')
