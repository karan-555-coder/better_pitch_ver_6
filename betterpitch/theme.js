// Site-wide state for version 6 (styles in theme.css), injected into every
// HTML page by server.js:
//  - dark sections get a brushed-metal finish with the hero's rays;
//  - the hero's looping animations pause while it is off screen.
// Entrances (headings, text, cards, images, counters) live in motion.js and the globe in play.js.
// Like content.js it waits for React to hydrate, and it only sets data
// attributes.
(function () {
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
  }
  window.addEventListener('load', () => setTimeout(start, 600));
  setTimeout(start, 4500);
})();
