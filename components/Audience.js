'use client';
import { useEffect, useRef, useState } from 'react';
import { useShow } from '@/lib/useShow';
import { getSupabase } from '@/lib/supabase';
import { getDeviceId, getStored, setStored } from '@/lib/device';
import { requestGyro } from '@/lib/tilt';
import { Brand } from './Brand';
import ClothBg from './ClothBg';
import ThemeVars from './ThemeVars';
import Setup from './Setup';
import { findCast } from './VoteBars';
import { ReactionDock, ReactionIcon, useReactionSender } from './Reactions';

// Modes where the phone must stay black so the house stays dark.
const BLACK = new Set(['dark', 'glitch', 'message']);

export default function Audience() {
  const { settings, state, cue, cast, status, online } = useShow();
  const [programOpen, setProgramOpen] = useState(false);
  const [entered, setEntered] = useState(true);
  const mode = state?.override === 'black' ? 'dark' : cue?.phone_mode || 'program';
  const perf = state?.performance_id || null;

  useEffect(() => { setEntered(getStored('adi_entered') === '1'); }, []);
  useEffect(() => { setProgramOpen(false); }, [cue?.id]);

  const black = BLACK.has(mode) && !programOpen;
  const nightCloth = mode === 'standby' && !programOpen;

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
        still={nightCloth}
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
            {mode === 'vote' && <VoteCard key={`${perf}:${cue?.round_key}`} cue={cue} perf={perf} cast={cast} settings={settings} />}
            {mode === 'flowers' && <FlowerCard cue={cue} perf={perf} settings={settings} />}
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
      {cue?.reactions && perf && <ReactionDock perf={perf} kinds={['heart', 'haha', 'wow', 'sad']} night />}
      <button type="button" className="btn btn-ghost-night" onClick={onProgram}>Tingnan ang program</button>
      <p className="ph-hint">Pababain ang brightness. Lalabas dito ang botohan.</p>
    </div>
  );
}

/* ---------- VOTE ---------- */

