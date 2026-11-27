// Halaman tautan bagikan: https://<domain>/p/<kode>  (vercel.json: /p/:code -> /api/p?code=:code).
// Data dibaca lewat ./_share.mjs: kode a... dari RPC publik Supabase `get_shared_playlist` (docs/supabase/anon-share-schema.sql),
// kode u... dari Firestore `sharedPlaylists/<kode>` (../firestore.rules: `get` publik, `list` ditolak).
// HTML kecil: judul, jumlah lagu, beberapa lagu, tombol "Buka di MusicVerse", cadangan unduh, plus tag Open Graph yang
// menunjuk ke poster /api/og?code=<kode> (api/og.mjs) supaya tautan yang ditempel di WhatsApp/Telegram/Discord tampil sebagai poster.
// Env Vercel: lihat _share.mjs.
import { SITE, esc, loadShared, normalizeCode, summarize } from './_share.mjs';

const APP_ID = 'com.musicverse.app';
const SHOW_TRACKS = 5;

/** Asal situs dari permintaan (domain kustom / preview), cadangan SITE. */
function originOf(req) {
  const h = req.headers || {};
  const host = String(h['x-forwarded-host'] || h.host || '').split(',')[0].trim();
  if (!/^[a-z0-9.-]+(:\d+)?$/i.test(host)) return SITE;
  const proto = String(h['x-forwarded-proto'] || 'https').split(',')[0].trim() === 'http' ? 'http' : 'https';
  return `${proto}://${host}`;
}

