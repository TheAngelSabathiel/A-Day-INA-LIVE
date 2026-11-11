'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import { adminPost, uploadImage } from '@/lib/api';
import AdminGate, { logout } from './AdminGate';
import { Brand } from './Brand';
import ThemeVars from './ThemeVars';
import ClothBg from './ClothBg';
import VoteBars from './VoteBars';
import { useTally } from '@/lib/useShow';

export default function Admin() {
  return (
    <AdminGate title="Admin Setup">
      <AdminInner />
    </AdminGate>
  );
}

const TABS = [
  ['branding', 'Branding'],
  ['program', 'Program'],
  ['cast', 'Cast'],
  ['cues', 'Cues'],
  ['shows', 'Shows & Votes'],
];

function AdminInner() {
  const [tab, setTab] = useState('branding');
  const [settings, setSettings] = useState(null);
  const [toast, setToast] = useState(null);

  const notify = useCallback((msg, bad = false) => {
    setToast({ msg, bad, id: Date.now() });
    setTimeout(() => setToast(null), 2600);
  }, []);

  const loadSettings = useCallback(async () => {
    const sb = getSupabase();
    if (!sb) return;
    const { data } = await sb.from('settings').select('*').eq('id', 1).maybeSingle();
    setSettings(data || { id: 1 });
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  if (!getSupabase()) return <div className="center-screen"><div className="setup-card"><h1>Kulang ang setup</h1><p>Missing Supabase env vars.</p></div></div>;
  if (!settings) return <div className="center-screen"><div className="loader" /></div>;

  return (
    <div className="adm">
      <ThemeVars settings={settings} />
      <ClothBg still base={settings.color_bg} blood={settings.color_accent} className="cloth-tool" />
      <header className="adm-top">
        <div className="adm-brand"><Brand settings={settings} size="sm" /><span>Admin</span></div>
        <nav className="adm-tabs">
          {TABS.map(([k, l]) => (
            <button key={k} type="button" className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
          ))}
        </nav>
        <nav className="adm-links">
          <a href="/control">Control</a>
          <a href="/screen" target="_blank" rel="noreferrer">Screen</a>
          <a href="/" target="_blank" rel="noreferrer">Phone</a>
          <button type="button" className="linkish" onClick={logout}>Logout</button>
        </nav>
      </header>

      <main className="adm-main">
        {tab === 'branding' && <BrandingTab settings={settings} onSaved={setSettings} notify={notify} />}
        {tab === 'program' && <ProgramTab settings={settings} onSaved={setSettings} notify={notify} />}
        {tab === 'cast' && <CastTab notify={notify} />}
        {tab === 'cues' && <CuesTab notify={notify} />}
        {tab === 'shows' && <ShowsTab notify={notify} />}
      </main>

      {toast && <div key={toast.id} className={`toast ${toast.bad ? 'bad' : ''}`}>{toast.msg}</div>}
    </div>
  );
}

/* ---------- small form helpers ---------- */

function Field({ label, hint, children, wide }) {
  return (
    <label className={`field ${wide ? 'wide' : ''}`}>
      <span>{label}</span>
      {children}
      {hint && <em>{hint}</em>}
    </label>
  );
}

function Text({ value, onChange, ...rest }) {
  return <input type="text" value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...rest} />;
}

function Area({ value, onChange, rows = 4, ...rest }) {
  return <textarea rows={rows} value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...rest} />;
}

