import { NextRequest } from 'next/server';
import { apiJson, growthContext, requireGrowthFeature, requireGrowthRole } from '@/lib/growth-server';
import { decryptSecret, encryptSecret } from '@/lib/growth-crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function safeNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

async function linkedinGet(url: URL, token: string, version: string) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Linkedin-Version': version,
      'X-Restli-Protocol-Version': '2.0.0',
      Accept: 'application/json',
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = String(payload.message || payload.serviceErrorCode || `LinkedIn API request failed (${response.status}).`);
    throw new Error(message.slice(0, 500));
  }
  return payload;
}

function endpoint(path: string, organizationUrn: string, start: number, end: number) {
  const url = new URL(`https://api.linkedin.com/rest/${path}`);
  const finder = path === 'organizationPageStatistics' ? 'organization' : 'organizationalEntity';
  url.searchParams.set('q', finder);
  url.searchParams.set(finder, organizationUrn);
  url.searchParams.set('timeIntervals.timeGranularityType', 'DAY');
  url.searchParams.set('timeIntervals.timeRange.start', String(start));
  url.searchParams.set('timeIntervals.timeRange.end', String(end));
  return url;
}

/**
 * Fetches organization-level LinkedIn analytics only for organization URNs discovered
 * from the same tenant's OAuth grant. No arbitrary organization URN can be queried.
 */
