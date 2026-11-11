import { COOKIE, json } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST() {
  const res = json({ ok: true });
  res.cookies.set(COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}
