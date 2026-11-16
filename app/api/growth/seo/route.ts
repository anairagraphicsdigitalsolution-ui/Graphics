import { NextRequest } from 'next/server';
import { growthContext, requireGrowthRole, apiJson } from '@/lib/growth-server';
import { decryptSecret, encryptSecret } from '@/lib/growth-crypto';

export const runtime = 'nodejs';
export const maxDuration = 60;
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const isoDate = (date: Date) => date.toISOString().slice(0, 10);
const dateDaysAgo = (days: number) => { const d = new Date(); d.setUTCDate(d.getUTCDate() - days); return isoDate(d); };
const safeNumber = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;

async function googleSeoAccess(db: any, organizationId: string) {
  const [{ data: integration, error }, { data: app, error: appError }] = await Promise.all([
    db.from('growth_integrations').select('id,encrypted_credentials,settings').eq('organization_id', organizationId).eq('provider', 'google_seo').maybeSingle(),
    db.from('growth_platform_integrations').select('encrypted_credentials').eq('provider', 'google_oauth_app').maybeSingle(),
  ]);
  if (error || appError || !integration?.encrypted_credentials || !app?.encrypted_credentials) throw new Error('Connect Google Search Console and Analytics for this workspace first.');
  let credentials: any, appCredentials: any;
  try { credentials = decryptSecret(integration.encrypted_credentials) || {}; appCredentials = decryptSecret(app.encrypted_credentials) || {}; }
  catch { throw new Error('Google SEO credentials cannot be decrypted. Check GROWTH_TOKEN_ENCRYPTION_KEY.'); }
  const clientId = String(appCredentials.client_id || '').trim();
  const clientSecret = String(appCredentials.client_secret || '').trim();
  const refreshToken = String(credentials.refresh_token || '').trim();
  if (!clientId || !clientSecret || !refreshToken) throw new Error('Google SEO OAuth setup is incomplete. Reconnect the Google account.');
  const response = await fetch(GOOGLE_TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }), cache: 'no-store' });
  const token: any = await response.json().catch(() => ({}));
  if (!response.ok || !token.access_token) throw new Error(token.error_description || token.error || 'Google access token refresh failed. Reconnect the account.');
  return { accessToken: String(token.access_token), integration, settings: integration.settings || {}, scopes: credentials.granted_scopes || [] };
}

async function googleGet(accessToken: string, url: string) {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' });
  const data: any = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || `Google API returned ${response.status}.`);
  return data;
}
async function googlePost(accessToken: string, url: string, body: unknown) {
  const response = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store' });
  const data: any = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || `Google API returned ${response.status}.`);
  return data;
}

async function loadGoogleProperties(accessToken: string) {
  const [sitesResult, accountsResult] = await Promise.allSettled([
    googleGet(accessToken, 'https://www.googleapis.com/webmasters/v3/sites'),
    googleGet(accessToken, 'https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200'),
  ]);
  const sites: any = sitesResult.status === 'fulfilled' ? sitesResult.value : {};
  const accounts: any = accountsResult.status === 'fulfilled' ? accountsResult.value : {};
  const gscProperties = (sites.siteEntry || []).map((site: any) => ({ siteUrl: String(site.siteUrl || ''), permissionLevel: String(site.permissionLevel || '') }));
  const ga4Properties: any[] = [];
  for (const account of accounts.accountSummaries || []) {
    for (const property of account.propertySummaries || []) {
      ga4Properties.push({ propertyId: String(property.property || '').split('/').pop(), displayName: String(property.displayName || ''), account: String(account.displayName || '') });
    }
  }
  return {
    gscProperties, ga4Properties,
    gscError: sitesResult.status === 'rejected' ? (sitesResult.reason instanceof Error ? sitesResult.reason.message : 'Search Console properties unavailable.') : null,
    ga4Error: accountsResult.status === 'rejected' ? (accountsResult.reason instanceof Error ? accountsResult.reason.message : 'GA4 properties unavailable.') : null,
  };
}

