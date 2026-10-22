// Small Spline 3D robot in the home page hero (styles in theme.css). It stands
// in the gap under the headline, left of the voice demo panel (never behind
// it: anything moving under the panel's backdrop blur makes it re-blur every
// frame), fades in once loaded and turns its head towards the cursor. Kept
// deliberately quiet: no extra motion, and rendering stops off screen.
// The runtime, its wasm and the scene are served by server.js from this
// machine (the CSP only allows this server). The scene is the public "robot"
// code export, self-hosted in betterpitch/spline/; swap SCENE for your own
// Export -> Code file to change it.
import { Application } from '/__bp/spline/runtime.js';

const SCENE = '/__bp/spline/scene.splinecode';

if (location.pathname === '/' && !matchMedia('(prefers-reduced-motion: reduce)').matches &&
    matchMedia('(min-width: 1100px)').matches) waitForHero();

function waitForHero() {
  const box = document.querySelector('#bp-hero .bph-box');
  if (box) return mount(box);
  const mo = new MutationObserver(() => {
    const b = document.querySelector('#bp-hero .bph-box');
    if (b) { mo.disconnect(); mount(b); }
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
}

async function mount(box) {
  const layer = document.createElement('div');
  layer.className = 'bp-spline';
  layer.innerHTML = '<canvas aria-hidden="true"></canvas>' +
    '<a class="bp-spline-credit" href="https://spline.design" target="_blank" rel="noopener">Made with Spline</a>';
  // after the background tiles, so they don't paint over the robot
  const atBack = b => { const t = b.querySelector('.bph-tiles'); t ? t.after(layer) : b.prepend(layer); };
  atBack(box);
  // React may re-render the hero after a failed hydration; put the layer back
  // (same node, so the WebGL context survives).
  new MutationObserver(() => {
    if (layer.isConnected) return;
    const b = document.querySelector('#bp-hero .bph-box');
    if (b) atBack(b);
  }).observe(document.documentElement, { childList: true, subtree: true });

  // --bp-spline-x is the demo panel's left edge; the robot stands just left of it
  const place = () => {
    const panel = box.querySelector('.bph-panel');
    if (panel) layer.style.setProperty('--bp-spline-x', panel.getBoundingClientRect().left - box.getBoundingClientRect().left + 'px');
  };
  place();
  new ResizeObserver(place).observe(box);

  const canvas = layer.querySelector('canvas');
  const app = new Application(canvas, { wasmPath: '/__bp/spline/' });
  try {
    await app.load(SCENE);
  } catch (e) {
    layer.remove();
    return;
  }
  app.setBackgroundColor('rgba(0,0,0,0)');
  requestAnimationFrame(() => layer.classList.add('bp-spline-on'));

  // The layer lets clicks through to the hero, so the scene never sees the
  // pointer itself: hand it the page's moves so the robot keeps looking.
  // Not bubbling, so the copy never comes back round to this listener.
  addEventListener('pointermove', e => {
    if (!e.isTrusted) return;
    canvas.dispatchEvent(new PointerEvent('pointermove', {
      clientX: e.clientX, clientY: e.clientY, pointerId: e.pointerId, pointerType: e.pointerType,
    }));
  }, { passive: true });

  new IntersectionObserver(([e]) => {
    if (e.isIntersecting) app.play(); else app.stop();
  }).observe(box);
}
