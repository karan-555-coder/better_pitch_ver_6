// 3D and playful layer for version 6 (styles in theme.css), on GSAP:
//  - a dotted copper globe turns behind the dark "platform" heading, with calls
//    arcing between cities and pinging where they land; drag it to spin it,
//    click it to fire a burst of calls from the nearest city;
//  - cards tilt in 3D towards the cursor with a copper glare, and their icon
//    flips like a coin when the cursor arrives;
//  - buttons are magnetic and wobble like jelly when pressed;
//  - a copper ring trails the cursor, stretching with speed and growing over
//    anything clickable;
//  - the floating chips in the closing call-to-action drift in 3D depth with
//    the cursor.
// New nodes (the globe canvas, the cursor ring) sit in decorative layers or
// at the end of <body>, never in the page's own content. Canvases only draw
// while on screen.
(function () {
  if (!window.gsap) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const $$ = (sel, root) => [...(root || document).querySelectorAll(sel)];
  const fine = matchMedia('(pointer: fine)').matches;
  const skip = el => el.closest('#bp-hero, [class*="marquee"], [class*="embla"]');
  const DPR = Math.min(2, devicePixelRatio || 1);
  const RAD = Math.PI / 180;

  // ---------- globe ----------
  // rough continents as blobs [lat, lon, radius in degrees]
  const LAND = [[48, -100, 24], [62, -120, 16], [20, -98, 9], [-12, -58, 17], [-32, -64, 9], [50, 12, 12], [62, 25, 10],
    [6, 20, 21], [-22, 25, 12], [24, 45, 10], [50, 85, 26], [60, 120, 18], [30, 105, 16], [21, 78, 8], [5, 112, 9],
    [-25, 134, 12], [72, -42, 8], [36, 138, 4], [-2, 120, 6]];
  const CITIES = [[40.7, -74], [37.8, -122.4], [43.7, -79.4], [51.5, -0.1], [52.5, 13.4], [19.1, 72.9], [28.6, 77.2],
    [25.2, 55.3], [1.35, 103.8], [35.7, 139.7], [-33.9, 151.2], [-23.5, -46.6], [6.5, 3.4], [-26.2, 28], [19.4, -99.1]];
  const vec = (lat, lon) => [Math.cos(lat * RAD) * Math.sin(lon * RAD), Math.sin(lat * RAD), Math.cos(lat * RAD) * Math.cos(lon * RAD)];
  const isLand = (lat, lon) => LAND.some(([la, lo, r]) => {
    const a = vec(lat, lon), b = vec(la, lo);
    const d = Math.acos(Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])) / RAD;
    return d < r * (1 + .28 * Math.sin(lon * .11 + lat * .07) * Math.cos(lat * .13));
  });
  // dots spread evenly over the sphere (Fibonacci), split into land and sea
  const DOTS = (() => {
    const out = [], n = 5200, g = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < n; i++) {
      const y = 1 - (i / (n - 1)) * 2, r = Math.sqrt(1 - y * y), t = g * i;
      const v = [Math.cos(t) * r, y, Math.sin(t) * r];
      const lat = Math.asin(y) / RAD, lon = Math.atan2(v[0], v[2]) / RAD;
      out.push({ v, land: isLand(lat, lon) });
    }
    return out;
  })();
  const CITY_V = CITIES.map(([la, lo]) => vec(la, lo));

  function slerp(a, b, t) {
    const d = Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]), w = Math.acos(d), s = Math.sin(w) || 1e-6;
    const p = Math.sin((1 - t) * w) / s, q = Math.sin(t * w) / s;
    return [a[0] * p + b[0] * q, a[1] * p + b[1] * q, a[2] * p + b[2] * q];
  }

  function Globe(host, opts) {
    const cv = document.createElement('canvas');
    cv.className = 'bp-globe ' + (opts.cls || '');
    cv.setAttribute('aria-hidden', 'true');
    host.appendChild(cv);
    const ctx = cv.getContext('2d');
    let W = 0, R = 0, yaw = -1.2, pitch = -.32, spin = .0016, tPitch = -.32, drag = null, vis = false, raf = 0;
    const arcs = [], pings = [];
    function size() {
      W = cv.clientWidth;
      cv.width = cv.height = Math.round(W * DPR);
      R = W * .4;
    }
    new ResizeObserver(size).observe(cv);
    size();

    function project(v) {
      const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      const x = v[0] * cy + v[2] * sy, z1 = -v[0] * sy + v[2] * cy;
      const y = v[1] * cp - z1 * sp, z = v[1] * sp + z1 * cp;
      return [W / 2 + x * R, W / 2 - y * R, z];
    }
    function launch(from) {
      const a = from != null ? from : Math.floor(Math.random() * CITY_V.length);
      let b = Math.floor(Math.random() * CITY_V.length);
      if (b === a) b = (b + 3) % CITY_V.length;
      arcs.push({ a: CITY_V[a], b: CITY_V[b], bi: b, t: 0, sp: .55 + Math.random() * .35,
        h: .12 + .28 * Math.acos(CITY_V[a][0] * CITY_V[b][0] + CITY_V[a][1] * CITY_V[b][1] + CITY_V[a][2] * CITY_V[b][2]) / Math.PI });
    }

    let last = performance.now(), nextArc = 0;
    function frame(now) {
      raf = 0;
      if (!cv.isConnected) return;
      const dt = Math.min(.05, (now - last) / 1000);
      last = now;
      // spin is in radians per 60fps frame; a flick slows back to the idle turn
      if (!drag) { yaw += spin * 60 * dt; spin += (.0016 - spin) * .02; }
      pitch += (tPitch - pitch) * .06;
      if (now > nextArc && arcs.length < 7) { launch(); nextArc = now + 420 + Math.random() * 700; }

      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.clearRect(0, 0, W, W);
      // atmosphere and a copper rim light
      const g = ctx.createRadialGradient(W / 2, W / 2, R * .8, W / 2, W / 2, R * 1.35);
      g.addColorStop(0, 'rgba(200,132,86,0)');
      g.addColorStop(.22, 'rgba(200,132,86,.16)');
      g.addColorStop(1, 'rgba(200,132,86,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, W);
      const body = ctx.createRadialGradient(W / 2 - R * .35, W / 2 - R * .4, R * .1, W / 2, W / 2, R);
      body.addColorStop(0, 'rgba(70,58,52,.55)');
      body.addColorStop(1, 'rgba(20,21,24,.35)');
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.arc(W / 2, W / 2, R, 0, Math.PI * 2); ctx.fill();

      for (const d of DOTS) {
        const [x, y, z] = project(d.v);
        if (d.land) {
          const s = (z > 0 ? 1.5 + z * 1.1 : 1.1) * (W / 600);
          ctx.fillStyle = z > 0 ? `rgba(232,172,126,${.4 + z * .6})` : 'rgba(224,167,124,.09)';
          ctx.fillRect(x - s / 2, y - s / 2, s, s);
        } else if (z > 0) {
          const s = 1 * (W / 600);
          ctx.fillStyle = `rgba(236,234,230,${.06 + z * .1})`;
          ctx.fillRect(x - s / 2, y - s / 2, s, s);
        }
      }
      // cities
      for (const c of CITY_V) {
        const [x, y, z] = project(c);
        if (z <= 0) continue;
        ctx.fillStyle = `rgba(255,226,200,${.4 + z * .6})`;
        ctx.beginPath(); ctx.arc(x, y, 1.8 * (W / 600) + z, 0, Math.PI * 2); ctx.fill();
      }
      // calls: a bright head on a great-circle arc lifted off the surface, its tail fading
      ctx.lineCap = 'round';
      for (let i = arcs.length - 1; i >= 0; i--) {
        const a = arcs[i];
        const was = a.t;
        a.t += dt * a.sp;
        if (was < 1 && a.t >= 1) pings.push({ v: a.b, t: 0 });
        if (a.t > 1.45) { arcs.splice(i, 1); continue; }
        const head = Math.min(1, a.t), tail = Math.max(0, a.t - .45);
        let prev = null;
        for (let k = 0; k <= 22; k++) {
          const t = tail + (head - tail) * k / 22;
          const p = slerp(a.a, a.b, t), lift = 1 + a.h * Math.sin(Math.PI * t);
          const q = project([p[0] * lift, p[1] * lift, p[2] * lift]);
          if (prev) {
            const front = q[2] > -.15 || Math.hypot(q[0] - W / 2, q[1] - W / 2) > R;
            ctx.strokeStyle = `rgba(240,196,160,${(k / 22) * (front ? .95 : .18)})`;
            ctx.lineWidth = (.6 + 1.6 * k / 22) * (W / 600);
            ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
          }
          prev = q;
        }
        if (a.t < 1 && prev) {
          ctx.fillStyle = '#fff3e6';
          ctx.shadowColor = 'rgba(224,167,124,.9)'; ctx.shadowBlur = 10;
          ctx.beginPath(); ctx.arc(prev[0], prev[1], 2.4 * (W / 600), 0, Math.PI * 2); ctx.fill();
          ctx.shadowBlur = 0;
        }
      }
      // pings: a ring spreading on the surface where a call lands
      for (let i = pings.length - 1; i >= 0; i--) {
        const p = pings[i];
        p.t += dt;
        if (p.t > 1.1) { pings.splice(i, 1); continue; }
        const [x, y, z] = project(p.v);
        if (z <= 0) continue;
        const r = (4 + p.t * 22) * (W / 600);
        ctx.strokeStyle = `rgba(240,196,160,${(1 - p.t / 1.1) * z})`;
        ctx.lineWidth = 1.4 * (W / 600);
        ctx.beginPath(); ctx.ellipse(x, y, r, r * Math.max(.25, z), 0, 0, Math.PI * 2); ctx.stroke();
      }
      if (vis) raf = requestAnimationFrame(frame);
    }
    const run = () => { if (!raf && vis) { last = performance.now(); raf = requestAnimationFrame(frame); } };
    new IntersectionObserver(([e]) => { vis = e.isIntersecting; run(); }).observe(cv);

    // drag to spin (the canvas itself is click-through; the section listens)
    const inside = e => {
      const r = cv.getBoundingClientRect();
      return Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)) < r.width * .38;
    };
    const area = opts.area;
    const free = e => !e.target.closest('a, button, input, textarea, select, [role="button"]');
    area.addEventListener('pointermove', e => {
      const r = cv.getBoundingClientRect();
      if (drag) {
        const dx = e.clientX - drag.x;
        yaw += dx * .006; spin = dx * .006; drag.x = e.clientX;
        tPitch = Math.max(-.9, Math.min(.5, tPitch + (e.clientY - drag.y) * .004)); drag.y = e.clientY;
        return;
      }
      tPitch = -.32 + ((e.clientY - (r.top + r.height / 2)) / innerHeight) * .25;
      area.classList.toggle('bp-globe-grab', inside(e) && free(e));
    });
    area.addEventListener('pointerdown', e => {
      if (!inside(e) || !free(e)) return;
      drag = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY };
      area.classList.add('bp-globe-dragging');
    });
    addEventListener('pointerup', e => {
      if (!drag) return;
      const moved = Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0);
      drag = null;
      area.classList.remove('bp-globe-dragging');
      spin = Math.max(-.06, Math.min(.06, spin));
      if (moved < 5) {
        // click: a burst of calls from the city nearest the pointer
        let best = 0, bd = 1e9;
        CITY_V.forEach((c, i) => {
          const [x, y, z] = project(c);
          const r = cv.getBoundingClientRect();
          const d = Math.hypot(r.left + x - e.clientX, r.top + y - e.clientY) + (z < 0 ? 1e6 : 0);
          if (d < bd) { bd = d; best = i; }
        });
        pings.push({ v: CITY_V[best], t: 0 });
        for (let k = 0; k < 5; k++) launch(best);
        run();
      }
    });
    return cv;
  }

  function globes() {
    // the dark "platform" section: its decorative layer sits behind the content
    const sec = document.getElementById('toggle-nav-dark-mode');
    if (!sec) return;
    const deco = [...sec.children].find(c => /pointer-events-none/.test(c.className) && /absolute/.test(c.className));
    if (!deco || deco.querySelector('.bp-globe')) return;
    Globe(deco, { area: sec, cls: 'bp-globe-platform' });
  }

  // ---------- 3D cards ----------
  const CARDS = 'main .rounded-2xl.bg-white:not(.py-16), main .rounded-3xl.bg-white, main .rounded-2xl[class*="bg-primary-50"], main .rounded-xl.bg-white, main .rounded-2xl[class*="bg-gradient"]';
  function tilt() {
    for (const c of $$(CARDS)) {
      if (c._bpTilt || skip(c) || c.parentElement.closest(CARDS)) continue;
      const r = c.getBoundingClientRect();
      if (r.width < 140 || r.width > 760 || r.height > 640 || c.querySelector('iframe, video')) continue;
      c._bpTilt = true;
      const rx = gsap.quickTo(c, 'rotationX', { duration: .5, ease: 'power3.out' });
      const ry = gsap.quickTo(c, 'rotationY', { duration: .5, ease: 'power3.out' });
      const glare = getComputedStyle(c).backgroundImage === 'none';
      if (glare) c.dataset.bpGlare = '';
      const icon = [...c.querySelectorAll('img, svg')].find(i => { const b = i.getBoundingClientRect(); return b.width >= 14 && b.width <= 64 && b.height <= 64; });
      c.addEventListener('pointerenter', () => {
        gsap.set(c, { transformPerspective: 900 });
        c.dataset.bpLift = '';
        if (icon && !gsap.isTweening(icon)) gsap.fromTo(icon, { rotationY: 0 }, { rotationY: 360, duration: .9, ease: 'back.out(1.7)', transformPerspective: 400 });
      });
      c.addEventListener('pointermove', e => {
        const b = c.getBoundingClientRect(), px = (e.clientX - b.left) / b.width, py = (e.clientY - b.top) / b.height;
        const k = Math.min(1, 320 / Math.max(b.width, b.height));
        rx((.5 - py) * 9 * k);
        ry((px - .5) * 11 * k);
        if (glare) { c.style.setProperty('--bp-gx', px * 100 + '%'); c.style.setProperty('--bp-gy', py * 100 + '%'); }
      });
      c.addEventListener('pointerleave', () => { rx(0); ry(0); delete c.dataset.bpLift; });
    }
  }

  // ---------- magnetic, jelly buttons ----------
  function magnets() {
    for (const b of $$('a.bg-primary-800, button.bg-primary-800, header a[class*="rounded"], main a[class*="rounded-full"], main button[class*="rounded-full"]')) {
      if (b._bpMag || b.closest('#bp-hero')) continue;
      const r = b.getBoundingClientRect();
      if (!r.width || r.width > 360 || r.height > 80) continue;
      b._bpMag = true;
      const x = gsap.quickTo(b, 'x', { duration: .4, ease: 'power3.out' });
      const y = gsap.quickTo(b, 'y', { duration: .4, ease: 'power3.out' });
      b.addEventListener('pointermove', e => {
        const q = b.getBoundingClientRect();
        x((e.clientX - (q.left + q.width / 2)) * .28);
        y((e.clientY - (q.top + q.height / 2)) * .35);
      });
      b.addEventListener('pointerleave', () => {
        gsap.to(b, { x: 0, y: 0, duration: .9, ease: 'elastic.out(1,.35)', overwrite: 'auto' });
      });
      b.addEventListener('pointerdown', () => gsap.to(b, { scaleX: 1.08, scaleY: .88, duration: .12, ease: 'power2.out' }));
      b.addEventListener('pointerup', () => gsap.to(b, { scaleX: 1, scaleY: 1, duration: .8, ease: 'elastic.out(1.1,.3)' }));
    }
  }

  // ---------- cursor ring ----------
  function cursor() {
    if (!fine || document.querySelector('.bp-cursor')) return;
    const ring = document.createElement('div'), dot = document.createElement('div');
    ring.className = 'bp-cursor'; dot.className = 'bp-cursor-dot';
    document.body.append(ring, dot);
    let mx = -100, my = -100, x = mx, y = my, on = false, raf = 0;
    const loop = () => {
      const vx = mx - x, vy = my - y;
      x += vx * .2; y += vy * .2;
      const v = Math.min(.45, Math.hypot(vx, vy) / 260);
      ring.style.transform = `translate3d(${x}px,${y}px,0) rotate(${Math.atan2(vy, vx)}rad) scale(${1 + v},${1 - v * .6})`;
      dot.style.transform = `translate3d(${mx}px,${my}px,0)`;
      raf = Math.hypot(vx, vy) > .1 ? requestAnimationFrame(loop) : 0;
    };
    addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      mx = e.clientX; my = e.clientY;
      if (!on) { on = true; x = mx; y = my; document.documentElement.dataset.bpCursor = ''; }
      ring.classList.toggle('bp-cursor-link', !!e.target.closest('a, button, [role="button"], input, label, summary'));
      if (!raf) raf = requestAnimationFrame(loop);
    }, { passive: true });
    document.addEventListener('pointerleave', () => { on = false; document.documentElement.removeAttribute('data-bp-cursor'); });
    addEventListener('pointerdown', () => ring.classList.add('bp-cursor-down'));
    addEventListener('pointerup', () => ring.classList.remove('bp-cursor-down'));
  }

  // ---------- floating chips drift in 3D depth ----------
  function depth() {
    for (const sec of $$('footer section, main section')) {
      if (sec._bpDepth || skip(sec)) continue;
      const stage = [...sec.querySelectorAll('div.relative')].find(d => {
        const kids = [...d.children].filter(k => getComputedStyle(k).position === 'absolute' && k.getBoundingClientRect().width > 40);
        return kids.length >= 3 && d.getBoundingClientRect().height > 200;
      });
      if (!stage) continue;
      sec._bpDepth = true;
      // move each chip with whichever of translate / transform it is not already using
      const kids = [...stage.children].filter(k => {
        const cs = getComputedStyle(k);
        return cs.position === 'absolute' && (cs.translate === 'none' || cs.transform === 'none');
      });
      const layers = kids.map((k, i) => ({ k, d: 8 + (i * 7) % 26, ph: i * 1.7, x: 0, y: 0, tr: getComputedStyle(k).translate === 'none' }));
      let tx = 0, ty = 0, vis = false, raf = 0;
      sec.addEventListener('pointermove', e => {
        const r = sec.getBoundingClientRect();
        tx = (e.clientX - r.left) / r.width - .5; ty = (e.clientY - r.top) / r.height - .5;
      });
      sec.addEventListener('pointerleave', () => { tx = ty = 0; });
      const loop = t => {
        raf = 0;
        for (const l of layers) {
          l.x += (-tx * l.d * 1.4 - l.x) * .08; l.y += (-ty * l.d - l.y) * .08;
          const bob = Math.sin(t / 900 + l.ph) * l.d * .25;
          const px = l.x.toFixed(2), py = (l.y + bob).toFixed(2), rot = (l.x * .08).toFixed(2);
          if (l.tr) { l.k.style.translate = `${px}px ${py}px`; l.k.style.rotate = `${rot}deg`; }
          else l.k.style.transform = `translate3d(${px}px,${py}px,0) rotate(${rot}deg)`;
        }
        if (vis) raf = requestAnimationFrame(loop);
      };
      new IntersectionObserver(([e]) => { vis = e.isIntersecting; if (vis && !raf) raf = requestAnimationFrame(loop); }).observe(sec);
    }
  }

  function scan() { globes(); tilt(); magnets(); depth(); }
  let started = false, t = 0;
  function start() {
    if (started) return;
    started = true;
    cursor();
    scan();
    // Next.js swaps pages and React may re-render sections: pick up new ones
    new MutationObserver(() => { clearTimeout(t); t = setTimeout(scan, 500); }).observe(document.body, { childList: true, subtree: true });
  }
  // after motion.js has set up its card entrances (load + 900ms)
  window.addEventListener('load', () => setTimeout(start, 1300));
  setTimeout(start, 5200);
})();