export async function GET(req: NextRequest) {
  const ctx = await growthContext(req); if ('response' in ctx) return ctx.response;
  const organizationId = req.nextUrl.searchParams.get('organizationId') || '';
  const websiteId = req.nextUrl.searchParams.get('websiteId') || '';
  const action = req.nextUrl.searchParams.get('action') || 'dashboard';
  if (!await requireGrowthRole(ctx.db, ctx.userId, organizationId, ['owner', 'manager', 'editor', 'viewer', 'client'])) return apiJson({ error: 'Workspace permission denied.' }, 403);
  const [{ data: integration }, { data: keywords, error: keywordError }, { data: tasks, error: taskError }, { data: website }] = await Promise.all([
    ctx.db.from('growth_integrations').select('connection_status,settings,last_success_at,last_error').eq('organization_id', organizationId).eq('provider', 'google_seo').maybeSingle(),
    ctx.db.from('growth_seo_keywords').select('*').eq('organization_id', organizationId).eq('website_id', websiteId).order('priority').order('keyword').limit(500),
    ctx.db.from('growth_seo_tasks').select('*').eq('organization_id', organizationId).eq('website_id', websiteId).order('created_at', { ascending: false }).limit(100),
    ctx.db.from('growth_websites').select('id,name,domain,website_url,verification_status').eq('organization_id', organizationId).eq('id', websiteId).maybeSingle(),
  ]);
  if (keywordError || taskError) return apiJson({ error: 'SEO workspace data could not be loaded.' }, 503);
  if (!websiteId || !website) return apiJson({ error: 'Select a website in this workspace.' }, 404);
  if (action === 'properties') {
    try {
      const auth = await googleSeoAccess(ctx.db, organizationId);
      return apiJson({ connected: true, ...await loadGoogleProperties(auth.accessToken), selected: auth.settings });
    } catch (error) { return apiJson({ error: error instanceof Error ? error.message : 'Google properties unavailable.' }, 409); }
  }
  const [{ data: searchRows }, { data: analyticsRows }, { data: audits }] = await Promise.all([
    ctx.db.from('growth_seo_search_metrics').select('metric_date,query,page,clicks,impressions,ctr,position,country,device').eq('organization_id', organizationId).eq('website_id', websiteId).gte('metric_date', dateDaysAgo(28)).order('metric_date', { ascending: true }).limit(5000),
    ctx.db.from('growth_seo_analytics_metrics').select('metric_date,landing_page,source_medium,sessions,engaged_sessions,total_users,conversions').eq('organization_id', organizationId).eq('website_id', websiteId).gte('metric_date', dateDaysAgo(28)).order('metric_date', { ascending: true }).limit(5000),
    ctx.db.from('growth_website_audits').select('id,score,report,created_at').eq('organization_id', organizationId).eq('website_id', websiteId).order('created_at', { ascending: false }).limit(10),
  ]);
  const allSettings = integration?.settings || {};
  const websiteSettings = allSettings.website_properties?.[websiteId] || (String(allSettings.website_id || '') === websiteId ? allSettings : {});
  const total = (rows: any[], key: string) => (rows || []).reduce((sum, row) => sum + safeNumber(row[key]), 0);
  const impressions = total(searchRows || [], 'impressions');
  const clicks = total(searchRows || [], 'clicks');
  const sessions = total(analyticsRows || [], 'sessions');
  const engaged = total(analyticsRows || [], 'engaged_sessions');
  return apiJson({
    website, connection: { connected: integration?.connection_status === 'connected', status: integration?.connection_status || 'not_connected', settings: websiteSettings, lastSuccessAt: integration?.last_success_at || null, lastError: integration?.last_error || null },
    keywords: keywords || [], tasks: tasks || [], audits: audits || [],
    search: { clicks, impressions, ctr: impressions ? clicks / impressions : 0, averagePosition: impressions ? (searchRows || []).reduce((s: number, r: any) => s + safeNumber(r.position) * safeNumber(r.impressions), 0) / impressions : null, rows: searchRows || [], dataCapped: (searchRows || []).length >= 5000 },
    analytics: { sessions, engagedSessions: engaged, engagementRate: sessions ? engaged / sessions : 0, users: total(analyticsRows || [], 'total_users'), conversions: total(analyticsRows || [], 'conversions'), rows: analyticsRows || [], dataCapped: (analyticsRows || []).length >= 5000 },
  });
}