function Check({ label, checked, onChange }) {
  return (
    <label className="check">
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function ImageField({ label, value, kind, onChange, notify, round }) {
  const [busy, setBusy] = useState(false);
  async function pick(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const url = await uploadImage(file, kind);
      onChange(url);
      notify('Uploaded. I-save para i-apply.');
    } catch (err) {
      notify(err.message, true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="img-field">
      <span className="img-label">{label}</span>
      <div className={`img-preview ${round ? 'round' : ''}`}>
        {value ? <img src={value} alt="" /> : <span>Wala pa</span>}
      </div>
      <div className="img-actions">
        <label className="btn btn-outline btn-sm">
          {busy ? 'Uploading…' : value ? 'Palitan' : 'Upload'}
          <input type="file" accept="image/*" onChange={pick} hidden disabled={busy} />
        </label>
        {value && <button type="button" className="btn btn-sm btn-text" onClick={() => onChange(null)}>Alisin</button>}
      </div>
    </div>
  );
}

function useDraft(source) {
  const [draft, setDraft] = useState(source);
  useEffect(() => setDraft(source), [source]);
  const set = (k) => (v) => setDraft((d) => ({ ...d, [k]: v }));
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(source), [draft, source]);
  return [draft, set, setDraft, dirty];
}

/* ---------- BRANDING ---------- */

function BrandingTab({ settings, onSaved, notify }) {
  const [d, set, , dirty] = useDraft(settings);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const { data } = await adminPost('/api/admin/settings', { upsert: d });
      onSaved(data?.[0] || d);
      notify('Saved. Live na sa lahat ng screens.');
    } catch (e) { notify(e.message, true); } finally { setBusy(false); }
  }

  const colors = [
    ['color_bg', 'Background (beige)'],
    ['color_surface', 'Cards'],
    ['color_accent', 'Accent (maroon)'],
    ['color_ink', 'Text'],
  ];

  return (
    <div className="adm-section">
      <div className="adm-head">
        <h1>Branding</h1>
        <button type="button" className="btn btn-accent" onClick={save} disabled={!dirty || busy}>{busy ? 'Saving…' : 'Save'}</button>
      </div>

      <div className="card">
        <h2>Logo</h2>
        <div className="logo-grid">
          <ImageField label="Sublogo" kind="sublogo" value={d.sublogo_url} onChange={set('sublogo_url')} notify={notify} />
          <ImageField label="Main logo" kind="logo" value={d.logo_url} onChange={set('logo_url')} notify={notify} />
        </div>
        <div className="seg">
          <span>Gamitin sa app:</span>
          <button type="button" className={d.logo_mode !== 'logo' ? 'on' : ''} onClick={() => set('logo_mode')('sublogo')}>Sublogo</button>
          <button type="button" className={d.logo_mode === 'logo' ? 'on' : ''} onClick={() => set('logo_mode')('logo')}>Main logo</button>
        </div>
        <p className="muted small">Kung walang na-upload, text wordmark ang lalabas. PNG o SVG na transparent ang pinakamaganda.</p>
        <div className="brand-preview">
          <div className="bp light"><Brand settings={d} size="md" /></div>
          <div className="bp dark"><Brand settings={d} size="md" className="on-night" /></div>
        </div>
      </div>

      <div className="card">
        <h2>Colors</h2>
        <div className="color-grid">
          {colors.map(([k, l]) => (
            <label key={k} className="color-field">
              <input type="color" value={d[k] || '#000000'} onChange={(e) => set(k)(e.target.value)} />
              <span><strong>{l}</strong><input type="text" value={d[k] || ''} onChange={(e) => set(k)(e.target.value)} /></span>
            </label>
          ))}
        </div>
      </div>

      <div className="card form-grid">
        <h2 className="wide">Show identity</h2>
        <Field label="Show title"><Text value={d.show_title} onChange={set('show_title')} /></Field>
        <Field label="Presenter"><Text value={d.presenter} onChange={set('presenter')} /></Field>
        <Field label="Tagline" wide><Text value={d.tagline} onChange={set('tagline')} /></Field>
        <Field label="QR prompt (idle screen)" wide><Text value={d.join_prompt} onChange={set('join_prompt')} /></Field>
        <Field label="Public URL para sa QR" hint="Iwanang blangko para gamitin ang kasalukuyang domain. Lagay ang final Vercel o custom domain kapag mayroon na." wide>
          <Text value={d.public_url} onChange={set('public_url')} placeholder="https://adayina.vercel.app" />
        </Field>
      </div>
    </div>
  );
}

/* ---------- PROGRAM ---------- */

