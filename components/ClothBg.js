'use client';
import { useEffect, useRef } from 'react';
import { startTilt, tilt } from '@/lib/tilt';

/*
 * The bedsheet. A lit satin height-field rendered in one fragment shader.
 * - night: 0 beige day sheet, 1 dark sheet (eases between)
 * - stain: 0..1 maroon bleed that spreads and soaks
 * - still: render once (battery-friendly backgrounds)
 * Touch anywhere sends a ripple through the fabric.
 */

const VERT = `
attribute vec2 a;
varying vec2 vUv;
void main(){ vUv = a * .5 + .5; gl_Position = vec4(a, 0., 1.); }`;

const FRAG = `
precision mediump float;
varying vec2 vUv;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uTilt;
uniform float uStain;
uniform float uNight;
uniform vec3 uBase;
uniform vec3 uBlood;
uniform vec4 uTouch[4];

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1., 0.)), u.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0., a = .5;
  for (int i = 0; i < 4; i++){ v += a * noise(p); p *= 2.03; a *= .5; }
  return v;
}
float height(vec2 p){
  float t = uTime * .05;
  vec2 q = p + vec2(fbm(p * .65 + t), fbm(p * .65 - t + 4.7)) * .95;
  float h = .62 * sin(q.x * 1.55 + q.y * .85 + t * 2.);
  h += .30 * sin(-q.x * 1.05 + q.y * 2.3 - t * 1.3);
  h += .11 * sin(q.x * 3.6 + q.y * 1.6 + t);
  h += .035 * fbm(q * 2.2);
  for (int i = 0; i < 4; i++){
    vec4 tc = uTouch[i];
    float age = uTime - tc.z;
    if (tc.w > 0. && age > 0. && age < 3.5){
      float d = distance(p, tc.xy);
      h += tc.w * .22 * sin(d * 9. - age * 6.) * exp(-d * 2.2) * exp(-age * 1.1);
    }
  }
  return h;
}
void main(){
  float asp = uRes.x / uRes.y;
  vec2 p = (vUv - .5) * vec2(asp, 1.) * 2.2 + uTilt * .25;
  float e = .035;
  float h = height(p);
  vec3 n = normalize(vec3(h - height(p + vec2(e, 0.)), h - height(p + vec2(0., e)), .11));

  vec3 L = normalize(vec3(-.45 + uTilt.x * .9, .55 + uTilt.y * .9, .85));
  float diff = clamp(dot(n, L), 0., 1.);
  vec3 H = normalize(L + vec3(0., 0., 1.));
  float spec = pow(clamp(dot(n, H), 0., 1.), 42.);
  float fold = pow(1. - clamp(n.z, 0., 1.), 1.6);

  // stain: a soft, uneven bloom low on the sheet
  float sd = distance(p * vec2(1., 1.25), vec2(.55, -.55)) - uStain * 1.7 + fbm(p * 2.6 + 3.) * .55 * uStain;
  float stain = smoothstep(.12, -.08, sd) * step(.001, uStain);
  float rim = smoothstep(.22, 0., abs(sd)) * uStain;

  vec3 day = uBase * (.5 + .62 * diff) - fold * .06 + spec * .34 * vec3(1., .97, .93);
  vec3 bl = uBlood * (.38 + .75 * diff) + spec * .18 * vec3(1., .8, .82);
  day = mix(day, bl, stain);
  day = mix(day, uBlood * .7, rim * .3 * (1. - stain));

  vec3 nightBase = mix(vec3(.05, .018, .022), uBlood * .45, .22);
  vec3 night = nightBase * (.28 + 1.1 * diff) + spec * uBlood * .7;
  night = mix(night, uBlood * (.22 + .55 * diff) + spec * .12, stain);

  vec3 col = mix(day, night, uNight);
  float vig = smoothstep(1.35, .15, length((vUv - .5) * vec2(asp * .85, 1.)));
  col *= mix(.72, 1., vig);
  gl_FragColor = vec4(col, 1.);
}`;

const hexCache = new Map();
function rgb(hex, fallback) {
  const key = hex || fallback;
  if (hexCache.has(key)) return hexCache.get(key);
  let h = String(key).replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  const out = Number.isNaN(n) ? rgb(fallback, '#EDE3D1') : [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  hexCache.set(key, out);
  return out;
}

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader');
  return s;
}

