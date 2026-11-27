import { guard, json } from '@/lib/auth';
import { getAdminClient } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

// Hide or unhide one audience comment: { id, hidden }
// Clear a show's comments (hide all, e.g. after a tech run): { performance_id, all: true }
export async function POST(req) {
  const denied = await guard();
  if (denied) return denied;
  const sb = getAdminClient();
  if (!sb) return json({ error: 'SUPABASE_SECRET_KEY is not set.' }, 500);

  const { id, hidden = true, performance_id, all } = await req.json().catch(() => ({}));
  if (all && performance_id) {
    const { error } = await sb.from('comments').update({ hidden: true }).eq('performance_id', performance_id).eq('hidden', false);
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  }
  if (!id) return json({ error: 'id required' }, 400);
  const { error } = await sb.from('comments').update({ hidden: !!hidden }).eq('id', id);
  if (error) return json({ error: error.message }, 400);
  return json({ ok: true });
}
