// Scroll-driven motion for version 6 on GSAP + ScrollTrigger (served by
// server.js from node_modules), kept quiet on purpose: each plays once, is
// short, and only moves things a few pixels.
//  - in each section the heading, then its text, then its call to action rise
//    into place one after another;
//  - cards rise in one after another, like the feature chips under the hero;
//  - large images settle in with a slight zoom-out;
//  - figures ("38,384", "~2,500") count up from zero and end on their exact text.
// Only things below the first screen are animated, so nothing visible on load
// is hidden, and every inline style is cleared once its animation is done.
(function () {
  if (!window.gsap || !window.ScrollTrigger) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  gsap.registerPlugin(ScrollTrigger);
  const $$ = (sel, root) => [...(root || document).querySelectorAll(sel)];
  const skip = el => el.closest('#bp-hero, [class*="marquee"], [class*="embla"]');
  const below = el => { const r = el.getBoundingClientRect(); return r.height > 0 && r.top >= innerHeight; };
  const still = el => { const cs = getComputedStyle(el); return cs.transform === 'none' && cs.translate === 'none' && cs.animationName === 'none'; };
  const CARDS = 'main .rounded-2xl.bg-white:not(.py-16), main .rounded-3xl.bg-white, main .rounded-2xl[class*="bg-gradient"], main .rounded-xl.bg-white';
  const taken = new Set();

  // heading -> text -> call to action, per section
  function sections() {
    for (const h of $$('main h1, main h2')) {
      if (skip(h) || !below(h) || h.closest(CARDS) || !still(h)) continue;
      // the text and actions that belong to this heading: the next few siblings
      // of its block, stopping at the first big block (a grid of cards, an image)
      const block = h.parentElement, group = [h];
      let n = h.nextElementSibling, guard = 0;
      while (n && guard++ < 4) {
        const r = n.getBoundingClientRect();
        if (r.height > 220 || n.querySelector('img, h2, h3') || skip(n) || !still(n)) break;
        group.push(n);
        n = n.nextElementSibling;
      }
      if (group.length === 1 && block !== h && block.children.length <= 4) {
        for (const s of block.children) if (s !== h && s.getBoundingClientRect().height <= 220 && !s.querySelector('img, h2, h3') && still(s)) group.push(s);
      }
      group.forEach(el => taken.add(el));
      gsap.set(group, { y: 18, autoAlpha: 0 });
      ScrollTrigger.create({
        trigger: h, start: 'top 88%', once: true,
        onEnter: () => gsap.to(group, { y: 0, autoAlpha: 1, duration: .7, ease: 'power2.out', stagger: .1, clearProps: 'transform,opacity,visibility' }),
      });
    }
  }

  function cards() {
    const list = $$(CARDS).filter(c => !skip(c) && below(c) && !c.parentElement.closest(CARDS) && !taken.has(c) && still(c));
    if (!list.length) return;
    list.forEach(c => taken.add(c));
    gsap.set(list, { y: 24, autoAlpha: 0 });
    ScrollTrigger.batch(list, {
      start: 'top 92%', once: true,
      onEnter: batch => gsap.to(batch, { y: 0, autoAlpha: 1, duration: .7, ease: 'power2.out', stagger: .08, clearProps: 'transform,opacity,visibility' }),
    });
  }

  function images() {
    for (const img of $$('main img')) {
      if (skip(img) || !below(img) || img.closest(CARDS) || [...taken].some(t => t.contains(img)) || img.getBoundingClientRect().width < 320 || !still(img)) continue;
      gsap.set(img, { scale: 1.04, autoAlpha: 0 });
      ScrollTrigger.create({
        trigger: img, start: 'top 90%', once: true,
        onEnter: () => gsap.to(img, { scale: 1, autoAlpha: 1, duration: 1.1, ease: 'power2.out', clearProps: 'transform,opacity,visibility' }),
      });
    }
  }

  // "~2,500", "38,384", "15.7%" ... count up and end on the exact original text
  function counters() {
    const NUM = /^([~$+]?)(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?([%+kKmMx]*)$/;
    for (const el of $$('main *')) {
      if (el.children.length || skip(el) || el.closest('script, style') || !below(el)) continue;
      const node = el.firstChild;
      if (!node || node.nodeType !== 3 || el.childNodes.length !== 1) continue;
      const orig = node.nodeValue, m = orig.trim().match(NUM);
      if (!m || parseFloat(m[2].replace(/,/g, '')) < 10) continue;
      const [, pre, int, dec, suf] = m;
      const target = parseFloat(int.replace(/,/g, '') + (dec || '')), places = dec ? dec.length - 1 : 0, commas = int.includes(',');
      const lead = orig.match(/^\s*/)[0], trail = orig.match(/\s*$/)[0];
      el.style.fontVariantNumeric = 'tabular-nums';
      ScrollTrigger.create({
        trigger: el, start: 'top 90%', once: true,
        onEnter: () => {
          const st = { v: 0 };
          gsap.to(st, {
            v: target, duration: 1.4, ease: 'power2.out',
            onUpdate: () => {
              let s = st.v.toFixed(places);
              if (commas) s = Number(s).toLocaleString('en-US', { minimumFractionDigits: places, maximumFractionDigits: places });
              node.nodeValue = lead + pre + s + suf + trail;
            },
            onComplete: () => { node.nodeValue = orig; el.style.removeProperty('font-variant-numeric'); },
          });
        },
      });
    }
  }

  let started = false;
  function start() {
    if (started) return;
    started = true;
    // The page scrolls inside #page-scroller, not the window.
    const sc = document.getElementById('page-scroller');
    if (sc) ScrollTrigger.defaults({ scroller: sc });
    sections();
    cards();
    images();
    counters();
    ScrollTrigger.refresh();
    // images that load later push things down, which would leave the trigger
    // points where they were measured; re-measure when the page changes size
    const main = document.querySelector('main');
    if (main) {
      let t = 0;
      new ResizeObserver(() => { clearTimeout(t); t = setTimeout(() => ScrollTrigger.refresh(), 200); }).observe(main);
    }
  }
  // theme.js starts at load + 600ms; this goes after it
  window.addEventListener('load', () => setTimeout(start, 900));
  setTimeout(start, 4800);
})();
