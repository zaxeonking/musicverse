// Pustaka bersama untuk halaman tautan bagikan /p/<kode> (api/p.mjs, runtime Node) dan poster pratinjau /api/og (api/og.mjs, edge).
// Awalan "_" supaya Vercel tidak menjadikannya fungsi sendiri. Murni fetch + string, jalan di Node maupun edge.
//
// Env Vercel (server saja, JANGAN diawali VITE_):
//   SUPABASE_SHARE_URL  = https://<proyek>.supabase.co    tautan tanpa akun (awalan "a"), RPC publik get_shared_playlist
//   SUPABASE_SHARE_KEY  = sb_publishable_...              kunci PUBLIK (JANGAN sb_secret_ / service_role)
//   FIREBASE_API_KEY    = AIza...                         tautan akun (awalan "u"), dokumen Firestore sharedPlaylists/<kode>
//   FIREBASE_PROJECT_ID = musicverse-app                  bawaan musicverse-app

export const CODE_RE = /^[au][2-9a-hjkmnp-z]{9}$/; // sama dengan ShareCode.kt
export const SITE = 'https://musicverseid.vercel.app';

export function isValidCode(code) {
  return typeof code === 'string' && CODE_RE.test(code);
}

/** Ambil kode dari query (?code=...), huruf kecil; '' bila tidak sah. */
export function normalizeCode(raw) {
  const s = String(Array.isArray(raw) ? raw[0] : raw || '').toLowerCase();
  return isValidCode(s) ? s : '';
}

/** IP pengunjung pertama dari x-forwarded-for (batas laju Supabase dihitung per IP). */
function firstIp(forwardedFor) {
  const ip = String(forwardedFor || '').split(',')[0].trim();
  return ip || '';
}

/**
 * Ambil playlist bagikan.
 * Hasil: { status: 'ok', title, tracks } | { status: 'not_found' | 'busy' | 'unconfigured' | 'error' }.
 * tracks = [{ title, artist, cover }] (cover hanya https://, selain itu null).
 */
export async function loadShared(code, env, forwardedFor) {
  if (!isValidCode(code)) return { status: 'not_found' };
  try {
    return code[0] === 'u' ? await fromFirestore(code, env) : await fromSupabase(code, env, forwardedFor);
  } catch {
    return { status: 'error' };
  }
}

async function fromSupabase(code, env, forwardedFor) {
  const base = String(env.SUPABASE_SHARE_URL || '').trim().replace(/\/+$/, '');
  const key = String(env.SUPABASE_SHARE_KEY || '').trim();
  if (!base.startsWith('https://') || !key) return { status: 'unconfigured' };
  if (key.startsWith('sb_secret_')) return { status: 'unconfigured' }; // jangan pernah pakai kunci rahasia di sini
  const headers = { apikey: key, 'content-type': 'application/json', accept: 'application/json' };
  const ip = firstIp(forwardedFor);
  // Teruskan IP pengunjung supaya semua kunjungan tidak dihitung dari satu IP Vercel (jatah get 600/jam per IP).
  if (ip) headers['x-forwarded-for'] = ip;
  const r = await fetch(`${base}/rest/v1/rpc/get_shared_playlist`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ p_code: code }),
    signal: AbortSignal.timeout(8000),
  });
  const j = await r.json().catch(() => null);
  if (j && j.ok === true && typeof j.title === 'string') {
    const tracks = parseTracks(j.tracks);
    return tracks ? { status: 'ok', title: j.title.trim(), tracks } : { status: 'error' };
  }
  if (j && j.error === 'not_found') return { status: 'not_found' };
  if (j && j.error === 'rate_limited') return { status: 'busy' };
  return { status: 'error' };
}

async function fromFirestore(code, env) {
  const project = String(env.FIREBASE_PROJECT_ID || 'musicverse-app').trim();
  const apiKey = String(env.FIREBASE_API_KEY || '').trim();
  if (!apiKey) return { status: 'unconfigured' };
  const url =
    `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(project)}` +
    `/databases/(default)/documents/sharedPlaylists/${code}?key=${encodeURIComponent(apiKey)}`;
  const r = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
  if (r.status === 404) return { status: 'not_found' };
  if (r.status === 429) return { status: 'busy' };
  if (!r.ok) return { status: 'error' };
  const j = await r.json();
  const title = j?.fields?.title?.stringValue;
  const raw = j?.fields?.tracks?.stringValue;
  if (typeof title !== 'string' || typeof raw !== 'string') return { status: 'error' };
  const tracks = parseTracks(JSON.parse(raw));
  return tracks ? { status: 'ok', title: title.trim(), tracks } : { status: 'error' };
}

/** Kunci pendek dari aplikasi: t judul, a artis, c sampul. Lagu tanpa judul dilewati; null bila tidak ada satu pun. */
export function parseTracks(raw) {
  if (!Array.isArray(raw)) return null;
  const out = [];
  for (const t of raw) {
    if (!t || typeof t.t !== 'string' || !t.t.trim()) continue;
    out.push({
      title: t.t.trim(),
      artist: typeof t.a === 'string' ? t.a.trim() : '',
      cover: typeof t.c === 'string' && t.c.startsWith('https://') ? t.c : null,
    });
  }
  return out.length ? out : null;
}

/** Ringkasan untuk poster. Satu lagu = kartu lagu (judul + artis); lebih dari satu = kartu playlist. */
export function summarize({ title, tracks }) {
  const count = tracks.length;
  const cover = (tracks.find((t) => t.cover) || {}).cover || null;
  // Sampul berbeda (maks. 3) untuk kipas di poster playlist.
  const covers = [];
  for (const t of tracks) {
    if (t.cover && !covers.includes(t.cover)) covers.push(t.cover);
    if (covers.length === 3) break;
  }
  if (count === 1) {
    return { kind: 'song', label: 'NOW PLAYING', title: tracks[0].title, subtitle: tracks[0].artist, count, cover, covers };
  }
  return { kind: 'playlist', label: 'PLAYLIST', title, subtitle: `${count} lagu`, count, cover, covers };
}

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
