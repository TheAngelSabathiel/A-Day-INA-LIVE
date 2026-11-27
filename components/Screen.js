'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useShow, useTally } from '@/lib/useShow';
import { getSupabase } from '@/lib/supabase';
import { parseChatLine } from '@/lib/chat';
import { cleanText, fillWinner, topOf, useAudienceComments } from '@/lib/comments';
import { Brand } from './Brand';
import QR, { prettyUrl, useJoinUrl } from './QR';
import ThemeVars from './ThemeVars';
import ClothBg from './ClothBg';
import { ReactionIcon } from './Reactions';
import Medal from './Medal';
import Setup from './Setup';
import VoteBars, { findCast, tallyTotal } from './VoteBars';

const DARK_MODES = new Set(['glitch', 'message', 'sms', 'black', 'voicemsg', 'blackmsg']);
const NO_RAIL = new Set(['chat', 'black', 'blackmsg', 'idle', 'curtain', 'glitch', 'message', 'voicemsg']);

export default function Screen() {
  const { settings, state, cue, cast, status } = useShow({ pollCue: true });
  const cueKey = `${cue?.id || 'none'}:${state?.cue_started_at || ''}`;
  const mode = state?.override === 'black' ? 'black' : cue?.screen_mode || 'idle';
  const joinUrl = useJoinUrl(settings);
  const viewers = useViewerCounter(cue?.counter_target, cueKey);
  const chat = useChatFeed(cue, cueKey, state, state?.performance_id);
  const { petals, total: flowerTotal, removePetal } = useReactions(state?.performance_id, cueKey);
  const tally = useTally(state?.performance_id, cue?.round_key, !!cue?.vote_open);
  const left = useCountdown(cue?.timer_seconds, cueKey);
  const idle = useIdleCursor();
  useWakeLock();

  useEffect(() => {
    document.body.classList.add('is-screen');
    return () => document.body.classList.remove('is-screen');
  }, []);

  const toggleFs = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  };

  if (status !== 'ready') return <Setup status={status} />;

  const dark = DARK_MODES.has(mode);
  const blankResult = mode === 'result' && !cue?.body && /:\s*$/.test(cue?.title || '');
  const stain = mode === 'blackmsg' ? 0 : dark ? 0.7 : blankResult ? 0.45 : mode === 'chat' && cue?.chat_loop ? 0.3 : 0;
  const showTop = !!cue?.show_live && !['black', 'idle', 'blackmsg'].includes(mode);
  const lowerThird = mode === 'live' && (cue?.title || cue?.subtitle);
  const railOn = chat.length > 0 && !NO_RAIL.has(mode) && (cue?.comments || cue?.chat_lines?.length > 0);
  const qrFloat = cue?.show_qr && !['idle', 'vote', 'black', 'blackmsg'].includes(mode);
  const winner = topOf(tally);
  const fx = state?.override === 'black' ? 'none' : cue?.fx || 'none';

  return (
    <div className={`screen ${dark ? 'is-dark' : ''} mode-${mode} fx-${fx} ${railOn ? 'has-rail' : ''} ${qrFloat ? 'has-qr' : ''} ${idle ? 'is-idle' : ''}`}>
      <ThemeVars settings={settings} />
      <ClothBg
        autoDrift
        off={mode === 'black' || mode === 'blackmsg'}
        night={dark}
        stain={stain}
        base={settings.color_bg}
        blood={settings.color_accent}
      />

      {showTop && (
        <div className="sc-top">
          <Brand settings={settings} size="sm" />
          <div className="sc-top-right">
            <span className="live-pill"><i />LIVE</span>
            <span className="viewers" aria-label="viewers">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5C6.5 5 2.7 9.2 1.5 12c1.2 2.8 5 7 10.5 7s9.3-4.2 10.5-7C21.3 9.2 17.5 5 12 5Zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8Z" fill="currentColor" /></svg>
              {viewers.toLocaleString('en-US')}
            </span>
          </div>
        </div>
      )}

      <main className="sc-main">
        <div className="sc-tilt">
          <div className="sc-swing" key={cueKey}>
            <Body
              mode={mode} cue={cue} settings={settings} cast={cast} tally={tally} chat={chat}
              joinUrl={joinUrl} left={left} cueKey={cueKey} winner={winner}
            />
          </div>
        </div>
      </main>

      {lowerThird && (
        <div className="lower-third" key={'lt' + cueKey + cue.title + cue.subtitle}>
          {cue.title && <strong>{fillWinner(cue.title, winner)}</strong>}
          {cue.subtitle && <span>{cue.subtitle}</span>}
        </div>
      )}

      {mode === 'news' && cue?.body && (
        <div className="news-ticker" key={'tk' + cueKey}>
          <div className="news-track">
            <span>{cue.body}</span>
            <span aria-hidden="true">{cue.body}</span>
          </div>
        </div>
      )}

      {railOn && (
        <aside className={`sc-rail ${lowerThird ? 'above-lt' : ''}`} aria-label="Live chat">
          <p className="rail-head"><span className="rail-dot" />Live chat</p>
          <ChatFeed msgs={chat.slice(-12)} />
        </aside>
      )}

      {cue?.caption && !['black', 'blackmsg'].includes(mode) && <div className="sc-caption" key={'cap' + cueKey}>{cue.caption}</div>}

      {qrFloat && (
        <div className="sc-qr-float">
          <QR url={joinUrl} />
          <span>{prettyUrl(joinUrl)}</span>
        </div>
      )}

      {cue?.flowers && flowerTotal > 0 && (
        <div className="flower-count" key={flowerTotal}><ReactionIcon kind="flower" size={28} /> {flowerTotal.toLocaleString('en-US')}</div>
      )}

      {fx !== 'none' && <div className="fx-flash" aria-hidden="true" />}
      {fx === 'heavy' && <div className="fx-layer" aria-hidden="true"><i /><i /><i /><i /><i /></div>}

      {!['black', 'blackmsg'].includes(mode) && (
        <div className="petals" aria-hidden="true">
          {petals.map((p) => (
            <span
              key={p.id}
              className={`petal kind-${p.kind}`}
              style={{ left: `${p.x}%`, animationDuration: `${p.d}s`, animationDelay: `${p.delay || 0}s`, '--size': p.s, '--sway': `${p.w}vw` }}
              onAnimationEnd={() => removePetal(p.id)}
            >
              <ReactionIcon kind={p.kind} size={64} />
            </span>
          ))}
        </div>
      )}

      <button type="button" className="fs-btn" onClick={toggleFs}>Fullscreen</button>
    </div>
  );
}

