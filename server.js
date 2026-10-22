// Replays the archive recorded by capture.js on http://localhost:PORT.
// Usage: node server.js   (PORT env var optional, default 4000)
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 4000;
const ARCHIVE = path.join(__dirname, 'archive');
const manifest = JSON.parse(fs.readFileSync(path.join(ARCHIVE, 'manifest.json'), 'utf8'));
const SITE = 'www.artisan.co';
// Other archived hosts, served under /__ext/<host>. The dashboard hosts are the
// "Ava" web-chat widget: its loader, its iframe app and its API.
const EXT_HOSTS = [
  'images.ctfassets.net',
  'artisanai-storage.sfo3.cdn.digitaloceanspaces.com',
  'dashboard.artisan.co',
  'api.dashboard.artisan.co',
  'cdn.replica.tavus.io',
];
const CHAT_API = 'api.dashboard.artisan.co/api/public/web-chat/';

// Indexes for fuzzy fallbacks.
const imageByUrl = {};   // /_next/image?url=X  -> [{w, key}]
const rscByPath = {};    // pathname            -> key of any recorded ?_rsc= response
const extByPath = {};    // pathname            -> key on another archived host (the chat iframe
                         //                        requests root-relative /_next/... and /embed/...)
for (const key of Object.keys(manifest)) {
  if (key.startsWith('POST ')) continue;
  if (!key.startsWith(SITE + '/')) {
    extByPath[new URL('http://' + key).pathname] ||= key;
    continue;
  }
  const u = new URL('http://' + key);
  if (u.pathname === '/_next/image') {
    const src = u.searchParams.get('url');
    (imageByUrl[src] ||= []).push({ w: Number(u.searchParams.get('w')) || 0, key });
  } else if (u.searchParams.has('_rsc')) {
    rscByPath[u.pathname] ||= key;
  }
}

// Redirects the live site performs (checked with curl).
const REDIRECTS = {
  '/talk-to-sales': '/request-demo',
};

const TEXT_RE =/text\/|javascript|json|x-component|svg|xml/;

// Pages may only load from localhost (plus the few third parties listed), so
// analytics, ad pixels and session recorders injected by GTM or the chat
// widget can't phone home from the replica.
const ALLOWED = [
  'https://jobs.ashbyhq.com', 'https://app.ashbyhq.com', 'https://cdn.ashbyprd.com', // /careers job board
  'https://hatscripts.github.io', // flag icons
  'https://www.youtube.com', 'https://www.youtube-nocookie.com', 'https://i.ytimg.com', // video embeds
];
const CSP = [
  "default-src 'self' data: blob:",
  `script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: ${ALLOWED.join(' ')}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${ALLOWED.join(' ')}`,
  `connect-src 'self' ${ALLOWED.join(' ')}`,
  `frame-src 'self' ${ALLOWED.join(' ')}`,
].join('; ');

// Replacements must keep the exact byte length: Next.js embeds RSC "T" rows
// whose length prefix covers this text, and a mismatch breaks hydration
// ("Connection closed."). "http://localhost:" + 5-digit zero-padded port is
// 22 chars, same as "https://www.artisan.co"; "/__ext//" is 8 chars, same as "https://".
const LOCAL_ORIGIN = 'http://localhost:' + String(PORT).padStart(5, '0');

function rewrite(body) {
  let s = body.toString('utf8');
  s = s.split('https://www.artisan.co').join(LOCAL_ORIGIN);
  // Only the chat widget's /embed/ URLs: other dashboard links (e.g. "Login" ->
  // /sign-in) must stay absolute, or Next.js treats them as in-site pages.
  // The loader URL is built as `${origin || "https://dashboard.artisan.co"}/embed/loader.js`.
  s = s.split('https://dashboard.artisan.co/embed/').join('/__ext//dashboard.artisan.co/embed/');
  s = s.split('"https://dashboard.artisan.co"').join('"/__ext//dashboard.artisan.co"');
  for (const h of EXT_HOSTS) if (h !== 'dashboard.artisan.co') s = s.split('https://' + h).join('/__ext//' + h);
  return s;
}

