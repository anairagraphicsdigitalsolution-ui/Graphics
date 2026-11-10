import { NextRequest } from 'next/server';
import {apiJson, growthContext, requireGrowthRole, requireGrowthFeature} from '@/lib/growth-server';
import { decryptSecret } from '@/lib/growth-crypto';

export const runtime = 'nodejs';
const OBJECTIVES = new Set(['OUTCOME_AWARENESS','OUTCOME_TRAFFIC','OUTCOME_ENGAGEMENT','OUTCOME_LEADS','OUTCOME_SALES','OUTCOME_APP_PROMOTION']);

export async function GET(req: NextRequest) {
  const ctx = await growthContext(req);
  if ('response' in ctx) return ctx.response;
  const organizationId = req.nextUrl.searchParams.get('organizationId') || '';
  if (!await requireGrowthRole(ctx.db, ctx.userId, organizationId, ['owner','manager','editor','viewer'])) return apiJson({ error: 'Workspace permission denied.' }, 403);
 if(!await requireGrowthFeature(ctx.db,ctx.userId,organizationId,'ads'))return apiJson({error:'This module is not included in your workspace plan.'},402);
  const { data, error } = await ctx.db.from('growth_ad_campaign_drafts').select('id,ad_account_id,name,objective,daily_budget_minor,currency,special_ad_categories,status,provider_campaign_id,approved_at,submitted_at,last_error,created_at').eq('organization_id', organizationId).order('created_at', { ascending: false }).limit(100);
  if (error) return apiJson({ error: 'Campaign drafts are unavailable. Apply the v6.56 migration.' }, 500);
  return apiJson({ campaigns: data || [] });
}

export async function POST(req: NextRequest) {
  const ctx = await growthContext(req);
  if ('response' in ctx) return ctx.response;
  try {
    const body = await req.json();
    const organizationId = String(body.organizationId || '');
    if (!await requireGrowthRole(ctx.db, ctx.userId, organizationId, ['owner','manager','editor'])) return apiJson({ error: 'Campaign editor permission required.' }, 403);
 if(!await requireGrowthFeature(ctx.db,ctx.userId,organizationId,'ads'))return apiJson({error:'This module is not included in your workspace plan.'},402);
    const name = String(body.name || '').trim();
    const adAccountId = String(body.adAccountId || '').trim();
    const objective = String(body.objective || 'OUTCOME_LEADS');
    const categories = Array.isArray(body.specialAdCategories) ? body.specialAdCategories : [];
    if (name.length < 3 || name.length > 180) return apiJson({ error: 'Campaign name must contain 3–180 characters.' }, 400);
    if (!/^act_?\d{5,30}$/.test(adAccountId)) return apiJson({ error: 'A valid Meta Ad Account ID is required.' }, 400);
    if (!OBJECTIVES.has(objective)) return apiJson({ error: 'Unsupported Meta campaign objective.' }, 400);
    if (categories.length > 10 || categories.some((v: unknown) => typeof v !== 'string' || v.length > 80)) return apiJson({ error: 'Invalid special ad category list.' }, 400);
    const budget = body.dailyBudgetMinor == null || body.dailyBudgetMinor === '' ? null : Number(body.dailyBudgetMinor);
    if (budget !== null && (!Number.isSafeInteger(budget) || budget < 1)) return apiJson({ error: 'Daily budget must be a positive integer in the currency minor unit.' }, 400);
    const { data, error } = await ctx.db.from('growth_ad_campaign_drafts').insert({ organization_id: organizationId, ad_account_id: adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`, name, objective, daily_budget_minor: budget, currency: String(body.currency || 'INR').slice(0, 3).toUpperCase(), special_ad_categories: categories, created_by: ctx.userId }).select('id,name,objective,status,ad_account_id').single();
    if (error) return apiJson({ error: 'Could not save campaign draft.' }, 500);
    return apiJson({ success: true, campaign: data, note: 'Saved as draft. No campaign or spend has been created.' }, 201);
  } catch (e) { return apiJson({ error: e instanceof Error ? e.message : 'Campaign draft failed.' }, 400); }
}

export async function PATCH(req: NextRequest) {
  const ctx = await growthContext(req);
  if ('response' in ctx) return ctx.response;
  try {
    const body = await req.json();
    const organizationId = String(body.organizationId || '');
    const id = String(body.id || '');
    if (!await requireGrowthRole(ctx.db, ctx.userId, organizationId, ['owner','manager'])) return apiJson({ error: 'Only workspace owner or manager can approve campaign submission.' }, 403);
 if(!await requireGrowthFeature(ctx.db,ctx.userId,organizationId,'ads'))return apiJson({error:'This module is not included in your workspace plan.'},402);
    const { data: draft, error } = await ctx.db.from('growth_ad_campaign_drafts').select('*').eq('id', id).eq('organization_id', organizationId).eq('status', 'draft').maybeSingle();
    if (error || !draft) return apiJson({ error: 'Draft not found or already reviewed.' }, 404);
    const socialAccountId = String(body.socialAccountId || '');
    const { data: account } = await ctx.db.from('growth_social_accounts').select('platform,connection_status,encrypted_credentials,scopes').eq('id', socialAccountId).eq('organization_id', organizationId).maybeSingle();
    if (!account || account.platform !== 'facebook' || account.connection_status !== 'connected') return apiJson({ error: 'Connect a Facebook account with ads_management permission.' }, 409);
    if (!Array.isArray(account.scopes) || !account.scopes.includes('ads_management')) return apiJson({ error: 'Facebook connection does not record ads_management permission. Reconnect Meta and grant this permission.' }, 403);
    const credentials = decryptSecret(account.encrypted_credentials);
    const version = process.env.META_GRAPH_API_VERSION;
    if (!credentials?.access_token || !version) return apiJson({ error: 'Meta credentials or Graph API version are unavailable.' }, 503);
    const params = new URLSearchParams({ name: draft.name, objective: draft.objective, status: 'PAUSED', buying_type: 'AUCTION', special_ad_categories: JSON.stringify(draft.special_ad_categories || []), access_token: credentials.access_token });
    const response = await fetch(`https://graph.facebook.com/${version}/${draft.ad_account_id}/campaigns`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params, cache: 'no-store' });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.id) {
      await ctx.db.from('growth_ad_campaign_drafts').update({ status: 'failed', last_error: String(result?.error?.message || 'Meta campaign creation failed.').slice(0, 1000), updated_at: new Date().toISOString() }).eq('id', draft.id);
      return apiJson({ error: result?.error?.message || 'Meta campaign creation failed.' }, 502);
    }
    const now = new Date().toISOString();
    await ctx.db.from('growth_ad_campaign_drafts').update({ status: 'submitted', provider_campaign_id: String(result.id), approved_by: ctx.userId, approved_at: now, submitted_at: now, last_error: null, updated_at: now }).eq('id', draft.id);
    return apiJson({ success: true, campaignId: result.id, status: 'PAUSED', message: 'Meta campaign created in PAUSED state. Ad sets, creatives and activation are not created.' });
  } catch (e) { return apiJson({ error: e instanceof Error ? e.message : 'Campaign approval failed.' }, 502); }
}
