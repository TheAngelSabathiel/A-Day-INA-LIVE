import { guard, json } from '@/lib/auth';
import { getAdminClient } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

const COLUMNS = {
  settings: ['id', 'show_title', 'tagline', 'presenter', 'logo_url', 'sublogo_url', 'logo_mode', 'color_bg', 'color_surface',
    'color_accent', 'color_ink', 'schedule', 'venue', 'synopsis', 'advisory', 'credits', 'helpline', 'socials', 'public_url', 'join_prompt'],
  cast_members: ['id', 'sort', 'character_name', 'display_name', 'role_label', 'actor_name', 'bio', 'photo_url'],
  performances: ['id', 'sort', 'label', 'is_test'],
  cues: ['id', 'sort', 'label', 'note', 'screen_mode', 'phone_mode', 'title', 'subtitle', 'body', 'caption', 'phone_title', 'phone_body',
    'options', 'round_key', 'vote_open', 'show_bars', 'show_qr', 'show_live', 'counter_target', 'flowers', 'timer_seconds',
    'chat_lines', 'chat_interval_ms', 'chat_loop'],
};

function clean(table, row) {
  const out = {};
  for (const k of COLUMNS[table]) if (k in row) out[k] = row[k];
  if (table === 'settings') { out.id = 1; out.updated_at = new Date().toISOString(); }
  return out;
}

export async function POST(req, ctx) {
  const denied = await guard();
  if (denied) return denied;

  const { table } = await ctx.params;
  if (!COLUMNS[table]) return json({ error: 'Unknown table' }, 400);

  const sb = getAdminClient();
  if (!sb) return json({ error: 'SUPABASE_SECRET_KEY is not set.' }, 500);

  const body = await req.json().catch(() => ({}));

  if (Array.isArray(body.delete) && body.delete.length) {
    const { error } = await sb.from(table).delete().in('id', body.delete);
    if (error) return json({ error: error.message }, 400);
  }

  if (body.upsert) {
    const rows = (Array.isArray(body.upsert) ? body.upsert : [body.upsert]).map((r) => clean(table, r));
    const { data, error } = await sb.from(table).upsert(rows).select();
    if (error) return json({ error: error.message }, 400);
    return json({ data });
  }

  return json({ ok: true });
}
