import { createHmac, timingSafeEqual } from 'node:crypto';
const secret = () => process.env.GROWTH_UNSUBSCRIBE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const b64 = (value: string) => Buffer.from(value).toString('base64url');
export function createUnsubscribeToken(organizationId: string, leadId: string, now = Date.now()) {
  const key = secret();
  if (!key) throw new Error('Unsubscribe signing secret is not configured.');
  const payload = b64(JSON.stringify({ o: organizationId, l: leadId, e: Math.floor(now / 1000) + 180 * 86400 }));
  const signature = createHmac('sha256', key).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}
export function verifyUnsubscribeToken(token: string) {
  const [payload, signature, extra] = String(token || '').split('.');
  if (!payload || !signature || extra) return null;
  const key = secret();
  if (!key) return null;
  try {
    const expected = createHmac('sha256', key).update(payload).digest();
    const actual = Buffer.from(signature, 'base64url');
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
    const value = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!value.o || !value.l || !Number.isInteger(value.e) || value.e < Math.floor(Date.now() / 1000)) return null;
    return { organizationId: String(value.o), leadId: String(value.l) };
  } catch { return null; }
}
