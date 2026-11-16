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
    let financialLedgerSynced = false;
    let financialSyncWarning: string | null = null;
    try {
      const accountUrl = new URL(`https://graph.facebook.com/${version}/${adAccountId}`);
      accountUrl.searchParams.set('fields', 'currency,name');
      accountUrl.searchParams.set('access_token', credentials.access_token);
      const accountInfo = await graphJson(accountUrl);
      const currency = String(accountInfo.currency || '').toUpperCase();
      if (!/^[A-Z]{3}$/.test(currency)) throw new Error('Meta Ad Account did not return a valid billing currency.');
      const financialRows = rows.map((row: any) => ({
        organization_id: organizationId, entry_type: 'spend', amount: Number(row.spend || 0), currency,
        channel: 'meta_ads', campaign_id: String(row.campaign_id || ''), campaign_name: String(row.campaign_name || ''),
        source: 'meta_ads', external_ref: `meta:${adAccountId}:${String(row.campaign_id || 'unknown')}:${String(row.date_start || '')}`,
        entry_date: String(row.date_start || ''), status: Number(row.spend || 0) > 0 ? 'posted' : 'void',
        notes: `Synced from Meta Ads account ${adAccountId}.`, metadata: { ad_account_id: adAccountId, account_name: accountInfo.name || null, period_end: row.date_stop || null, impressions: Number(row.impressions || 0), clicks: Number(row.clicks || 0) }
      })).filter((row: any) => /^\d{4}-\d{2}-\d{2}$/.test(row.entry_date) && row.external_ref.length > 20);
      const refs = financialRows.map((row: any) => row.external_ref);
      const { data: existingRows, error: existingError } = refs.length
        ? await context.db.from('growth_marketing_financial_entries').select('id,external_ref').eq('organization_id', organizationId).eq('source', 'meta_ads').eq('entry_type', 'spend').in('external_ref', refs)
        : { data: [], error: null };
      if (existingError) throw new Error('Could not inspect existing Meta spend ledger rows.');
      const existingByRef = new Map((existingRows || []).map((row: any) => [row.external_ref, row.id]));
      const inserts: any[] = [];
      for (const row of financialRows) {
        if (existingByRef.has(row.external_ref)) {
          const updatePayload: Record<string, unknown> = { currency: row.currency, channel: row.channel, campaign_id: row.campaign_id || null, campaign_name: row.campaign_name || null, entry_date: row.entry_date, status: Number(row.amount || 0) > 0 ? 'posted' : 'void', notes: row.notes, metadata: row.metadata, updated_at: new Date().toISOString() };
          if (Number(row.amount || 0) > 0) updatePayload.amount = Number(row.amount);
          const { error: updateError } = await context.db.from('growth_marketing_financial_entries').update(updatePayload).eq('id', existingByRef.get(row.external_ref)).eq('organization_id', organizationId);
          if (updateError) throw new Error('Could not refresh an existing Meta spend ledger row.');
        } else if (Number(row.amount || 0) > 0) inserts.push(row);
      }
      if (inserts.length) { const { error: insertError } = await context.db.from('growth_marketing_financial_entries').insert(inserts); if (insertError) throw new Error('Could not write new Meta spend ledger rows.'); }
      financialLedgerSynced = true;
    } catch (syncError) {
      financialSyncWarning = syncError instanceof Error ? syncError.message : 'Meta spend was saved as a snapshot but not reconciled to the financial ledger.';
    }
    return apiJson({ success: true, snapshotId: saved.id, adAccountId, period: { since: iso(start), until: iso(end), days }, campaignRows: rows.length, rows, financialLedgerSynced, financialSyncWarning });
  } catch (error) {
    return apiJson({ error: error instanceof Error ? error.message : 'Meta Ads Insights sync failed.' }, 502);
  }
}
