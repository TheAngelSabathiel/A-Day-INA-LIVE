import { COOKIE, json, tokenFor } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  const pin = process.env.ADMIN_PIN;
  if (!pin) return json({ error: 'ADMIN_PIN is not set in the environment.' }, 500);
  const body = await req.json().catch(() => ({}));
  if (String(body.pin ?? '') !== pin) {
    await new Promise((r) => setTimeout(r, 600));
    return json({ error: 'Maling PIN.' }, 401);
  }
  const res = json({ ok: true });
  res.cookies.set(COOKIE, tokenFor(pin), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 14,
  });
  return res;
}
