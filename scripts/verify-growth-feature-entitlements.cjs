const fs=require('fs'),path=require('path');const read=p=>fs.readFileSync(path.join(process.cwd(),p),'utf8');
const server=read('lib/growth-server.ts'),billing=read('components/growth-billing-admin.tsx');
const automation=read('app/api/growth/automation/route.ts'),wa=read('app/api/growth/whatsapp/send/route.ts'),social=read('app/api/growth/social-connect/route.ts'),ads=read('app/api/growth/ad-activation/route.ts');
const checks=[
 ['shared plan entitlement resolver exists',/requireGrowthFeature/.test(server)],
 ['platform administrators bypass tenant plan gates',/admin_users/.test(server)&&/return true/.test(server)],
 ['active subscription and plan status are checked',/period_end/.test(server)&&/subscription\.status/.test(server)&&/plan\?\.is_active/.test(server)],
 ['explicit disabled feature denies access',/features\[feature\] !== false/.test(server)],
 ['workflow APIs enforce automation entitlement',/requireGrowthFeature\(c\.db,c\.userId,orgId,'automation'\)/.test(automation)],
 ['WhatsApp outbound enforces WhatsApp entitlement',/requireGrowthFeature\(c\.db,c\.userId,orgId,'whatsapp'\)/.test(wa)],
 ['social OAuth enforces social channel entitlement',/requireGrowthFeature\(context\.db, context\.userId, organizationId, 'social_channels'\)/.test(social)],
 ['Meta ads activation enforces ads entitlement',/requireGrowthFeature\(ctx\.db,ctx\.userId,organizationId,'ads'\)/.test(ads)],
 ['CRM lead updates enforce CRM entitlement',/requireGrowthFeature\(ctx\.db, ctx\.userId, orgId, 'crm'\)/.test(read('app/api/growth/lead-update/route.ts'))],
 ['CRM tasks enforce CRM entitlement on reads and writes',(read('app/api/growth/task/route.ts').match(/requireGrowthFeature/g)||[]).length>=3],
 ['CRM imports and activities enforce CRM entitlement',/requireGrowthFeature/.test(read('app/api/growth/crm/import/route.ts'))&& (read('app/api/growth/crm/activities/route.ts').match(/requireGrowthFeature/g)||[]).length>=2],
 ['CRM attachments enforce CRM entitlement',/requireGrowthFeature\(db,userId,orgId,'crm'\)/.test(read('app/api/growth/crm/attachments/route.ts'))],
 ['CRM analytics enforce CRM entitlement',/requireGrowthFeature\(c\.db,c\.userId,orgId,'crm'\)/.test(read('app/api/growth/analytics/route.ts'))],
 ['Super Admin can configure plan feature toggles',/toggleFeature/.test(billing)&&/features:next/.test(billing)],
 ['new plans expose module entitlements',/Included modules/.test(billing)&&/setFeatures/.test(billing)]
];
for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)process.exitCode=1;}
console.log(`${checks.filter(x=>x[1]).length}/${checks.length} feature-entitlement checks passed`);
