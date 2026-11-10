const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const route=fs.readFileSync(path.join(root,'app/api/growth/email/unsubscribe/route.ts'),'utf8');
const signer=fs.readFileSync(path.join(root,'lib/growth-email-unsubscribe.ts'),'utf8');
const worker=fs.readFileSync(path.join(root,'app/api/growth/worker/route.ts'),'utf8');
const checks=[
 ['HMAC signer and constant-time verification',/createHmac\('sha256'/.test(signer)&&/timingSafeEqual/.test(signer)],
 ['signed token verification in route',/verifyUnsubscribeToken/.test(route)],
 ['expiry enforced',/180 \* 86400/.test(signer)&&/value\.e < Math\.floor/.test(signer)],
 ['tenant-scoped contact update',/eq\('id', identity\.leadId\)\.eq\('organization_id', identity\.organizationId\)/.test(route)],
 ['one-click POST supports token URL',/export async function POST/.test(route)&&/searchParams.get\('token'\)/.test(route)&&/List-Unsubscribe=One-Click/.test(worker)],
 ['consent revoked',/consent_to_contact: false/.test(route)&&/contact_opted_out_at: now/.test(route)],
 ['audit timeline entry',/growth_lead_activities/.test(route)&&/email_one_click_unsubscribe/.test(route)],
 ['email worker includes unsubscribe link',/createUnsubscribeToken/.test(worker)&&/List-Unsubscribe/.test(worker)],
 ['no cross-tenant lookup by lead id alone',/eq\('organization_id', identity\.organizationId\)/.test(route)]
];
for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)process.exitCode=1;}
console.log(`${checks.filter(x=>x[1]).length}/${checks.length} checks passed`);