export async function GET(req: NextRequest) {
  const ctx = await growthContext(req);
  if ('response' in ctx) return ctx.response;
  const organizationId = String(req.nextUrl.searchParams.get('organizationId') || '').trim();
  const accountId = String(req.nextUrl.searchParams.get('socialAccountId') || '').trim();
  const days = Number(req.nextUrl.searchParams.get('days') || 28);
  const organizationUrn = String(req.nextUrl.searchParams.get('organizationUrn') || '').trim();
  if (!organizationId || !accountId || !organizationUrn || ![7, 28, 90].includes(days)) {
    return apiJson({ error: 'Workspace, LinkedIn account, approved organization and a 7, 28 or 90 day period are required.' }, 400);
  }
  if (!await requireGrowthRole(ctx.db, ctx.userId, organizationId, ['owner', 'manager', 'editor', 'viewer'])) {
    return apiJson({ error: 'Workspace permission denied.' }, 403);
  }
  if (!await requireGrowthFeature(ctx.db, ctx.userId, organizationId, 'social_channels')) {
    return apiJson({ error: 'Social channels are not included in this workspace plan.' }, 402);
  }
  const { data: account, error } = await ctx.db.from('growth_social_accounts')
    .select('id,platform,connection_status,encrypted_credentials,account_name,scopes,metadata')
    .eq('id', accountId).eq('organization_id', organizationId).maybeSingle();
  if (error || !account || account.platform !== 'linkedin' || account.connection_status !== 'connected') {
    return apiJson({ error: 'Choose a connected LinkedIn account from this workspace.' }, 409);
  }
  const allowedOrganizations = Array.isArray(account.metadata?.organization_urns) ? account.metadata.organization_urns : [];
  if (!allowedOrganizations.some((entry: any) => entry?.urn === organizationUrn)) {
    return apiJson({ error: 'This LinkedIn organization was not returned by the current tenant OAuth authorization. Reconnect with approved organization analytics scopes.' }, 403);
  }
  const scopes = Array.isArray(account.scopes) ? account.scopes : [];
  if (!scopes.includes('r_organization_admin')) {
    return apiJson({ error: 'LinkedIn organization analytics scope r_organization_admin is missing. Enable the approved Community Management/Marketing API product and reconnect.' }, 409);
  }
  try {
    const credentials = decryptSecret(account.encrypted_credentials) as any;
    let accessToken = String(credentials?.access_token || '');
    if (!accessToken) return apiJson({ error: 'LinkedIn access token is missing. Reconnect the account.' }, 409);
    if (credentials.expires_at && Date.parse(credentials.expires_at) <= Date.now() + 60000) {
      if (!credentials.refresh_token) return apiJson({ error: 'LinkedIn refresh token is unavailable. Reconnect the account.' }, 409);
      const integration = await ctx.db.from('growth_integrations').select('encrypted_credentials').eq('organization_id', organizationId).eq('provider', 'linkedin').maybeSingle();
      const vault = integration.data?.encrypted_credentials ? decryptSecret(integration.data.encrypted_credentials) as any : {};
      const clientId = String(vault.client_id || process.env.LINKEDIN_CLIENT_ID || '');
      const clientSecret = String(vault.client_secret || process.env.LINKEDIN_CLIENT_SECRET || '');
      if (!clientId || !clientSecret) return apiJson({ error: 'LinkedIn OAuth client credentials are not configured for token refresh.' }, 503);
      const refreshResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: credentials.refresh_token, client_id: clientId, client_secret: clientSecret }),
        cache: 'no-store', signal: AbortSignal.timeout(15000),
      });
      const refreshed = await refreshResponse.json().catch(() => ({}));
      if (!refreshResponse.ok || !refreshed.access_token) return apiJson({ error: String(refreshed.error_description || 'LinkedIn token refresh failed. Reconnect the account.') }, 502);
      accessToken = String(refreshed.access_token);
      const expiresAt = new Date(Date.now() + Number(refreshed.expires_in || 3600) * 1000).toISOString();
      const updatedCredentials = { ...credentials, access_token: accessToken, expires_at: expiresAt, ...(refreshed.refresh_token ? { refresh_token: refreshed.refresh_token } : {}) };
      const saved = await ctx.db.from('growth_social_accounts').update({ encrypted_credentials: encryptSecret(updatedCredentials), token_expires_at: expiresAt, last_health_check_at: new Date().toISOString(), token_health: 'healthy' }).eq('id', account.id).eq('organization_id', organizationId);
      if (saved.error) return apiJson({ error: 'Token refreshed but could not be persisted securely.' }, 503);
    }

    const version = process.env.LINKEDIN_API_VERSION || '202610';
    const end = new Date();
    const start = new Date(end.getTime() - days * 86400000);
    const startMs = start.getTime();
    const endMs = end.getTime();
    const [page, followers, shares] = await Promise.allSettled([
      linkedinGet(endpoint('organizationPageStatistics', organizationUrn, startMs, endMs), accessToken, version),
      linkedinGet(endpoint('organizationalEntityFollowerStatistics', organizationUrn, startMs, endMs), accessToken, version),
      linkedinGet(endpoint('organizationalEntityShareStatistics', organizationUrn, startMs, endMs), accessToken, version),
    ]);
    const errors = [page, followers, shares].filter((result): result is PromiseRejectedResult => result.status === 'rejected')
      .map(result => String(result.reason instanceof Error ? result.reason.message : 'LinkedIn analytics endpoint failed.').slice(0, 300));
    const pageRows = page.status === 'fulfilled' ? page.value.elements || [] : [];
    const followerRows = followers.status === 'fulfilled' ? followers.value.elements || [] : [];
    const shareRows = shares.status === 'fulfilled' ? shares.value.elements || [] : [];
    const sumDeep = (value: any, key: string): number => safeNumber(value?.[key]);
    const pageViews = pageRows.reduce((total: number, row: any) => total + safeNumber(row.totalPageStatistics?.views?.allPageViews?.pageViews), 0);
    const pageClicks = pageRows.reduce((total: number, row: any) => {
      const clicks = row.totalPageStatistics?.clicks || {};
      const entries = [...(clicks.desktopCustomButtonClickCounts || []), ...(clicks.mobileCustomButtonClickCounts || [])];
      return total + entries.reduce((sum: number, item: any) => sum + safeNumber(item?.clicks || item?.clickCount), 0);
    }, 0);
    const followerGains = followerRows.reduce((total: number, row: any) => total + sumDeep(row.followerGains, 'organicFollowerGain') + sumDeep(row.followerGains, 'paidFollowerGain'), 0);
    const shareTotals = shareRows.reduce((total: any, row: any) => {
      const stats = row.totalShareStatistics || {};
      for (const key of ['impressionCount', 'uniqueImpressionsCount', 'clickCount', 'likeCount', 'commentCount', 'shareCount']) total[key] += safeNumber(stats[key]);
      return total;
    }, { impressionCount: 0, uniqueImpressionsCount: 0, clickCount: 0, likeCount: 0, commentCount: 0, shareCount: 0 });
    const availableSources = [page.status === 'fulfilled', followers.status === 'fulfilled', shares.status === 'fulfilled'].filter(Boolean).length;
    if (!availableSources) return apiJson({ error: 'LinkedIn returned no analytics data.', details: errors }, 502);
    const metrics = {
      pageViews, pageClicks, followerGains, ...shareTotals,
      daily: { page: pageRows, followers: followerRows, shares: shareRows },
      source: 'LinkedIn Marketing API', sourceVersion: version,
      availableSources, unavailableSources: errors,
    };
    const periodStart = start.toISOString().slice(0, 10);
    const periodEnd = end.toISOString().slice(0, 10);
    const { error: saveError } = await ctx.db.from('growth_social_insights').upsert({
      organization_id: organizationId, social_account_id: account.id, platform: 'linkedin',
      period_start: periodStart, period_end: periodEnd, metrics,
      source_status: errors.length ? 'partial' : 'synced', synced_at: new Date().toISOString(),
      last_error: errors.length ? errors.join(' | ').slice(0, 1500) : null,
    }, { onConflict: 'social_account_id,period_start,period_end' });
    if (saveError) return apiJson({ error: 'LinkedIn metrics fetched but snapshot storage failed. Apply the LinkedIn analytics migration.' }, 503);
    return apiJson({ account: account.account_name, organizationUrn, period: { days, startDate: periodStart, endDate: periodEnd }, totals: { pageViews, pageClicks, followerGains, ...shareTotals }, rows: metrics.daily, source: metrics.source, sourceVersion: version, partial: errors.length > 0, warnings: errors, fetchedAt: new Date().toISOString() });
  } catch (error) {
    return apiJson({ error: error instanceof Error ? error.message : 'LinkedIn analytics could not be loaded.' }, 502);
  }
}