function page({ title, desc, image, url, body, code }) {
  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="noindex">
<meta property="og:site_name" content="MusicVerse">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website">
${url ? `<meta property="og:url" content="${esc(url)}">` : ''}
${
  image
    ? `<meta property="og:image" content="${esc(image)}">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(title)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${esc(image)}">`
    : '<meta name="twitter:card" content="summary">'
}
<meta name="theme-color" content="#121212">
<style>
:root{--bg:#121212;--card:#1b1b1b;--raised:#262626;--ink:#eceFea;--muted:#a3a8a1;--accent:#1db954;--deep:#148a3f;--on:#06140b}
@media (prefers-color-scheme:light){:root{--bg:#f4f6f3;--card:#fff;--raised:#e9ece8;--ink:#14181a;--muted:#5d645c;--on:#06140b}}
*{box-sizing:border-box}
html,body{margin:0}
body{background:var(--bg);color:var(--ink);font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;min-height:100svh;display:grid;place-items:center;padding:max(20px,env(safe-area-inset-top)) 16px max(20px,env(safe-area-inset-bottom))}
main{width:100%;max-width:420px}
.fan{position:relative;border-radius:24px;overflow:hidden;background:linear-gradient(180deg,var(--accent),var(--deep));padding:26px 16px 18px;text-align:center;color:var(--on)}
.stack{position:relative;height:136px}
.stack img,.stack i{position:absolute;top:50%;left:50%;border-radius:14px;object-fit:cover;box-shadow:0 10px 22px rgba(0,0,0,.35);background:var(--raised)}
.stack .b{width:104px;height:104px;transform:translate(-50%,-50%) translateX(-66px) rotate(-9deg)}
.stack .c{width:104px;height:104px;transform:translate(-50%,-50%) translateX(66px) rotate(9deg)}
.stack .a{width:124px;height:124px;transform:translate(-50%,-50%);z-index:2}
h1{font-size:1.15rem;line-height:1.25;margin:14px 0 4px;overflow-wrap:anywhere}
.fan p{margin:0;font-size:.85rem;opacity:.85}
.btns{display:grid;gap:10px;margin:16px 0 6px}
a.btn{display:flex;align-items:center;justify-content:center;min-height:48px;border-radius:999px;font-weight:600;text-decoration:none}
a.main{background:var(--ink);color:var(--bg)}
a.alt{background:var(--raised);color:var(--ink)}
a.btn:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
ul{list-style:none;margin:14px 0 0;padding:0;display:grid;gap:10px}
li{display:flex;gap:12px;align-items:center;min-width:0}
li img,li i{width:44px;height:44px;border-radius:8px;object-fit:cover;background:var(--raised);flex:none}
li div{min-width:0}
li b,li span{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
li span{color:var(--muted);font-size:.82rem}
.more,.note{color:var(--muted);font-size:.82rem;margin:12px 4px 0}
.msg{background:var(--card);border-radius:20px;padding:26px 20px;text-align:center}
.msg h1{margin:0 0 8px}.msg p{margin:0 0 18px;color:var(--muted)}
@media (prefers-reduced-motion:no-preference){.fan{animation:in .35s ease-out both}@keyframes in{from{opacity:0;transform:translateY(8px)}}}
</style>
</head>
<body>
<main>
${body}
</main>
<script>
// Chrome Android: intent:// membuka app bila terpasang, bila tidak jatuh ke halaman unduh. Peramban lain memakai musicverse://.
(function(){var a=document.getElementById('open');if(!a)return;
if(/Android/i.test(navigator.userAgent)){var fb=encodeURIComponent(location.origin+'/');
a.href='intent://p/${esc(code || '')}#Intent;scheme=musicverse;package=${APP_ID};S.browser_fallback_url='+fb+';end';}})();
</script>
</body>
</html>`;
}

function message(code, heading, text, status) {
  return {
    status,
    html: page({
      title: `${heading} · MusicVerse`,
      desc: text,
      code,
      body: `<div class="msg"><h1>${esc(heading)}</h1><p>${esc(text)}</p><div class="btns"><a class="btn main" href="/">Unduh MusicVerse</a></div></div>`,
    }),
  };
}

function render(code, data, origin) {
  const tracks = data.tracks;
  const s = summarize(data);
  const covers = s.covers;
  const img = (src, cls) => (src ? `<img class="${cls}" src="${esc(src)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<i class="${cls}"></i>`);
  const count = tracks.length;
  const rows = tracks
    .slice(0, SHOW_TRACKS)
    .map(
      (t) => `<li>${
        t.cover ? `<img src="${esc(t.cover)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : '<i></i>'
      }<div><b>${esc(t.title)}</b>${t.artist ? `<span>${esc(t.artist)}</span>` : ''}</div></li>`,
    )
    .join('');
  const more = count > SHOW_TRACKS ? `<p class="more">+${count - SHOW_TRACKS} lagu lainnya</p>` : '';
  return {
    status: 200,
    html: page({
      title: `${s.title} · MusicVerse`,
      desc:
        s.kind === 'song'
          ? `${s.subtitle ? s.subtitle + ' · ' : ''}Dengarkan di MusicVerse`
          : `Playlist ${count} lagu dibagikan lewat MusicVerse.`,
      // Poster 1200x630 dibuat server (api/og.mjs) dari sampul + judul + artis/jumlah lagu.
      image: `${origin}/api/og?code=${code}`,
      url: `${origin}/p/${code}`,
      code,
      body: `<section class="fan">
<div class="stack">${img(covers[1], 'b')}${img(covers[2], 'c')}${img(covers[0], 'a')}</div>
<h1>${esc(data.title)}</h1>
<p>${count} lagu · dibagikan lewat MusicVerse</p>
</section>
<div class="btns">
<a id="open" class="btn main" href="musicverse://p/${esc(code)}">Buka di MusicVerse</a>
<a class="btn alt" href="/">Belum punya aplikasinya? Unduh</a>
</div>
<ul>${rows}</ul>${more}
<p class="note">Salinan disimpan di Pustakamu setelah kamu menekan Simpan di aplikasi. Tidak ada audio yang dikirim lewat tautan ini.</p>`,
    }),
  };
}

export default async function handler(req, res) {
  const code = normalizeCode(req.query?.code);
  let out;
  let cache = 'public, s-maxage=60, stale-while-revalidate=300';
  if (!code) {
    out = message('', 'Tautan tidak valid', 'Alamat ini bukan tautan playlist MusicVerse yang sah.', 404);
    cache = 'public, s-maxage=3600';
  } else {
    const data = await loadShared(code, process.env, req.headers?.['x-forwarded-for']);
    if (data.status === 'ok') out = render(code, data, originOf(req));
    else if (data.status === 'not_found') {
      out = message(
        code,
        'Tautan tidak berlaku',
        code.startsWith('u')
          ? 'Playlist ini sudah dihapus oleh pemiliknya, atau tautannya salah.'
          : 'Playlist ini sudah dimatikan oleh pengirimnya, sudah kedaluwarsa (tautan berlaku 30 hari), atau tautannya salah.',
        404,
      );
      cache = 'public, s-maxage=30';
    } else if (data.status === 'busy') {
      out = message(code, 'Sedang ramai', 'Terlalu banyak yang membuka tautan sekarang. Coba lagi sebentar lagi.', 503);
      cache = 'no-store';
    } else {
      out = message(code, 'Tidak bisa dibuka', 'Playlist belum bisa dimuat. Coba lagi sebentar lagi.', 502);
      cache = 'no-store';
    }
  }
  res.status(out.status);
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.setHeader('cache-control', cache);
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('referrer-policy', 'no-referrer');
  res.send(out.html);
}
