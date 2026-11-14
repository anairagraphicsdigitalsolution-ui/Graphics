import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
export const runtime = 'nodejs';
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, max-age=0', 'Pragma': 'no-cache' } });
function getDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
function validToken(token: string) { return /^[a-f0-9]{64}$/i.test(token); }

/** Public, bearer-token proposal view. Exposes only proposal contents, never customer PII. */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') || '';
  if (!validToken(token)) return json({ error: 'This proposal link is invalid.' }, 400);
  const db = getDb();
  if (!db) return json({ error: 'Proposal response service is not configured.' }, 503);
  const { data, error } = await db.from('growth_proposals')
    .select('reference_no,title,summary,line_items,currency,total_amount,valid_until,status,response_token_expires_at')
    .eq('response_token_hash', hashToken(token)).maybeSingle();
  if (error || !data) return json({ error: 'This proposal link is invalid or has already been used.' }, 404);
  if (data.status !== 'sent') return json({ error: 'This proposal is not awaiting a customer response.' }, 409);
  if (!data.response_token_expires_at || Date.parse(data.response_token_expires_at) <= Date.now()) return json({ error: 'This proposal response link has expired.' }, 410);
  return json({ proposal: { referenceNo: data.reference_no, title: data.title, summary: data.summary, lineItems: data.line_items, currency: data.currency, totalAmount: data.total_amount, validUntil: data.valid_until, expiresAt: data.response_token_expires_at } });
}

/** A one-time customer decision updates proposal + CRM deal in one database transaction. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = String(body?.token || ''), decision = String(body?.decision || '');
    if (!validToken(token) || !['accepted', 'rejected'].includes(decision)) return json({ error: 'A valid proposal token and decision are required.' }, 400);
    const db = getDb();
    if (!db) return json({ error: 'Proposal response service is not configured.' }, 503);
    const { data, error } = await db.rpc('growth_respond_to_proposal', { p_token_hash: hashToken(token), p_decision: decision });
    if (error) {
      const message = String(error.message || 'Proposal response could not be saved.');
      const status = /invalid|already been used|only a sent|decision|expired/i.test(message) ? 409 : 500;
      return json({ error: status === 409 ? message : 'Proposal response could not be saved.' }, status);
    }
    const result = Array.isArray(data) ? data[0] : data;
    if (!result) return json({ error: 'Proposal response returned no result.' }, 500);
    if (result.status === 'expired') return json({ error: 'This proposal has expired.', status: 'expired' }, 410);
    return json({ status: result.status, referenceNo: result.reference_no, title: result.title, totalAmount: result.total_amount, currency: result.currency, respondedAt: result.responded_at });
  } catch { return json({ error: 'Invalid proposal response.' }, 400); }
}
