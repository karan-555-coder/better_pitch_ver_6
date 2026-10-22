// Scroll-driven motion for version 6 on GSAP + ScrollTrigger (served by
// server.js from node_modules), on top of theme.js:
//  - paragraphs fill with ink from top to bottom as they are scrolled through;
//  - sections sink back as they scroll away, like cards going under a deck;
//  - cards rise in one after another, like the feature chips under the hero.
// Both are scrubbed with the scroll. The sink only uses transform and opacity,
// and skips sections that hold sticky or fixed content (a transform would
// break them).
(function () {
  if (!window.gsap || !window.ScrollTrigger) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  gsap.registerPlugin(ScrollTrigger);
  const $$ = (sel, root) => [...(root || document).querySelectorAll(sel)];
  const skip = el => el.closest('#bp-hero, [class*="marquee"], [class*="embla"]');

  function inkFill() {
    for (const p of $$('main p')) {
      if (skip(p) || p.children.length || p.textContent.trim().length < 60) continue;
      const cs = getComputedStyle(p);
      if (cs.backgroundImage !== 'none') continue;
      p.style.setProperty('--bp-ink', cs.color);
      p.dataset.bpFill = '';
      gsap.fromTo(p, { '--bp-fill': '0%' }, {
        '--bp-fill': '100%', ease: 'none',
        scrollTrigger: { trigger: p, start: 'top 92%', end: 'bottom 62%', scrub: true },
      });
    }
  }

  function sink() {
    for (const s of $$('main section')) {
      if (s.closest('#bp-hero') || s.parentElement.closest('section') || s.getBoundingClientRect().height < innerHeight * .6) continue;
      const cs = getComputedStyle(s);
      if (cs.transform !== 'none' || cs.translate !== 'none') continue;
      if ([...s.querySelectorAll('*')].some(n => { const p = getComputedStyle(n).position; return p === 'sticky' || p === 'fixed'; })) continue;
      gsap.fromTo(s, { scale: 1, opacity: 1 }, {
        scale: .94, opacity: .55, transformOrigin: '50% 100%', ease: 'none',
        // only once most of the section has gone by, so nothing being read is dimmed
        scrollTrigger: { trigger: s, start: 'bottom 35%', end: 'bottom top', scrub: true },
      });
    }
  }

  // cards rise in one after another, like the feature chips under the hero
  const CARDS = 'main .rounded-2xl.bg-white:not(.py-16), main .rounded-3xl.bg-white, main .rounded-2xl[class*="bg-gradient"], main .rounded-xl.bg-white';
  function cards() {
    const below = el => { const r = el.getBoundingClientRect(); return r.height > 0 && r.top >= innerHeight; };
    const list = $$(CARDS).filter(c => {
      if (skip(c) || !below(c) || c.parentElement.closest(CARDS)) return false;
      const cs = getComputedStyle(c);
      return cs.transform === 'none' && cs.translate === 'none' && cs.animationName === 'none';
    });
    if (!list.length) return;
    gsap.set(list, { y: 46, autoAlpha: 0 });
    ScrollTrigger.batch(list, {
      start: 'top 92%', once: true,
      onEnter: batch => gsap.to(batch, { y: 0, autoAlpha: 1, duration: .9, ease: 'power3.out', stagger: .1, clearProps: 'transform,opacity,visibility' }),
    });
  }

  let started = false;
  function start() {
    if (started) return;
    started = true;
    // The page scrolls inside #page-scroller, not the window.
    const sc = document.getElementById('page-scroller');
    if (sc) ScrollTrigger.defaults({ scroller: sc });
    inkFill();
    sink();
    cards();
    ScrollTrigger.refresh();
  }
  // theme.js starts at load + 600ms; this goes after it
  window.addEventListener('load', () => setTimeout(start, 900));
  setTimeout(start, 4800);
})();
