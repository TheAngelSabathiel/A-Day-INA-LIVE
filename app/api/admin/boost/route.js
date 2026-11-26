import { guard, json } from '@/lib/auth';
import { getAdminClient } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

// Adds manual votes to a round. Accepts one boost or a list: { boosts: [{choice, amount}] }.
export async function POST(req) {
  const denied = await guard();
  if (denied) return denied;
  const sb = getAdminClient();
  if (!sb) return json({ error: 'SUPABASE_SECRET_KEY is not set.' }, 500);

  const body = await req.json().catch(() => ({}));
  const { performance_id, round_key } = body;
  if (!performance_id || !round_key) return json({ error: 'performance_id and round_key required' }, 400);
  const list = Array.isArray(body.boosts) ? body.boosts : [{ choice: body.choice, amount: body.amount }];
  const rows = list
    .filter((b) => b && typeof b.choice === 'string' && b.choice.trim())
    .map((b) => ({
      performance_id,
      round_key,
      choice: b.choice.trim(),
      amount: Math.max(1, Math.min(100, Math.round(Number(b.amount) || 1))),
    }));
  if (!rows.length) return json({ error: 'No votes to add' }, 400);

  const { error } = await sb.from('vote_boosts').insert(rows);
  if (error) return json({ error: error.message }, 400);
  return json({ ok: true, added: rows.reduce((s, r) => s + r.amount, 0) });
}
