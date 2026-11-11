import { guard, json } from '@/lib/auth';
import { getAdminClient } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

const MAX = 4 * 1024 * 1024;

export async function POST(req) {
  const denied = await guard();
  if (denied) return denied;
  const sb = getAdminClient();
  if (!sb) return json({ error: 'SUPABASE_SECRET_KEY is not set.' }, 500);

  const form = await req.formData();
  const file = form.get('file');
  const kind = String(form.get('kind') || 'asset').replace(/[^a-z0-9-]/gi, '') || 'asset';
  if (!file || typeof file === 'string') return json({ error: 'No file' }, 400);
  if (file.size > MAX) return json({ error: 'Max 4MB. Paki-compress ang image.' }, 413);
  if (!/^image\//.test(file.type)) return json({ error: 'Images only (PNG, JPG, SVG, WEBP).' }, 415);

  const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
  const path = `${kind}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());

  const { error } = await sb.storage.from('brand').upload(path, buf, {
    contentType: file.type,
    cacheControl: '31536000',
    upsert: false,
  });
  if (error) return json({ error: error.message }, 400);

  const { data } = sb.storage.from('brand').getPublicUrl(path);
  return json({ url: data.publicUrl });
}
