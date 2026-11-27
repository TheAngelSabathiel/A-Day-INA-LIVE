'use client';
import { useEffect, useRef, useState } from 'react';
import { useShow, useTally } from '@/lib/useShow';
import { cleanText, fillWinner, getHandle, setHandle, topOf } from '@/lib/comments';
import { getSupabase } from '@/lib/supabase';
import { getDeviceId, getStored, setStored } from '@/lib/device';
import { requestGyro } from '@/lib/tilt';
import { Brand } from './Brand';
import Medal from './Medal';
import ClothBg from './ClothBg';
import ThemeVars from './ThemeVars';
import Setup from './Setup';
import { findCast } from './VoteBars';
import { ReactionDock, ReactionIcon, useReactionSender } from './Reactions';

const EMOJIS = ['heart', 'haha', 'wow', 'sad', 'angry'];

// Modes where the phone must stay black so the house stays dark.
const BLACK = new Set(['dark', 'glitch', 'message', 'blackmsg']);

export default function Audience() {
  const { settings, state, cue, cast, status, online } = useShow();
  const [programOpen, setProgramOpen] = useState(false);
  const [entered, setEntered] = useState(true);
  const raw = state?.override === 'black' ? 'dark' : cue?.phone_mode || 'program';
  const mode = raw === 'flowers' ? 'react' : raw;
  const perf = state?.performance_id || null;

  useEffect(() => { setEntered(getStored('adi_entered') === '1'); }, []);
  useEffect(() => { setProgramOpen(false); }, [cue?.id]);

  const black = BLACK.has(mode) && !programOpen;
  const nightCloth = (mode === 'standby' || mode === 'react') && !programOpen;

  useEffect(() => {
    document.body.classList.toggle('ph-night', black || nightCloth);
    return () => document.body.classList.remove('ph-night');
  }, [black, nightCloth]);

  if (status !== 'ready') return <Setup status={status} />;

  const showGate = mode === 'program' && !entered;

  return (
    <div className={`ph ph-${mode} ${programOpen ? 'ph-program-open' : ''}`}>
      <ThemeVars settings={settings} />
      <ClothBg
        off={black}
        night={nightCloth}
        still={mode === 'standby' && !programOpen}
        base={settings.color_bg}
        blood={settings.color_accent}
      />

      {!online && <div className="ph-offline">Mahina ang signal. Nagre-reconnect…</div>}

      <div className="ph-layer">
        {programOpen ? (
          <Program settings={settings} cast={cast} onClose={() => setProgramOpen(false)} />
        ) : (
          <>
            {mode === 'program' && <Program settings={settings} cast={cast} hidden={showGate} />}
            {mode === 'thanks' && <Program settings={settings} cast={cast} thanks cue={cue} />}
            {mode === 'standby' && <Standby cue={cue} perf={perf} settings={settings} onProgram={() => setProgramOpen(true)} />}
            {mode === 'react' && <ReactCard key={cue?.id} cue={cue} perf={perf} cast={cast} settings={settings} muted={!!state?.comments_muted} onProgram={() => setProgramOpen(true)} />}
            {mode === 'vote' && <VoteCard key={`${perf}:${cue?.round_key}`} cue={cue} perf={perf} cast={cast} settings={settings} muted={!!state?.comments_muted} />}
            {mode === 'blackmsg' && (
              <div className="ph-black ph-blackmsg" key={cue?.id}>
                <p><Typed text={cue?.phone_body || cue?.phone_title || ''} /></p>
              </div>
            )}
            {mode === 'dark' && (
              <div className="ph-black">{cue?.phone_title && <p className="ph-dim">{cue.phone_title}</p>}</div>
            )}
            {mode === 'glitch' && (
              <div className="ph-black"><p className="glitch ph-glitch" data-text={cue?.phone_title || ''}>{cue?.phone_title}</p></div>
            )}
            {mode === 'message' && (
              <div className="ph-black ph-message" key={cue?.id}>
                {cue?.phone_title && <h1>{cue.phone_title}</h1>}
                {cue?.phone_body && <p>{cue.phone_body}</p>}
              </div>
            )}
          </>
        )}
      </div>

      {showGate && (
        <Gate settings={settings} onEnter={() => { setStored('adi_entered', '1'); setEntered(true); }} />
      )}
    </div>
  );
}

