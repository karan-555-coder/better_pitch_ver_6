// Site-wide state for version 6 (styles in theme.css), injected into every
// HTML page by server.js:
//  - the hero's tile grid continues on the big panels and dark sections,
//    lighting up around the cursor and swept by a bloom wave on arrival;
//  - dark sections get a brushed-metal finish with the hero's rays;
//  - hovered headings get a voice waveform above them;
//  - headings rise from behind a ledge, images open like venetian blinds;
//  - the hero's looping animations pause while it is off screen.
// GSAP motion lives in motion.js and pointer interactions in interact.js.
// Like content.js it waits for React to hydrate, and it only sets data
// attributes and custom properties, removing the entrance ones once they have
// played. Things already on screen are not hidden.
(function () {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const below = el => { const r = el.getBoundingClientRect(); return r.height > 0 && r.top >= innerHeight; };
  // sliders and marquees move sideways, so their items may never scroll into view
  const skip = el => el.closest('#bp-hero, [class*="marquee"], [class*="embla"]');
  // Entrance helper: el gets attr="wait" now, "in" when it scrolls into view,
  // and the attribute is dropped once the transition has finished.
  const io = new IntersectionObserver((entries, obs) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      obs.unobserve(e.target);
      const { attr, ms } = e.target._bpIn;
      e.target.setAttribute(attr, 'in');
      setTimeout(() => e.target.removeAttribute(attr), ms);
    }
  }, { threshold: 0, rootMargin: '0px 0px -10% 0px' });
  const enter = (el, attr, ms) => {
    el.setAttribute(attr, 'wait');
    el._bpIn = { attr, ms };
    io.observe(el);
  };

  function metal() {
    for (const el of document.querySelectorAll('main section, main section > div, footer')) {
      if (el.dataset.bpMetal !== undefined || el.closest('#bp-hero, [data-bp-metal]')) continue;
      const cs = getComputedStyle(el), r = el.getBoundingClientRect();
      if (r.width < 400 || r.height < 200 || cs.backgroundImage !== 'none') continue;
      const m = cs.backgroundColor.match(/[\d.]+/g);
      if (!m || (m[3] !== undefined && +m[3] < .9)) continue;
      if ((.2126 * m[0] + .7152 * m[1] + .0722 * m[2]) / 255 < .3) el.dataset.bpMetal = '';
    }
  }

  function ledges() {
    for (const h of document.querySelectorAll('main h1, main h2')) {
      if (skip(h) || !below(h) || getComputedStyle(h).clipPath !== 'none') continue;
      enter(h, 'data-bp-ledge', 1000);
    }
  }

  function blinds() {
    for (const img of document.querySelectorAll('main img')) {
      if (skip(img) || !below(img) || img.getBoundingClientRect().width < 160 || getComputedStyle(img).maskImage !== 'none') continue;
      enter(img, 'data-bp-blinds', 1500);
    }
  }

  // The hero's tile grid on the big panels and dark sections. A static element
  // only becomes relative when no absolutely positioned child would re-anchor.
  function grids() {
    const bloom = new IntersectionObserver((entries, obs) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        obs.unobserve(e.target);
        e.target.dataset.bpGrid += ' bloom';
      }
    }, { threshold: .15 });
    const sel = 'main .bg-white.rounded-2xl.py-16, [data-bp-metal], footer [class*="bg-gradient-deep"], main [class*="bg-gradient-deep"]';
    for (const el of document.querySelectorAll(sel)) {
      if (el.dataset.bpGrid !== undefined || el.closest('#bp-hero') || skip(el) || getComputedStyle(el, '::before').content !== 'none') continue;
      const cs = getComputedStyle(el);
      let flags = [];
      if (cs.position === 'static') {
        const unsafe = [...el.querySelectorAll('*')].some(n => getComputedStyle(n).position === 'absolute' && !(n.offsetParent && el.contains(n.offsetParent) && n.offsetParent !== el));
        if (unsafe) continue;
        flags.push('rel');
      }
      const m = cs.backgroundColor.match(/[\d.]+/g);
      // a transparent background (the white panels get one in theme.css) is not dark
      const opaque = m && (m[3] === undefined || +m[3] > .5);
      const dark = el.dataset.bpMetal !== undefined || /deep/.test(el.className) || (opaque && (.2126 * m[0] + .7152 * m[1] + .0722 * m[2]) / 255 < .3);
      if (dark) flags.push('dark');
      el.dataset.bpGrid = flags.join(' ');
      let raf = 0, x = 0, y = 0;
      el.addEventListener('pointermove', e => {
        x = e.clientX; y = e.clientY;
        if (raf) return;
        raf = requestAnimationFrame(() => {
          raf = 0;
          const r = el.getBoundingClientRect();
          el.style.setProperty('--bp-mx', (x - r.left).toFixed(0) + 'px');
          el.style.setProperty('--bp-my', (y - r.top).toFixed(0) + 'px');
        });
      });
      if (!reduced) bloom.observe(el);
    }
  }

  // the voice waveform above a hovered heading is centred on its first line
  function waves() {
    for (const h of document.querySelectorAll('main h1, main h2')) {
      if (h.dataset.bpWave !== undefined || skip(h)) continue;
      const cs = getComputedStyle(h);
      if ((cs.position !== 'static' && cs.position !== 'relative') || getComputedStyle(h, '::after').content !== 'none') continue;
      h.dataset.bpWave = '';
      h.addEventListener('pointerenter', () => {
        const range = document.createRange();
        range.selectNodeContents(h);
        const rects = [...range.getClientRects()].filter(r => r.width > 2);
        if (!rects.length) return;
        const top = Math.min(...rects.map(r => r.top)), line = rects.filter(r => r.top - top < 4);
        const left = Math.min(...line.map(r => r.left)), right = Math.max(...line.map(r => r.right));
        h.style.setProperty('--bp-wl', ((left + right) / 2 - 70 - h.getBoundingClientRect().left).toFixed(0) + 'px');
      });
    }
  }

  // the hero's looping animations pause while it is scrolled out of view
  function pauseHero() {
    const hero = document.getElementById('bp-hero');
    if (!hero) return;
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting) hero.removeAttribute('data-bp-off'); else hero.dataset.bpOff = '';
    }).observe(hero);
  }

  let started = false;
  function start() {
    if (started) return;
    started = true;
    pauseHero();
    metal();
    grids();
    waves();
    if (!reduced) {
      ledges();
      blinds();
    }
  }
  window.addEventListener('load', () => setTimeout(start, 600));
  setTimeout(start, 4500);
})();
