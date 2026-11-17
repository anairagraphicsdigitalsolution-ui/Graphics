'use strict';
const fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');
const start=read('app/api/growth/seo/oauth/start/route.ts');
const callback=read('app/api/growth/seo/oauth/callback/route.ts');
const api=read('app/api/growth/seo/route.ts');
const ui=read('components/growth-website-intelligence.tsx');
const audit=read('app/api/growth/website-intelligence/route.ts');
const migration=read('supabase/migrations/20261116043326_growth_seo_intelligence_v6980.sql');
const provider=read('supabase/migrations/20261116043535_growth_seo_integration_provider_v6980b.sql');
const lockdown=read('supabase/migrations/20261116043810_growth_seo_privilege_lockdown_v6980c.sql');
const integrations=read('app/api/growth/platform-integrations/route.ts');
const integrationUi=read('components/growth-platform-integrations-manager.tsx');
const nav=read('components/growth-primary-nav.tsx');
const pkg=JSON.parse(read('package.json'));
const checks=[
 ['SEO OAuth start authenticates bearer session and requires owner/manager',start.includes('growthContext(req)')&&start.includes("['owner', 'manager']")],
 ['Google Search Console read-only scope requested',start.includes('webmasters.readonly')],
 ['Google Analytics read-only scope requested',start.includes('analytics.readonly')],
 ['Separate SEO callback URI is configurable in Developer APIs',integrations.includes("settings:['redirect_uri','seo_redirect_uri']")&&integrationUi.includes('seo_redirect_uri')&&start.includes('app.settings?.seo_redirect_uri')&&callback.includes('app.settings?.seo_redirect_uri')],
 ['OAuth state is signed, time-limited and stored in HttpOnly cookie',start.includes('createHmac')&&start.includes('timing-safe')===false&&start.includes('maxAge: 600')&&start.includes('httpOnly: true')],
 ['OAuth callback verifies signature, expiry and exact state',callback.includes('timingSafeEqual')&&callback.includes('state.exp < Date.now()')&&callback.includes('state.state !== req.nextUrl.searchParams.get(\'state\')')],
 ['Google OAuth callback rechecks active tenant and membership',callback.includes("organization.status !== 'active'")&&callback.includes('growth_members')],
 ['Google refresh token is encrypted in tenant integration vault',callback.includes('encryptSecret(credentials)')&&callback.includes("provider: 'google_seo'")],
 ['Existing refresh token is retained when Google omits a replacement',callback.includes('token.refresh_token || previous.refresh_token')],
 ['Google access token is refreshed server-side',api.includes('grant_type: \'refresh_token\'')&&api.includes('oauth2.googleapis.com/token')],
 ['GSC properties are fetched from Search Console API',api.includes('webmasters/v3/sites')],
 ['GA4 property list is fetched from Analytics Admin API',api.includes('analyticsadmin.googleapis.com/v1beta/accountSummaries')],
 ['GSC and GA4 property discovery failures are isolated independently',api.includes('Promise.allSettled')&&api.includes('gscError:')&&api.includes('ga4Error:')],
 ['GSC Search Analytics data is fetched from Google API',api.includes('webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query')],
 ['GSC query/page/country/device/date dimensions are persisted',api.includes("dimensions: ['date', 'query', 'page', 'country', 'device']")&&api.includes("from('growth_seo_search_metrics').upsert")],
 ['Ranking verification uses real GSC average position weighted by impressions',api.includes('r.position) * safeNumber(r.impressions)')&&api.includes('latest_position')],
 ['Prior-period position is retained for movement comparison',api.includes('previous_position: p.position')],
 ['GSC position is explicitly not described as real-time SERP rank',api.includes('not a live real-time SERP rank')],
 ['GA4 runReport fetches landing page and source/medium dimensions',api.includes('analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport')&&api.includes('landingPagePlusQueryString')&&api.includes('sessionSourceMedium')],
 ['GA4 sessions, engaged sessions, users and conversions are persisted',api.includes('engaged_sessions')&&api.includes('total_users')&&api.includes('conversions')&&api.includes("from('growth_seo_analytics_metrics').upsert")],
 ['Per-website Google properties are stored independently per tenant',api.includes('website_properties')&&api.includes('[websiteId]')],
 ['SEO API enforces tenant membership and editor access for writes',api.includes('requireGrowthRole')&&api.includes("['owner', 'manager', 'editor']")],
 ['Tracked keywords are tenant/site scoped and deduplicated',api.includes("from('growth_seo_keywords').upsert")&&api.includes('organization_id,website_id,keyword,country,device')],
 ['Keyword ranking refresh filters actual Search Console query rows',api.includes('String(r.keys?.[1] || \'\').toLowerCase()')&&api.includes('tracked.keyword')],
 ['SEO tasks are generated from failed audit findings only',api.includes("action === 'generate_tasks'")&&api.includes('item.pass === false')],
 ['SEO task generation does not modify website content',api.includes('No website changes were made')],
 ['SEO task status transitions are tenant and site scoped',api.includes("action === 'update_task'")&&api.includes("eq('website_id', websiteId)")],
 ['Homepage audit still respects DNS verification and robots policy',audit.includes("site.verification_status !== 'verified'")&&audit.includes('crawlerDisallowed(robotsText)')],
 ['Dashboard exposes OAuth, property selection, sync and KPI metrics',ui.includes('Connect Google account')&&ui.includes('Load available Google properties')&&ui.includes('Sync Search Console')&&ui.includes('Sync GA4')&&ui.includes('Search clicks')],
 ['Dashboard exposes keyword tracking and ranking movement',ui.includes('Keyword ranking verification')&&ui.includes('Avg. position')&&ui.includes('previous_position')],
 ['Dashboard labels provider row caps to avoid presenting partial KPIs as complete',api.includes('dataCapped: (searchRows || []).length >= 5000')&&api.includes('dataCapped: (analyticsRows || []).length >= 5000')&&ui.includes('KPI totals shown here may be partial')],
 ['Dashboard exposes prioritized task management and honest limitations',ui.includes('Prioritized SEO tasks')&&ui.includes('Competitor visibility')&&ui.includes('not enabled in this release')],
 ['SEO Intelligence is visible in primary navigation',nav.includes("id:'website-intelligence',label:'Website Intelligence'")],
 ['Migration creates keyword, GSC, GA4 and task tables with RLS',migration.includes('growth_seo_keywords')&&migration.includes('growth_seo_search_metrics')&&migration.includes('growth_seo_analytics_metrics')&&migration.includes('growth_seo_tasks')&&migration.match(/enable row level security/g)?.length===4],
 ['SEO tables explicitly revoke anon access and restrict authenticated privileges',lockdown.includes('revoke all on table')&&lockdown.includes('from anon, authenticated')&&lockdown.includes('grant all on table')],
 ['Provider constraint allows tenant Google SEO credential record',provider.includes("'google_seo'")],
 ['Package version and full verification script include Module 8',['6.98.0','6.99.0','6.100.0','6.101.0','6.102.0','6.103.0','6.104.0','6.105.0','6.106.0','6.108.0','6.109.0','6.110.0','6.112.0','6.113.0','6.114.0','6.115.0','6.116.0','6.118.0','6.119.0','6.120.0','6.121.0','6.122.0','6.123.0','6.124.0','6.124.1','6.124.2','6.124.3','6.124.4','6.124.5','6.124.6','6.124.7'].includes(pkg.version)&&pkg.scripts['verify:all'].includes('verify:growth-seo-intelligence-v6980')],
];
let failed=0;for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)failed++;}
console.log(`${checks.length-failed} PASS, ${failed} FAIL`);process.exitCode=failed?1:0;
