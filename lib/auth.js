import crypto from 'crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const COOKIE = 'adi_admin';

export function tokenFor(pin) {
  const secret = process.env.ADMIN_SECRET || `adi-${pin}`;
  return crypto.createHmac('sha256', secret).update(`admin:${pin}`).digest('hex');
}

export async function isAdmin() {
  const pin = process.env.ADMIN_PIN;
  if (!pin) return false;
  const jar = await cookies();
  const got = jar.get(COOKIE)?.value || '';
  const want = tokenFor(pin);
  if (got.length !== want.length) return false;
  return crypto.timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

export function json(data, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function guard() {
  if (!(await isAdmin())) return json({ error: 'Unauthorized' }, 401);
  return null;
}
