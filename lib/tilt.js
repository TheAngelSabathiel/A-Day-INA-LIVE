'use client';

/**
 * One shared tilt value for the whole page, from the mouse on desktop,
 * the gyroscope on phones, or a slow drift on the projector.
 * Written to CSS vars --tx / --ty (-1..1) so CSS 3D layers can use it
 * without React re-renders.
 */
export const tilt = { x: 0, y: 0 };

const target = { x: 0, y: 0 };
let started = false;
let autoDrift = false;
let lastInput = -1e9;
let base = null;

const clamp = (v) => Math.max(-1, Math.min(1, v));

function onOrient(e) {
  if (e.gamma == null || e.beta == null) return;
  // Ignore landscape; the program is a portrait experience.
  if (window.innerWidth > window.innerHeight) return;
  lastInput = performance.now();
  if (!base) base = { b: e.beta, g: e.gamma };
  // Baseline follows slowly so whatever angle you hold the phone at becomes "center".
  base.b += (e.beta - base.b) * 0.015;
  base.g += (e.gamma - base.g) * 0.015;
  target.x = clamp((e.gamma - base.g) / 18);
  target.y = clamp(-(e.beta - base.b) / 18);
}

export function startTilt(opts = {}) {
  if (opts.autoDrift) autoDrift = true;
  if (started || typeof window === 'undefined') return;
  started = true;

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (window.matchMedia('(pointer: fine)').matches) {
    window.addEventListener('pointermove', (e) => {
      target.x = clamp((e.clientX / window.innerWidth) * 2 - 1);
      target.y = clamp(-((e.clientY / window.innerHeight) * 2 - 1));
      lastInput = performance.now();
    }, { passive: true });
  }
  window.addEventListener('deviceorientation', onOrient, { passive: true });

  const root = document.documentElement.style;
  let lx = NaN;
  let ly = NaN;
  const loop = (t) => {
    requestAnimationFrame(loop);
    let tx = target.x;
    let ty = target.y;
    if (autoDrift && t - lastInput > 4000) {
      tx = Math.sin(t / 5200) * 0.5;
      ty = Math.cos(t / 7100) * 0.35;
    }
    if (reduce) { tx = 0; ty = 0; }
    tilt.x += (tx - tilt.x) * 0.06;
    tilt.y += (ty - tilt.y) * 0.06;
    const rx = Math.round(tilt.x * 500) / 500;
    const ry = Math.round(tilt.y * 500) / 500;
    if (rx !== lx) { root.setProperty('--tx', rx); lx = rx; }
    if (ry !== ly) { root.setProperty('--ty', ry); ly = ry; }
  };
  requestAnimationFrame(loop);
}

/** iOS needs a user tap before it shares the gyroscope. */
export async function requestGyro() {
  try {
    const D = window.DeviceOrientationEvent;
    if (D && typeof D.requestPermission === 'function') await D.requestPermission();
  } catch {
    /* denied or unsupported: mouse/drift still works */
  }
}
