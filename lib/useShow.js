'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabase } from './supabase';

const POLL_MS = 6000;

/**
 * Live show data: settings, cast, show_state and the current cue.
 * Realtime first, with a polling fallback for weak venue signal.
 */
export function useShow({ allCues = false } = {}) {
  const sb = getSupabase();
  const [settings, setSettings] = useState(null);
  const [cast, setCast] = useState([]);
  const [state, setState] = useState(null);
  const [cues, setCues] = useState([]);
  const [cue, setCue] = useState(null);
  const [status, setStatus] = useState(sb ? 'loading' : 'unconfigured');
  const [online, setOnline] = useState(true);

  const stateRef = useRef(null);
  const cuesRef = useRef([]);

  const fetchCue = useCallback(async (id) => {
    if (!sb) return;
    if (!id) { setCue(null); return; }
    if (allCues) {
      const hit = cuesRef.current.find((c) => c.id === id);
      if (hit) { setCue(hit); return; }
    }
    const { data } = await sb.from('cues').select('*').eq('id', id).maybeSingle();
    if (stateRef.current?.current_cue_id === id) setCue(data || null);
  }, [sb, allCues]);

  const applyState = useCallback((next) => {
    if (!next) return;
    const prev = stateRef.current;
    if (prev && prev.updated_at === next.updated_at) return;
    stateRef.current = next;
    setState(next);
    if (!prev || prev.current_cue_id !== next.current_cue_id || prev.cue_started_at !== next.cue_started_at) {
      fetchCue(next.current_cue_id);
    }
  }, [fetchCue]);

  const reloadCues = useCallback(async () => {
    if (!sb) return;
    const { data } = await sb.from('cues').select('*').order('sort');
    if (!data) return;
    cuesRef.current = data;
    setCues(data);
    const cur = stateRef.current?.current_cue_id;
    if (cur) setCue(data.find((c) => c.id === cur) || null);
  }, [sb]);

  const reloadCast = useCallback(async () => {
    if (!sb) return;
    const { data } = await sb.from('cast_members').select('*').order('sort');
    if (data) setCast(data);
  }, [sb]);

  const refreshState = useCallback(async () => {
    if (!sb) return;
    const { data, error } = await sb.from('show_state').select('*').eq('id', 1).maybeSingle();
    setOnline(!error);
    if (data) applyState(data);
  }, [sb, applyState]);

  useEffect(() => {
    if (!sb) return;
    let alive = true;

    (async () => {
      const [s, c, st, cl] = await Promise.all([
        sb.from('settings').select('*').eq('id', 1).maybeSingle(),
        sb.from('cast_members').select('*').order('sort'),
        sb.from('show_state').select('*').eq('id', 1).maybeSingle(),
        allCues ? sb.from('cues').select('*').order('sort') : Promise.resolve({ data: null }),
      ]);
      if (!alive) return;
      if (s.error || st.error) { setStatus('error'); return; }
      setSettings(s.data || {});
      setCast(c.data || []);
      if (cl.data) { cuesRef.current = cl.data; setCues(cl.data); }
      applyState(st.data);
      setStatus('ready');
    })();

    const channel = sb
      .channel('show-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'show_state' }, (p) => applyState(p.new))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, (p) => { if (p.new?.id) setSettings(p.new); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cast_members' }, () => reloadCast())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cues' }, (p) => {
        if (allCues) { reloadCues(); return; }
        if (p.new?.id && p.new.id === stateRef.current?.current_cue_id) setCue(p.new);
      })
      .subscribe((s) => {
        // Realtime can drop on weak signal; polling keeps the show in sync,
        // so only a failed poll marks the device offline.
        if (s === 'SUBSCRIBED') refreshState();
      });

    const poll = setInterval(refreshState, POLL_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') refreshState(); };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      alive = false;
      clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
      sb.removeChannel(channel);
    };
  }, [sb, allCues, applyState, reloadCast, reloadCues, refreshState]);

  return { settings, setSettings, cast, state, cue, cues, status, online, applyState, reloadCues, reloadCast };
}

/** Vote tally for one round. Polls fast while voting is live. */
export function useTally(performanceId, roundKey, live) {
  const [tally, setTally] = useState({});
  useEffect(() => {
    const sb = getSupabase();
    if (!sb || !performanceId || !roundKey) { setTally({}); return; }
    let alive = true;
    const load = async () => {
      const { data } = await sb.rpc('get_tally', { p_performance: performanceId, p_round: roundKey });
      if (alive && data) setTally(Object.fromEntries(data.map((r) => [r.choice, Number(r.votes)])));
    };
    load();
    const t = setInterval(load, live ? 1000 : 5000);
    return () => { alive = false; clearInterval(t); };
  }, [performanceId, roundKey, live]);
  return tally;
}
