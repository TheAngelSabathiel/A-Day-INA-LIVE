'use client';
import { useId } from 'react';

/*
 * The MAMA Medal. Original vector: struck-gold disc with a beveled rim,
 * a laurel ring, engraved lettering on a circular path and a satin ribbon.
 * Pass `photo` to set the winner's picture in the centre.
 */
export default function Medal({ photo, label = 'MAMA MEDAL', ring = 'A DAY INA: LIVE · MAY THE BEST MOTHER WIN ·', className = '' }) {
  const u = useId().replace(/:/g, '');
  const id = (k) => `${k}${u}`;
  const leaves = Array.from({ length: 22 }, (_, i) => i);

  return (
    <div className={`medal3d ${className}`} aria-hidden="true">
      <div className="medal3d-glow" />
      <svg className="medal3d-svg" viewBox="0 0 240 320">
        <defs>
          <linearGradient id={id('rb')} x1="0" x2="1">
            <stop offset="0" stopColor="#3d0811" />
            <stop offset=".45" stopColor="#8a1a2c" />
            <stop offset=".55" stopColor="#a3243a" />
            <stop offset="1" stopColor="#4a0a15" />
          </linearGradient>
          <linearGradient id={id('rs')} x1="0" x2="1">
            <stop offset="0" stopColor="#b98a2a" />
            <stop offset=".5" stopColor="#ffe9a8" />
            <stop offset="1" stopColor="#a87818" />
          </linearGradient>
          <linearGradient id={id('rim')} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fff4c8" />
            <stop offset=".22" stopColor="#e9c25a" />
            <stop offset=".5" stopColor="#9b6a12" />
            <stop offset=".72" stopColor="#f3d27a" />
            <stop offset="1" stopColor="#7a4f0a" />
          </linearGradient>
          <radialGradient id={id('face')} cx=".38" cy=".3" r=".8">
            <stop offset="0" stopColor="#fff6d2" />
            <stop offset=".3" stopColor="#f0cd6a" />
            <stop offset=".7" stopColor="#c48f25" />
            <stop offset="1" stopColor="#8d5e10" />
          </radialGradient>
          <radialGradient id={id('core')} cx=".42" cy=".35" r=".75">
            <stop offset="0" stopColor="#ffeeb0" />
            <stop offset=".55" stopColor="#d9a63c" />
            <stop offset="1" stopColor="#a5741a" />
          </radialGradient>
          <linearGradient id={id('sheen')} x1="0" x2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset=".5" stopColor="#fff" stopOpacity=".75" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <clipPath id={id('disc')}><circle cx="120" cy="208" r="96" /></clipPath>
          <clipPath id={id('photo')}><circle cx="120" cy="208" r="50" /></clipPath>
          <path id={id('arc')} d="M120 208 m-73 0 a73 73 0 1 1 146 0 a73 73 0 1 1 -146 0" />
          <filter id={id('emb')} x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="1.2" stdDeviation=".4" floodColor="#fff7d6" floodOpacity=".9" />
            <feDropShadow dx="0" dy="-1" stdDeviation=".4" floodColor="#5b3a05" floodOpacity=".8" />
          </filter>
        </defs>

        {/* ribbon: two satin tails with gold edges */}
        <g>
          <path d="M66 0h50l-6 128-38-14z" fill={`url(#${id('rb')})`} />
          <path d="M124 0h50l-10 114-38 14z" fill={`url(#${id('rb')})`} />
          <path d="M82 0h8l-6 120-7-3zM150 0h8l-5 117-7 3z" fill={`url(#${id('rs')})`} opacity=".9" />
          <path d="M72 114l38 14 10-4 10 4 34-14 0 16-44 18-48-18z" fill="#2e060d" opacity=".55" />
        </g>

        {/* clasp */}
        <rect x="98" y="102" width="44" height="18" rx="5" fill={`url(#${id('rim')})`} />
        <rect x="101" y="105" width="38" height="12" rx="3" fill="none" stroke="#7a4f0a" strokeOpacity=".5" />

        {/* disc */}
        <circle cx="120" cy="212" r="100" fill="#3a2404" opacity=".35" />
        <circle cx="120" cy="208" r="100" fill={`url(#${id('rim')})`} />
        <circle cx="120" cy="208" r="92" fill={`url(#${id('face')})`} />
        <circle cx="120" cy="208" r="92" fill="none" stroke="#7a4f0a" strokeOpacity=".45" strokeWidth="1.2" />
        <circle cx="120" cy="208" r="84" fill="none" stroke="#fff3c4" strokeOpacity=".7" strokeWidth=".8" />

        {/* laurel ring */}
        <g fill="#a87416" opacity=".85">
          {leaves.map((i) => {
            const side = i < 11 ? -1 : 1;
            const k = i % 11;
            const a = (side < 0 ? 200 + k * 13 : 340 - k * 13) * (Math.PI / 180);
            const x = 120 + Math.cos(a) * 62;
            const y = 208 + Math.sin(a) * 62;
            const rot = (a * 180) / Math.PI + (side < 0 ? -60 : 60);
            return <ellipse key={i} cx={x} cy={y} rx="3.4" ry="8" transform={`rotate(${rot} ${x} ${y})`} />;
          })}
        </g>

        {/* engraved ring text */}
        <text fontFamily="Anton, Impact, sans-serif" fontSize="11.5" letterSpacing="2.6" fill="#7a4f0a" filter={`url(#${id('emb')})`}>
          <textPath href={`#${id('arc')}`} startOffset="0">{ring}</textPath>
        </text>

        {/* centre */}
        <circle cx="120" cy="208" r="54" fill={`url(#${id('core')})`} />
        <circle cx="120" cy="208" r="54" fill="none" stroke="#7a4f0a" strokeOpacity=".5" strokeWidth="1.5" />
        {photo ? (
          <image href={photo} x="70" y="158" width="100" height="100" preserveAspectRatio="xMidYMid slice" clipPath={`url(#${id('photo')})`} />
        ) : (
          <g filter={`url(#${id('emb')})`} fill="#7a4f0a" textAnchor="middle" fontFamily="Anton, Impact, sans-serif">
            <text x="120" y="212" fontSize="34">{label.split(' ')[0]}</text>
            <text x="120" y="234" fontSize="13" letterSpacing="4">{label.split(' ').slice(1).join(' ')}</text>
            <path d="M120 170l4 8 9 1.3-6.5 6.3 1.5 9-8-4.2-8 4.2 1.5-9-6.5-6.3 9-1.3z" />
          </g>
        )}

        {/* light sweep */}
        <g clipPath={`url(#${id('disc')})`}>
          <rect className="medal3d-sweep" x="-80" y="100" width="60" height="220" fill={`url(#${id('sheen')})`} transform="rotate(20 120 208)" />
        </g>
      </svg>
      <div className="medal3d-sparks">{Array.from({ length: 14 }, (_, i) => <i key={i} style={{ '--i': i }} />)}</div>
    </div>
  );
}
