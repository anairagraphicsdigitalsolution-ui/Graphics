import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { enforceGrowthRateLimit } from '@/lib/growth-rate-limit';
export const runtime = 'nodejs';
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const clean = (value: unknown, max = 500) => String(value || '').trim().slice(0, max);
function allowedOrigin(origin: string, website: any) {
  try {
    const host = new URL(origin).hostname.toLowerCase();
    const candidates = [website.domain, website.website_url].filter(Boolean).flatMap((v: string) => { try { return [new URL(v.includes('://') ? v : `https://${v}`).hostname.toLowerCase()]; } catch { return [String(v).toLowerCase().replace(/^www\./, '')]; } });
    return candidates.some((base: string) => host === base || host === `www.${base}` || host.endsWith(`.${base}`));
  } catch { return false; }
}
function cors(origin: string) { return { 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin', 'Cache-Control': 'no-store' }; }
export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: 'Tracking is not configured.' }, { status: 503 });
  try {
    const raw = await req.text(); if (raw.length > 12000) return NextResponse.json({ error: 'Event payload is too large.' }, { status: 413 });
    const body = JSON.parse(raw);
    const publicKey = clean(body.publicKey, 100), websiteId = clean(body.websiteId, 80), eventId = clean(body.eventId, 100);
    const eventName = clean(body.eventName, 30);
    if (!/^agw_[a-f0-9]{64}$/.test(publicKey) || !/^[0-9a-f-]{36}$/i.test(websiteId) || !/^[a-zA-Z0-9_-]{8,100}$/.test(eventId) || !['page_view','form_start','form_submit','chat_open','conversion'].includes(eventName)) return NextResponse.json({ error: 'Invalid tracking event.' }, { status: 400 });
    const db = createClient(url, key, { auth: { persistSession: false } });
    const { data: tracker } = await db.from('growth_website_tracking_keys').select('organization_id,website_id').eq('website_id', websiteId).eq('key_hash', sha256(publicKey)).eq('is_active', true).maybeSingle();
    if (!tracker) return NextResponse.json({ error: 'Tracking key is invalid or revoked.' }, { status: 403 });
    const { data: website } = await db.from('growth_websites').select('domain,website_url,verification_status').eq('id', websiteId).eq('organization_id', tracker.organization_id).maybeSingle();
    const origin = req.headers.get('origin') || '';
    if (!website || website.verification_status !== 'verified' || !origin || !allowedOrigin(origin, website)) return NextResponse.json({ error: 'Origin is not authorized for this website.' }, { status: 403 });
    const rate = await enforceGrowthRateLimit(db, req, `website-event-${websiteId}`, 120, 60);
    if (!rate.allowed) return NextResponse.json({ error: 'Website event rate limit exceeded.' }, { status: 429, headers: cors(origin) });
    const attribution = body.attribution && typeof body.attribution === 'object' ? body.attribution : {};
    const eventData = body.eventData && typeof body.eventData === 'object' ? body.eventData : {};
    const { error } = await db.from('growth_website_events').upsert({
      organization_id: tracker.organization_id, website_id: websiteId, event_id: eventId,
      visitor_id: clean(body.visitorId, 100) || 'unknown', session_id: clean(body.sessionId, 100) || 'unknown', event_name: eventName,
      page_url: clean(body.pageUrl, 1000), referrer: clean(body.referrer, 1000),
      utm_source: clean(attribution.utm_source, 160) || null, utm_medium: clean(attribution.utm_medium, 160) || null,
      utm_campaign: clean(attribution.utm_campaign, 160) || null, utm_term: clean(attribution.utm_term, 160) || null, utm_content: clean(attribution.utm_content, 160) || null,
      gclid: clean(attribution.gclid, 500) || null, gbraid: clean(attribution.gbraid, 500) || null, wbraid: clean(attribution.wbraid, 500) || null,
      event_data: { form_key: clean(eventData.form_key, 100), campaign_id: clean(eventData.campaign_id, 100) }, occurred_at: new Date().toISOString(),
    }, { onConflict: 'website_id,event_id', ignoreDuplicates: true });
    if (error) return NextResponse.json({ error: 'Event could not be stored.' }, { status: 500, headers: cors(origin) });
    return NextResponse.json({ accepted: true }, { headers: cors(origin) });
  } catch { return NextResponse.json({ error: 'Invalid event payload.' }, { status: 400 }); }
}