function Body({ mode, cue, settings, cast, tally, chat, joinUrl, left, cueKey, winner }) {
  switch (mode) {
    case 'black':
      return null;

    case 'idle':
      return (
        <section className="sc-idle">
          <div className="sc-idle-info">
            <Brand settings={settings} size="xl" className="extrude" />
            {settings.tagline && <p className="sc-tagline">{settings.tagline}</p>}
            {(settings.schedule || settings.venue) && (
              <p className="sc-meta">{[settings.schedule, settings.venue].filter(Boolean).join(' · ')}</p>
            )}
            {settings.presenter && <p className="sc-presenter">{settings.presenter}</p>}
          </div>
          <div className="sc-idle-qr">
            <QR url={joinUrl} />
            <p>{cue?.title || settings.join_prompt || 'I-scan para sumali sa LIVE'}</p>
            <span>{prettyUrl(joinUrl)}</span>
          </div>
        </section>
      );

    case 'live':
      return (
        <section className="sc-onair">
          <Brand settings={settings} size="xl" className="sc-watermark" />
        </section>
      );

    case 'title':
      return (
        <section className="sc-title">
          <Brand settings={settings} size={cue?.title ? 'md' : 'xl'} className={cue?.title ? '' : 'extrude'} />
          {cue?.title && <h1 className="sc-h1 extrude">{fillWinner(cue.title, winner)}</h1>}
          {cue?.subtitle && <p className="sc-kicker">{cue.subtitle}</p>}
          {cue?.body && <p className="sc-body">{cue.body}</p>}
        </section>
      );

    case 'vote': {
      const total = tallyTotal(cue.options, tally);
      return (
        <section className="sc-vote">
          <div className="sc-vote-main">
            <header className="sc-vote-head">
              <div>
                {cue.title && <h1 className="sc-h2">{cue.title}</h1>}
                {cue.subtitle && <p className="sc-kicker">{cue.subtitle}</p>}
                <div className="sc-vote-foot">
                  <span>{total.toLocaleString('en-US')} {total === 1 ? 'boto' : 'mga boto'}</span>
                  {cue.vote_open ? <span className="pill-open">BUKAS ANG BOTOHAN</span> : <span className="pill-closed">SARADO</span>}
                  {left != null && <span className={`countdown ${left <= 5 ? 'hot' : ''}`}>{left}s</span>}
                </div>
              </div>
              {cue.show_qr && (
                <div className="sc-vote-qr">
                  <QR url={joinUrl} />
                  <span>{prettyUrl(joinUrl)}</span>
                </div>
              )}
            </header>
            {cue.show_bars && <VoteBars options={cue.options} tally={tally} cast={cast} />}
          </div>
        </section>
      );
    }

    case 'drumroll':
      return (
        <section className="sc-drum">
          {cue.subtitle && <p className="sc-kicker">{cue.subtitle}</p>}
          <h1 className="sc-h1 extrude-ink">{cue.title}<span className="dots"><i /><i /><i /></span></h1>
        </section>
      );

    case 'result': {
      const blank = !cue.body && /:\s*$/.test(cue.title || '');
      return (
        <section className="sc-result">
          {cue.subtitle && <p className="sc-kicker">{cue.subtitle}</p>}
          <h1 className={`sc-h1 pop extrude ${blank ? 'nowrap' : ''}`}>{fillWinner(cue.title, winner)}{blank && <span className="blank-cursor" />}</h1>
          {cue.body && <p className="sc-body">{cue.body}</p>}
          {cue.show_bars && cue.options?.length > 0 && <VoteBars options={cue.options} tally={tally} cast={cast} compact />}
        </section>
      );
    }

    case 'news':
      return (
        <section className="sc-news">
          <div className="news-flag">BREAKING NEWS</div>
          <h1 className="news-head extrude-ink">{cue.title}</h1>
          {cue.subtitle && <p className="news-kicker">{cue.subtitle}</p>}

        </section>
      );

    case 'chat':
      return (
        <section className="sc-chatmode">
          {cue.title && <p className="sc-kicker">{cue.title}</p>}
          <ChatFeed msgs={chat.slice(-9)} big />
        </section>
      );

    case 'glitch':
      return (
        <section className="sc-glitch">
          <h1 className="glitch" data-text={cue.title || ''}>{cue.title}</h1>
          {cue.subtitle && <p className="glitch-sub">{cue.subtitle}</p>}
        </section>
      );

    case 'message':
      return (
        <section className="sc-message">
          {cue.title && <h1 className="msg-title">{cue.title}</h1>}
          {cue.body && <p className="msg-body"><Typewriter text={cue.body} keyId={cueKey} /></p>}
        </section>
      );

    case 'sms':
      return (
        <section className="sc-sms">
          <div className="sms-phone">
            <div className="sms-status"><span>No Service</span><span>11:47 PM</span></div>
            <div className="sms-sender">{cue.title || 'Message'}</div>
            <div className="sms-bubble">{cue.body}</div>
            <div className="sms-meta">Delivered</div>
          </div>
        </section>
      );

    case 'winner': {
      const m = findCast(cast, winner || '');
      return (
        <section className="sc-winner">
          {cue.subtitle && <p className="sc-kicker">{cue.subtitle}</p>}
          <Medal photo={m?.photo_url} className="sc-medal" />
          <div className="win-text">
            <WinName text={winner ? fillWinner(cue.title || '{winner}', winner) : 'Walang boto pa'} empty={!winner} />
            {cue.body && <p className="win-body">{cue.body}</p>}
          </div>
        </section>
      );
    }

    case 'voicemsg':
      return (
        <section className="sc-voice">
          <div className="vm-card">
            <div className="vm-top">
              <span className="vm-av">{(cue.title || '?').slice(0, 1)}</span>
              <span className="vm-who"><strong>{cue.title}</strong>{cue.subtitle && <small>{cue.subtitle}</small>}</span>
            </div>
            <div className="vm-row">
              <span className="vm-play" aria-hidden="true" />
              <span className="vm-wave" aria-hidden="true">
                {Array.from({ length: 38 }, (_, i) => (
                  <i key={i} style={{ '--h': `${22 + Math.round(Math.abs(Math.sin(i * 1.7) + Math.sin(i * 0.43)) * 36)}%`, '--d': `${(i % 7) * 0.11}s` }} />
                ))}
              </span>
              <Elapsed keyId={cueKey} />
            </div>
          </div>
        </section>
      );

    case 'blackmsg':
      return (
        <section className="sc-blackmsg">
          <p><Typewriter text={cue.body || cue.title || ''} keyId={cueKey} speed={75} /></p>
        </section>
      );

    case 'curtain':
      return (
        <section className={`sc-curtain ${settings.credits ? 'has-credits' : ''}`}>
          <div className="cur-main">
            <Brand settings={settings} size="lg" className="extrude" />
            {cue.title && <h1 className="sc-h2 extrude">{cue.title}</h1>}
            {cue.body && <p className="sc-body">{cue.body}</p>}
            {settings.helpline && <div className="sc-help">{settings.helpline}</div>}
          </div>
          {settings.credits && <div className="cur-credits"><Credits text={settings.credits} /></div>}
        </section>
      );

    default:
      return null;
  }
}

