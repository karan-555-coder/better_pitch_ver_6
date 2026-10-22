// Pointer interactions for version 6 on GSAP (served by server.js from
// node_modules); styles in theme.css:
//  - the copper sheen on hovered buttons turns to follow the cursor's angle,
//    like light on brushed metal;
//  - a click throws copper sparks that arc down under gravity, like a grinder;
//  - following an internal link wipes a graphite-and-copper panel across the
//    screen while the next page loads in.
// The only new nodes are a click-through canvas for the sparks and the wipe
// panel, both appended to <body> outside React's tree. The canvas is only
// drawn while sparks are in the air.
(function () {
  if (!window.gsap) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const $$ = (sel, root) => [...(root || document).querySelectorAll(sel)];

  function sheen() {
    for (const b of $$('a.bg-primary-800, button.bg-primary-800')) {
      if (b._bpSh) continue;
      b._bpSh = true;
      b.addEventListener('pointermove', e => {
        const r = b.getBoundingClientRect();
        const ang = Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI;
        b.style.setProperty('--bp-ang', (ang + 90).toFixed(0) + 'deg');
      });
    }
  }

  function sparks() {
    const cv = document.createElement('canvas');
    cv.className = 'bp-sparks';
    document.body.appendChild(cv);
    const ctx = cv.getContext('2d');
    let dpr = 1;
    const size = () => { dpr = Math.min(2, devicePixelRatio || 1); cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; };
    size();
    addEventListener('resize', size);
    const P = [];
    let running = false, last = 0;
    const frame = now => {
      const dt = Math.min(32, now - last) / 16.7;
      last = now;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      ctx.lineCap = 'round';
      for (let i = P.length - 1; i >= 0; i--) {
        const p = P[i];
        p.life -= .022 * dt;
        if (p.life <= 0 || p.y > innerHeight + 20) { P.splice(i, 1); continue; }
        p.px = p.x; p.py = p.y;
        p.vy += .32 * dt; p.vx *= .985; p.vy *= .985;
        p.x += p.vx * dt; p.y += p.vy * dt;
        // each spark is a short streak along its motion, hot white turning copper as it cools
        const g = Math.max(0, p.life);
        ctx.strokeStyle = g > .6 ? `rgba(255,236,214,${g})` : `rgba(224,${120 + g * 80 | 0},${60 + g * 60 | 0},${g})`;
        ctx.lineWidth = 1.6 * g + .4;
        ctx.beginPath();
        ctx.moveTo(p.px - p.vx * 1.5, p.py - p.vy * 1.5);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
      if (P.length) requestAnimationFrame(frame);
      else { running = false; ctx.clearRect(0, 0, innerWidth, innerHeight); }
    };
    addEventListener('pointerdown', e => {
      if (e.target.closest('input, textarea, select, [contenteditable]')) return;
      const n = e.target.closest('a, button') ? 26 : 16;
      for (let i = 0; i < n && P.length < 160; i++) {
        // mostly upward, fanning out to both sides
        const a = -Math.PI / 2 + gsap.utils.random(-1.25, 1.25), v = gsap.utils.random(4, 11);
        P.push({ x: e.clientX, y: e.clientY, px: e.clientX, py: e.clientY, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: gsap.utils.random(.7, 1) });
      }
      if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
    });
  }

  function wipe() {
    const panel = document.createElement('div');
    panel.className = 'bp-wipe';
    document.body.appendChild(panel);
    addEventListener('click', e => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest('a[href]');
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || (url.pathname === location.pathname && url.search === location.search)) return;
      // In the replica a link loads a whole new page, which would take the panel
      // with it before it is seen, so the panel covers the screen first and the
      // page is opened after. If that is slow it lifts again on its own.
      e.preventDefault();
      e.stopPropagation();
      gsap.timeline()
        .fromTo(panel, { translate: '0 100%' }, { translate: '0 0%', duration: .45, ease: 'power3.in', onComplete: () => location.assign(url.href) })
        .to(panel, { translate: '0 -100%', duration: .55, ease: 'power3.out', delay: 1.5 })
        .set(panel, { translate: '0 100%' });
    }, true);
    // coming back with the browser's back button can restore the page with the panel still up
    addEventListener('pageshow', e => { if (e.persisted) gsap.set(panel, { translate: '0 100%' }); });
  }

  let started = false;
  function start() {
    if (started) return;
    started = true;
    sheen();
    sparks();
    wipe();
    let pending = false;
    new MutationObserver(() => {
      if (pending) return;
      pending = true;
      // batched: React can add many nodes in a burst
      setTimeout(() => { pending = false; sheen(); }, 400);
    }).observe(document.querySelector('main') || document.body, { childList: true, subtree: true });
  }
  // after theme.js (load + 600ms) and motion.js (load + 900ms)
  window.addEventListener('load', () => setTimeout(start, 1100));
  setTimeout(start, 5000);
})();