/* ---------- TITLE CARD (3D, follows tilt) ---------- */

function TitleCard({ settings, size = 'lg', live = true }) {
  return (
    <div className={`title-card tc-${size}`}>
      <div className="tc-frame" aria-hidden="true"><i /><i /><i /><i /></div>
      {live && <span className="tc-live live-pill"><i />LIVE</span>}
      <div className="tc-brand"><Brand settings={settings} size={size === 'lg' ? 'xl' : 'lg'} /></div>
      {settings.tagline && <p className="tc-tag">{settings.tagline}</p>}
    </div>
  );
}

/* ---------- ENTRY GATE ---------- */

function Gate({ settings, onEnter }) {
  const [leaving, setLeaving] = useState(false);

  async function enter() {
    if (leaving) return;
    await requestGyro();
    navigator.vibrate?.(18);
    setLeaving(true);
    setTimeout(onEnter, 950);
  }

  return (
    <div className={`gate3d ${leaving ? 'leaving' : ''}`}>
      <div className="stage3d gate-stage">
        <TitleCard settings={settings} size="lg" />
      </div>
      <div className="gate-foot">
        <button type="button" className="btn3d" onClick={enter}>Pumasok sa LIVE</button>
        {settings.schedule && <p className="gate-meta">{settings.schedule}</p>}
        <p className="gate-hint">Galawin ang phone. Pindutin ang kumot.</p>
      </div>
    </div>
  );
}

/* ---------- STANDBY ---------- */

function Standby({ cue, perf, settings, onProgram }) {
  return (
    <div className="ph-standby-wrap">
      <div className="ph-standby-top">
        <Brand settings={settings} size="sm" className="on-night" />
        <span className="live-pill small"><i />LIVE</span>
      </div>
      <div className="ph-standby-body" key={cue?.id}>
        <h1>{cue?.phone_title || 'Naka-LIVE ka.'}</h1>
        {cue?.phone_body && <p>{cue.phone_body}</p>}
      </div>
      {cue?.reactions && perf && <ReactionDock perf={perf} kinds={EMOJIS} night />}
      <button type="button" className="btn btn-ghost-night" onClick={onProgram}>Tingnan ang program</button>
      <p className="ph-hint">Pababain ang brightness. Lalabas dito ang botohan.</p>
    </div>
  );
}

/* ---------- VOTE ---------- */

