const fs=require('fs'),path=require('path');let pass=0,fail=0;const root=process.cwd();function check(n,v){if(v){pass++;console.log('PASS '+n)}else{fail++;console.error('FAIL '+n)}}
const platform=fs.readFileSync(path.join(root,'app/api/growth/platform-integrations/route.ts'),'utf8');const test=fs.readFileSync(path.join(root,'app/api/growth/platform-integrations/test/route.ts'),'utf8');const tenant=fs.readFileSync(path.join(root,'app/api/growth/integrations/route.ts'),'utf8');const resolver=fs.readFileSync(path.join(root,'lib/growth-integrations.ts'),'utf8');const ui=fs.readFileSync(path.join(root,'components/growth-integrations-center.tsx'),'utf8');const migration=fs.readFileSync(path.join(root,'supabase/migrations/20261114235000_growth_platform_integrations_v6923.sql'),'utf8');
check('Platform vault requires allow-listed Super Admin',platform.includes("from('admin_users')")&&platform.includes('Platform administrator access required'));
check('Platform credentials encrypted before storage',platform.includes('encryptSecret(secrets)'));
check('Platform API never returns secret values',platform.includes('configuredKeys')&&platform.includes('masked')&&!platform.includes('credentials:s'));
check('Workspace BYOK remains organization scoped',tenant.includes("eq('organization_id',org)")&&tenant.includes("onConflict:'organization_id,provider'"));
check('Separate platform and workspace tabs',ui.includes('Client Workspace APIs')&&ui.includes('Anaira Developer APIs'));
check('Platform fallback disabled unless shared usage is explicitly enabled',resolver.includes("platformRow.settings?.allow_shared_usage === true"));
check('OAuth app credentials are platform-managed while access tokens remain tenant-owned',resolver.includes("['meta_app','google_oauth_app','google_ads_developer']")&&resolver.includes('allowedPlatformKeys'));
check('Google Ads customer integration catalog exists',tenant.includes("google_ads:{label:'Google Ads (Client Account)'"));
check('Platform Google Ads developer token is separate',platform.includes("google_ads_developer:{label:'Google Ads Developer Token'"));
check('Platform API test endpoint is Super Admin protected',test.includes("from('admin_users')")&&test.includes("provider==='google_ads_developer'"));
check('Platform vault migration denies direct client access',migration.includes('enable row level security')&&migration.includes('using (false)')&&migration.includes('grant all on public.growth_platform_integrations to service_role'));
console.log(`\n${pass} PASS / ${fail} FAIL`);process.exit(fail?1:0);