function VoteCard({ cue, perf, cast, settings }) {
  const storeKey = `adi_vote_${perf}_${cue?.round_key}`;
  const [mine, setMine] = useState(null);
  const [pick, setPick] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => { setMine(getStored(storeKey)); }, [storeKey]);

  const open = !!(cue?.vote_open && perf && cue?.round_key);
  const options = cue?.options || [];

  async function submit() {
    if (!pick || busy || mine) return;
    const sb = getSupabase();
    setBusy(true);
    setErr('');
    for (let attempt = 0; attempt < 3; attempt++) {
      const { error } = await sb.from('votes').insert({
        performance_id: perf,
        round_key: cue.round_key,
        choice: pick,
        device_id: getDeviceId(),
      });
      if (!error) { setStored(storeKey, pick); setMine(pick); setBusy(false); navigator.vibrate?.([20, 40, 30]); return; }
      if (error.code === '23505') { setStored(storeKey, '__done__'); setMine('__done__'); setBusy(false); return; }
      if (error.code === '42501') { setErr('Sarado na ang botohan.'); setBusy(false); return; }
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

      {mine ? (
        <div className="vote-done">
          <div className="stage3d">
            <div className="ballot">
              <span className="ballot-label">Ang boto mo</span>
              <span className="ballot-name">{mine !== '__done__' ? mine : 'Naitala na'}</span>
              <span className="seal" aria-hidden="true"><span>INA</span></span>
            </div>
          </div>
          <h2>Naitala ang boto mo.</h2>
          <p className="muted">Abangan ang resulta sa screen.</p>
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
                  <button type="button" className={`vote-opt ${on ? 'on' : ''}`} onClick={() => { setPick(o); navigator.vibrate?.(8); }} aria-pressed={on}>
                    {m?.photo_url
                      ? <img src={m.photo_url} alt="" className="vote-av" />
                      : <span className="vote-av mono-avatar">{o.slice(0, 1)}</span>}
                    <span className="vote-txt">
                      <strong>{o}</strong>
                      {m?.role_label && <small>{m.role_label}</small>}
                    </span>
                    <span className="vote-radio" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
          {err && <p className="err center">{err}</p>}
          <div className="vote-cta">
            <button type="button" className="btn3d btn-block" disabled={!pick || busy} onClick={submit}>
              {busy ? 'Ipinapadala…' : pick ? `Iboto si ${pick}` : 'Pumili ng INA'}
            </button>
            <p className="muted small center">Isang boto lang bawat phone.</p>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- FLOWERS ---------- */

function FlowerCard({ cue, perf, settings }) {
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
      dx: Math.round(Math.random() * 220 - 110),
      rz: Math.round(Math.random() * 90 - 45),
    }));
    setBursts((b) => [...b.slice(-16), ...add]);
    navigator.vibrate?.(10);
  }

  return (
    <div className="flowers">
      <header className="vote-head">
        <Brand settings={settings} size="sm" />
        <span className="live-pill small"><i />LIVE</span>
      </header>
      <div className="vote-intro">
        <h1>{cue?.phone_title || 'Send flowers!'}</h1>
        {cue?.phone_body && <p>{cue.phone_body}</p>}
      </div>
      <div className="flower-stage stage3d">
        {bursts.map((b) => (
          <span
            key={b.id}
            className="flower-burst"
            style={{ '--dx': `${b.dx}px`, '--rz': `${b.rz}deg` }}
            onAnimationEnd={() => setBursts((all) => all.filter((x) => x.id !== b.id))}
          >
            <ReactionIcon kind="flower" size={46} />
          </span>
        ))}
        <button type="button" className={`flower-btn ${pressed ? 'pressed' : ''}`} onClick={tap} aria-label="Magpadala ng bulaklak">
          <span className="fb-rim" />
          <span className="fb-face">
            <span className="fb-icon"><ReactionIcon kind="flower" size={112} /></span>
            <small>Tap</small>
          </span>
        </button>
      </div>
      <p className="center flower-count-ph">{sent > 0 ? `${sent} bulaklak ang naipadala mo` : 'I-tap nang paulit-ulit'}</p>
      {cue?.reactions && perf && <ReactionDock perf={perf} kinds={['heart', 'haha', 'wow', 'sad']} />}
    </div>
  );
}

/* ---------- PROGRAM ---------- */

const ROTS = [-4, 3, -2.5, 4.5, -3, 2];

function Polaroid({ c, i }) {
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
          {c.actor_name && <span className="pol-actor">Ginagampanan ni <b>{c.actor_name}</b></span>}
        </span>
      </button>
    </li>
  );
}

function Program({ settings, cast, thanks = false, cue, onClose, hidden = false }) {
  return (
    <div className={`prog ${hidden ? 'is-hidden' : 'is-in'}`}>
      {onClose && <button type="button" className="prog-close" onClick={onClose}>Isara</button>}

      <header className="prog-hero stage3d">
        <TitleCard settings={settings} size="md" live={!thanks} />
        <div className="prog-meta">
          {settings.schedule && <span>{settings.schedule}</span>}
          {settings.venue && <span>{settings.venue}</span>}
          {settings.presenter && <span className="prog-by">Isang produksyon ng {settings.presenter}</span>}
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
          {cast.map((c, i) => <Polaroid key={c.id} c={c} i={i} />)}
        </ul>
      </section>

      {settings.synopsis && (
        <section className="sec">
          <h2 className="sec-h">Tungkol sa show</h2>
          <div className="note-card"><p>{settings.synopsis}</p></div>
        </section>
      )}

      {settings.socials && <p className="pre socials">{settings.socials}</p>}
      <footer className="prog-foot">Huwag isara ang page na ito. Dito lalabas ang botohan.</footer>
    </div>
  );
}
