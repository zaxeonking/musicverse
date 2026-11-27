// Poster pratinjau 1200x630 untuk tautan /p/<kode> yang ditempel di chat (og:image dari api/p.mjs).
// PLAYLIST: poster kipas tiga sampul (tengah tegak, kiri-kanan miring 9 derajat) + judul + jumlah lagu, SAMA dengan poster di
// aplikasi (androidApp/.../ui/library/PlaylistPoster.kt; angka tata letak harus sama). LAGU tunggal: kartu panel seperti sebelumnya.
// Satori (mesin gambar @vercel/og) belum mendukung blur, jadi latar = sampul diperbesar + lapisan gelap.
// Ganti latar poster playlist: BACKDROP ('cover' | 'paper'), samakan dengan POSTER_BACKDROP di aplikasi.
import { ImageResponse } from '@vercel/og';
import { loadShared, normalizeCode, summarize } from './_share.mjs';

export const config = { runtime: 'edge' };

const MAX_COVER_BYTES = 3 * 1024 * 1024;

// UKURAN KELUARAN. Tata letak tetap digambar di kanvas 1200x630 (angka di bawah tidak berubah), tetapi PNG yang dikirim
// diperkecil lewat transform scale. WhatsApp membuang og:image yang lebih dari ~300 KB (Telegram/Discord tidak seketat itu),
// dan PNG foto 1200x630 gampang 600 KB - 1 MB. 600x315 membuatnya jauh di bawah batas. Ubah OUT_W (mis. 800) bila mau lebih
// tajam, lalu samakan og:image:width/height di api/p.mjs (OUT_H = OUT_W * 630 / 1200).
const OUT_W = 600;
const OUT_H = Math.round((OUT_W * 630) / 1200);
const OUT_SCALE = OUT_W / 1200;

/** Ukuran dari kanvas 1200x630 ke ukuran keluaran (tanpa transform: Satori menskalakan dari titik tengah, bukan pojok). */
const px = (n) => Math.round(n * OUT_SCALE * 100) / 100;

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
const BACKDROP = 'cover'; // 'cover' = latar gelap, 'paper' = kertas terang. (Foto sampul tidak lagi dipakai sebagai latar: terlalu berat untuk WhatsApp.)
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
    const r = await fetch(src, { signal: AbortSignal.timeout(2000), headers: { accept: 'image/jpeg,image/png,image/gif;q=0.9' } });
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

/** Satu sampul kipas: kotak bersudut bulat, dirotasi di sekitar titik tengahnya (cx, cy). Semua angka dalam kanvas 1200x630. */
function fanCover(src, size, cx, cy, rotation, fallbackBg) {
  const box = {
    display: 'flex',
    position: 'absolute',
    left: px(cx - size / 2),
    top: px(cy - size / 2),
    width: px(size),
    height: px(size),
    borderRadius: px(RADIUS),
    overflow: 'hidden',
    transform: `rotate(${rotation}deg)`,
    boxShadow: `0 ${px(14)}px ${px(34)}px rgba(0,0,0,0.47)`,
  };
  if (src) {
    return el('div', box, [{ type: 'img', props: { src, width: px(size), height: px(size), style: { width: px(size), height: px(size), objectFit: 'cover' } } }]);
  }
  return el('div', { ...box, alignItems: 'center', justifyContent: 'center', backgroundImage: fallbackBg, fontSize: px(size * 0.46), color: 'rgba(255,255,255,0.3)' }, '\u266a');
}