function ProgramTab({ settings, onSaved, notify }) {
  const [d, set, , dirty] = useDraft(settings);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const { data } = await adminPost('/api/admin/settings', { upsert: d });
      onSaved(data?.[0] || d);
      notify('Saved.');
    } catch (e) { notify(e.message, true); } finally { setBusy(false); }
  }

  return (
    <div className="adm-section">
      <div className="adm-head">
        <h1>Program</h1>
        <button type="button" className="btn btn-accent" onClick={save} disabled={!dirty || busy}>{busy ? 'Saving…' : 'Save'}</button>
      </div>
      <div className="card form-grid">
        <Field label="Schedule"><Text value={d.schedule} onChange={set('schedule')} /></Field>
        <Field label="Venue"><Text value={d.venue} onChange={set('venue')} /></Field>
        <Field label="Synopsis (spoiler-free)" wide><Area rows={5} value={d.synopsis} onChange={set('synopsis')} /></Field>
        <Field label="Trigger warning (shown on the phone program)" wide><Area rows={3} value={d.advisory} onChange={set('advisory')} /></Field>
        <Field label="Credits" hint="Isang linya bawat credit." wide><Area rows={10} value={d.credits} onChange={set('credits')} /></Field>
        <Field label="Socials / links" wide><Area rows={3} value={d.socials} onChange={set('socials')} /></Field>
        <Field label="Helpline note (post-show)" wide><Area rows={6} value={d.helpline} onChange={set('helpline')} /></Field>
      </div>
    </div>
  );
}

/* ---------- CAST ---------- */

