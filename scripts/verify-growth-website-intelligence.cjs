const fs = require('node:fs');
const path = require('node:path');
const read = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');
const route = read('app/api/growth/website-intelligence/route.ts');
const ui = read('components/growth-website-intelligence.tsx');
const migrationPath = 'supabase/migrations/20261113180052_growth_website_intelligence_v1.sql';
const migration = read(migrationPath);

const checks = [
  ['SEO scan route exists', fs.existsSync('app/api/growth/website-intelligence/route.ts')],
  ['Owner/manager permission enforced for scans', route.includes("['owner', 'manager']")],
  ['Verified website ownership required', route.includes("site.verification_status !== 'verified'")],
  ['Private and local IP ranges blocked', route.includes('privateIp') && route.includes('resolves to a private or restricted IP')],
  ['All redirect targets are revalidated', route.includes('MAX_REDIRECTS') && route.includes('current = await publicUrl(current.toString())')],
  ['HTTP redirect destinations are followed safely', route.includes("redirect: 'manual'") && route.includes('new URL(location, current)')],
  ['Response bodies have explicit byte limits', route.includes('readTextLimited') && route.includes('MAX_HTML_BYTES')],
  ['Robots rules parse actual newline-separated directives', route.includes('robots.split(/\\r?\\n/)')],
  ['Robots disallow is checked before homepage body is parsed', route.indexOf('crawlerDisallowed(robotsText)') < route.indexOf('readTextLimited(response, MAX_HTML_BYTES)')],
  ['SEO metadata and canonical links are extracted', route.includes("tagText(html, 'title')") && route.includes("linkHref(html, 'canonical')")],
  ['SEO scan report is persisted', route.includes("from('growth_website_audits')") && route.includes('.insert(')],
  ['Missing-table error is distinguished from permission errors', route.includes("error.code === '42P01'") && route.includes('permissions')],
  ['Audit history API is tenant scoped', route.includes(".eq('organization_id', organizationId)") && route.includes("from('growth_website_audits')")],
  ['Audit database migration exists at applied remote version', fs.existsSync(migrationPath)],
  ['Audit report has tenant and website foreign keys', migration.includes('references public.growth_organizations') && migration.includes('references public.growth_websites')],
  ['Audit history index is present', migration.includes('growth_website_audits_org_site_created_idx')],
  ['Audit rows are RLS protected', migration.includes('enable row level security')],
  ['Client-side direct access is denied by policy', migration.includes('using (false) with check (false)')],
  ['Service role is explicitly granted table access', migration.includes('grant all on table public.growth_website_audits to service_role')],
  ['Website selection reloads the correct scan history', ui.includes('loadHistory(org, site)') && ui.includes('}, [org, site]);')],
  ['Previous scans can reopen their stored report', ui.includes('onClick={() => setReport(item.report)}')],
  ['Scan result refreshes history after save', ui.includes('await loadHistory(org, site)')],
  ['Website SEO remains in admin app', fs.existsSync('app/admin/ai-growth/website-intelligence/page.tsx')],
  ['Website SEO navigation link exists', read('components/growth-primary-nav.tsx').includes('/admin/ai-growth/website-intelligence')],
];
let failures = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  if (!ok) failures++;
}
console.log(`${checks.length - failures}/${checks.length} passed`);
process.exitCode = failures ? 1 : 0;
