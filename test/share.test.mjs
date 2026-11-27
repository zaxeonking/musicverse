// Tes tanpa jaringan untuk api/_share.mjs dan api/p.mjs (fetch tiruan). Poster api/og.mjs butuh @vercel/og + Vercel, tidak diuji di sini.
import assert from 'node:assert/strict';
import { isValidCode, normalizeCode, loadShared, parseTracks, summarize, esc, padFan, uniqueCovers } from '../api/_share.mjs';

// Kode: awalan a/u + 9 dari 31 karakter (tanpa i, l, o, 0, 1).
assert.equal(isValidCode('a2345678ac'), true);
assert.equal(isValidCode('uabcdefghj'), true);
assert.equal(isValidCode('a2345678i0'), false);
assert.equal(isValidCode('x234567890'), false);
assert.equal(isValidCode(undefined), false);
assert.equal(normalizeCode('A2345678AC'), 'a2345678ac');
assert.equal(normalizeCode(['uabcdefghj', 'x']), 'uabcdefghj');
assert.equal(normalizeCode('<script>'), '');

assert.equal(parseTracks([]), null);
assert.equal(parseTracks([{ a: 'x' }]), null);
const tr = parseTracks([{ t: ' Lagu ', a: 'Artis', c: 'https://i.scdn.co/x' }, { a: 'tanpa judul' }, { t: 'B', c: 'http://bad' }]);
assert.equal(tr.length, 2);
assert.equal(tr[0].title, 'Lagu');
assert.equal(tr[1].cover, null);

const song = summarize({ title: 'P', tracks: [tr[0]] });
assert.equal(song.kind, 'song');
assert.equal(song.title, 'Lagu');
assert.equal(song.subtitle, 'Artis');
const pl = summarize({ title: 'EPIC: The Musical', tracks: tr });
assert.equal(pl.kind, 'playlist');
assert.equal(pl.subtitle, '2 lagu');
assert.equal(pl.cover, 'https://i.scdn.co/x');
// Kipas: sampul unik yang kurang diulang (album = satu sampul), kandidat cadangan tersedia.
assert.deepEqual(pl.covers, ['https://i.scdn.co/x', 'https://i.scdn.co/x', 'https://i.scdn.co/x']);
assert.deepEqual(padFan(['a', 'b']), ['a', 'b', 'a']);
assert.deepEqual(padFan([]), []);
assert.deepEqual(uniqueCovers([{ cover: 'https://i.ytimg.com/vi_webp/ID/hqdefault.webp' }, { cover: null }], 12), ['https://i.ytimg.com/vi/ID/hqdefault.jpg']);

// Supabase + Firestore tiruan
globalThis.fetch = async (u, init = {}) => {
  u = String(u);
  if (u.includes('/rpc/get_shared_playlist')) {
    assert.equal(init.headers.apikey, 'sb_publishable_x');
    assert.equal(init.headers['x-forwarded-for'], '1.2.3.4');
    const { p_code } = JSON.parse(init.body);
    if (p_code === 'a2345678ac') {
      return new Response(JSON.stringify({ ok: true, title: '<b>"x"</b>', tracks: [{ t: 'Satu', a: 'A', c: 'https://c/1' }, { t: 'Dua' }] }));
    }
    if (p_code === 'a2345678ae') return new Response(JSON.stringify({ ok: false, error: 'rate_limited' }));
    return new Response(JSON.stringify({ ok: false, error: 'not_found' }));
  }
  if (u.includes('firestore.googleapis.com')) {
    assert(u.includes('key=AIza_test'));
    if (u.includes('uabcdefghk')) return new Response('{}', { status: 404 });
    return new Response(
      JSON.stringify({ fields: { title: { stringValue: 'Akun' }, tracks: { stringValue: JSON.stringify([{ t: 'X' }, { t: 'Y' }]) } } }),
    );
  }
  throw new Error('tak terduga ' + u);
};
const env = { SUPABASE_SHARE_URL: 'https://p.supabase.co/', SUPABASE_SHARE_KEY: 'sb_publishable_x', FIREBASE_API_KEY: 'AIza_test' };
let r = await loadShared('a2345678ac', env, '1.2.3.4, 10.0.0.1');
assert(r.status === 'ok' && r.tracks.length === 2);
assert.equal((await loadShared('a2345678ad', env, '1.2.3.4')).status, 'not_found');
assert.equal((await loadShared('a2345678ae', env, '1.2.3.4')).status, 'busy');
assert.equal((await loadShared('a2345678ac', {}, null)).status, 'unconfigured');
assert.equal((await loadShared('a2345678ac', { ...env, SUPABASE_SHARE_KEY: 'sb_secret_x' }, null)).status, 'unconfigured');
r = await loadShared('uabcdefghj', env, null);
assert(r.status === 'ok' && r.title === 'Akun' && r.tracks.length === 2);
assert.equal((await loadShared('uabcdefghk', env, null)).status, 'not_found');
assert.equal((await loadShared('uabcdefghj', {}, null)).status, 'unconfigured');

// Halaman /p/<kode>: og:image menunjuk ke /api/og di domain yang sama, teks pengguna di-escape.
process.env.SUPABASE_SHARE_URL = env.SUPABASE_SHARE_URL;
process.env.SUPABASE_SHARE_KEY = env.SUPABASE_SHARE_KEY;
const { default: handler } = await import('../api/p.mjs');
async function call(query, headers = {}) {
  const res = { code: 0, h: {}, body: '' };
  await handler(
    { query, headers: { 'x-forwarded-for': '1.2.3.4', ...headers } },
    { status(c) { res.code = c; return this; }, setHeader(k, v) { res.h[k] = v; }, send(b) { res.body = b; } },
  );
  return res;
}
let page = await call({ code: 'a2345678ac' }, { host: 'musicverseid.vercel.app' });
assert.equal(page.code, 200);
assert(page.body.includes('property="og:image" content="https://musicverseid.vercel.app/api/og?code=a2345678ac"'));
assert(page.body.includes('property="og:url" content="https://musicverseid.vercel.app/p/a2345678ac"'));
assert(page.body.includes('summary_large_image'));
assert(!page.body.includes('<b>"x"</b>') && page.body.includes('&lt;b&gt;'));
page = await call({ code: 'a2345678ac' }, { host: 'evil"><script>' });
assert(page.body.includes('https://musicverseid.vercel.app/api/og?code=a2345678ac')); // host aneh -> cadangan SITE
assert.equal((await call({ code: 'a2345678ad' })).code, 404);
assert.equal((await call({ code: 'a2345678ae' })).code, 503);
assert.equal((await call({ code: 'jelek' })).code, 404);
assert.equal(esc('<&>'), '&lt;&amp;&gt;');
console.log('semua tes lolos');
