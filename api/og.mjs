// Poster pratinjau 1200x630 untuk tautan /p/<kode> yang ditempel di chat (og:image dari api/p.mjs).
// PLAYLIST: poster kipas tiga sampul (tengah tegak, kiri-kanan miring 9 derajat) + judul + jumlah lagu, SAMA dengan poster di
// aplikasi (androidApp/.../ui/library/PlaylistPoster.kt; angka tata letak harus sama). LAGU tunggal: kartu panel seperti sebelumnya.
// Satori (mesin gambar @vercel/og) belum mendukung blur, jadi latar = sampul diperbesar + lapisan gelap.
// Ganti latar poster playlist: BACKDROP ('cover' | 'paper'), samakan dengan POSTER_BACKDROP di aplikasi.
import { ImageResponse } from '@vercel/og';
import { loadShared, normalizeCode, summarize } from './_share.mjs';

export const config = { runtime: 'edge' };

const MAX_COVER_BYTES = 3 * 1024 * 1024;
const FALLBACK = { kind: 'playlist', label: 'PLAYLIST', title: 'MusicVerse', subtitle: 'Dengarkan bersama', count: 0, cover: null, covers: [] };

// Tata letak poster playlist (1200x630). SAMA dengan PlaylistPoster.kt.
const CENTER = 330;
const SIDE = 290;
const SIDE_DX = 215;
const SIDE_DY = 28;
const ROT = 9;
const TOP = 56;
const RADIUS = 36;
const TITLE_BASELINE = 492;
const COUNT_BASELINE = 548;
const TEXT_MAX_W = 1020;
const BACKDROP = 'cover'; // 'cover' = sampul pertama digelapkan, 'paper' = kertas terang
const FALLBACK_GRADIENTS = [
  'linear-gradient(135deg,#6d28d9,#2563eb)',
  'linear-gradient(135deg,#be185d,#f97316)',
  'linear-gradient(135deg,#047857,#0ea5e9)',
];

/**
 * Unduh sampul lebih dulu dan jadikan data URL. Bila sampul gagal/lambat/terlalu besar/bukan gambar, poster tetap dibuat
 * tanpa sampul (Satori melempar galat di tengah stream bila <img> gagal dimuat, dan itu tidak bisa ditangkap).
 */
async function inlineCover(src) {
  if (!src) return null;
  try {
    // Minta jpeg/png saja: Google/Deezer memberi webp bila Accept membolehkan, dan Satori gagal membaca webp (galat di tengah stream).
    const r = await fetch(src, { signal: AbortSignal.timeout(2500), headers: { accept: 'image/jpeg,image/png,image/gif;q=0.9' } });
    if (!r.ok) return null;
    const buf = await r.arrayBuffer();
    if (buf.byteLength === 0 || buf.byteLength > MAX_COVER_BYTES) return null;
    const bytes = new Uint8Array(buf);
    // Jenis dari ISI berkas, bukan header content-type (sering salah): hanya png/jpeg/gif yang lolos.
    const type =
      bytes[0] === 0xff && bytes[1] === 0xd8 ? 'image/jpeg'
      : bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 ? 'image/png'
      : bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 ? 'image/gif'
      : null;
    if (!type) return null;
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return `data:${type};base64,${btoa(bin)}`;
  } catch {
    return null;
  }
}

const el = (type, style, children) => ({ type, props: { style, children } });

/** Satu sampul kipas: kotak bersudut bulat, dirotasi di sekitar titik tengahnya (cx, cy). */
function fanCover(src, size, cx, cy, rotation, fallbackBg) {
  const box = {
    display: 'flex',
    position: 'absolute',
    left: cx - size / 2,
    top: cy - size / 2,
    width: size,
    height: size,
    borderRadius: RADIUS,
    overflow: 'hidden',
    transform: `rotate(${rotation}deg)`,
    boxShadow: '0 14px 34px rgba(0,0,0,0.47)',
  };
  if (src) {
    return el('div', box, [{ type: 'img', props: { src, width: size, height: size, style: { width: size, height: size, objectFit: 'cover' } } }]);
  }
  return el('div', { ...box, alignItems: 'center', justifyContent: 'center', backgroundImage: fallbackBg, fontSize: size * 0.46, color: 'rgba(255,255,255,0.3)' }, '♪');
}

