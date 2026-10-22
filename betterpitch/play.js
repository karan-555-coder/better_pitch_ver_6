// The globe for version 6 (styles in theme.css): a dotted copper globe turns
// slowly behind the dark "platform" heading, with a few calls arcing between
// cities and pinging where they land; it can be dragged to spin. The canvas
// sits in that section's decorative layer, never in the page's own content,
// and only draws while on screen.
(function () {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const DPR = Math.min(1.5, devicePixelRatio || 1);
  const RAD = Math.PI / 180;

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
  // dot colour and size per brightness band (see the drawing loop)
  const BANDS = [{ c: 'rgba(224,167,124,.09)', s: 1.1 }]
    .concat([0, 1, 2, 3].map(i => ({ c: `rgba(232,172,126,${(.4 + .6 * (i + .5) / 4).toFixed(2)})`, s: 1.5 + 1.1 * (i + .5) / 4 })))
    .concat([0, 1].map(i => ({ c: `rgba(236,234,230,${(.06 + .1 * (i + .5) / 2).toFixed(3)})`, s: 1 })));

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
    let glow, body;
    function size() {
      W = cv.clientWidth;
      cv.width = cv.height = Math.round(W * DPR);
      R = W * .4;
      // atmosphere with a copper rim light, and the dark body of the globe
      glow = ctx.createRadialGradient(W / 2, W / 2, R * .8, W / 2, W / 2, R * 1.35);
      glow.addColorStop(0, 'rgba(200,132,86,0)');
      glow.addColorStop(.22, 'rgba(200,132,86,.16)');
      glow.addColorStop(1, 'rgba(200,132,86,0)');
      body = ctx.createRadialGradient(W / 2 - R * .35, W / 2 - R * .4, R * .1, W / 2, W / 2, R);
      body.addColorStop(0, 'rgba(70,58,52,.55)');
      body.addColorStop(1, 'rgba(20,21,24,.35)');
    }
    new ResizeObserver(size).observe(cv);
    size();

    // rotation terms, worked out once per frame (turn() below)
    let cy = 1, sy = 0, cp = 1, sp = 0;
    const turn = () => { cy = Math.cos(yaw); sy = Math.sin(yaw); cp = Math.cos(pitch); sp = Math.sin(pitch); };
    function project(v) {
      const x = v[0] * cy + v[2] * sy, z1 = -v[0] * sy + v[2] * cy;
      const y = v[1] * cp - z1 * sp, z = v[1] * sp + z1 * cp;
      return [W / 2 + x * R, W / 2 - y * R, z];
    }
    function launch() {
      const a = Math.floor(Math.random() * CITY_V.length);
      let b = Math.floor(Math.random() * CITY_V.length);
      if (b === a) b = (b + 3) % CITY_V.length;
      arcs.push({ a: CITY_V[a], b: CITY_V[b], t: 0, sp: .4 + Math.random() * .2,
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
      if (now > nextArc && arcs.length < 3) { launch(); nextArc = now + 1400 + Math.random() * 1600; }

      turn();
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.clearRect(0, 0, W, W);
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, W);
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.arc(W / 2, W / 2, R, 0, Math.PI * 2); ctx.fill();

      // Dots are sorted into a few brightness bands by depth and each band is
      // filled in one go: band 0 is land on the far side, 1-4 land on the near
      // side (dim to bright), 5-6 sea on the near side.
      const k = W / 600, bands = BANDS.map(() => new Path2D());
      for (const d of DOTS) {
        const v = d.v, x0 = v[0] * cy + v[2] * sy, z1 = -v[0] * sy + v[2] * cy;
        const z = v[1] * sp + z1 * cp;
        if (!d.land && z <= 0) continue;
        const b = d.land ? (z > 0 ? 1 + Math.min(3, z * 4 | 0) : 0) : 5 + Math.min(1, z * 2 | 0);
        const sz = BANDS[b].s * k, x = W / 2 + x0 * R, y = W / 2 - (v[1] * cp - z1 * sp) * R;
        bands[b].rect(x - sz / 2, y - sz / 2, sz, sz);
      }
      BANDS.forEach((b, i) => { ctx.fillStyle = b.c; ctx.fill(bands[i]); });
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
      drag = { x: e.clientX, y: e.clientY };
      area.classList.add('bp-globe-dragging');
    });
    addEventListener('pointerup', () => {
      if (!drag) return;
      drag = null;
      area.classList.remove('bp-globe-dragging');
      spin = Math.max(-.04, Math.min(.04, spin));
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

  let started = false, t = 0;
  function start() {
    if (started) return;
    started = true;
    globes();
    // Next.js swaps pages and React may re-render sections: pick up new ones
    new MutationObserver(() => { clearTimeout(t); t = setTimeout(globes, 500); }).observe(document.body, { childList: true, subtree: true });
  }
  // after motion.js has set up its card entrances (load + 900ms)
  window.addEventListener('load', () => setTimeout(start, 1300));
  setTimeout(start, 5200);
})();
