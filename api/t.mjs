// Halaman tautan gabung Listen Together: https://<domain>/t/<kode>  (vercel.json: /t/:code -> /api/t?code=:code).
// TANPA basis data: room hidup singkat dan dipegang Worker Cloudflare, jadi halaman ini hanya menampilkan kode dan tombol
// "Buka di MusicVerse" (musicverse://t/<kode>; di Chrome Android lewat intent://). Tautan hanya MEMBUKA lembar di app;
// pengguna tetap mengetuk Gabung di sana. Cadangan: unduh app. Kode = 6 karakter alfabet bagikan (tanpa i, l, o, 0, 1).
import { SITE, esc } from './_share.mjs';

const APP_ID = 'com.musicverse.app';
const ROOM_RE = /^[2-9a-hjkmnp-z]{6}$/;

function normalize(raw) {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (typeof v !== 'string') return null;
  const code = v.toLowerCase().replace(/[ -]/g, '');
  return ROOM_RE.test(code) ? code : null;
}

function originOf(req) {
  const h = req.headers || {};
  const host = String(h['x-forwarded-host'] || h.host || '').split(',')[0].trim();
  if (!/^[a-z0-9.-]+(:\d+)?$/i.test(host)) return SITE;
  const proto = String(h['x-forwarded-proto'] || 'https').split(',')[0].trim() === 'http' ? 'http' : 'https';
  return `${proto}://${host}`;
}

function page({ title, desc, url, body, code }) {
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
<meta name="twitter:card" content="summary">
<meta name="theme-color" content="#121212">
<style>
:root{--bg:#121212;--card:#1b1b1b;--raised:#262626;--ink:#eceFea;--muted:#a3a8a1;--accent:#1db954;--deep:#148a3f;--on:#06140b}
@media (prefers-color-scheme:light){:root{--bg:#f4f6f3;--card:#fff;--raised:#e9ece8;--ink:#14181a;--muted:#5d645c;--on:#06140b}}
*{box-sizing:border-box}
html,body{margin:0}
body{background:var(--bg);color:var(--ink);font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;min-height:100svh;display:grid;place-items:center;padding:max(20px,env(safe-area-inset-top)) 16px max(20px,env(safe-area-inset-bottom))}
main{width:100%;max-width:420px}
.hero{border-radius:24px;background:linear-gradient(180deg,var(--accent),var(--deep));padding:30px 18px 24px;text-align:center;color:var(--on)}
.hero h1{font-size:1.15rem;line-height:1.25;margin:0 0 14px}
.code{display:inline-block;font:700 2.1rem/1.1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.14em;background:rgba(255,255,255,.22);border-radius:16px;padding:12px 18px}
.hero p{margin:14px 0 0;font-size:.85rem;opacity:.85}
.btns{display:grid;gap:10px;margin:16px 0 6px}
a.btn{display:flex;align-items:center;justify-content:center;min-height:48px;border-radius:999px;font-weight:600;text-decoration:none}
a.main{background:var(--ink);color:var(--bg)}
a.alt{background:var(--raised);color:var(--ink)}
a.btn:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
.note{color:var(--muted);font-size:.82rem;margin:12px 4px 0}
.msg{background:var(--card);border-radius:20px;padding:26px 20px;text-align:center}
.msg h1{font-size:1.15rem;margin:0 0 8px}.msg p{margin:0 0 18px;color:var(--muted)}
@media (prefers-reduced-motion:no-preference){.hero{animation:in .35s ease-out both}@keyframes in{from{opacity:0;transform:translateY(8px)}}}
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
a.href='intent://t/${esc(code || '')}#Intent;scheme=musicverse;package=${APP_ID};S.browser_fallback_url='+fb+';end';}})();
</script>
</body>
</html>`;
}

export default function handler(req, res) {
  const code = normalize(req.query?.code);
  let status = 200;
  let html;
  let cache = 'public, s-maxage=3600';
  if (!code) {
    status = 404;
    html = page({
      title: 'Tautan tidak valid · MusicVerse',
      desc: 'Alamat ini bukan tautan Dengar bareng MusicVerse yang sah.',
      code: '',
      body: '<div class="msg"><h1>Tautan tidak valid</h1><p>Alamat ini bukan tautan Dengar bareng MusicVerse yang sah.</p><div class="btns"><a class="btn main" href="/">Unduh MusicVerse</a></div></div>',
    });
  } else {
    const shown = `${code.slice(0, 3)} ${code.slice(3)}`.toUpperCase();
    html = page({
      title: 'Dengar bareng di MusicVerse',
      desc: `Kamu diajak mendengarkan musik bersama. Kode room: ${shown}.`,
      url: `${originOf(req)}/t/${code}`,
      code,
      body: `<section class="hero">
<h1>Kamu diajak dengar bareng</h1>
<div class="code" aria-label="Kode room">${esc(shown)}</div>
<p>Room hanya hidup selama host masih di dalamnya.</p>
</section>
<div class="btns">
<a id="open" class="btn main" href="musicverse://t/${esc(code)}">Buka di MusicVerse</a>
<a class="btn alt" href="/">Belum punya aplikasinya? Unduh</a>
</div>
<p class="note">Aplikasi akan membuka Dengar bareng dengan kode ini terisi; kamu tinggal mengetuk Gabung. Tidak ada audio yang dikirim lewat tautan ini. Kode juga bisa diketik manual di Dengar bareng.</p>`,
    });
  }
  res.status(status);
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.setHeader('cache-control', cache);
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('referrer-policy', 'no-referrer');
  res.send(html);
}
