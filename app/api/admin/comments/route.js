import { guard, json } from '@/lib/auth';
import { getAdminClient } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

// Hide or unhide one audience comment: { id, hidden }
export async function POST(req) {
  const denied = await guard();
  if (denied) return denied;
  const sb = getAdminClient();
  if (!sb) return json({ error: 'SUPABASE_SECRET_KEY is not set.' }, 500);

  const { id, hidden = true } = await req.json().catch(() => ({}));
  if (!id) return json({ error: 'id required' }, 400);
  const { error } = await sb.from('comments').update({ hidden: !!hidden }).eq('id', id);
  if (error) return json({ error: error.message }, 400);
  return json({ ok: true });
}