// BetterPitch palette (version 6, graphite & copper): every purple/violet/
// magenta colour in the recorded files (hue 240-335) is replaced. Vivid mid
// shades become copper (hue 24-29), dark and muted ones a cool graphite grey,
// and light ones a warm cream; the three are mixed in RGB since graphite and
// copper sit far apart on the hue wheel. Alpha is kept, so only colours change.
// HTML and RSC payloads
// must keep their byte length (see above), so there a replacement that would be
// longer is skipped and a shorter one is padded with spaces.
function hslOf(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function rgbOf(h, s, l) {
  const f = n => { const k = (n + h / 30) % 12, a = s * Math.min(l, 1 - l); return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); };
  return [f(0), f(8), f(4)];
}
const mix = (p, q, t) => p.map((v, i) => Math.round(v + (q[i] - v) * t));
function toTheme(r, g, b) {
  const [h, s, l] = hslOf(r, g, b);
  if (h < 240 || h > 335 || s <= .12) return null;
  // b2 blends towards cream as shades get light; v picks copper for vivid mid
  // shades, everything else (incl. dark vivid ones) is graphite
  const b2 = Math.min(1, Math.max(0, (l - .7) / .15));
  const v = Math.min(1, Math.max(0, (s - .55) / .2)) * Math.min(1, Math.max(0, (l - .42) / .08));
  const cream = rgbOf(28, Math.min(s, .45) * .5, l);
  const graphite = mix(rgbOf(220, .08, l * .42), cream, b2);
  const copper = mix(rgbOf(24 + (h - 240) * .05, Math.min(.62, s * .7), .48 + (l - .45) * .3), cream, b2);
  return mix(graphite, copper, v);
}
const hex2 = n => n.toString(16).padStart(2, '0');
// Fixed swaps: the ivory page backgrounds become a soft warm grey-white, and
// the amber and pink-red stops of the heading text gradient (outside the purple
// hue range) become light and deep copper.
const FIXED = { fbf9f7: 'f6f5f3', f4f0ec: 'eeece8', f5f1ed: 'efede9', f8f5f3: 'f4f3f0', f2c677: 'e0a77c', fc1855: '9a5a36' };

function recolor(s, type) {
  const exactLength = /text\/html|x-component/.test(type);
  s = s.replace(/#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-zA-Z_-])/g, (m, h) => {
    if (h.length === 3 && !/css/.test(type)) return m;
    const full = h.length === 3 ? h.replace(/./g, c => c + c) : h;
    const fixed = h.length !== 3 && FIXED[full.slice(0, 6).toLowerCase()];
    if (fixed) return '#' + fixed + full.slice(6);
    const c = toTheme(...[0, 2, 4].map(i => parseInt(full.substr(i, 2), 16)));
    if (!c) return m;
    if (h.length === 3) return '#' + c.map(v => Math.round(v / 17).toString(16)).join('');
    return '#' + c.map(hex2).join('') + full.slice(6);
  });
  return s.replace(/(rgba?\(\s*)(\d+)([ ,]+)(\d+)([ ,]+)(\d+)/g, (m, p, r, s1, g, s2, b) => {
    const c = toTheme(+r, +g, +b);
    if (!c) return m;
    let out = p + c[0] + s1 + c[1] + s2 + c[2];
    if (exactLength) {
      if (out.length > m.length) return m;
      out = p + c[0] + s1 + c[1] + s2 + ' '.repeat(m.length - out.length) + c[2];
    }
    return out;
  });
}

function lookup(u) {
  if (u.pathname.startsWith('/__ext/')) {
    const k = u.pathname.replace(/^\/__ext\/+/, '') + u.search;
    return manifest[k] ? k : null;
  }
  const exact = SITE + u.pathname + u.search;
  if (manifest[exact]) return exact;

  if (u.pathname === '/_next/image') {
    // Image URLs rewritten to /__ext/<host> by rewrite() come back here; map them to the original.
    const src = u.searchParams.get('url').replace(/^\/__ext\/+/, 'https://');
    const list = imageByUrl[src];
    if (!list) return null;
    const w = Number(u.searchParams.get('w')) || 0;
    return list.slice().sort((a, b) => Math.abs(a.w - w) - Math.abs(b.w - w))[0].key;
  }
  if (u.searchParams.has('_rsc')) return rscByPath[u.pathname] || null;

  // Same path without query string, and trailing-slash variants.
  const bare = u.pathname.replace(/\/+$/, '') || '/';
  for (const k of [SITE + bare, SITE + bare + '/']) if (manifest[k]) return k;
  return extByPath[u.pathname] || null;
}

