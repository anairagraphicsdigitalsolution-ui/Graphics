import { NextRequest } from 'next/server';
import {apiJson, growthContext, requireGrowthRole, requireGrowthFeature} from '@/lib/growth-server';
import { decryptSecret } from '@/lib/growth-crypto';

export const runtime = 'nodejs';

async function graphJson(url: URL) {
  const response = await fetch(url, { cache: 'no-store' });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error?.error_user_msg || body?.error?.message || `Meta Ads API returned ${response.status}.`);
  return body;
}

export async function GET(req: NextRequest) {
  const context = await growthContext(req);
  if ('response' in context) return context.response;
  const organizationId = req.nextUrl.searchParams.get('organizationId') || '';
  if (!await requireGrowthRole(context.db, context.userId, organizationId, ['owner', 'manager', 'editor', 'viewer'])) return apiJson({ error: 'Workspace permission denied.' }, 403);
 if(!await requireGrowthFeature(context.db,context.userId,organizationId,'ads'))return apiJson({error:'This module is not included in your workspace plan.'},402);
  const { data, error } = await context.db.from('growth_ads_insights').select('id,ad_account_id,period_start,period_end,metrics,source_status,synced_at,last_error').eq('organization_id', organizationId).order('synced_at', { ascending: false }).limit(50);
  if (error) return apiJson({ error: 'Ads reporting history unavailable. Apply the v6.54 migration.' }, 500);
  return apiJson({ snapshots: data || [] });
}

export async function POST(req: NextRequest) {
  const context = await growthContext(req);
  if ('response' in context) return context.response;
  try {
    const body = await req.json();
    const organizationId = String(body.organizationId || '');
    const accountId = String(body.socialAccountId || '');
    const adAccountId = String(body.adAccountId || '').trim();
    const days = Math.max(1, Math.min(30, Number(body.days) || 7));
    if (!/^act_?\d{5,30}$/.test(adAccountId)) return apiJson({ error: 'Enter a valid Meta Ad Account ID, for example act_1234567890.' }, 400);
    if (!await requireGrowthRole(context.db, context.userId, organizationId, ['owner', 'manager'])) return apiJson({ error: 'Workspace manager permission required.' }, 403);
 if(!await requireGrowthFeature(context.db,context.userId,organizationId,'ads'))return apiJson({error:'This module is not included in your workspace plan.'},402);
    const version = process.env.META_GRAPH_API_VERSION;
    if (!version) return apiJson({ error: 'META_GRAPH_API_VERSION is not configured.' }, 503);
    const { data: account, error: accountError } = await context.db.from('growth_social_accounts').select('id,platform,connection_status,encrypted_credentials,account_name').eq('id', accountId).eq('organization_id', organizationId).maybeSingle();
    if (accountError || !account || account.platform !== 'facebook' || account.connection_status !== 'connected') return apiJson({ error: 'Choose a connected Facebook Page account. Its token must have ads_read access.' }, 409);
    const credentials = decryptSecret(account.encrypted_credentials);
    if (!credentials?.access_token) return apiJson({ error: 'The connected Facebook account has no usable access token.' }, 409);
    const end = new Date();
    const start = new Date(Date.now() - (days - 1) * 86400000);
    const iso = (date: Date) => date.toISOString().slice(0, 10);
    const url = new URL(`https://graph.facebook.com/${version}/${adAccountId.replace(/^act_/, 'act_')}/insights`);
    url.searchParams.set('level', 'campaign');
    url.searchParams.set('fields', 'campaign_id,campaign_name,objective,impressions,reach,clicks,spend,cpc,ctr,actions,cost_per_action_type,date_start,date_stop');
    url.searchParams.set('time_increment', '1');
    url.searchParams.set('time_range', JSON.stringify({ since: iso(start), until: iso(end) }));
    url.searchParams.set('limit', '500');
    url.searchParams.set('access_token', credentials.access_token);
    const response = await graphJson(url);
    const rows = Array.isArray(response.data) ? response.data : [];
    const record = {
      organization_id: organizationId,
      platform: 'meta',
      ad_account_id: adAccountId,
      period_start: iso(start),
      period_end: iso(end),
      metrics: rows,
      source_status: 'synced',
      synced_at: new Date().toISOString(),
      last_error: null
    };
    const { data: saved, error: saveError } = await context.db.from('growth_ads_insights').upsert(record, { onConflict: 'organization_id,ad_account_id,period_start,period_end' }).select('id').single();
    if (saveError) return apiJson({ error: 'Meta Ads data fetched, but snapshot persistence failed. Check the v6.54 migration.' }, 500);
    return apiJson({ success: true, snapshotId: saved.id, adAccountId, period: { since: iso(start), until: iso(end), days }, campaignRows: rows.length, rows });
  } catch (error) {
    return apiJson({ error: error instanceof Error ? error.message : 'Meta Ads Insights sync failed.' }, 502);
  }
}
