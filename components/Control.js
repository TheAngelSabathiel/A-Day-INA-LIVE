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
  program: 'Program', standby: 'Standby', flowers: 'Flowers', dark: 'Dark', thanks: 'Thanks',
};

function ControlInner() {
  const { settings, state, cue, cues, cast, status, online, applyState } = useShow({ allCues: true });
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
        <label className="ctl-perf">
          <span>Show</span>
          <select value={state?.performance_id || ''} onChange={(e) => send({ performance_id: e.target.value || null })}>
            <option value="">(none)</option>
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
      {!state?.performance_id && <div className="ctl-banner bad">Walang napiling Show. Hindi tatanggap ng boto.</div>}
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

          {cue?.round_key && cue?.options?.length > 0 && (
            <div className="panel">
              <div className="panel-head">
                <strong>Votes · {cue.round_key}</strong>
                <span>{tallyTotal(cue.options, tally)} total {cue.vote_open ? '· OPEN' : '· closed'}</span>
              </div>
              <VoteBars options={cue.options} tally={tally} cast={cast} compact />
            </div>
          )}
          {cue?.round_key && !cue?.options?.length && (
            <RoundPeek cues={cues} roundKey={cue.round_key} tally={tally} cast={cast} />
          )}

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
                      <span className="cue-sub">{MODE_LABEL[c.screen_mode] || c.screen_mode} · {MODE_LABEL[c.phone_mode] || c.phone_mode}{c.vote_open ? ' · VOTE' : ''}{c.flowers ? ' · FLOWERS' : ''}{c.reactions ? ' · REACTIONS' : ''}</span>
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
      {c.reactions && <span className="chip hot">Reactions</span>}
      {c.chat_lines?.length > 0 && <span className="chip">Chat ×{c.chat_lines.length}{c.chat_loop ? ' loop' : ''}</span>}
      {c.counter_target != null && <span className="chip">Viewers → {Number(c.counter_target).toLocaleString('en-US')}</span>}
    </div>
  );
}
