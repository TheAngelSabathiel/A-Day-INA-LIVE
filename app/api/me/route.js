import { isAdmin, json } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!process.env.ADMIN_PIN) return json({ error: 'ADMIN_PIN is not set in the environment.' }, 500);
  if (!(await isAdmin())) return json({ error: 'Unauthorized' }, 401);
  return json({ ok: true });
}
