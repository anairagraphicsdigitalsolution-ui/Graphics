import { createHash, randomBytes } from 'node:crypto';
import { NextRequest } from 'next/server';
import { apiJson, growthContext, requireGrowthRole } from '@/lib/growth-server';

export const runtime = 'nodejs';
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const dayAgo = () => new Date(Date.now() - 30 * 86400000).toISOString();

export async function GET(req: NextRequest) {
  const ctx = await growthContext(req); if ('response' in ctx) return ctx.response;
  const organizationId = req.nextUrl.searchParams.get('organizationId') || '';
  const websiteId = req.nextUrl.searchParams.get('websiteId') || '';
  if (!await requireGrowthRole(ctx.db, ctx.userId, organizationId, ['owner', 'manager', 'editor', 'viewer', 'client'])) return apiJson({ error: 'Workspace access denied.' }, 403);
  const { data: website } = await ctx.db.from('growth_websites').select('id,name,domain,website_url,verification_status').eq('id', websiteId).eq('organization_id', organizationId).maybeSingle();
  if (!website) return apiJson({ error: 'Website not found.' }, 404);
  const [{ data: key }, { data: events, error: eventError }, { data: forms, error: formError }] = await Promise.all([
    ctx.db.from('growth_website_tracking_keys').select('key_prefix,is_active,created_at').eq('organization_id', organizationId).eq('website_id', websiteId).eq('is_active', true).maybeSingle(),
    ctx.db.from('growth_website_events').select('event_name,page_url,utm_source,utm_medium,utm_campaign,session_id,visitor_id,occurred_at').eq('organization_id', organizationId).eq('website_id', websiteId).gte('occurred_at', dayAgo()).order('occurred_at', { ascending: false }).limit(10000),
    ctx.db.from('growth_website_form_submissions').select('id,form_key,lead_id,consent_to_contact,created_at').eq('organization_id', organizationId).eq('website_id', websiteId).gte('created_at', dayAgo()).order('created_at', { ascending: false }).limit(2000),
  ]);
  if (eventError || formError) return apiJson({ error: 'Website analytics could not be loaded. Apply the Module 9 database migration.' }, 503);
  const rows = events || [];
  const count = (name: string) => rows.filter(row => row.event_name === name).length;
  const formStarts = count('form_start');
  const formSubmits = count('form_submit');
  const formAbandonments = Math.max(0, formStarts - formSubmits);
  const unique = (field: 'visitor_id' | 'session_id') => new Set(rows.map(row => row[field]).filter(Boolean)).size;
  const group = (field: 'page_url' | 'utm_source') => {
    const totals = new Map<string, number>();
    rows.filter(row => row.event_name === 'page_view').forEach(row => { const key = String(row[field] || (field === 'utm_source' ? 'direct / unknown' : '(not set)')); totals.set(key, (totals.get(key) || 0) + 1); });
    return [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, value]) => ({ name, value }));
  };
  return apiJson({ website, tracking: { active: Boolean(key), keyPrefix: key?.key_prefix || null, createdAt: key?.created_at || null }, analytics: {
    pageViews: count('page_view'), visitors: unique('visitor_id'), sessions: unique('session_id'), formStarts, formSubmits, formAbandonments, formAbandonmentRate: formStarts ? formAbandonments / formStarts : null, chatOpens: count('chat_open'), conversions: count('conversion'),
    formRecords: forms?.length || 0, consentedForms: (forms || []).filter(x => x.consent_to_contact).length,
    topPages: group('page_url'), topSources: group('utm_source'), dataCapped: rows.length >= 10000,
  }, forms: forms || [] });
}

export async function POST(req: NextRequest) {
  const ctx = await growthContext(req); if ('response' in ctx) return ctx.response;
  try {
    const body = await req.json();
    const organizationId = String(body.organizationId || '');
    const websiteId = String(body.websiteId || '');
    const action = String(body.action || '');
    if (!await requireGrowthRole(ctx.db, ctx.userId, organizationId, ['owner', 'manager'])) return apiJson({ error: 'Workspace owner or manager permission required.' }, 403);
    const { data: website } = await ctx.db.from('growth_websites').select('id,verification_status').eq('id', websiteId).eq('organization_id', organizationId).maybeSingle();
    if (!website) return apiJson({ error: 'Website not found.' }, 404);
    if (action === 'issue_key') {
      if (website.verification_status !== 'verified') return apiJson({ error: 'Verify DNS ownership before enabling public tracking.' }, 409);
      const publicKey = `agw_${randomBytes(32).toString('hex')}`;
      await ctx.db.from('growth_website_tracking_keys').update({ is_active: false, revoked_at: new Date().toISOString() }).eq('organization_id', organizationId).eq('website_id', websiteId).eq('is_active', true);
      const { error } = await ctx.db.from('growth_website_tracking_keys').insert({ organization_id: organizationId, website_id: websiteId, key_hash: sha256(publicKey), key_prefix: publicKey.slice(0, 12), created_by: ctx.userId });
      if (error) return apiJson({ error: 'Tracking key could not be issued.' }, 500);
      return apiJson({ success: true, publicKey, message: 'Copy this key now. It is shown once and cannot be recovered; rotate it if lost.' });
    }
    if (action === 'revoke_key') {
      const { error } = await ctx.db.from('growth_website_tracking_keys').update({ is_active: false, revoked_at: new Date().toISOString() }).eq('organization_id', organizationId).eq('website_id', websiteId).eq('is_active', true);
      if (error) return apiJson({ error: 'Tracking key could not be revoked.' }, 500);
      return apiJson({ success: true, message: 'Website tracking key revoked.' });
    }
    return apiJson({ error: 'Unsupported tracking-key action.' }, 400);
  } catch { return apiJson({ error: 'Invalid tracking-key request.' }, 400); }
}