function playlistPoster(s) {
  const dark = BACKDROP === 'cover';
  const ink = dark ? '#ffffff' : '#111111';
  const inkSoft = dark ? 'rgba(255,255,255,0.8)' : '#555555';
  const [c0, c1, c2] = s.covers || [];
  const cx = 1200 / 2;
  const cySide = TOP + SIDE_DY + SIDE / 2;
  const layers = [];
  layers.push(fanCover(c1, SIDE, cx - SIDE_DX, cySide, -ROT, FALLBACK_GRADIENTS[1]));
  layers.push(fanCover(c2, SIDE, cx + SIDE_DX, cySide, ROT, FALLBACK_GRADIENTS[2]));
  layers.push(fanCover(c0, CENTER, cx, TOP + CENTER / 2, 0, FALLBACK_GRADIENTS[0]));
  layers.push(
    el(
      'div',
      { display: 'flex', position: 'absolute', left: px((1200 - TEXT_MAX_W) / 2), top: px(TITLE_BASELINE - 50), width: px(TEXT_MAX_W), justifyContent: 'center', fontSize: px(50), fontWeight: 700, color: ink, lineClamp: 1 },
      s.title,
    ),
  );
  if (s.count) {
    layers.push(el('div', { display: 'flex', position: 'absolute', left: 0, top: px(COUNT_BASELINE - 32), width: OUT_W, justifyContent: 'center', fontSize: px(32), color: inkSoft }, s.subtitle));
  }
  return el(
    'div',
    {
      display: 'flex',
      position: 'relative',
      width: OUT_W,
      height: OUT_H,
      overflow: 'hidden',
      backgroundImage: dark ? 'linear-gradient(135deg,#1f1b2e,#0f172a)' : 'linear-gradient(180deg,#ffffff,#d2d2d2)',
    },
    layers,
  );
}

function songPoster(s) {
  const cover = s.cover;
  const bg = { backgroundImage: 'linear-gradient(135deg,#1db954,#0c3b20 60%,#111111)' };
  const CV = px(420);
  const coverBox = cover
    ? { type: 'img', props: { src: cover, width: CV, height: CV, style: { width: CV, height: CV, borderRadius: px(40), objectFit: 'cover' } } }
    : el(
        'div',
        { display: 'flex', width: CV, height: CV, borderRadius: px(40), background: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', fontSize: px(190), color: 'rgba(255,255,255,0.35)' },
        '\u266a',
      );
  const textCol = el('div', { display: 'flex', flexDirection: 'column', justifyContent: 'center', marginLeft: px(52), flex: 1, minWidth: 0 }, [
    el('div', { display: 'flex', fontSize: px(26), letterSpacing: px(5), color: 'rgba(255,255,255,0.8)', marginBottom: px(18) }, s.label),
    el('div', { display: 'flex', fontSize: px(66), fontWeight: 700, color: '#fff', lineHeight: 1.08, lineClamp: 3 }, s.title),
    el('div', { display: 'flex', fontSize: px(34), color: 'rgba(255,255,255,0.85)', marginTop: px(18), lineClamp: 1 }, (s.subtitle || '').toUpperCase() || ' '),
  ]);
  const panel = el(
    'div',
    { display: 'flex', alignItems: 'center', padding: px(44), borderRadius: px(64), background: 'rgba(255,255,255,0.14)', border: `${px(2)}px solid rgba(255,255,255,0.22)`, width: px(1060) },
    [coverBox, textCol],
  );
  const brand = el('div', { display: 'flex', alignItems: 'center', marginTop: px(30), fontSize: px(36), fontWeight: 700, color: '#fff' }, [
    el(
      'div',
      { display: 'flex', alignItems: 'flex-end', marginRight: px(14) },
      [14, 28, 20, 34].map((h) => el('div', { width: px(8), height: px(h), borderRadius: px(4), background: '#1db954', marginRight: px(5) }, '')),
    ),
    'MusicVerse',
  ]);
  return el('div', { display: 'flex', width: OUT_W, height: OUT_H, ...bg }, [
    el('div', { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: OUT_W, height: OUT_H, background: 'rgba(0,0,0,0.25)' }, [panel, brand]),
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
    const loaded = (await Promise.all((summary.candidates || summary.covers || []).slice(0, 6).map(inlineCover))).filter(Boolean);
    const ok = loaded.slice(0, 3);
    const covers = ok.length ? Array.from({ length: 3 }, (_, i) => ok[i % ok.length]) : [];
    summary = { ...summary, covers };
  }
  return new ImageResponse(summary.kind === 'song' ? songPoster(summary) : playlistPoster(summary), {
    width: OUT_W,
    height: OUT_H,
    headers: {
      // Poster gagal (tautan mati/Supabase sibuk) jangan di-cache lama supaya cepat pulih.
      'cache-control': found ? 'public, max-age=600, s-maxage=3600, stale-while-revalidate=86400' : 'public, max-age=60, s-maxage=60',
    },
  });
}