/* "Role: Name" lines become a centered two-column roll; other lines become headings. */
function Credits({ text }) {
  const groups = [];
  let cur = null;
  for (const raw of String(text).split('\n')) {
    const line = raw.trim();
    if (!line) { cur = null; continue; }
    const m = line.match(/^([^:]{1,40}):\s*(.+)$/);
    if (m) {
      if (!cur || cur.type !== 'rows') { cur = { type: 'rows', rows: [] }; groups.push(cur); }
      cur.rows.push([m[1].trim(), m[2].trim()]);
    } else {
      cur = null;
      const seenRows = groups.some((g) => g.type === 'rows');
      groups.push({ type: 'line', text: line, note: seenRows });
    }
  }
  return (
    <div className="credits">
      {groups.map((g, i) => (g.type === 'line'
        ? <p key={i} className={g.note ? 'credits-note' : 'credits-line'}>{g.text}</p>
        : (
          <dl key={i} className="credits-rows">
            {g.rows.map(([role, name], j) => (
              <div key={j}><dt>{role}</dt><dd>{name}</dd></div>
            ))}
          </dl>
        )))}
    </div>
  );
}

function WinName({ text, empty }) {
  const longest = Math.max(...String(text).split(/\s+/).map((w) => w.length), 0);
  const size = empty ? 'is-empty' : text.length > 16 || longest > 11 ? 'is-long' : text.length > 9 ? 'is-mid' : '';
  return <h1 className={`sc-h1 pop win-name ${size}`}>{text}</h1>;
}