function send(res, entry) {
  // Images with purple recoloured by recolor-images.js.
  const recolored = path.join(ARCHIVE, 'recolored', entry.file);
  let body = fs.readFileSync(fs.existsSync(recolored) ? recolored : path.join(ARCHIVE, 'files', entry.file));
  if (TEXT_RE.test(entry.type)) body = recolor(rewrite(body), entry.type);
  const headers = { 'content-type': entry.type || 'application/octet-stream', 'cache-control': 'no-cache' };
  if (/text\/html/.test(entry.type)) {
    headers['content-security-policy'] = CSP;
    // BetterPitch copy is swapped in on the client (betterpitch/content.js) so the
    // recorded markup and RSC payloads stay byte-identical.
    // The home page's first section is added the same way (betterpitch/hero.js).
    // The opening logo animation (betterpitch/intro.js) runs first.
    // Site-wide background glow and motion (betterpitch/theme.css, theme.js),
    // plus scroll-driven motion and pointer interactions on GSAP
    // (betterpitch/motion.js, interact.js), the 3D/playful layer (play.js) and
    // the Spline 3D robot in the hero (spline.js, an ES module).
    body = body.replace('</head>', '<link rel="stylesheet" href="/__bp/theme.css"><script src="/__bp/intro.js"></script><script src="/__bp/content.js"></script><script src="/__bp/hero.js"></script><script src="/__bp/theme.js"></script>' +
      '<script src="/__bp/gsap.min.js"></script><script src="/__bp/ScrollTrigger.min.js"></script>' +
      '<script src="/__bp/motion.js"></script><script src="/__bp/interact.js"></script><script src="/__bp/play.js"></script>' +
      '<script type="module" src="/__bp/spline.js"></script></head>');
  }
  res.writeHead(entry.status, headers);
  res.end(body);
}

http.createServer((req, res) => {
  const u = new URL(req.url, 'http://localhost');
  // Analytics endpoints (PostHog proxy) - answer with an empty success so nothing errors.
  const BP = {
    '/__bp/content.js': 'application/javascript', '/__bp/hero.js': 'application/javascript', '/__bp/hero.css': 'text/css',
    '/__bp/theme.js': 'application/javascript', '/__bp/theme.css': 'text/css', '/__bp/motion.js': 'application/javascript',
    '/__bp/interact.js': 'application/javascript', '/__bp/intro.js': 'application/javascript',
    '/__bp/play.js': 'application/javascript', '/__bp/spline.js': 'application/javascript',
  };
  // GSAP comes from node_modules (CSP only allows scripts from this server)
  const GSAP = { '/__bp/gsap.min.js': 1, '/__bp/ScrollTrigger.min.js': 1 };
  if (GSAP[u.pathname]) {
    res.writeHead(200, { 'content-type': 'application/javascript', 'cache-control': 'no-cache' });
    return res.end(fs.readFileSync(path.join(__dirname, 'node_modules', 'gsap', 'dist', path.basename(u.pathname))));
  }
  // Spline runtime (its chunks, wasm and textures) also comes from node_modules;
  // the scene itself is a self-hosted copy in betterpitch/spline/.
  if (u.pathname.startsWith('/__bp/spline/')) {
    const name = path.basename(u.pathname);
    const file = name.endsWith('.splinecode')
      ? path.join(__dirname, 'betterpitch', 'spline', name)
      : path.join(__dirname, 'node_modules', '@splinetool', 'runtime', 'build', name);
    if (!fs.existsSync(file)) { res.writeHead(404); return res.end(); }
    const TYPES = { '.js': 'application/javascript', '.wasm': 'application/wasm', '.png': 'image/png' };
    res.writeHead(200, { 'content-type': TYPES[path.extname(name)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    return res.end(fs.readFileSync(file));
  }
  if (BP[u.pathname]) {
    res.writeHead(200, { 'content-type': BP[u.pathname], 'cache-control': 'no-cache' });
    return res.end(fs.readFileSync(path.join(__dirname, 'betterpitch', path.basename(u.pathname))));
  }
  if (u.pathname.startsWith('/ingest')) {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end('{}');
  }
  if (req.method !== 'GET') {
    // The chat widget's start-up calls (bootstrap, opener) were recorded, so the
    // panel renders as it does live. Anything else - sending a message, starting
    // a call - needs Artisan's live AI backend, which only accepts artisan.co.
    const k = 'POST ' + u.pathname.replace(/^\/__ext\/+/, '');
    if (manifest[k]) return send(res, manifest[k]);
    if (k.includes(CHAT_API)) {
      res.writeHead(503, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: { code: 'OFFLINE_REPLICA', message: 'Chat is not available in the local replica.' } }));
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end('{}');
  }
  const key = lookup(u);
  if (!key && REDIRECTS[u.pathname]) {
    res.writeHead(308, { location: REDIRECTS[u.pathname] });
    return res.end();
  }
  if (!key) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    return res.end('Not in archive: ' + u.pathname + u.search + '\nRun: node capture.js ' + u.pathname);
  }
  send(res, manifest[key]);
}).listen(PORT, () => console.log(`Artisan replica running at http://localhost:${PORT}`));
