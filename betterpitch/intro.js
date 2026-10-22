// Opening animation for version 6 (styles in theme.css): when the site loads,
// a graphite screen covers it, a copper ring draws itself around a "B", the
// BetterPitch wordmark rises letter by letter with a copper shine, and the
// screen splits open to show the page. Plays on every full load of the home
// page and once per tab on other pages; a click skips it.
// Runs in <head>: it covers the page right away with html[data-bp-intro]
// (a CSS ::before, so nothing is added to the markup React hydrates) and puts
// the overlay at the end of <body> once the document has been parsed.
(function () {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let seen = false;
  try { seen = sessionStorage.getItem('bp-intro') === '1'; sessionStorage.setItem('bp-intro', '1'); } catch (e) {}
  if (seen && location.pathname !== '/') return;
  const root = document.documentElement;
  root.dataset.bpIntro = '';

  function play() {
    const el = document.createElement('div');
    el.className = 'bp-intro';
    el.setAttribute('aria-hidden', 'true');
    const letters = (word, from) => [...word].map((c, i) =>
      `<span class="bp-intro-ch" style="--i:${from + i}">${c}</span>`).join('');
    el.innerHTML =
      '<div class="bp-intro-half bp-intro-top"></div><div class="bp-intro-half bp-intro-bottom"></div>' +
      '<div class="bp-intro-logo">' +
        '<svg class="bp-intro-mark" viewBox="0 0 80 80"><circle class="bp-intro-ring" cx="40" cy="40" r="34"/>' +
        '<text x="40" y="41" text-anchor="middle" dominant-baseline="central">B</text></svg>' +
        `<span class="bp-intro-word"><span>${letters('Better', 0)}</span><span class="bp-intro-pitch">${letters('Pitch', 6)}</span></span>` +
      '</div><div class="bp-intro-line"></div>';
    document.body.appendChild(el);
    root.removeAttribute('data-bp-intro');
    // The recorded page fails to hydrate and React then re-renders <body>,
    // dropping the overlay: put it back, with its animations moved on by the
    // time already played (--bp-t) so they continue instead of restarting.
    const t0 = performance.now();
    const keep = new MutationObserver(() => {
      if (el.isConnected) return;
      el.style.setProperty('--bp-t', (performance.now() - t0) / 1000 + 's');
      document.body.appendChild(el);
    });
    keep.observe(root, { childList: true, subtree: true });

    let ended = false;
    const end = () => {
      if (ended) return;
      ended = true;
      el.classList.add('bp-intro-open');
      setTimeout(() => { keep.disconnect(); el.remove(); }, 900);
    };
    const timer = setTimeout(end, 2300);
    el.addEventListener('click', () => { clearTimeout(timer); end(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', play);
  else play();
})();