function ChatFeed({ msgs, big = false }) {
  return (
    <ol className={`chat ${big ? 'chat-big' : ''}`}>
      {msgs.map((m) => (
        <li key={m.id} className={`${m.injected ? 'injected' : ''} ${m.audience ? 'from-audience' : ''}`}>
          <span className="chat-av">{(m.name || '?').slice(0, 1).toUpperCase()}</span>
          <span className="chat-txt"><b>{m.name}</b>{m.audience || m.injected ? cleanText(m.text) : m.text}</span>
        </li>
      ))}
    </ol>
  );
}

function Elapsed({ keyId }) {
  const [s, setS] = useState(0);
  useEffect(() => {
    setS(0);
    const t0 = Date.now();
    const t = setInterval(() => setS(Math.floor((Date.now() - t0) / 1000)), 500);
    return () => clearInterval(t);
  }, [keyId]);
  return <span className="vm-time">{Math.floor(s / 60)}:{String(s % 60).padStart(2, '0')}</span>;
}

function Typewriter({ text, keyId, speed = 42 }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    if (!text) return;
    const t = setInterval(() => {
      setN((v) => {
        if (v >= text.length) { clearInterval(t); return v; }
        return v + 1;
      });
    }, speed);
    return () => clearInterval(t);
  }, [text, keyId, speed]);
  return <>{text.slice(0, n)}<span className="tw-caret" /></>;
}

/* ---------- hooks ---------- */

function useViewerCounter(target, key) {
  const [n, setN] = useState(12480);
  const ref = useRef(12480);
  useEffect(() => {
    let raf = 0;
    let timer = 0;
    if (target != null) {
      const from = ref.current;
      const to = Number(target);
      const dur = Math.abs(to - from) > 100000 ? 3400 : 1400;
      const t0 = performance.now();
      const step = (t) => {
        const k = Math.min(1, (t - t0) / dur);
        const v = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)));
        ref.current = v;
        setN(v);
        if (k < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    } else {
      timer = setInterval(() => {
        ref.current = Math.max(0, ref.current + Math.floor(Math.random() * 46) - 9);
        setN(ref.current);
      }, 1400);
    }
    return () => { cancelAnimationFrame(raf); clearInterval(timer); };
  }, [target, key]);
  return n;
}