function VoteCard({ cue, perf, cast, settings, muted }) {
  const tally = useTally(perf, cue?.round_key, false, 3000);
  const storeKey = `adi_vote_${perf}_${cue?.round_key}`;
  const [mine, setMine] = useState(null);
  const [pick, setPick] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => { setMine(getStored(storeKey)); }, [storeKey]);

  const open = !!(cue?.vote_open && perf && cue?.round_key);
  const options = cue?.options || [];
  const total = options.reduce((n, o) => n + (tally[o] || 0), 0);
  const pct = (o) => (total ? Math.round(((tally[o] || 0) * 100) / total) : 0);
  const max = Math.max(0, ...options.map((o) => tally[o] || 0));

  const [changing, setChanging] = useState(false);

  async function submit() {
    if (!pick || busy || (mine && !changing)) return;
    if (changing && pick === mine) { setChanging(false); return; }
    const sb = getSupabase();
    setBusy(true);
    setErr('');
    for (let attempt = 0; attempt < 3; attempt++) {
      const { error } = await sb.rpc('cast_vote', {
        p_performance: perf,
        p_round: cue.round_key,
        p_choice: pick,
        p_device: getDeviceId(),
      });
      if (!error) { setStored(storeKey, pick); setMine(pick); setChanging(false); setBusy(false); navigator.vibrate?.([20, 40, 30]); return; }
      if (error.code === '42501' || /closed/i.test(error.message || '')) { setErr('Sarado na ang botohan.'); setBusy(false); return; }
      await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
    }
    setErr('Hindi pumasok ang boto. Pakisubukan ulit.');
    setBusy(false);
  }

  return (
    <div className="vote">
      <header className="vote-head">
        <Brand settings={settings} size="sm" />
        <span className={`live-pill small ${open ? '' : 'off'}`}><i />{open ? 'Botohan' : 'Sarado'}</span>
      </header>

      <div className="vote-intro">
        <h1>{cue?.phone_title || 'Sino ang ie-eliminate?'}</h1>
        {cue?.phone_body && <p>{cue.phone_body}</p>}
      </div>

      {mine && !changing ? (
        <div className="vote-done">
          <div className="stage3d">
            <div className="ballot">
              <span className="ballot-label">Ang boto mo</span>
              <span className="ballot-name">{mine !== '__done__' ? mine : 'Naitala na'}</span>
              <span className="seal" aria-hidden="true"><span>INA</span></span>
            </div>
          </div>
          <h2>Naitala ang boto mo.</h2>
          {open && (
            <button
              type="button"
              className="btn btn-outline vote-change"
              onClick={() => { setPick(mine !== '__done__' ? mine : null); setChanging(true); setErr(''); navigator.vibrate?.(8); }}
            >
              Nagbago ang isip? Palitan ang boto
            </button>
          )}
          <LiveBars options={options} pct={pct} tally={tally} max={max} total={total} />
        </div>
      ) : !open ? (
        <div className="vote-done">
          <h2>Sarado na ang botohan.</h2>
          <p className="muted">Abangan ang resulta sa screen.</p>
        </div>
      ) : (
        <>
          <ul className={`vote-list stage3d ${pick ? 'has-pick' : ''}`}>
            {options.map((o, i) => {
              const m = findCast(cast, o);
              const on = pick === o;
              return (
                <li key={o} style={{ '--i': i }}>
                  <button type="button" className={`vote-opt ${on ? 'on' : ''}`} style={{ '--pct': `${pct(o)}%` }} onClick={() => { setPick(o); navigator.vibrate?.(8); }} aria-pressed={on}>
                    <span className="vote-fill" aria-hidden="true" />
                    {m?.photo_url
                      ? <img src={m.photo_url} alt="" className="vote-av" />
                      : <span className="vote-av mono-avatar">{o.slice(0, 1)}</span>}
                    <span className="vote-txt">
                      <strong>{o}</strong>
                      {m?.role_label && <small>{m.role_label}</small>}
                    </span>
                    <span className="vote-pct">{pct(o)}%</span>
                    <span className="vote-radio" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
          {err && <p className="err center">{err}</p>}
          <div className="vote-cta">
            <button type="button" className="btn3d btn-block" disabled={!pick || busy} onClick={submit}>
              {busy ? 'Ipinapadala…' : pick ? (changing ? (pick === mine ? 'Ito pa rin ang boto ko' : `Palitan, iboto si ${pick}`) : `Iboto si ${pick}`) : 'Pumili ng INA'}
            </button>
            {changing && <button type="button" className="btn btn-text vote-cancel" onClick={() => setChanging(false)}>Huwag na lang</button>}
            <p className="muted small center">Isang boto bawat phone. Pwedeng palitan habang bukas · {total.toLocaleString('en-US')} boto na</p>
          </div>
        </>
      )}

      {(cue?.reactions || cue?.comments) && perf && (
        <div className="vote-extras">
          {cue?.reactions && <ReactionDock perf={perf} kinds={EMOJIS} />}
          {cue?.comments && <CommentBox perf={perf} muted={muted} />}
        </div>
      )}
    </div>
  );
}

function LiveBars({ options, pct, tally, max, total }) {
  return (
    <div className="live-bars" aria-label="Live na resulta">
      <p className="live-bars-head"><span className="live-dot" />Live na botohan · {total.toLocaleString('en-US')}</p>
      {options.map((o) => (
        <div key={o} className={`lb ${(tally[o] || 0) === max && max > 0 ? 'lead' : ''}`}>
          <span className="lb-name">{o}</span>
          <span className="lb-track"><span className="lb-fill" style={{ width: `${pct(o)}%` }} /></span>
          <span className="lb-pct">{pct(o)}%</span>
        </div>
      ))}
    </div>
  );
}

/* ---------- TYPEWRITER ---------- */

function Typed({ text, speed = 55 }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    const t = setInterval(() => setN((v) => (v >= text.length ? v : v + 1)), speed);
    return () => clearInterval(t);
  }, [text, speed]);
  return <>{text.slice(0, n)}<span className="tw-caret" /></>;
}

/* ---------- FLOWER SEAL ---------- */

function FlowerSeal({ perf, size = 'md' }) {
  const send = useReactionSender(perf);
  const [sent, setSent] = useState(0);
  const [bursts, setBursts] = useState([]);
  const [pressed, setPressed] = useState(false);

  function tap() {
    send('flower');
    setSent((n) => n + 1);
    setPressed(true);
    setTimeout(() => setPressed(false), 120);
    const add = Array.from({ length: 2 }, () => ({
      id: Math.random().toString(36).slice(2),
      dx: Math.round(Math.random() * 200 - 100),
      rz: Math.round(Math.random() * 90 - 45),
    }));
    setBursts((b) => [...b.slice(-16), ...add]);
    navigator.vibrate?.(10);
  }

  return (
    <div className={`seal-wrap seal-${size}`}>
      <div className="flower-stage stage3d">
        {bursts.map((b) => (
          <span
            key={b.id}
            className="flower-burst"
            style={{ '--dx': `${b.dx}px`, '--rz': `${b.rz}deg` }}
            onAnimationEnd={() => setBursts((all) => all.filter((x) => x.id !== b.id))}
          >
            <ReactionIcon kind="flower" size={44} />
          </span>
        ))}
        <button type="button" className={`flower-btn ${pressed ? 'pressed' : ''}`} onClick={tap} aria-label="Magpadala ng bulaklak">
          <span className="fb-rim" />
          <span className="fb-face">
            <span className="fb-icon"><ReactionIcon kind="flower" size={112} /></span>
            <small>Flowers</small>
          </span>
        </button>
      </div>
      <p className="seal-count">{sent > 0 ? `${sent} bulaklak ang naipadala mo` : 'I-tap nang paulit-ulit'}</p>
    </div>
  );
}

/* ---------- COMMENT BOX ---------- */

function CommentBox({ perf, muted, night = false }) {
  const [text, setText] = useState('');
  const [handle, setH] = useState('');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);
  const [msg, setMsg] = useState('');
  const [mine, setMine] = useState([]);

  useEffect(() => { setH(getHandle()); }, []);
  useEffect(() => {
    if (!wait) return undefined;
    const t = setTimeout(() => setWait((w) => Math.max(0, w - 1)), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function send(e) {
    e.preventDefault();
    const body = cleanText(text.trim()).slice(0, 140);
    if (!body || busy || wait || muted) return;
    setBusy(true);
    setMsg('');
    const { error } = await getSupabase().from('comments').insert({
      performance_id: perf, handle: handle || getHandle(), body, device_id: getDeviceId(),
    });
    setBusy(false);
    if (!error) {
      setText('');
      setWait(3);
      setMine((m) => [...m.slice(-2), body]);
      navigator.vibrate?.(12);
      return;
    }
    if (error.code === 'P0001') { setWait(3); setMsg('Dahan-dahan lang. Isang comment bawat 3 segundo.'); return; }
    if (error.code === '42501') { setMsg('Sarado ang comments ngayon.'); return; }
    setMsg('Hindi naipadala. Pakisubukan ulit.');
  }

  if (muted) return <p className={`cbox-muted ${night ? 'is-night' : ''}`}>Naka-pause ang comments.</p>;

  return (
    <form className={`cbox ${night ? 'is-night' : ''}`} onSubmit={send}>
      {mine.length > 0 && (
        <ul className="cbox-mine" aria-live="polite">
          {mine.map((m, i) => <li key={i}><b>@{handle}</b> {m}</li>)}
        </ul>
      )}
      <HandleEditor handle={handle} onChange={setH} editing={editing} setEditing={setEditing} />
      <div className="cbox-row">
        <input
          className="cbox-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={140}
          placeholder="Mag-comment…"
          aria-label="Comment"
          enterKeyHint="send"
        />
        <button className="cbox-send" disabled={!text.trim() || busy || wait > 0} aria-label="Ipadala">
          {wait > 0 ? wait : (
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M3.4 20.6 21 12 3.4 3.4l2.4 7.1L14 12l-8.2 1.5z" fill="currentColor" /></svg>
          )}
        </button>
      </div>
      {msg && <p className="cbox-msg">{msg}</p>}
    </form>
  );
}

/** Your chat name. Tap to rename; saved on this phone. */
function HandleEditor({ handle, onChange, editing, setEditing }) {
  const [draft, setDraft] = useState(handle);
  useEffect(() => { if (editing) setDraft(handle); }, [editing, handle]);
  function save(e) {
    e?.preventDefault?.();
    onChange(setHandle(draft));
    setEditing(false);
    navigator.vibrate?.(8);
  }
  if (editing) {
    return (
      <div className="cbox-who is-editing">
        <span className="cbox-at">@</span>
        <input
          className="cbox-name"
          autoFocus
          maxLength={20}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-label="Pangalan mo sa chat"
          enterKeyHint="done"
          onKeyDown={(e) => { if (e.key === 'Enter') save(e); if (e.key === 'Escape') setEditing(false); }}
        />
        <button type="button" className="cbox-save" onClick={save}>I-save</button>
      </div>
    );
  }
  return (
    <div className="cbox-who">
      <span className="cbox-av" aria-hidden="true">{(handle || '?').slice(0, 1).toUpperCase()}</span>
      <span className="cbox-as"><small>Nickname mo</small><b>@{handle}</b></span>
      <button type="button" className="cbox-rename" onClick={() => setEditing(true)} aria-label="Palitan ang pangalan">
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M4 17.2V20h2.8l8.3-8.3-2.8-2.8L4 17.2Zm13.7-7.6a.8.8 0 0 0 0-1.1l-2.2-2.2a.8.8 0 0 0-1.1 0l-1.6 1.6 3.3 3.3 1.6-1.6Z" fill="currentColor" /></svg>
        Palitan
      </button>
    </div>
  );
}

/** Shown when the control has not picked a show yet, so taps are not silently lost. */
function Connecting({ night = false }) {
  return <p className={`ph-wait ${night ? 'is-night' : ''}`}>Kumokonekta sa LIVE…</p>;
}

/* ---------- REACT (intros and live moments) ---------- */

function findByTitle(cast, title = '') {
  const t = String(title).toLowerCase();
  return cast.find((c) => {
    const names = [c.display_name, c.character_name].filter(Boolean).map((x) => x.toLowerCase());
    return names.some((n) => n && (t === n || t.includes(n)));
  });
}

function ReactCard({ cue, perf, cast, settings, muted, onProgram }) {
  const needsWinner = /\{winner\}/i.test(`${cue?.phone_title || ''}${cue?.title || ''}`);
  const tally = useTally(needsWinner ? perf : null, needsWinner ? cue?.round_key : null, false);
  const winner = topOf(tally);
  const name = fillWinner(cue?.phone_title || cue?.title, winner);
  const sub = cue?.phone_title ? null : cue?.subtitle;
  const m = findByTitle(cast, needsWinner ? winner : name);

  return (
    <div className="react">
      <header className="vote-head">
        <Brand settings={settings} size="sm" className="on-night" />
        <span className="live-pill small"><i />LIVE</span>
      </header>

      <div className={`react-hero ${needsWinner ? 'is-winner' : ''}`} key={cue?.id}>
        {needsWinner && winner && <Medal photo={m?.photo_url} className="ph-medal" />}
        {!needsWinner && m && (
          <span className="react-av">
            {m.photo_url ? <img src={m.photo_url} alt="" /> : <span className="mono-avatar">{m.character_name.slice(0, 1)}</span>}
          </span>
        )}
        {name && <h1>{name}</h1>}
        {sub && <p className="react-sub">{sub}</p>}
        {cue?.phone_body && <p className="react-hint">{cue.phone_body}</p>}
      </div>

      {cue?.flowers && perf && <FlowerSeal perf={perf} size={cue?.reactions ? 'md' : 'lg'} />}
      {cue?.reactions && perf && <ReactionDock perf={perf} kinds={EMOJIS} night />}
      {cue?.comments && perf && <CommentBox perf={perf} muted={muted} night />}
      {!perf && (cue?.flowers || cue?.reactions || cue?.comments) && <Connecting night />}

      <button type="button" className="btn btn-ghost-night react-prog" onClick={onProgram}>Tingnan ang program</button>
    </div>
  );
}

/* ---------- PROGRAM ---------- */

const ROTS = [-4, 3, -2.5, 4.5, -3, 2];

function Polaroid({ c, i, credit = false }) {
  const [flip, setFlip] = useState(false);
  const name = c.display_name || c.character_name;
  return (
    <li className="pol-wrap" style={{ '--rot': `${ROTS[i % ROTS.length]}deg`, '--i': i }}>
      <button
        type="button"
        className={`pol ${flip ? 'flipped' : ''}`}
        onClick={() => { setFlip((f) => !f); navigator.vibrate?.(6); }}
        aria-pressed={flip}
        aria-label={flip ? `Isara si ${name}` : `Kilalanin si ${name}`}
      >
        <span className="pol-face pol-front">
          <span className="pol-photo">
            {c.photo_url ? <img src={c.photo_url} alt="" /> : <span className="pol-mono">{(c.character_name || '?').slice(0, 1)}</span>}
          </span>
          <span className="pol-name">{name}</span>
          {c.role_label && <span className="pol-role">{c.role_label}</span>}
        </span>
        <span className="pol-face pol-back">
          <span className="pol-name">{c.character_name}</span>
          {c.bio && <span className="pol-bio">{c.bio}</span>}
          {credit && c.actor_name && <span className="pol-actor">Ginagampanan ni <b>{c.actor_name}</b></span>}
        </span>
      </button>
    </li>
  );
}

function Program({ settings, cast, thanks = false, cue, onClose, hidden = false }) {
  return (
    <div className={`prog ${hidden ? 'is-hidden' : 'is-in'}`}>
      {onClose && (
        <div className="prog-bar">
          <button type="button" className="prog-close" onClick={onClose}>
            <span className="live-dot" aria-hidden="true" />Bumalik sa LIVE
          </button>
        </div>
      )}

      <header className="prog-hero stage3d">
        <TitleCard settings={settings} size="md" live={!thanks} />
        <div className="prog-meta">
          {settings.schedule && <span>{settings.schedule}</span>}
          {settings.venue && <span>{settings.venue}</span>}
          {settings.presenter && <span className="prog-by">Hatid ng {settings.presenter}</span>}
        </div>
      </header>

      {!thanks && (settings.advisory || settings.helpline) && (
        <section className="tw-card" aria-label="Trigger warning">
          <div className="tw-head">
            <span className="tw-icon" aria-hidden="true">!</span>
            <strong>Trigger warning</strong>
          </div>
          {settings.advisory && <p>{settings.advisory}</p>}
          {settings.helpline && (
            <details className="tw-help">
              <summary>Kung kailangan mo ng kausap</summary>
              <div className="helpline">{settings.helpline}</div>
            </details>
          )}
        </section>
      )}

      {thanks && (
        <section className="prog-thanks">
          <h2>{cue?.phone_title || 'Maraming salamat sa panonood!'}</h2>
          {cue?.phone_body && <p>{cue.phone_body}</p>}
          {settings.helpline && <div className="helpline">{settings.helpline}</div>}
        </section>
      )}

      <section className="sec">
        <h2 className="sec-h sec-h-one">Ang mga INA ngayong gabi</h2>
        <p className="sec-hint">I-tap ang litrato para makilala sila.</p>
        <ul className="polaroids stage3d">
          {cast.map((c, i) => <Polaroid key={c.id} c={c} i={i} credit={thanks} />)}
        </ul>
      </section>

      {settings.synopsis && (
        <section className="sec">
          <h2 className="sec-h">Tungkol sa episode</h2>
          <div className="note-card"><p>{settings.synopsis}</p></div>
        </section>
      )}

      {settings.socials && <p className="pre socials">{settings.socials}</p>}
      <footer className="prog-foot">Huwag isara ang page na ito. Dito lalabas ang botohan.</footer>
    </div>
  );
}
