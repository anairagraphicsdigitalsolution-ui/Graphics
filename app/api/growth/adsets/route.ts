import { NextRequest } from 'next/server';
import {apiJson, growthContext, requireGrowthRole, requireGrowthFeature} from '@/lib/growth-server';

export const runtime = 'nodejs';
const GOALS = new Set(['LINK_CLICKS','IMPRESSIONS','REACH','LANDING_PAGE_VIEWS','LEAD_GENERATION','CONVERSIONS','POST_ENGAGEMENT','VIDEO_VIEWS']);

export async function GET(req: NextRequest) {
  const ctx = await growthContext(req);
  if ('response' in ctx) return ctx.response;
  const organizationId = req.nextUrl.searchParams.get('organizationId') || '';
  const campaignDraftId = req.nextUrl.searchParams.get('campaignDraftId') || '';
  if (!await requireGrowthRole(ctx.db, ctx.userId, organizationId, ['owner','manager','editor','viewer'])) return apiJson({ error: 'Workspace permission denied.' }, 403);
 if(!await requireGrowthFeature(ctx.db,ctx.userId,organizationId,'ads'))return apiJson({error:'This module is not included in your workspace plan.'},402);
  let query = ctx.db.from('growth_adset_drafts').select('id,campaign_draft_id,name,optimization_goal,billing_event,daily_budget_minor,start_time,end_time,targeting,status,provider_adset_id,last_error,created_at').eq('organization_id', organizationId).order('created_at', { ascending: false }).limit(100);
  if (campaignDraftId) query = query.eq('campaign_draft_id', campaignDraftId);
  const { data, error } = await query;
  if (error) return apiJson({ error: 'Ad set drafts unavailable. Apply the v6.57 migration.' }, 500);
  return apiJson({ adsets: data || [] });
}

export async function POST(req: NextRequest) {
  const ctx = await growthContext(req);
  if ('response' in ctx) return ctx.response;
  try {
    const b = await req.json();
    const organizationId = String(b.organizationId || '');
    if (!await requireGrowthRole(ctx.db, ctx.userId, organizationId, ['owner','manager','editor'])) return apiJson({ error: 'Ad set editor permission required.' }, 403);
 if(!await requireGrowthFeature(ctx.db,ctx.userId,organizationId,'ads'))return apiJson({error:'This module is not included in your workspace plan.'},402);
    const campaignDraftId = String(b.campaignDraftId || '');
    const { data: campaign } = await ctx.db.from('growth_ad_campaign_drafts').select('id,status,organization_id,objective').eq('id', campaignDraftId).eq('organization_id', organizationId).maybeSingle();
    if (!campaign || !['draft','submitted'].includes(campaign.status)) return apiJson({ error: 'Choose a valid campaign draft or paused campaign.' }, 409);
    const name = String(b.name || '').trim();
    const optimizationGoal = String(b.optimizationGoal || 'LINK_CLICKS');
    const budget = b.dailyBudgetMinor == null || b.dailyBudgetMinor === '' ? null : Number(b.dailyBudgetMinor);
    const targeting = b.targeting && typeof b.targeting === 'object' && !Array.isArray(b.targeting) ? b.targeting : {};
    if (name.length < 3 || name.length > 180) return apiJson({ error: 'Ad set name must contain 3–180 characters.' }, 400);
    if (!GOALS.has(optimizationGoal)) return apiJson({ error: 'Unsupported optimization goal.' }, 400);
    if (budget !== null && (!Number.isSafeInteger(budget) || budget < 1)) return apiJson({ error: 'Daily budget must be a positive integer in currency minor units.' }, 400);
    if (JSON.stringify(targeting).length > 12000) return apiJson({ error: 'Targeting configuration is too large.' }, 400);
    const { data, error } = await ctx.db.from('growth_adset_drafts').insert({ organization_id: organizationId, campaign_draft_id: campaignDraftId, name, optimization_goal: optimizationGoal, billing_event: 'IMPRESSIONS', daily_budget_minor: budget, start_time: b.startTime || null, end_time: b.endTime || null, targeting }).select('id,campaign_draft_id,name,optimization_goal,daily_budget_minor,status').single();
    if (error) return apiJson({ error: 'Could not save ad set draft.' }, 500);
    return apiJson({ success: true, adset: data, note: 'Saved as draft only. No audience, ad set, or spend has been created.' }, 201);
  } catch { return apiJson({ error: 'Invalid ad set draft.' }, 400); }
}

