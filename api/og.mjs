// Poster pratinjau 1200x630 untuk tautan /p/<kode> yang ditempel di chat (og:image dari api/p.mjs).
// Desain mengikuti poster di aplikasi: latar sampul digelapkan, panel kaca berisi sampul + label + judul + artis/jumlah lagu,
// merek di bawah. Satori (mesin gambar @vercel/og) belum mendukung blur, jadi latar = sampul diperbesar + lapisan gelap.
import { ImageResponse } from '@vercel/og';
import { loadShared, normalizeCode, summarize } from './_share.mjs';

export const config = { runtime: 'edge' };

const MAX_COVER_BYTES = 3 * 1024 * 1024;
const FALLBACK = { kind: 'playlist', label: 'PLAYLIST', title: 'MusicVerse', subtitle: 'Dengarkan bersama', count: 0, cover: null };

/**
 * Unduh sampul lebih dulu dan jadikan data URL. Bila sampul gagal/lambat/terlalu besar/bukan gambar, poster tetap dibuat
 * tanpa sampul (Satori melempar galat di tengah stream bila <img> gagal dimuat, dan itu tidak bisa ditangkap).
 */
async function inlineCover(src) {
  if (!src) return null;
  try {
    const r = await fetch(src, { signal: AbortSignal.timeout(4000) });
    const type = (r.headers.get('content-type') || '').split(';')[0].trim();
    if (!r.ok || !/^image\/(png|jpe?g|webp|gif)$/.test(type)) return null;
    const buf = await r.arrayBuffer();
    if (buf.byteLength === 0 || buf.byteLength > MAX_COVER_BYTES) return null;
    const bytes = new Uint8Array(buf);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return `data:${type};base64,${btoa(bin)}`;
  } catch {
    return null;
  }
}

const el = (type, style, children) => ({ type, props: { style, children } });

function poster(s) {
  const cover = s.cover;
  const bg = cover
    ? { backgroundImage: `url(${cover})`, backgroundSize: '100% 100%' }
    : { backgroundImage: 'linear-gradient(135deg,#1db954,#0c3b20 60%,#111111)' };
  const coverBox = cover
    ? { type: 'img', props: { src: cover, width: 420, height: 420, style: { width: 420, height: 420, borderRadius: 40, objectFit: 'cover' } } }
    : el(
        'div',
        { display: 'flex', width: 420, height: 420, borderRadius: 40, background: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', fontSize: 190, color: 'rgba(255,255,255,0.35)' },
        '♪',
      );
  const textCol = el('div', { display: 'flex', flexDirection: 'column', justifyContent: 'center', marginLeft: 52, flex: 1, minWidth: 0 }, [
    el('div', { display: 'flex', fontSize: 26, letterSpacing: 5, color: 'rgba(255,255,255,0.8)', marginBottom: 18 }, s.label),
    el('div', { display: 'flex', fontSize: 66, fontWeight: 700, color: '#fff', lineHeight: 1.08, lineClamp: 3 }, s.title),
    el('div', { display: 'flex', fontSize: 34, color: 'rgba(255,255,255,0.85)', marginTop: 18, lineClamp: 1 }, (s.subtitle || '').toUpperCase() || ' '),
  ]);
  const panel = el(
    'div',
    { display: 'flex', alignItems: 'center', padding: 44, borderRadius: 64, background: 'rgba(255,255,255,0.14)', border: '2px solid rgba(255,255,255,0.22)', width: 1060 },
    [coverBox, textCol],
  );
  const brand = el('div', { display: 'flex', alignItems: 'center', marginTop: 30, fontSize: 36, fontWeight: 700, color: '#fff' }, [
    el(
      'div',
      { display: 'flex', alignItems: 'flex-end', marginRight: 14 },
      [14, 28, 20, 34].map((h) => el('div', { width: 8, height: h, borderRadius: 4, background: '#1db954', marginRight: 5 }, '')),
    ),
    'MusicVerse',
  ]);
  return el('div', { display: 'flex', width: 1200, height: 630, ...bg }, [
    el('div', { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: 1200, height: 630, background: 'rgba(0,0,0,0.55)' }, [panel, brand]),
  ]);
}

export default async function handler(request) {
  const url = new URL(request.url);
  const code = normalizeCode(url.searchParams.get('code'));
  let summary = FALLBACK;
  let found = false;
  if (code) {
    const shared = await loadShared(code, process.env, request.headers.get('x-forwarded-for'));
    if (shared.status === 'ok') {
      summary = summarize(shared);
      found = true;
    }
  }
  summary = { ...summary, cover: await inlineCover(summary.cover) };
  return new ImageResponse(poster(summary), {
    width: 1200,
    height: 630,
    headers: {
      // Poster gagal (tautan mati/Supabase sibuk) jangan di-cache lama supaya cepat pulih.
      'cache-control': found ? 'public, max-age=600, s-maxage=3600, stale-while-revalidate=86400' : 'public, max-age=60, s-maxage=60',
    },
  });
}
