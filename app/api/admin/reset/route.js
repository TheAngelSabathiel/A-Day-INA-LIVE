import { guard, json } from '@/lib/auth';
import { getAdminClient } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  const denied = await guard();
  if (denied) return denied;
  const sb = getAdminClient();
  if (!sb) return json({ error: 'SUPABASE_SECRET_KEY is not set.' }, 500);

  const { performance_id, round_key } = await req.json().catch(() => ({}));
  if (!performance_id) return json({ error: 'performance_id required' }, 400);

  let q = sb.from('votes').delete().eq('performance_id', performance_id);
  if (round_key) q = q.eq('round_key', round_key);
  const { error } = await q;
  if (error) return json({ error: error.message }, 400);

  let qb = sb.from('vote_boosts').delete().eq('performance_id', performance_id);
  if (round_key) qb = qb.eq('round_key', round_key);
  const { error: eb } = await qb;
  if (eb) return json({ error: eb.message }, 400);

  if (!round_key) {
    for (const t of ['reactions', 'comments']) {
      const { error: e2 } = await sb.from(t).delete().eq('performance_id', performance_id);
      if (e2) return json({ error: e2.message }, 400);
    }
  }
  return json({ ok: true });
}