export default function ClothBg({ night = false, stain = 0, still = false, off = false, base, blood, autoDrift = false, className = '' }) {
  const ref = useRef(null);
  const live = useRef({});
  live.current = { night, stain, still, off, base, blood };

  useEffect(() => {
    startTilt({ autoDrift });
    const canvas = ref.current;
    let gl = null;
    try {
      gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, powerPreference: 'low-power' });
    } catch { gl = null; }
    if (!gl) { canvas.dataset.fallback = '1'; return undefined; }

    let prog;
    try {
      prog = gl.createProgram();
      gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link');
    } catch {
      canvas.dataset.fallback = '1';
      return undefined;
    }
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const aLoc = gl.getAttribLocation(prog, 'a');
    gl.enableVertexAttribArray(aLoc);
    gl.vertexAttribPointer(aLoc, 2, gl.FLOAT, false, 0, 0);
    const U = {};
    ['uRes', 'uTime', 'uTilt', 'uStain', 'uNight', 'uBase', 'uBlood', 'uTouch'].forEach((k) => { U[k] = gl.getUniformLocation(prog, k); });

    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const SCALE = coarse ? 0.5 : 0.6;
    const FPS = coarse ? 30 : 50;
    const touches = new Float32Array(16);
    let ti = 0;
    const t0 = performance.now();
    const cur = { night: live.current.night ? 1 : 0, stain: live.current.stain };
    let raf = 0;
    let last = 0;
    let drew = false;
    let visible = document.visibilityState === 'visible';
    let lost = false;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(2, Math.round(canvas.clientWidth * dpr * SCALE));
      const h = Math.max(2, Math.round(canvas.clientHeight * dpr * SCALE));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w; canvas.height = h;
        gl.viewport(0, 0, w, h);
        drew = false;
      }
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    const onDown = (e) => {
      if (live.current.still || reduce) return;
      const r = canvas.getBoundingClientRect();
      if (!r.width) return;
      const u = (e.clientX - r.left) / r.width;
      const v = 1 - (e.clientY - r.top) / r.height;
      const asp = r.width / r.height;
      const i = (ti++ % 4) * 4;
      touches[i] = (u - 0.5) * asp * 2.2 + tilt.x * 0.25;
      touches[i + 1] = (v - 0.5) * 2.2 + tilt.y * 0.25;
      touches[i + 2] = (performance.now() - t0) / 1000;
      touches[i + 3] = 1;
    };
    window.addEventListener('pointerdown', onDown, { passive: true });

    const onVis = () => { visible = document.visibilityState === 'visible'; };
    document.addEventListener('visibilitychange', onVis);
    const onLost = (e) => { e.preventDefault(); lost = true; canvas.dataset.fallback = '1'; };
    canvas.addEventListener('webglcontextlost', onLost);

    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      if (!visible || lost) return;
      if (now - last < 1000 / FPS) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const p = live.current;
      if (p.off) { drew = false; return; }
      const tn = p.night ? 1 : 0;
      cur.night += (tn - cur.night) * Math.min(1, dt * 2.2);
      cur.stain += ((p.stain || 0) - cur.stain) * Math.min(1, dt * 0.7);
      const settling = Math.abs(tn - cur.night) > 0.003 || Math.abs((p.stain || 0) - cur.stain) > 0.003;
      const still = p.still || reduce;
      if (still && drew && !settling) return;

      gl.uniform2f(U.uRes, canvas.width, canvas.height);
      gl.uniform1f(U.uTime, still ? 14 : (now - t0) / 1000);
      gl.uniform2f(U.uTilt, still ? 0 : tilt.x, still ? 0 : tilt.y);
      gl.uniform1f(U.uStain, cur.stain);
      gl.uniform1f(U.uNight, cur.night);
      gl.uniform3fv(U.uBase, rgb(p.base, '#EDE3D1'));
      gl.uniform3fv(U.uBlood, rgb(p.blood, '#6E1423'));
      gl.uniform4fv(U.uTouch, touches);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      drew = true;
      canvas.dataset.ready = '1';
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('pointerdown', onDown);
      document.removeEventListener('visibilitychange', onVis);
      canvas.removeEventListener('webglcontextlost', onLost);
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
    };
  }, [autoDrift]);

  return <canvas ref={ref} className={`cloth ${night ? 'is-night' : ''} ${off ? 'is-off' : ''} ${className}`} aria-hidden="true" />;
}