export async function POST(req: NextRequest) {
  const ctx = await growthContext(req); if ('response' in ctx) return ctx.response;
  let failedOrganizationId = '';
  try {
    const body = await req.json();
    const organizationId = String(body.organizationId || ''), websiteId = String(body.websiteId || ''), action = String(body.action || '');
    failedOrganizationId = organizationId;
    if (!organizationId || !websiteId || !await requireGrowthRole(ctx.db, ctx.userId, organizationId, ['owner', 'manager', 'editor'])) return apiJson({ error: 'Workspace editor permission required.' }, 403);
    const { data: website } = await ctx.db.from('growth_websites').select('id,website_url,domain,verification_status').eq('organization_id', organizationId).eq('id', websiteId).maybeSingle();
    if (!website) return apiJson({ error: 'Website not found in this workspace.' }, 404);

    if (action === 'save_properties') {
      const { data: row, error } = await ctx.db.from('growth_integrations').select('id,settings').eq('organization_id', organizationId).eq('provider', 'google_seo').maybeSingle();
      if (error || !row) return apiJson({ error: 'Connect Google Search Console and Analytics first.' }, 409);
      const gscSiteUrl = String(body.gscSiteUrl || '').trim().slice(0, 500);
      const ga4PropertyId = String(body.ga4PropertyId || '').replace(/[^0-9]/g, '').slice(0, 30);
      const settings = row.settings || {};
      const websiteProperties = { ...(settings.website_properties || {}), [websiteId]: { gsc_site_url: gscSiteUrl, ga4_property_id: ga4PropertyId } };
      const { error: saveError } = await ctx.db.from('growth_integrations').update({ settings: { ...settings, website_properties: websiteProperties }, updated_at: new Date().toISOString(), updated_by: ctx.userId }).eq('id', row.id).eq('organization_id', organizationId);
      if (saveError) return apiJson({ error: 'Could not save selected Google properties.' }, 500);
      return apiJson({ success: true });
    }

    if (action === 'add_keyword') {
      const keyword = String(body.keyword || '').trim().replace(/\s+/g, ' ').slice(0, 200);
      if (keyword.length < 2) return apiJson({ error: 'Enter a keyword with at least 2 characters.' }, 400);
      const payload = { organization_id: organizationId, website_id: websiteId, keyword, country: String(body.country || 'IND').toUpperCase().slice(0, 3), device: ['ALL', 'DESKTOP', 'MOBILE', 'TABLET'].includes(body.device) ? body.device : 'ALL', target_url: String(body.targetUrl || '').slice(0, 1000) || null, search_intent: ['informational', 'navigational', 'commercial', 'transactional'].includes(body.searchIntent) ? body.searchIntent : 'unknown', priority: ['low', 'medium', 'high'].includes(body.priority) ? body.priority : 'medium', created_by: ctx.userId, updated_at: new Date().toISOString() };
      const { data, error } = await ctx.db.from('growth_seo_keywords').upsert(payload, { onConflict: 'organization_id,website_id,keyword,country,device' }).select('*').single();
      if (error) return apiJson({ error: 'Keyword could not be saved.' }, 500);
      return apiJson({ success: true, keyword: data });
    }

    if (action === 'update_task') {
      const taskId = String(body.taskId || ''), status = String(body.status || '');
      if (!['open', 'in_progress', 'blocked', 'completed', 'dismissed'].includes(status)) return apiJson({ error: 'Invalid SEO task status.' }, 400);
      const patch: any = { status, updated_at: new Date().toISOString() };
      if (status === 'completed') { patch.completed_at = new Date().toISOString(); patch.completed_by = ctx.userId; }
      else { patch.completed_at = null; patch.completed_by = null; }
      const { data, error } = await ctx.db.from('growth_seo_tasks').update(patch).eq('id', taskId).eq('organization_id', organizationId).eq('website_id', websiteId).select('id,status').maybeSingle();
      if (error || !data) return apiJson({ error: 'SEO task could not be updated.' }, 404);
      return apiJson({ success: true, task: data });
    }

    if (action === 'generate_tasks') {
      const { data: latest } = await ctx.db.from('growth_website_audits').select('id,report').eq('organization_id', organizationId).eq('website_id', websiteId).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (!latest?.report || !Array.isArray((latest.report as any).checks)) return apiJson({ error: 'Run a website audit before generating SEO tasks.' }, 409);
      const failed = ((latest.report as any).checks as any[]).filter(item => item && item.pass === false);
      const taskRows = failed.map(item => ({
        organization_id: organizationId, website_id: websiteId,
        title: `Fix ${String(item.label || item.key || 'SEO issue').slice(0, 150)}`,
        description: String(item.detail || 'Review this finding and correct it on the website.').slice(0, 1000),
        task_type: ['title', 'description', 'h1', 'canonical'].includes(String(item.key)) ? 'content' : 'technical',
        priority: String(item.key) === 'robots' ? 'critical' : ['title', 'description', 'canonical'].includes(String(item.key)) ? 'high' : 'medium',
        status: 'open', source_data: { audit_id: latest.id, check_key: item.key, source: 'website_audit' }, created_by: ctx.userId,
      }));
      let created = 0;
      for (const row of taskRows) {
        const { data: existing } = await ctx.db.from('growth_seo_tasks').select('id').eq('organization_id', organizationId).eq('website_id', websiteId).eq('title', row.title).in('status', ['open', 'in_progress']).limit(1).maybeSingle();
        if (existing) continue;
        const { error } = await ctx.db.from('growth_seo_tasks').insert(row);
        if (!error) created++;
      }
      return apiJson({ success: true, created, findings: failed.length, message: `${created} prioritized SEO tasks created from ${failed.length} audit findings. No website changes were made.` });
    }

    if (action !== 'sync_search_console' && action !== 'sync_ga4') return apiJson({ error: 'Unsupported SEO action.' }, 400);
    const auth = await googleSeoAccess(ctx.db, organizationId);
    const settings = auth.settings?.website_properties?.[websiteId] || (String(auth.settings?.website_id || '') === websiteId ? auth.settings : {});
    if (!settings || (!settings.gsc_site_url && !settings.ga4_property_id)) return apiJson({ error: 'Select and save Google properties for this website first.' }, 409);
    const now = new Date();
    const end = dateDaysAgo(3); // Google reporting data is delayed; exclude the latest incomplete days.
    const start = dateDaysAgo(31);

    if (action === 'sync_search_console') {
      const siteUrl = String(settings.gsc_site_url || '').trim();
      if (!siteUrl) return apiJson({ error: 'Choose a Search Console property before syncing.' }, 409);
      const current = await googlePost(auth.accessToken, `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, { startDate: start, endDate: end, dimensions: ['date', 'query', 'page', 'country', 'device'], rowLimit: 25000, dataState: 'final' });
      const previous = await googlePost(auth.accessToken, `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, { startDate: dateDaysAgo(59), endDate: dateDaysAgo(32), dimensions: ['query', 'page', 'country', 'device'], rowLimit: 25000, dataState: 'final' });
      const rows = (current.rows || []).map((row: any) => ({ organization_id: organizationId, website_id: websiteId, metric_date: `${String(row.keys?.[0] || '').slice(0,4)}-${String(row.keys?.[0] || '').slice(4,6)}-${String(row.keys?.[0] || '').slice(6,8)}`, query: String(row.keys?.[1] || ''), page: String(row.keys?.[2] || ''), country: String(row.keys?.[3] || ''), device: String(row.keys?.[4] || ''), clicks: Math.round(safeNumber(row.clicks)), impressions: Math.round(safeNumber(row.impressions)), ctr: safeNumber(row.ctr), position: safeNumber(row.position), synced_at: now.toISOString() })).filter((row: any) => /^\d{4}-\d{2}-\d{2}$/.test(row.metric_date));
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await ctx.db.from('growth_seo_search_metrics').upsert(rows.slice(i, i + 500), { onConflict: 'organization_id,website_id,metric_date,query,page,country,device' });
        if (error) throw new Error('Search Console rows were fetched but could not be stored.');
      }
      const keywordRows = await ctx.db.from('growth_seo_keywords').select('id,keyword,country,device').eq('organization_id', organizationId).eq('website_id', websiteId).eq('status', 'active').limit(500);
      const priorRows = previous.rows || [];
      for (const tracked of keywordRows.data || []) {
        const currentMatches = (current.rows || []).filter((r: any) => String(r.keys?.[1] || '').toLowerCase() === String(tracked.keyword).toLowerCase() && (tracked.country === 'IND' ? String(r.keys?.[3] || '').toLowerCase() === 'ind' : true) && (tracked.device === 'ALL' || String(r.keys?.[4] || '').toUpperCase() === tracked.device));
        const priorMatches = priorRows.filter((r: any) => String(r.keys?.[0] || '').toLowerCase() === String(tracked.keyword).toLowerCase() && (tracked.country === 'IND' ? String(r.keys?.[2] || '').toLowerCase() === 'ind' : true) && (tracked.device === 'ALL' || String(r.keys?.[3] || '').toUpperCase() === tracked.device));
        const aggregate = (matches: any[]) => { const imp = matches.reduce((s, r) => s + safeNumber(r.impressions), 0); return { impressions: imp, clicks: matches.reduce((s, r) => s + safeNumber(r.clicks), 0), position: imp ? matches.reduce((s, r) => s + safeNumber(r.position) * safeNumber(r.impressions), 0) / imp : null }; };
        const c = aggregate(currentMatches), p = aggregate(priorMatches);
        await ctx.db.from('growth_seo_keywords').update({ previous_position: p.position, latest_position: c.position, impressions: Math.round(c.impressions), clicks: Math.round(c.clicks), ctr: c.impressions ? c.clicks / c.impressions : 0, last_verified_at: now.toISOString(), updated_at: now.toISOString() }).eq('id', tracked.id).eq('organization_id', organizationId);
      }
      await ctx.db.from('growth_integrations').update({ last_success_at: now.toISOString(), last_tested_at: now.toISOString(), last_error: null }).eq('organization_id', organizationId).eq('provider', 'google_seo');
      return apiJson({ success: true, provider: 'google_search_console', rowsSynced: rows.length, trackedKeywordsUpdated: (keywordRows.data || []).length, window: { start, end }, rankingMeaning: 'Google Search Console average position aggregated over the selected reporting period; not a live real-time SERP rank.' });
    }

    const propertyId = String(settings.ga4_property_id || '').replace(/[^0-9]/g, '');
    if (!propertyId) return apiJson({ error: 'Choose a GA4 property before syncing.' }, 409);
    const report = await googlePost(auth.accessToken, `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
      dateRanges: [{ startDate: start, endDate: end }],
      dimensions: [{ name: 'date' }, { name: 'landingPagePlusQueryString' }, { name: 'sessionSourceMedium' }],
      metrics: [{ name: 'sessions' }, { name: 'engagedSessions' }, { name: 'totalUsers' }, { name: 'conversions' }],
      limit: '10000',
    });
    const gaRows = (report.rows || []).map((row: any) => ({ organization_id: organizationId, website_id: websiteId, metric_date: `${String(row.dimensionValues?.[0]?.value || '').slice(0,4)}-${String(row.dimensionValues?.[0]?.value || '').slice(4,6)}-${String(row.dimensionValues?.[0]?.value || '').slice(6,8)}`, landing_page: String(row.dimensionValues?.[1]?.value || ''), source_medium: String(row.dimensionValues?.[2]?.value || ''), sessions: Math.round(safeNumber(row.metricValues?.[0]?.value)), engaged_sessions: Math.round(safeNumber(row.metricValues?.[1]?.value)), total_users: Math.round(safeNumber(row.metricValues?.[2]?.value)), conversions: safeNumber(row.metricValues?.[3]?.value), synced_at: now.toISOString() })).filter((row: any) => /^\d{4}-\d{2}-\d{2}$/.test(row.metric_date));
    for (let i = 0; i < gaRows.length; i += 500) {
      const { error } = await ctx.db.from('growth_seo_analytics_metrics').upsert(gaRows.slice(i, i + 500), { onConflict: 'organization_id,website_id,metric_date,landing_page,source_medium' });
      if (error) throw new Error('GA4 rows were fetched but could not be stored.');
    }
    await ctx.db.from('growth_integrations').update({ last_success_at: now.toISOString(), last_tested_at: now.toISOString(), last_error: null }).eq('organization_id', organizationId).eq('provider', 'google_seo');
    return apiJson({ success: true, provider: 'google_analytics_4', rowsSynced: gaRows.length, window: { start, end }, propertyId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'SEO operation failed.';
    if (failedOrganizationId) {
      await ctx.db.from('growth_integrations').update({ last_error: message.slice(0, 500), last_tested_at: new Date().toISOString() }).eq('organization_id', failedOrganizationId).eq('provider', 'google_seo');
    }
    return apiJson({ error: message.slice(0, 500) }, 502);
  }
}
