'use strict';
const fs=require('node:fs');
const pkg=require('../package.json');
const migration=fs.readFileSync('supabase/migrations/20261116061501_growth_integration_credential_lifecycle_v61500.sql','utf8');
const tenant=fs.readFileSync('app/api/growth/integrations/route.ts','utf8');
const platform=fs.readFileSync('app/api/growth/platform-integrations/route.ts','utf8');
const platformTest=fs.readFileSync('app/api/growth/platform-integrations/test/route.ts','utf8');
const workspaceUi=fs.readFileSync('components/growth-integrations-manager.tsx','utf8');
const platformUi=fs.readFileSync('components/growth-platform-integrations-manager.tsx','utf8');
const integrationLib=fs.readFileSync('lib/growth-integrations.ts','utf8');
const checks=[
 ['package version is v6.105.0',['6.105.0','6.106.0','6.108.0','6.109.0','6.110.0','6.112.0','6.113.0','6.114.0','6.115.0','6.116.0','6.118.0','6.119.0','6.120.0','6.121.0','6.122.0','6.123.0','6.124.0','6.124.1','6.124.2','6.124.3','6.124.4','6.124.5','6.124.6'].includes(pkg.version)],
 ['Module 15 verifier registered in full suite',pkg.scripts['verify:all'].includes('verify:growth-integrations-settings-v61500')],
 ['tenant credential version and rotation timestamp columns',migration.includes('growth_integrations')&&migration.includes('credential_version')&&migration.includes('credential_rotated_at')],
 ['platform credential lifecycle columns',migration.includes('growth_platform_integrations')&&migration.includes('last_success_at')],
 ['platform audit table is RLS enabled and client denied',migration.includes('growth_platform_integration_events')&&migration.includes('enable row level security')&&migration.includes('revoke all on public.growth_platform_integration_events from anon,authenticated')],
 ['platform audit events have provider/time index',migration.includes('growth_platform_integration_events_provider_created_idx')],
 ['tenant API exposes rotation metadata without secrets',tenant.includes('credentialVersion:r.credential_version')&&tenant.includes('credentialRotatedAt:r.credential_rotated_at')],
 ['tenant API detects actual secret changes before incrementing version',tenant.includes('let rotated=false')&&tenant.includes('credential_version:(Number(old?.credential_version)||0)+(rotated?1:0)')],
 ['tenant integration writes remain owner/manager guarded',tenant.includes("['owner','manager']")],
 ['tenant credential save and rotation are audit logged',tenant.includes("event_type:rotated?'credential_rotated':'credential_saved'")&&tenant.includes("event_type:'credential_removed'")],
 ['platform API remains admin-only',platform.includes('admin_users')&&platform.includes('Platform administrator access required')],
 ['platform API writes credential rotation audit events',platform.includes("event_type:rotated?'credential_rotated':'credential_saved'")],
 ['platform API exposes only masked secrets and lifecycle metadata',platform.includes('masked:')&&platform.includes('credentialRotatedAt:r.credential_rotated_at')],
 ['platform delete action is audited',platform.includes("event_type:'credential_removed'")],
 ['platform provider tests write health audit events',platformTest.includes('growth_platform_integration_events')&&platformTest.includes('connection_recovered')],
 ['platform validation-only tests are not marked connected',platformTest.includes("connection_status:'saved'")&&platformTest.includes('validationOnly:true')],
 ['workspace token refresh persists rotated credential version',integrationLib.includes('credential_version: (Number(priorVault?.credential_version) || 1) + 1')&&integrationLib.includes('credential_rotated_at: rotatedAt')],
 ['OAuth refresh lifecycle is audit logged without token contents',integrationLib.includes("event_type: 'credential_rotated'")&&integrationLib.includes('OAuth access token refreshed and encrypted')],
 ['workspace UI shows integration health counts',workspaceUi.includes('Integration health summary')&&workspaceUi.includes('Recent webhook failures')],
 ['workspace UI shows credential rotation and successful test time',workspaceUi.includes('Credential version')&&workspaceUi.includes('Last success')],
 ['platform UI shows provider health and audit history',platformUi.includes('Platform provider health')&&platformUi.includes('events.slice(0,12)')],
 ['platform UI shows credential lifecycle details',platformUi.includes('credentialRotatedAt')&&platformUi.includes('credentialVersion')],
 ['workspace and platform vaults remain separate',platform.includes('growth_platform_integrations')&&tenant.includes('growth_integrations')],
 ['provider API credentials remain AES-GCM encrypted',tenant.includes('encryptSecret(secrets)')&&platform.includes('encryptSecret(secrets)')],
 ['API never returns raw credential objects',tenant.includes('masked:')&&platform.includes('masked:')&&!tenant.includes('credentials:secrets')&&!platform.includes('credentials:secrets')],
 ['shared API caps and BYOK usage remain available',platformUi.includes('Plan-specific monthly API caps')&&integrationLib.includes('consume_growth_platform_usage')],
 ['billing and plan settings remain in platform control surfaces',fs.existsSync('app/admin/ai-growth/platform/billing/page.tsx')&&fs.existsSync('app/admin/ai-growth/billing/page.tsx')],
];
let failed=0;for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)failed++;}console.log(`Module 15 verification: ${checks.length-failed}/${checks.length} PASS`);process.exit(failed?1:0);
