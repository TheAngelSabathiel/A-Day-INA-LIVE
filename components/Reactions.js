'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { getSupabase } from '@/lib/supabase';

/* A small, consistent reaction set. Original glossy badge icons, all one style. */
export const REACTIONS = [
  { kind: 'heart', label: 'Love' },
  { kind: 'haha', label: 'Haha' },
  { kind: 'wow', label: 'Wow' },
  { kind: 'sad', label: 'Sad' },
  { kind: 'flower', label: 'Flowers' },
];

const FILLS = {
  heart: ['#FF5A70', '#B0122F'],
  haha: ['#FFE07A', '#F3A41B'],
  wow: ['#FFE07A', '#F3A41B'],
  sad: ['#FFE07A', '#F3A41B'],
  flower: ['#FFA3C2', '#D93C74'],
};

const FACE = '#5A2A0B';

function Glyph({ kind }) {
  switch (kind) {
    case 'heart':
      return <path d="M24 35.5c-.6 0-1.2-.2-1.6-.6C14.7 28 11 24.2 11 19.3 11 15.2 14.2 12 18.2 12c2.4 0 4.6 1.2 5.8 3.1C25.2 13.2 27.4 12 29.8 12c4 0 7.2 3.2 7.2 7.3 0 4.9-3.7 8.7-11.4 15.6-.4.4-1 .6-1.6.6Z" fill="#fff" />;
    case 'haha':
      return (
        <g fill="none" stroke={FACE} strokeWidth="2.6" strokeLinecap="round">
          <path d="M14.5 19.5l4.5 2.2-4.5 2.2" />
          <path d="M33.5 19.5L29 21.7l4.5 2.2" />
          <path d="M14 27.5h20c0 5.8-4.5 10-10 10s-10-4.2-10-10Z" fill={FACE} stroke="none" />
          <path d="M18.5 34.3c1.5 1.5 3.4 2.2 5.5 2.2s4-.7 5.5-2.2c-1.5-1.3-3.4-2-5.5-2s-4 .7-5.5 2Z" fill="#FF6B7D" stroke="none" />
        </g>
      );
    case 'wow':
      return (
        <g fill={FACE}>
          <path d="M14 15.5c1.4-1.6 3.2-2.3 5.2-2" fill="none" stroke={FACE} strokeWidth="2.2" strokeLinecap="round" />
          <path d="M34 15.5c-1.4-1.6-3.2-2.3-5.2-2" fill="none" stroke={FACE} strokeWidth="2.2" strokeLinecap="round" />
          <ellipse cx="18" cy="21.5" rx="2.6" ry="3.4" />
          <ellipse cx="30" cy="21.5" rx="2.6" ry="3.4" />
          <ellipse cx="24" cy="32" rx="4.6" ry="5.8" />
        </g>
      );
    case 'sad':
      return (
        <g>
          <path d="M13.5 17.5c2-.4 4-1.4 5.5-3M34.5 17.5c-2-.4-4-1.4-5.5-3" fill="none" stroke={FACE} strokeWidth="2.2" strokeLinecap="round" />
          <ellipse cx="18" cy="22.5" rx="2.4" ry="2.9" fill={FACE} />
          <ellipse cx="30" cy="22.5" rx="2.4" ry="2.9" fill={FACE} />
          <path d="M17.5 34.5c1.8-2.2 4-3.3 6.5-3.3s4.7 1.1 6.5 3.3" fill="none" stroke={FACE} strokeWidth="2.6" strokeLinecap="round" />
          <path d="M33 26.5c1.6 2.4 2.4 4 2.4 5a2.4 2.4 0 0 1-4.8 0c0-1 .8-2.6 2.4-5Z" fill="#6EC3FF" />
        </g>
      );
    case 'flower':
      return (
        <g transform="translate(24 24)">
          {[0, 72, 144, 216, 288].map((r) => (
            <ellipse key={r} cx="0" cy="-7.6" rx="5.4" ry="7.6" fill="#fff" transform={`rotate(${r})`} />
          ))}
          <circle r="4.6" fill="#FFC93C" />
          <circle r="4.6" fill="none" stroke="#F09A1C" strokeWidth="1" />
        </g>
      );
    default:
      return null;
  }
}

export function ReactionIcon({ kind, size = 40, className = '' }) {
  const uid = useId().replace(/:/g, '');
  const [a, b] = FILLS[kind] || FILLS.heart;
  return (
    <svg className={`rx-icon ${className}`} width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <linearGradient id={`g${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={a} />
          <stop offset="1" stopColor={b} />
        </linearGradient>
        <radialGradient id={`h${uid}`} cx=".35" cy=".22" r=".55">
          <stop offset="0" stopColor="#fff" stopOpacity=".55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="24" cy="24" r="22" fill={`url(#g${uid})`} />
      <circle cx="24" cy="24" r="22" fill={`url(#h${uid})`} />
      <circle cx="24" cy="24" r="21.4" fill="none" stroke="rgba(0,0,0,.12)" strokeWidth="1.2" />
      <Glyph kind={kind} />
    </svg>
  );
}

/** Batches taps and sends them every 2.5s (max 10 per kind per batch). */
export function useReactionSender(perf) {
  const pending = useRef({});
  useEffect(() => {
    const sb = getSupabase();
    const flush = async () => {
      const rows = Object.entries(pending.current)
        .filter(([, n]) => n > 0)
        .map(([kind, n]) => ({ performance_id: perf, kind, count: Math.min(10, n) }));
      pending.current = {};
      if (rows.length && sb) await sb.from('reactions').insert(rows);
    };
    const t = setInterval(flush, 2500);
    return () => { clearInterval(t); flush(); };
  }, [perf]);
  return (kind) => {
    pending.current[kind] = Math.min((pending.current[kind] || 0) + 1, 20);
  };
}

/** The phone's reaction bar. */
export function ReactionDock({ perf, kinds, night = false }) {
  const send = useReactionSender(perf);
  const [bursts, setBursts] = useState([]);
  const [taps, setTaps] = useState({});
  const list = REACTIONS.filter((r) => !kinds || kinds.includes(r.kind));

  function tap(kind, i) {
    send(kind);
    navigator.vibrate?.(8);
    setTaps((t) => ({ ...t, [kind]: (t[kind] || 0) + 1 }));
    const id = Math.random().toString(36).slice(2);
    setBursts((b) => [...b.slice(-12), { id, kind, x: (i + 0.5) / list.length, dx: Math.round(Math.random() * 60 - 30) }]);
  }

  return (
    <div className={`rx-dock ${night ? 'is-night' : ''}`}>
      <div className="rx-bursts" aria-hidden="true">
        {bursts.map((b) => (
          <span
            key={b.id}
            className="rx-burst"
            style={{ left: `${b.x * 100}%`, '--dx': `${b.dx}px` }}
            onAnimationEnd={() => setBursts((all) => all.filter((x) => x.id !== b.id))}
          >
            <ReactionIcon kind={b.kind} size={40} />
          </span>
        ))}
      </div>
      <div className="rx-row" role="group" aria-label="Mag-react">
        {list.map((r, i) => (
          <button key={r.kind} type="button" className="rx-btn" onClick={() => tap(r.kind, i)} aria-label={r.label}>
            <span className={`rx-face ${taps[r.kind] ? 'pop' : ''}`} key={taps[r.kind] || 0}>
              <ReactionIcon kind={r.kind} size={44} />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
