// Playful stickers for the empty space beside centred section headings (styles
// in fill.css): a small copper icon on a soft tile sits to the left and right
// of each heading that has room for it, pops in when scrolled to, bobs gently
// and wiggles on hover. The stickers live in one aria-hidden layer at the end
// of <main>, positioned over the headings: never inside a heading (content.js
// swaps its text) or beside it (motion.js groups a heading with its siblings).
(function () {
  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = '/__bp/fill.css';
  document.head.appendChild(css);

  const P = 'viewBox="0 0 24 24"';
  const ICONS = [
    // phone, chat bubble, sparkle, calendar check, sound wave, headset, star, check badge
    `<svg ${P}><path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>`,
    `<svg ${P}><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12z"/><path d="M8.5 12h.01M12 12h.01M15.5 12h.01"/></svg>`,
    `<svg ${P}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16v4M17 18h4"/></svg>`,
    `<svg ${P}><rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4M9 15l2 2 4-4"/></svg>`,
    `<svg ${P}><path d="M3 12h2M7 8v8M11 5v14M15 9v6M19 11v2M21 12h0"/></svg>`,
    `<svg ${P}><path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="13" width="4" height="6" rx="1.5"/><rect x="17" y="13" width="4" height="6" rx="1.5"/><path d="M19 19a3 3 0 0 1-3 3h-3"/></svg>`,
    `<svg ${P}><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/></svg>`,
    `<svg ${P}><path d="M12 3l2.3 1.7 2.8-.2.9 2.7 2.3 1.6-.9 2.7.9 2.7-2.3 1.6-.9 2.7-2.8-.2L12 21l-2.3-1.7-2.8.2-.9-2.7-2.3-1.6.9-2.7-.9-2.7 2.3-1.6.9-2.7 2.8.2z"/><path d="M8.8 12l2.2 2.2 4.2-4.4"/></svg>`,
  ];
  const MIN_ROOM = 150; // px of free space needed on each side of the text
  let next = 0;
  const done = new WeakSet();

  const placers = [];
  const placeAll = () => placers.forEach(p => p());
  // headings rise a few pixels into place as they appear (motion.js), so
  // measure again when a sticker comes in
  const io = new IntersectionObserver(es => {
    for (const e of es) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); setTimeout(placeAll, 900); }
  }, { threshold: .6 });

  let layer, main;
  function getLayer() {
    const m = document.querySelector('main');
    if (!m) return null;
    if (!layer) { layer = document.createElement('div'); layer.className = 'bp-stk-layer'; layer.setAttribute('aria-hidden', 'true'); }
    if (layer.parentElement !== m) {
      if (getComputedStyle(m).position === 'static') m.style.position = 'relative';
      m.appendChild(layer);
      if (m !== main) { main = m; new ResizeObserver(placeAll).observe(m); }
    }
    return layer;
  }

  function isDark(el) {
    const [r, g, b] = getComputedStyle(el).color.match(/\d+/g).map(Number);
    return r * .3 + g * .59 + b * .11 > 160; // light text = dark section
  }

  function decorate(h) {
    if (done.has(h)) return;
    const range = document.createRange();
    range.selectNodeContents(h);
    const t = range.getBoundingClientRect();
    if (!t.width) return;
    // the heading's wrapper is often only as wide as the text: go up (a few
    // levels at most) to the first box with room on both sides
    let host = h.parentElement;
    const roomy = el => { const r = el.getBoundingClientRect(); return t.left - r.left >= MIN_ROOM && r.right - t.right >= MIN_ROOM; };
    for (let i = 0; host && i < 4 && !roomy(host); i++) host = host.parentElement;
    if (!host || host === document.body || !roomy(host)) return;
    const lay = getLayer();
    if (!lay) return;
    done.add(h);
    const dark = isDark(h);
    const stickers = [-1, 1].map((side, i) => {
      const s = document.createElement('span');
      s.className = 'bp-stk' + (dark ? ' bp-stk-dark' : '');
      s.innerHTML = ICONS[next++ % ICONS.length];
      s.style.setProperty('--r', (side * (6 + (next % 3) * 3)) + 'deg');
      s.style.setProperty('--d', (-i * 1.7 - (next % 4) * .6) + 's');
      lay.appendChild(s);
      io.observe(s);
      return s;
    });
    const place = () => {
      const r = range.getBoundingClientRect(), b = main.getBoundingClientRect();
      if (!r.width) return;
      // left sticker a little above the middle, right one a little below
      stickers[0].style.left = (r.left - b.left - 70) + 'px';
      stickers[0].style.top = (r.top - b.top + r.height * .3) + 'px';
      stickers[1].style.left = (r.right - b.left + 70) + 'px';
      stickers[1].style.top = (r.top - b.top + r.height * .7) + 'px';
    };
    placers.push(place);
    place();
  }

  function scan() {
    if (!matchMedia('(min-width: 1200px)').matches) return;
    if (layer && placers.length) getLayer(); // React may have re-rendered <main>
    for (const h of document.querySelectorAll('main h2')) {
      if (h.closest('#bp-hero, nav, footer, [class*="marquee"], [class*="embla"]')) continue;
      decorate(h);
    }
  }

  // React hydrates (and content.js swaps copy) after load: scan then, and
  // again whenever the page changes, debounced.
  let t;
  const later = () => { clearTimeout(t); t = setTimeout(scan, 400); };
  addEventListener('load', () => {
    later();
    new MutationObserver(later).observe(document.body, { childList: true, subtree: true });
  });
})();