function useChatFeed(cue, key, state, perfId) {
  const [msgs, setMsgs] = useState([]);
  const injectRef = useRef(undefined);
  const push = useCallback((m) => {
    setMsgs((prev) => (m.id && prev.some((x) => x.id === m.id) ? prev : [...prev.slice(-15), { ...m, id: m.id || Math.random().toString(36).slice(2) }]));
  }, []);

  // Every cue starts with a clean feed. Scripted lines play in order (script lines first),
  // and the comments-reading scene (chat mode, not a loop) also replays this show's saved
  // audience comments between the scripted ones.
  useEffect(() => {
    setMsgs([]);
    const lines = (cue?.chat_lines || []).filter((l) => l && l.trim());
    const replay = cue?.screen_mode === 'chat' && cue?.comments && !cue?.chat_loop && perfId;
    if (!lines.length && !replay) return undefined;
    let alive = true;
    let t = 0;

    (async () => {
      let saved = [];
      if (replay) {
        const sb = getSupabase();
        const { data } = sb
          ? await sb.from('comments').select('*').eq('performance_id', perfId).eq('hidden', false).order('id', { ascending: false }).limit(14)
          : { data: [] };
        saved = (data || []).reverse().map((c) => ({ id: `c${c.id}`, cid: c.id, name: c.handle, text: c.body, audience: true }));
      }
      if (!alive) return;

      let i = 0;
      let k = 0;
      let turn = 0;
      let gap = Math.max(200, cue.chat_interval_ms || 2500);
      const next = () => {
        if (!alive) return;
        const scriptLeft = i < lines.length || (cue.chat_loop && lines.length);
        const savedLeft = k < saved.length;
        if (!scriptLeft && !savedLeft) return;
        // alternate: script, saved, saved, script, saved, saved...
        const useSaved = savedLeft && (!scriptLeft || turn % 3 !== 0);
        if (useSaved) { push(saved[k]); k += 1; } else { push(parseChatLine(lines[i % lines.length], i >= lines.length)); i += 1; }
        turn += 1;
        if (cue.chat_ramp) gap = Math.max(180, gap * 0.86);
        const jitter = cue.chat_loop ? 0.6 + Math.random() * 0.8 : useSaved ? 0.7 : 1;
        t = setTimeout(next, gap * jitter);
      };
      next();
    })();

    return () => { alive = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, perfId]);

  // Live audience comments
  const hidden = useAudienceComments(perfId, (c) => push({ id: `c${c.id}`, cid: c.id, name: c.handle, text: c.body, audience: true }));

  const at = state?.inject_at || null;
  useEffect(() => {
    if (injectRef.current === undefined) { injectRef.current = at; return; }
    if (at && at !== injectRef.current) {
      injectRef.current = at;
      if (state?.inject_text) push({ ...parseChatLine(state.inject_text), injected: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at]);

  return hidden.size ? msgs.filter((m) => !m.cid || !hidden.has(m.cid)) : msgs;
}

function useReactions(perfId, key) {
  const [petals, setPetals] = useState([]);
  const [total, setTotal] = useState(0);

  useEffect(() => { setTotal(0); }, [key]);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    const ch = sb
      .channel('screen-reactions-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reactions' }, (p) => {
        const r = p.new || {};
        if (perfId && r.performance_id !== perfId) return;
        const n = Math.max(1, Math.min(10, r.count || 1));
        const flower = r.kind === 'flower';
        if (flower) setTotal((t) => t + n);
        // Every reaction rises across the whole set, staggered so a burst reads as a swarm.
        const add = Array.from({ length: Math.min(n, 6) }, (_, k) => ({
          id: Math.random().toString(36).slice(2),
          kind: r.kind,
          x: 2 + Math.random() * 96,
          d: 4 + Math.random() * 3.2,
          s: (flower ? 0.85 : 0.7) + Math.random() * 0.8,
          w: Math.random() * 8 - 4,
          delay: k * 0.18,
        }));
        setPetals((prev) => [...prev, ...add].slice(-140));
      })
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [perfId]);

  const removePetal = useCallback((id) => setPetals((prev) => prev.filter((p) => p.id !== id)), []);
  return { petals, total, removePetal };
}

function useCountdown(seconds, key) {
  const [left, setLeft] = useState(null);
  useEffect(() => {
    if (!seconds) { setLeft(null); return; }
    const end = Date.now() + seconds * 1000;
    const tick = () => setLeft(Math.max(0, Math.ceil((end - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [seconds, key]);
  return left;
}

function useIdleCursor() {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    let t = 0;
    const wake = () => {
      setIdle(false);
      clearTimeout(t);
      t = setTimeout(() => setIdle(true), 2500);
    };
    wake();
    window.addEventListener('mousemove', wake);
    window.addEventListener('touchstart', wake);
    return () => {
      clearTimeout(t);
      window.removeEventListener('mousemove', wake);
      window.removeEventListener('touchstart', wake);
    };
  }, []);
  return idle;
}

function useWakeLock() {
  useEffect(() => {
    let lock = null;
    const request = async () => {
      try { lock = await navigator.wakeLock?.request('screen'); } catch { /* not supported */ }
    };
    request();
    const onVis = () => { if (document.visibilityState === 'visible') request(); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      lock?.release?.().catch(() => {});
    };
  }, []);
}
