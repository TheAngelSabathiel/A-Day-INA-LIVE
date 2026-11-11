import { guard, json } from '@/lib/auth';
import { getAdminClient } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  const denied = await guard();
  if (denied) return denied;
  const sb = getAdminClient();
  if (!sb) return json({ error: 'SUPABASE_SECRET_KEY is not set.' }, 500);

  const body = await req.json().catch(() => ({}));
  const now = new Date().toISOString();
  const patch = { updated_at: now };

  if ('current_cue_id' in body) { patch.current_cue_id = body.current_cue_id || null; patch.cue_started_at = now; }
  if ('performance_id' in body) patch.performance_id = body.performance_id || null;
  if ('override' in body) patch.override = body.override || null;
  if (typeof body.inject_text === 'string' && body.inject_text.trim()) {
    patch.inject_text = body.inject_text.trim().slice(0, 240);
    patch.inject_at = now;
  }

  const { data, error } = await sb.from('show_state').upsert({ id: 1, ...patch }).select().single();
  if (error) return json({ error: error.message }, 400);
  return json({ data });
}
