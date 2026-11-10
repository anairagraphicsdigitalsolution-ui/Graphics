import { NextRequest, NextResponse } from 'next/server';
import { verifyUnsubscribeToken } from '@/lib/growth-email-unsubscribe';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
const noStore = { 'Cache-Control': 'no-store, max-age=0', 'X-Content-Type-Options': 'nosniff' };
function database() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Database service is not configured.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
function page(token: string, message = 'Confirm that you want to stop receiving email from this workspace.') {
  const safeToken = token.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Email preferences</title><body style="font-family:system-ui;max-width:560px;margin:12vh auto;padding:24px;color:#17352b"><h1>Email preferences</h1><p>${message}</p><form method="post" action="/api/growth/email/unsubscribe"><input type="hidden" name="token" value="${safeToken}"><button style="padding:12px 18px;background:#174b38;color:white;border:0;border-radius:8px">Unsubscribe</button></form></body></html>`;
}
async function unsubscribe(token: string) {
  const identity = verifyUnsubscribeToken(token);
  if (!identity) return { error: 'This unsubscribe link is invalid or expired.', status: 400 as const };
  const db = database();
  const now = new Date().toISOString();
  const { data, error } = await db.from('growth_leads').update({
    consent_to_contact: false,
    contact_opted_out_at: now,
    contact_opt_out_source: 'email_one_click_unsubscribe',
    updated_at: now
  }).eq('id', identity.leadId).eq('organization_id', identity.organizationId)
    .select('id').maybeSingle();
  if (error) return { error: 'Unable to update email preferences. Please retry later.', status: 503 as const };
  if (!data) return { error: 'The contact could not be found.', status: 404 as const };
  await db.from('growth_lead_activities').insert({
    organization_id: identity.organizationId, lead_id: identity.leadId,
    activity_type: 'email', body: 'Contact unsubscribed using the email one-click unsubscribe link.',
    metadata: { source: 'email_one_click_unsubscribe' }
  });
  return { success: true, status: 200 as const };
}
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') || '';
  if (!verifyUnsubscribeToken(token)) return new NextResponse(page('', 'This unsubscribe link is invalid or expired.'), { status: 400, headers: { ...noStore, 'Content-Type': 'text/html; charset=utf-8' } });
  return new NextResponse(page(token), { headers: { ...noStore, 'Content-Type': 'text/html; charset=utf-8' } });
}
export async function POST(req: NextRequest) {
  let token = req.nextUrl.searchParams.get('token') || '';
  const contentType = req.headers.get('content-type') || '';
  try {
    if (contentType.includes('application/json')) token = String((await req.json()).token || '');
    else {
      const raw = await req.text();
      token = new URLSearchParams(raw).get('token') || '';
    }
  } catch { return NextResponse.json({ error: 'Invalid unsubscribe request.' }, { status: 400, headers: noStore }); }
  try {
    const result = await unsubscribe(token);
    return NextResponse.json(result, { status: result.status, headers: noStore });
  } catch {
    return NextResponse.json({ error: 'Unsubscribe service is temporarily unavailable.' }, { status: 503, headers: noStore });
  }
}