function CastTab({ notify }) {
  const [rows, setRows] = useState(null);

  const load = useCallback(async () => {
    const { data } = await getSupabase().from('cast_members').select('*').order('sort');
    setRows(data || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function add() {
    const sort = (rows?.at(-1)?.sort || 0) + 10;
    try {
      await adminPost('/api/admin/cast_members', { upsert: { sort, character_name: 'Bagong INA' } });
      load();
    } catch (e) { notify(e.message, true); }
  }

  if (!rows) return <div className="loader" />;

  return (
    <div className="adm-section">
      <div className="adm-head">
        <h1>Cast</h1>
        <button type="button" className="btn btn-outline" onClick={add}>+ Add</button>
      </div>
      <p className="muted">Ang <strong>Character name</strong> ang ginagamit para i-match ang photo sa vote options (hal. &quot;Andy&quot; = &quot;ANDY&quot;).</p>
      <div className="cast-admin">
        {rows.map((r) => <CastRow key={r.id} row={r} notify={notify} onChange={load} />)}
      </div>
    </div>
  );
}

function CastRow({ row, notify, onChange }) {
  const [d, set, , dirty] = useDraft(row);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try { await adminPost('/api/admin/cast_members', { upsert: d }); notify('Saved.'); onChange(); }
    catch (e) { notify(e.message, true); } finally { setBusy(false); }
  }
  async function del() {
    if (!confirm(`Burahin si ${row.character_name}?`)) return;
    try { await adminPost('/api/admin/cast_members', { delete: [row.id] }); onChange(); }
    catch (e) { notify(e.message, true); }
  }

  return (
    <div className="card cast-row">
      <ImageField label="Photo" kind="cast" round value={d.photo_url} onChange={set('photo_url')} notify={notify} />
      <div className="form-grid">
        <Field label="Character name"><Text value={d.character_name} onChange={set('character_name')} /></Field>
        <Field label="Display name"><Text value={d.display_name} onChange={set('display_name')} /></Field>
        <Field label="Role / label" wide><Text value={d.role_label} onChange={set('role_label')} /></Field>
        <Field label="Actor"><Text value={d.actor_name} onChange={set('actor_name')} /></Field>
        <Field label="Order"><input type="number" value={d.sort ?? 0} onChange={(e) => set('sort')(Number(e.target.value))} /></Field>
        <Field label="Bio (spoiler-free)" wide><Area rows={2} value={d.bio} onChange={set('bio')} /></Field>
        <div className="row-actions wide">
          <button type="button" className="btn btn-text danger" onClick={del}>Delete</button>
          <button type="button" className="btn btn-accent" onClick={save} disabled={!dirty || busy}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- CUES ---------- */

const SCREEN_MODES = [
  ['idle', 'Idle: logo + big QR'],
  ['live', 'Live: LIVE badge, counter, lower third (title/subtitle)'],
  ['title', 'Title card: logo + title + subtitle + body'],
  ['vote', 'Vote: bars, QR, optional chat'],
  ['drumroll', 'Drumroll: title with animated dots'],
  ['result', 'Result: big title (ends with ":" and no body = blank cursor)'],
  ['news', 'Breaking news: headline, kicker, ticker (body)'],
  ['chat', 'Chat feed: scripted lines'],
  ['glitch', 'Glitch / hacked (dark)'],
  ['message', 'Message: typewriter text (dark)'],
  ['sms', 'SMS on a phone (dark): title = sender, body = text'],
  ['black', 'Black'],
  ['curtain', 'Curtain call: credits + helpline'],
];

const PHONE_MODES = [
  ['program', 'Program (bright)'],
  ['standby', 'Standby (dim, may program button)'],
  ['vote', 'Vote'],
  ['flowers', 'Send flowers'],
  ['dark', 'Dark (blackout)'],
  ['glitch', 'Glitch (dark)'],
  ['message', 'Message (dark)'],
  ['thanks', 'Thank you + program + helpline'],
];

const BLANK_CUE = {
  label: 'Bagong cue', note: '', screen_mode: 'live', phone_mode: 'standby', title: '', subtitle: '', body: '', caption: '',
  phone_title: '', phone_body: '', options: [], round_key: '', vote_open: false, show_bars: false, show_qr: false,
  show_live: true, counter_target: null, flowers: false, reactions: false, timer_seconds: null, chat_lines: [], chat_interval_ms: 2500, chat_loop: false,
};

function CuesTab({ notify }) {
  const [cues, setCues] = useState(null);
  const [sel, setSel] = useState(null);

  const load = useCallback(async () => {
    const { data } = await getSupabase().from('cues').select('*').order('sort');
    setCues(data || []);
    return data || [];
  }, []);
  useEffect(() => { load(); }, [load]);

  const current = cues?.find((c) => c.id === sel) || null;

  async function add(after) {
    const list = cues || [];
    const i = after ? list.findIndex((c) => c.id === after.id) : list.length - 1;
    const a = list[i]?.sort ?? 0;
    const b = list[i + 1]?.sort ?? a + 20;
    const sort = Math.floor((a + b) / 2) === a ? a + 1 : Math.floor((a + b) / 2);
    const base = after ? { ...after, id: undefined, label: `${after.label} (copy)` } : BLANK_CUE;
    const { id: _drop, created_at: _c, ...rest } = base;
    try {
      const { data } = await adminPost('/api/admin/cues', { upsert: { ...rest, sort } });
      await renumberIfTight(await load());
      if (data?.[0]) setSel(data[0].id);
    } catch (e) { notify(e.message, true); }
  }

  async function renumberIfTight(list) {
    const tight = list.some((c, i) => i > 0 && c.sort - list[i - 1].sort < 1);
    if (!tight) return;
    const rows = list.map((c, i) => ({ ...c, sort: (i + 1) * 10 }));
    await adminPost('/api/admin/cues', { upsert: rows });
    load();
  }

  async function move(c, dir) {
    const i = cues.findIndex((x) => x.id === c.id);
    const j = i + dir;
    if (j < 0 || j >= cues.length) return;
    const list = [...cues];
    [list[i], list[j]] = [list[j], list[i]];
    const rows = list.map((x, k) => ({ ...x, sort: (k + 1) * 10 }));
    setCues(rows);
    try { await adminPost('/api/admin/cues', { upsert: rows }); } catch (e) { notify(e.message, true); load(); }
  }

  async function del(c) {
    if (!confirm(`Burahin ang cue "${c.label}"?`)) return;
    try { await adminPost('/api/admin/cues', { delete: [c.id] }); setSel(null); load(); }
    catch (e) { notify(e.message, true); }
  }

  if (!cues) return <div className="loader" />;

  return (
    <div className="adm-section">
      <div className="adm-head">
        <h1>Cues</h1>
        <button type="button" className="btn btn-outline" onClick={() => add(null)}>+ Add cue</button>
      </div>
      <div className={`cue-admin ${current ? 'editing' : ''}`}>
        <ol className="cue-admin-list">
          {cues.map((c, i) => (
            <li key={c.id} className={sel === c.id ? 'on' : ''}>
              <button type="button" className="cue-pick" onClick={() => setSel(c.id)}>
                <span className="cue-n">{i + 1}</span>
                <span><strong>{c.label}</strong><small>{c.screen_mode} · {c.phone_mode}{c.vote_open ? ' · vote' : ''}{c.reactions ? ' · reactions' : ''}</small></span>
              </button>
              <span className="cue-ord">
                <button type="button" onClick={() => move(c, -1)} aria-label="Move up" disabled={i === 0}>▲</button>
                <button type="button" onClick={() => move(c, 1)} aria-label="Move down" disabled={i === cues.length - 1}>▼</button>
              </span>
            </li>
          ))}
        </ol>
        {current ? (
          <CueEditor
            key={current.id}
            cue={current}
            notify={notify}
            onSaved={load}
            onClose={() => setSel(null)}
            onDuplicate={() => add(current)}
            onDelete={() => del(current)}
          />
        ) : (
          <div className="card muted cue-empty">Pumili ng cue para i-edit.</div>
        )}
      </div>
    </div>
  );
}

const lines = (v) => (v || []).join('\n');
const toLines = (s) => s.split('\n').map((x) => x.trim()).filter(Boolean);
const numOrNull = (v) => (v === '' || v == null ? null : Number(v));

function CueEditor({ cue, notify, onSaved, onClose, onDuplicate, onDelete }) {
  const [d, set, , dirty] = useDraft(cue);
  const [busy, setBusy] = useState(false);
  const [optText, setOptText] = useState(lines(cue.options));
  const [chatText, setChatText] = useState(lines(cue.chat_lines));

  const changed = dirty || optText !== lines(cue.options) || chatText !== lines(cue.chat_lines);

  async function save() {
    setBusy(true);
    try {
      const row = {
        ...d,
        options: toLines(optText),
        chat_lines: toLines(chatText),
        round_key: (d.round_key || '').trim() || null,
        counter_target: numOrNull(d.counter_target),
        timer_seconds: numOrNull(d.timer_seconds),
        chat_interval_ms: Number(d.chat_interval_ms) || 2500,
      };
      await adminPost('/api/admin/cues', { upsert: row });
      notify('Cue saved. Live agad kung ito ang current cue.');
      onSaved();
    } catch (e) { notify(e.message, true); } finally { setBusy(false); }
  }

  return (
    <div className="card cue-editor">
      <div className="cue-editor-head">
        <button type="button" className="btn btn-text btn-sm back-btn" onClick={onClose}>◀ Cues</button>
        <div className="spacer" />
        <button type="button" className="btn btn-text btn-sm" onClick={onDuplicate}>Duplicate</button>
        <button type="button" className="btn btn-text btn-sm danger" onClick={onDelete}>Delete</button>
        <button type="button" className="btn btn-accent" onClick={save} disabled={!changed || busy}>{busy ? 'Saving…' : 'Save'}</button>
      </div>

      <div className="form-grid">
        <Field label="Cue label"><Text value={d.label} onChange={set('label')} /></Field>
        <Field label="Script note (para sa SM)"><Text value={d.note} onChange={set('note')} /></Field>

        <h3 className="wide">Projector</h3>
        <Field label="Screen mode" wide>
          <select value={d.screen_mode} onChange={(e) => set('screen_mode')(e.target.value)}>
            {SCREEN_MODES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
        <Field label="Title"><Text value={d.title} onChange={set('title')} /></Field>
        <Field label="Subtitle"><Text value={d.subtitle} onChange={set('subtitle')} /></Field>
        <Field label="Body" wide><Area rows={3} value={d.body} onChange={set('body')} /></Field>
        <Field label="Caption (bottom bar)" wide><Text value={d.caption} onChange={set('caption')} /></Field>
        <div className="checks wide">
          <Check label="LIVE badge + viewer counter" checked={d.show_live} onChange={set('show_live')} />
          <Check label="Show QR" checked={d.show_qr} onChange={set('show_qr')} />
          <Check label="Flowers (screen + phones)" checked={d.flowers} onChange={set('flowers')} />
          <Check label="Audience reactions (love, haha, wow, sad)" checked={d.reactions} onChange={set('reactions')} />
        </div>
        <Field label="Viewer counter target" hint="Blangko = dahan-dahang tumataas. Hal. 525600 sa reveal.">
          <input type="number" value={d.counter_target ?? ''} onChange={(e) => set('counter_target')(e.target.value)} />
        </Field>
        <Field label="Countdown (seconds)" hint="Optional, para sa vote screen.">
          <input type="number" value={d.timer_seconds ?? ''} onChange={(e) => set('timer_seconds')(e.target.value)} />
        </Field>

        <h3 className="wide">Phones</h3>
        <Field label="Phone mode" wide>
          <select value={d.phone_mode} onChange={(e) => set('phone_mode')(e.target.value)}>
            {PHONE_MODES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
        <Field label="Phone title"><Text value={d.phone_title} onChange={set('phone_title')} /></Field>
        <Field label="Phone text"><Text value={d.phone_body} onChange={set('phone_body')} /></Field>

        <h3 className="wide">Voting</h3>
        <Field label="Round key" hint="Parehong key = parehong botohan (hal. round1, final).">
          <Text value={d.round_key} onChange={set('round_key')} />
        </Field>
        <div className="checks">
          <Check label="Voting OPEN on this cue" checked={d.vote_open} onChange={set('vote_open')} />
          <Check label="Show vote bars" checked={d.show_bars} onChange={set('show_bars')} />
        </div>
        <Field label="Options (isa bawat linya)" wide><Area rows={5} value={optText} onChange={setOptText} /></Field>

        <h3 className="wide">Scripted chat</h3>
        <Field label="Chat lines" hint='Isa bawat linya. "name|message" para sa specific na username.' wide>
          <Area rows={5} value={chatText} onChange={setChatText} />
        </Field>
        <Field label="Interval (ms)"><input type="number" value={d.chat_interval_ms ?? 2500} onChange={(e) => set('chat_interval_ms')(e.target.value)} /></Field>
        <div className="checks"><Check label="Loop / flood" checked={d.chat_loop} onChange={set('chat_loop')} /></div>
      </div>
    </div>
  );
}

/* ---------- SHOWS ---------- */

function ShowsTab({ notify }) {
  const [perfs, setPerfs] = useState(null);
  const [state, setState] = useState(null);
  const [rounds, setRounds] = useState([]);
  const [cast, setCast] = useState([]);
  const [view, setView] = useState(null);

  const load = useCallback(async () => {
    const sb = getSupabase();
    const [p, s, c, k] = await Promise.all([
      sb.from('performances').select('*').order('sort'),
      sb.from('show_state').select('*').eq('id', 1).maybeSingle(),
      sb.from('cues').select('round_key, options, sort').order('sort'),
      sb.from('cast_members').select('*').order('sort'),
    ]);
    setPerfs(p.data || []);
    setState(s.data);
    setCast(k.data || []);
    const map = new Map();
    for (const q of c.data || []) if (q.round_key && q.options?.length && !map.has(q.round_key)) map.set(q.round_key, q.options);
    setRounds([...map.entries()]);
    setView((v) => v || s.data?.performance_id || p.data?.[0]?.id || null);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function setActive(id) {
    try { await adminPost('/api/admin/state', { performance_id: id }); notify('Active show updated.'); load(); }
    catch (e) { notify(e.message, true); }
  }
  async function reset(p) {
    if (!confirm(`I-reset ang LAHAT ng boto at flowers ng "${p.label}"? Hindi na ito maibabalik.`)) return;
    try { await adminPost('/api/admin/reset', { performance_id: p.id }); notify('Votes cleared.'); load(); }
    catch (e) { notify(e.message, true); }
  }
  async function save(p) {
    try { await adminPost('/api/admin/performances', { upsert: p }); notify('Saved.'); load(); }
    catch (e) { notify(e.message, true); }
  }
  async function remove(p) {
    if (!confirm(`Burahin ang "${p.label}" pati mga boto nito?`)) return;
    try { await adminPost('/api/admin/performances', { delete: [p.id] }); load(); }
    catch (e) { notify(e.message, true); }
  }
  async function add() {
    const sort = (perfs?.at(-1)?.sort || 0) + 10;
    try { await adminPost('/api/admin/performances', { upsert: { sort, label: 'Bagong show', is_test: false } }); load(); }
    catch (e) { notify(e.message, true); }
  }

  if (!perfs) return <div className="loader" />;

  return (
    <div className="adm-section">
      <div className="adm-head">
        <h1>Shows &amp; Votes</h1>
        <button type="button" className="btn btn-outline" onClick={add}>+ Add show</button>
      </div>
      <p className="muted">Ang <strong>active</strong> na show ang tumatanggap ng boto. Hiwalay ang boto ng bawat show. Gamitin ang Rehearsal/Test sa tech, tapos i-reset bago mag-house open.</p>

      <div className="perf-list">
        {perfs.map((p) => (
          <PerfRow
            key={p.id} perf={p} active={state?.performance_id === p.id} viewing={view === p.id}
            onView={() => setView(p.id)} onActive={() => setActive(p.id)} onReset={() => reset(p)}
            onSave={save} onDelete={() => remove(p)}
          />
        ))}
      </div>

      {view && (
        <div className="card">
          <h2>Results · {perfs.find((p) => p.id === view)?.label}</h2>
          {rounds.length === 0 && <p className="muted">Walang voting rounds sa cues.</p>}
          <div className="results-grid">
            {rounds.map(([key, options]) => <RoundResult key={key} perf={view} roundKey={key} options={options} cast={cast} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function PerfRow({ perf, active, viewing, onView, onActive, onReset, onSave, onDelete }) {
  const [d, set, , dirty] = useDraft(perf);
  return (
    <div className={`card perf-row ${active ? 'active' : ''}`}>
      <div className="perf-fields">
        <input type="text" value={d.label} onChange={(e) => set('label')(e.target.value)} aria-label="Show label" />
        <Check label="Test" checked={d.is_test} onChange={set('is_test')} />
        {dirty && <button type="button" className="btn btn-accent btn-sm" onClick={() => onSave(d)}>Save</button>}
      </div>
      <div className="perf-actions">
        {active ? <span className="chip hot">ACTIVE</span> : <button type="button" className="btn btn-outline btn-sm" onClick={onActive}>Set active</button>}
        <button type="button" className={`btn btn-sm ${viewing ? 'btn-accent' : 'btn-text'}`} onClick={onView}>Results</button>
        <button type="button" className="btn btn-text btn-sm" onClick={onReset}>Reset votes</button>
        <button type="button" className="btn btn-text btn-sm danger" onClick={onDelete}>Delete</button>
      </div>
    </div>
  );
}

function RoundResult({ perf, roundKey, options, cast }) {
  const tally = useTally(perf, roundKey, false);
  const total = options.reduce((s, o) => s + (tally[o] || 0), 0);
  return (
    <div className="round-result">
      <div className="panel-head"><strong>{roundKey}</strong><span>{total} votes</span></div>
      <VoteBars options={options} tally={tally} cast={cast} compact />
    </div>
  );
}