// Owner/manager-only provider submission. Every Ad Set is created PAUSED.
export async function PATCH(req: NextRequest) {
  const ctx = await growthContext(req);
  if ('response' in ctx) return ctx.response;
  try {
    const b = await req.json();
    const organizationId = String(b.organizationId || '');
    const id = String(b.id || '');
    if (!await requireGrowthRole(ctx.db, ctx.userId, organizationId, ['owner', 'manager'])) return apiJson({ error: 'Only workspace owner or manager can submit an Ad Set.' }, 403);
 if(!await requireGrowthFeature(ctx.db,ctx.userId,organizationId,'ads'))return apiJson({error:'This module is not included in your workspace plan.'},402);
    const { data: draft, error: draftError } = await ctx.db.from('growth_adset_drafts').select('*').eq('id', id).eq('organization_id', organizationId).eq('status', 'draft').maybeSingle();
    if (draftError || !draft) return apiJson({ error: 'Ad Set draft not found or already submitted.' }, 404);
    const { data: campaign } = await ctx.db.from('growth_ad_campaign_drafts').select('id,ad_account_id,provider_campaign_id,status').eq('id', draft.campaign_draft_id).eq('organization_id', organizationId).maybeSingle();
    if (!campaign?.provider_campaign_id || campaign.status !== 'submitted') return apiJson({ error: 'Submit the parent campaign first. It must exist in Meta in PAUSED state.' }, 409);
    const socialAccountId = String(b.socialAccountId || '');
    const { data: account } = await ctx.db.from('growth_social_accounts').select('platform,connection_status,encrypted_credentials,scopes').eq('id', socialAccountId).eq('organization_id', organizationId).maybeSingle();
    if (!account || account.platform !== 'facebook' || account.connection_status !== 'connected') return apiJson({ error: 'Connect the Facebook Page again and grant ads_management permission.' }, 409);
    if (!Array.isArray(account.scopes) || !account.scopes.includes('ads_management')) return apiJson({ error: 'The connected account does not record ads_management permission. Reconnect Meta and approve the permission.' }, 403);
    const { decryptSecret } = await import('@/lib/growth-crypto');
    const credentials = decryptSecret(account.encrypted_credentials);
    const version = process.env.META_GRAPH_API_VERSION;
    if (!credentials?.access_token || !version) return apiJson({ error: 'Meta credentials or Graph API version are unavailable.' }, 503);
    const budget = draft.daily_budget_minor == null ? null : Number(draft.daily_budget_minor);
    if (!budget || !Number.isSafeInteger(budget) || budget < 1) return apiJson({ error: 'Set a positive Ad Set daily budget before submitting.' }, 400);
    const targeting = draft.targeting && typeof draft.targeting === 'object' ? draft.targeting : {};
    if (!targeting.geo_locations || typeof targeting.geo_locations !== 'object') return apiJson({ error: 'Targeting must include geo_locations before submission.' }, 400);
    const params = new URLSearchParams({
      name: draft.name,
      campaign_id: campaign.provider_campaign_id,
      daily_budget: String(budget),
      billing_event: String(draft.billing_event || 'IMPRESSIONS'),
      optimization_goal: String(draft.optimization_goal),
      targeting: JSON.stringify(targeting),
      status: 'PAUSED',
      access_token: credentials.access_token,
    });
    if (draft.start_time) params.set('start_time', String(draft.start_time));
    if (draft.end_time) params.set('end_time', String(draft.end_time));
    if (b.promotedObject && typeof b.promotedObject === 'object' && !Array.isArray(b.promotedObject)) params.set('promoted_object', JSON.stringify(b.promotedObject));
    const response = await fetch(`https://graph.facebook.com/${version}/${campaign.ad_account_id}/adsets`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params, cache: 'no-store' });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.id) {
      const message = String(result?.error?.message || 'Meta Ad Set creation failed.').slice(0, 1000);
      await ctx.db.from('growth_adset_drafts').update({ status: 'failed', last_error: message, updated_at: new Date().toISOString() }).eq('id', draft.id);
      return apiJson({ error: message }, 502);
    }
    const now = new Date().toISOString();
    const { error: updateError } = await ctx.db.from('growth_adset_drafts').update({ status: 'submitted', provider_adset_id: String(result.id), approved_by: ctx.userId, approved_at: now, last_error: null, updated_at: now }).eq('id', draft.id).eq('status', 'draft');
    if (updateError) return apiJson({ success: true, adsetId: String(result.id), status: 'PAUSED', warning: 'Meta created the paused Ad Set, but the local draft status could not be updated. Reconcile before retrying.' }, 202);
    return apiJson({ success: true, adsetId: String(result.id), status: 'PAUSED', message: 'Meta Ad Set created in PAUSED state. No ad or spend has been activated.' });
  } catch {
    return apiJson({ error: 'Ad Set submission failed.' }, 502);
  }
}