function playlistPoster(s) {
  const dark = BACKDROP === 'cover';
  const ink = dark ? '#ffffff' : '#111111';
  const inkSoft = dark ? 'rgba(255,255,255,0.8)' : '#555555';
  const [c0, c1, c2] = s.covers || [];
  const cx = 1200 / 2;
  const cySide = TOP + SIDE_DY + SIDE / 2;
  const layers = [];
  if (dark && c0) {
    layers.push({
      type: 'img',
      props: { src: c0, width: 1800, height: 945, style: { position: 'absolute', left: -300, top: -158, width: 1800, height: 945, objectFit: 'cover' } },
    });
  }
  if (dark) layers.push(el('div', { display: 'flex', position: 'absolute', left: 0, top: 0, width: 1200, height: 630, background: 'rgba(0,0,0,0.5)' }, ''));
  layers.push(fanCover(c1, SIDE, cx - SIDE_DX, cySide, -ROT, FALLBACK_GRADIENTS[1]));
  layers.push(fanCover(c2, SIDE, cx + SIDE_DX, cySide, ROT, FALLBACK_GRADIENTS[2]));
  layers.push(fanCover(c0, CENTER, cx, TOP + CENTER / 2, 0, FALLBACK_GRADIENTS[0]));
  layers.push(
    el(
      'div',
      { display: 'flex', position: 'absolute', left: (1200 - TEXT_MAX_W) / 2, top: TITLE_BASELINE - 50, width: TEXT_MAX_W, justifyContent: 'center', fontSize: 50, fontWeight: 700, color: ink, lineClamp: 1 },
      s.title,
    ),
  );
  if (s.count) {
    layers.push(el('div', { display: 'flex', position: 'absolute', left: 0, top: COUNT_BASELINE - 32, width: 1200, justifyContent: 'center', fontSize: 32, color: inkSoft }, s.subtitle));
  }
  return el(
    'div',
    {
      display: 'flex',
      position: 'relative',
      width: 1200,
      height: 630,
      overflow: 'hidden',
      backgroundImage: dark ? 'linear-gradient(135deg,#1f1b2e,#0f172a)' : 'linear-gradient(180deg,#ffffff,#d2d2d2)',
    },
    layers,
  );
}

function songPoster(s) {
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
  // Sampul diunduh lebih dulu (paralel); yang gagal jadi null dan poster tetap dibuat dengan sampul cadangan.
  // Kandidat (maks. 12) dicoba paralel; 3 yang berhasil dipakai, kurang dari 3 diulang. Satu sampul rusak tidak lagi
  // meninggalkan kotak kosong selama masih ada sampul lain yang bisa dimuat.
  if (summary.kind === 'song') {
    summary = { ...summary, cover: await inlineCover(summary.cover) };
  } else {
    const loaded = (await Promise.all((summary.candidates || summary.covers || []).map(inlineCover))).filter(Boolean);
    const ok = loaded.slice(0, 3);
    const covers = ok.length ? Array.from({ length: 3 }, (_, i) => ok[i % ok.length]) : [];
    summary = { ...summary, covers };
  }
  return new ImageResponse(summary.kind === 'song' ? songPoster(summary) : playlistPoster(summary), {
    width: 1200,
    height: 630,
    headers: {
      // Poster gagal (tautan mati/Supabase sibuk) jangan di-cache lama supaya cepat pulih.
      'cache-control': found ? 'public, max-age=600, s-maxage=3600, stale-while-revalidate=86400' : 'public, max-age=60, s-maxage=60',
    },
  });
}
