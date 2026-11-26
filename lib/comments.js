'use client';
import { useEffect, useRef, useState } from 'react';
import { getSupabase } from './supabase';
import { getStored, setStored } from './device';

const NAMES = [
  'mommy_lyn', 'tita_bebs', 'marites.ph', 'ina_ng_lahat', 'kuya_jun', 'momshie_kat', 'titoboy', 'beshy.ina',
  'lola_cora', 'juicyfan', 'mamshie.rose', 'batang90s', 'fur.mama', 'pinay_mom', 'ate.girl', 'tsismis.hub',
  'mothertucker', 'inaabangan', 'ninang_joy', 'tita_mars',
];

export function getHandle() {
  let h = getStored('adi_handle');
  if (!h) {
    h = `${NAMES[Math.floor(Math.random() * NAMES.length)]}${Math.floor(10 + Math.random() * 89)}`;
    setStored('adi_handle', h);
  }
  return h;
}

export function setHandle(h) {
  const clean = String(h || '').replace(/\s+/g, '_').replace(/[^\w.]/g, '').slice(0, 20);
  if (clean) setStored('adi_handle', clean);
  return clean || getHandle();
}

// Masks profanity and links. The show's own puns (artisTANG INA, borTANG INA, INA) are left alone.
const BAD = [
  'putangina', 'putang ina', 'puta', 'tangina mo', 'gago', 'gaga', 'tarantado', 'ulol', 'kupal', 'pakyu',
  'hindot', 'kantot', 'jakol', 'burat', 'tite', 'puke', 'fuck', 'shit', 'bitch', 'asshole', 'cunt', 'nigga', 'nigger',
];
const BAD_RE = new RegExp(`\\b(${BAD.map((w) => w.replace(/ /g, '\\s*')).join('|')})\\w*`, 'gi');
const LINK_RE = /\b(?:https?:\/\/|www\.)\S+|\b\S+\.(?:com|net|org|ph|xyz|io|ly)\b\S*/gi;

export function cleanText(text = '') {
  return String(text)
    .replace(LINK_RE, '•••')
    .replace(BAD_RE, (m) => m[0] + '*'.repeat(Math.max(2, m.length - 1)));
}

/** Highest vote-getter(s) for a tally. Ties are joined with " & ". */
export function topOf(tally = {}) {
  const entries = Object.entries(tally).filter(([, n]) => n > 0);
  if (!entries.length) return null;
  const max = Math.max(...entries.map(([, n]) => n));
  return entries.filter(([, n]) => n === max).map(([k]) => k).sort().join(' & ');
}

export function fillWinner(text, winner) {
  if (!text) return text;
  return text.replace(/\{winner\}/gi, winner || '…');
}

/**
 * Audience comments for the active show: realtime with a polling fallback.
 * onNew(comment) fires for each new visible comment; returns hidden ids so feeds can drop them.
 */
export function useAudienceComments(perfId, onNew, { enabled = true } = {}) {
  const lastId = useRef(0);
  const seen = useRef(new Set());
  const cb = useRef(onNew);
  cb.current = onNew;
  const [hidden, setHidden] = useState(() => new Set());

  useEffect(() => {
    const sb = getSupabase();
    if (!sb || !perfId || !enabled) return undefined;
    let alive = true;
    seen.current = new Set();

    const take = (c) => {
      if (!c || c.performance_id !== perfId) return;
      if (c.hidden) { setHidden((h) => new Set(h).add(c.id)); return; }
      if (seen.current.has(c.id)) return;
      seen.current.add(c.id);
      lastId.current = Math.max(lastId.current, c.id);
      cb.current?.(c);
    };

    // start from "now": only comments made from here on
    (async () => {
      const { data } = await sb.from('comments').select('id').eq('performance_id', perfId).order('id', { ascending: false }).limit(1);
      if (alive) lastId.current = data?.[0]?.id || 0;
    })();

    const ch = sb
      .channel('comments-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments' }, (p) => take(p.new))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'comments' }, (p) => {
        if (p.new?.hidden) setHidden((h) => new Set(h).add(p.new.id));
      })
      .subscribe();

    const poll = setInterval(async () => {
      const { data } = await sb.from('comments').select('*').eq('performance_id', perfId).gt('id', lastId.current).order('id').limit(40);
      (data || []).forEach(take);
    }, 4000);

    return () => { alive = false; clearInterval(poll); sb.removeChannel(ch); };
  }, [perfId, enabled]);

  return hidden;
}
