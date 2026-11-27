'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useShow, useTally } from '@/lib/useShow';
import { getSupabase } from '@/lib/supabase';
import { adminPost } from '@/lib/api';
import AdminGate, { logout } from './AdminGate';
import { Brand } from './Brand';
import ThemeVars from './ThemeVars';
import ClothBg from './ClothBg';
import Setup from './Setup';
import VoteBars, { tallyTotal } from './VoteBars';
import { cleanText, useAudienceComments } from '@/lib/comments';

export default function Control() {
  return (
    <AdminGate title="Show Control">
      <ControlInner />
    </AdminGate>
  );
}

const MODE_LABEL = {
  idle: 'Idle + QR', live: 'Live', title: 'Title card', vote: 'Vote', drumroll: 'Drumroll', result: 'Result',
  news: 'News', chat: 'Chat', glitch: 'Glitch', black: 'Black', message: 'Message', sms: 'SMS', curtain: 'Curtain',
  winner: 'Winner', voicemsg: 'Voice msg', blackmsg: 'Black msg',
  program: 'Program', standby: 'Standby', flowers: 'Flowers', dark: 'Dark', thanks: 'Thanks', react: 'React',
};

function ControlInner() {
  const { settings, state, cue, cues, cast, status, online, applyState, reloadCues } = useShow({ allCues: true });
  const [perfs, setPerfs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [inject, setInject] = useState('');
  const listRef = useRef(null);

  const idx = cues.findIndex((c) => c.id === state?.current_cue_id);
  const next = cues[idx + 1] || (idx === -1 ? cues[0] : null);
  const prev = idx > 0 ? cues[idx - 1] : null;
  const tally = useTally(state?.performance_id, cue?.round_key, true);
  const perf = perfs.find((p) => p.id === state?.performance_id);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    sb.from('performances').select('*').order('sort').then(({ data }) => setPerfs(data || []));
  }, []);


  const send = useCallback(async (body) => {
    setBusy(true);
    setErr('');
    try {
      const { data } = await adminPost('/api/admin/state', body);
      if (data) applyState(data);
    } catch (e) {
      setErr(e.message);
    } finally {
      setTimeout(() => setBusy(false), 250);
    }
  }, [applyState]);

  const go = useCallback((c) => { if (c && !busy) send({ current_cue_id: c.id }); }, [busy, send]);

  // No show picked means phones can't vote, react or comment. Pick one automatically:
  // the show running around now (Manila time), else Rehearsal / Test.
  const autoPicked = useRef(false);
  useEffect(() => {
    if (autoPicked.current || status !== 'ready' || !state || state.performance_id || !perfs.length) return;
    autoPicked.current = true;
    const pick = pickPerformance(perfs);
    if (pick) send({ performance_id: pick.id });
  }, [status, state, perfs, send]);

  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target?.tagName || '').toLowerCase();
      if (['input', 'textarea', 'select'].includes(tag)) return;
      if (e.code === 'Space' || e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); go(next); }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(prev); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, next, prev]);

  useEffect(() => {
    const box = listRef.current;
    const row = box?.querySelector('.cue-row.now');
    if (!box || !row || box.scrollHeight <= box.clientHeight) return;
    box.scrollTo({ top: row.offsetTop - box.clientHeight / 2 + row.clientHeight / 2, behavior: 'smooth' });
  }, [state?.current_cue_id]);

  if (status !== 'ready') return <Setup status={status} />;

  const black = state?.override === 'black';

  return (
    <div className="ctl">
      <ThemeVars settings={settings} />
      <ClothBg still base={settings.color_bg} blood={settings.color_accent} className="cloth-tool" />
      <header className="ctl-top">
        <div className="ctl-brand">
          <Brand settings={settings} size="sm" />
          <span className={`dot ${online ? 'ok' : 'bad'}`} title={online ? 'Connected' : 'Reconnecting'} />
        </div>
        <label className={`ctl-perf ${state?.performance_id ? '' : 'is-missing'}`}>
          <span>Show</span>
          <select value={state?.performance_id || ''} onChange={(e) => send({ performance_id: e.target.value || null })}>
            <option value="">Pumili ng show</option>
            {perfs.map((p) => <option key={p.id} value={p.id}>{p.label}{p.is_test ? ' (test)' : ''}</option>)}
          </select>
        </label>
        <nav className="ctl-links">
          <a href="/screen" target="_blank" rel="noreferrer">Screen</a>
          <a href="/" target="_blank" rel="noreferrer">Phone</a>
          <a href="/admin">Admin</a>
          <button type="button" className="linkish" onClick={logout}>Logout</button>
        </nav>
      </header>

      {perf?.is_test && <div className="ctl-banner">TEST MODE: {perf.label}. Palitan ang Show bago mag-house open.</div>}
      {!state?.performance_id && <div className="ctl-banner bad">Pumili ng Show sa itaas. Hangga't wala, hindi gagana ang boto, reactions at comments sa phones.</div>}
      {err && <div className="ctl-banner bad">{err}</div>}

      <div className="ctl-grid">
        <section className="ctl-now">
          <div className="now-card">
            <p className="eyebrow">NOW {idx >= 0 ? `· ${idx + 1}/${cues.length}` : ''}</p>
            <h1>{cue?.label || '(walang cue)'}</h1>
            {cue && <CueChips c={cue} />}
            {cue?.note && <p className="cue-note">{cue.note}</p>}
          </div>

          <div className="next-card">
            <p className="eyebrow">NEXT</p>
            <h2>{next?.label || 'End of show'}</h2>
            {next?.note && <p className="cue-note">{next.note}</p>}
          </div>

          <div className="go-row">
            <button type="button" className="btn btn-back" onClick={() => go(prev)} disabled={!prev || busy}>◀ Back</button>
            <button type="button" className="btn btn-go" onClick={() => go(next)} disabled={!next || busy}>GO ▶</button>
          </div>
          <p className="muted small">Keyboard: Space / → = GO · ← = Back</p>

          <button
            type="button"
            className={`btn btn-block ${black ? 'btn-accent' : 'btn-outline'}`}
            onClick={() => send({ override: black ? null : 'black' })}
          >
            {black ? 'BLACKOUT ON · Tap to restore' : 'Emergency blackout (screen + phones)'}
          </button>

          {cue?.round_key && (
            <VotePanel
              key={`${state?.performance_id}:${cue.round_key}`}
              cue={cue} cues={cues} tally={tally} cast={cast} perfId={state?.performance_id} onError={setErr}
            />
          )}

          <QuickEdit cue={cue} next={next} onSaved={reloadCues} onError={setErr} />

          <SpeedPanel value={state?.chat_speed ?? 6} onChange={(v) => send({ chat_speed: v })} />
          <CommentsPanel perfId={state?.performance_id} muted={!!state?.comments_muted} onMute={(v) => send({ comments_muted: v })} onError={setErr} />

          <form
            className="panel inject"
            onSubmit={(e) => { e.preventDefault(); if (inject.trim()) { send({ inject_text: inject }); setInject(''); } }}
          >
            <div className="panel-head"><strong>Push chat line to screen</strong></div>
            <div className="inject-row">
              <input value={inject} onChange={(e) => setInject(e.target.value)} placeholder="name|message  o  message lang" />
              <button className="btn btn-accent" disabled={!inject.trim()}>Send</button>
            </div>
          </form>
        </section>

        <section className="ctl-list" ref={listRef}>
          <p className="eyebrow">CUES</p>
          <ol>
            {cues.map((c, i) => {
              const isNow = c.id === state?.current_cue_id;
              return (
                <li key={c.id} className={`cue-row ${isNow ? 'now' : ''} ${i < idx ? 'done' : ''}`}>
                  <button type="button" onClick={() => go(c)} disabled={busy}>
                    <span className="cue-n">{i + 1}</span>
                    <span className="cue-main">
                      <strong>{c.label}</strong>
                      <span className="cue-sub">{MODE_LABEL[c.screen_mode] || c.screen_mode} · {MODE_LABEL[c.phone_mode] || c.phone_mode}{c.vote_open ? ' · VOTE' : ''}{c.flowers ? ' · FLOWERS' : ''}{c.reactions ? ' · EMOJI' : ''}{c.comments ? ' · COMMENTS' : ''}{c.fx && c.fx !== 'none' ? ` · ${c.fx.toUpperCase()}` : ''}</span>
                    </span>
                    {isNow && <span className="cue-live">ON</span>}
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      </div>

      <div className="ctl-dock">
        <button type="button" className="btn btn-back" onClick={() => go(prev)} disabled={!prev || busy}>◀</button>
        <button type="button" className="btn btn-go" onClick={() => go(next)} disabled={!next || busy}>
          GO <small>{next?.label || ''}</small>
        </button>
      </div>
    </div>
  );
}

function RoundPeek({ cues, roundKey, tally, cast }) {
  const src = cues.find((c) => c.round_key === roundKey && c.options?.length);
  if (!src) return null;
  return (
    <div className="panel">
      <div className="panel-head">
        <strong>Votes · {roundKey}</strong>
        <span>{tallyTotal(src.options, tally)} total · closed</span>
      </div>
      <VoteBars options={src.options} tally={tally} cast={cast} compact />
    </div>
  );
}

function CueChips({ c }) {
  return (
    <div className="chips">
      <span className="chip">Screen: {MODE_LABEL[c.screen_mode] || c.screen_mode}</span>
      <span className="chip">Phone: {MODE_LABEL[c.phone_mode] || c.phone_mode}</span>
      {c.vote_open && <span className="chip hot">Voting open</span>}
      {c.flowers && <span className="chip hot">Flowers</span>}
      {c.reactions && <span className="chip hot">Emojis</span>}
      {c.comments && <span className="chip hot">Comments</span>}
      {c.fx && c.fx !== 'none' && <span className="chip hot">{c.fx === 'heavy' ? 'Heavy glitch' : 'Flicker'}</span>}
      {c.chat_lines?.length > 0 && <span className="chip">Chat ×{c.chat_lines.length}{c.chat_loop ? ' loop' : ''}</span>}
      {c.counter_target != null && <span className="chip">Viewers → {Number(c.counter_target).toLocaleString('en-US')}</span>}
    </div>
  );
}

/* ---------- VOTES: live tally + manual votes + ghost votes ---------- */

function VotePanel({ cue, cues, tally, cast, perfId, onError }) {
  const src = cue.options?.length ? cue : cues.find((c) => c.round_key === cue.round_key && c.options?.length);
  const options = src?.options || [];
  const [ghost, setGhost] = useState(false);
  const [target, setTarget] = useState('');
  const [speed, setSpeed] = useState('normal');
  const [flash, setFlash] = useState('');
  const live = !!cue.vote_open;

  const add = useCallback(async (boosts) => {
    if (!perfId) { onError('Pumili muna ng Show.'); return; }
    try {
      await adminPost('/api/admin/boost', { performance_id: perfId, round_key: cue.round_key, boosts });
    } catch (e) { onError(e.message); setGhost(false); }
  }, [perfId, cue.round_key, onError]);

  const tap = (choice, amount) => {
    add([{ choice, amount }]);
    setFlash(`+${amount} ${choice}`);
    setTimeout(() => setFlash(''), 900);
  };

  // Ghost votes: small random batches every ~1.5s while voting is open. A target gets most of them.
  useEffect(() => {
    if (!ghost || !live || !options.length) return undefined;
    const ms = speed === 'fast' ? 800 : speed === 'slow' ? 2600 : 1500;
    const t = setInterval(() => {
      const batch = [];
      const n = 1 + Math.floor(Math.random() * 2);
      for (let i = 0; i < n; i++) {
        const choice = target && Math.random() < 0.65 ? target : options[Math.floor(Math.random() * options.length)];
        batch.push({ choice, amount: 1 + Math.floor(Math.random() * (choice === target ? 5 : 3)) });
      }
      add(batch);
    }, ms);
    return () => clearInterval(t);
  }, [ghost, live, target, speed, options, add]);

  if (!options.length) return null;
  const total = tallyTotal(options, tally);

  return (
    <div className="panel votes-panel">
      <div className="panel-head">
        <strong>Votes · {cue.round_key}</strong>
        <span>{total.toLocaleString('en-US')} total · {live ? 'OPEN' : 'closed'}{flash && <b className="vp-flash"> {flash}</b>}</span>
      </div>
      <VoteBars options={options} tally={tally} cast={cast} compact />
      <div className="vp-add">
        {options.map((o) => (
          <div key={o} className="vp-row">
            <span className="vp-name">{o}</span>
            {[1, 5, 10].map((n) => (
              <button key={n} type="button" className="vp-btn" onClick={() => tap(o, n)}>+{n}</button>
            ))}
          </div>
        ))}
      </div>
      <div className={`vp-ghost ${ghost && live ? 'on' : ''}`}>
        <label className="check">
          <input type="checkbox" checked={ghost} onChange={(e) => setGhost(e.target.checked)} />
          <span>Ghost votes {ghost && !live ? '(hihinto: sarado ang botohan)' : ''}</span>
        </label>
        <select value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Push votes to">
          <option value="">Random</option>
          {options.map((o) => <option key={o} value={o}>Push {o}</option>)}
        </select>
        <select value={speed} onChange={(e) => setSpeed(e.target.value)} aria-label="Speed">
          <option value="slow">Slow</option>
          <option value="normal">Normal</option>
          <option value="fast">Fast</option>
        </select>
      </div>
    </div>
  );
}

/* ---------- QUICK EDIT: name strips and titles, live ---------- */

function QuickEdit({ cue, next, onSaved, onError }) {
  const [which, setWhich] = useState('now');
  const target = which === 'now' ? cue : next;
  const [d, setD] = useState({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setD({ title: target?.title || '', subtitle: target?.subtitle || '', caption: target?.caption || '' });
    setSaved(false);
  }, [target?.id, target?.title, target?.subtitle, target?.caption]);

  if (!target) return null;
  const dirty = (d.title || '') !== (target.title || '') || (d.subtitle || '') !== (target.subtitle || '') || (d.caption || '') !== (target.caption || '');

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await adminPost('/api/admin/cues', { upsert: { ...target, title: d.title || null, subtitle: d.subtitle || null, caption: d.caption || null } });
      setSaved(true);
      onSaved?.();
    } catch (err) { onError(err.message); } finally { setBusy(false); }
  }

  return (
    <form className="panel quick-edit" onSubmit={save}>
      <div className="panel-head">
        <strong>Quick edit · {target.label}</strong>
        <span className="seg-mini">
          <button type="button" className={which === 'now' ? 'on' : ''} onClick={() => setWhich('now')}>Now</button>
          <button type="button" className={which === 'next' ? 'on' : ''} onClick={() => setWhich('next')} disabled={!next}>Next</button>
        </span>
      </div>
      <label className="qe-field"><span>Title / name</span><input value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} /></label>
      <label className="qe-field"><span>Subtitle</span><input value={d.subtitle} onChange={(e) => setD({ ...d, subtitle: e.target.value })} /></label>
      <label className="qe-field"><span>Caption</span><input value={d.caption} onChange={(e) => setD({ ...d, caption: e.target.value })} /></label>
      <button className="btn btn-accent" disabled={!dirty || busy}>{busy ? 'Saving…' : saved && !dirty ? 'Live na' : 'Save (live agad)'}</button>
    </form>
  );
}

/* ---------- AUDIENCE COMMENTS: hide and mute ---------- */

function CommentsPanel({ perfId, muted, onMute, onError }) {
  const [list, setList] = useState([]);
  const hidden = useAudienceComments(perfId, (c) => setList((l) => [c, ...l].slice(0, 30)));

  useEffect(() => {
    const sb = getSupabase();
    if (!sb || !perfId) { setList([]); return; }
    sb.from('comments').select('*').eq('performance_id', perfId).order('id', { ascending: false }).limit(20)
      .then(({ data }) => setList(data || []));
  }, [perfId]);

  async function hide(c) {
    try {
      await adminPost('/api/admin/comments', { id: c.id, hidden: true });
      setList((l) => l.map((x) => (x.id === c.id ? { ...x, hidden: true } : x)));
    } catch (e) { onError(e.message); }
  }

  const [confirmClear, setConfirmClear] = useState(false);
  async function clearAll() {
    if (!confirmClear) { setConfirmClear(true); setTimeout(() => setConfirmClear(false), 4000); return; }
    setConfirmClear(false);
    try {
      await adminPost('/api/admin/comments', { performance_id: perfId, all: true });
      setList((l) => l.map((x) => ({ ...x, hidden: true })));
    } catch (e) { onError(e.message); }
  }

  return (
    <div className="panel comments-panel">
      <div className="panel-head">
        <strong>Audience comments</strong>
        <div className="cm-actions">
          <button type="button" className={`btn btn-sm ${confirmClear ? 'btn-accent' : 'btn-outline'}`} onClick={clearAll} disabled={!perfId}>
            {confirmClear ? 'Sigurado? Tap ulit' : 'Clear all'}
          </button>
          <button type="button" className={`btn btn-sm ${muted ? 'btn-accent' : 'btn-outline'}`} onClick={() => onMute(!muted)}>
            {muted ? 'MUTED · Tap to allow' : 'Mute comments'}
          </button>
        </div>
      </div>
      {list.length === 0 && <p className="muted small">Wala pang comments.</p>}
      <ul className="cm-list">
        {list.map((c) => {
          const off = c.hidden || hidden.has(c.id);
          return (
            <li key={c.id} className={off ? 'is-hidden' : ''}>
              <span className="cm-txt"><b>@{c.handle}</b> {cleanText(c.body)}</span>
              {off ? <span className="cm-tag">Hidden</span> : <button type="button" className="btn btn-sm btn-text danger" onClick={() => hide(c)}>Hide</button>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Picks the show happening around now in Manila (labels like "Nov 28 · 3PM"), else the test show. */
function pickPerformance(perfs) {
  const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  const nowMnl = new Date(Date.now() + 8 * 3600e3); // Manila clock read through UTC getters
  let best = null;
  for (const p of perfs) {
    if (p.is_test) continue;
    const m = /([a-z]{3})[a-z]*\.?\s+(\d{1,2}).*?(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i.exec(p.label || '');
    if (!m || MONTHS[m[1].toLowerCase()] == null) continue;
    let h = Number(m[3]) % 12;
    if (m[5].toLowerCase() === 'pm') h += 12;
    const start = Date.UTC(nowMnl.getUTCFullYear(), MONTHS[m[1].toLowerCase()], Number(m[2]), h, Number(m[4] || 0));
    const diff = nowMnl.getTime() - start; // ms since curtain
    if (diff > -3 * 3600e3 && diff < 3 * 3600e3 && (!best || Math.abs(diff) < best.d)) best = { p, d: Math.abs(diff) };
  }
  return best?.p || perfs.find((p) => p.is_test) || perfs[0] || null;
}

const SPEEDS = [['Mabagal', 3], ['Normal', 6], ['Mabilis', 8], ['Flood', 10]];

/** How fast scripted comments roll on the projector. Applies live, mid-cue. */
function SpeedPanel({ value, onChange }) {
  const [v, setV] = useState(value);
  const timer = useRef(0);
  useEffect(() => { setV(value); }, [value]);
  function pick(n) {
    setV(n);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onChange(n), 350); // saves once the slider settles
  }
  return (
    <div className="panel speed-panel">
      <div className="panel-head">
        <strong>Bilis ng comments</strong>
        <span className="muted small">{v <= 3 ? 'Mabagal' : v <= 6 ? 'Normal' : v <= 8 ? 'Mabilis' : 'Flood'}</span>
      </div>
      <div className="speed-row">
        <span className="muted small">Mabagal</span>
        <input type="range" min="1" max="10" step="1" value={v} aria-label="Bilis ng comments" onChange={(e) => pick(Number(e.target.value))} />
        <span className="muted small">Flood</span>
        <span className="speed-val">{v}</span>
      </div>
      <div className="speed-presets">
        {SPEEDS.map(([label, n]) => (
          <button key={n} type="button" className={`btn btn-sm ${v === n ? 'btn-accent' : 'btn-outline'}`} onClick={() => { setV(n); onChange(n); }}>{label}</button>
        ))}
      </div>
    </div>
  );
}
