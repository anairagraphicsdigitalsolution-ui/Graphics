const fs=require('node:fs');
const checks=[
 ['tenant-scoped call permission migration', 'supabase/migrations/20261111170000_growth_whatsapp_call_permissions.sql', ['organization_id','enable row level security','private.is_growth_member','private.is_growth_manager']],
 ['permission request endpoint', 'app/api/growth/whatsapp/calling/permission/route.ts', ['requireGrowthRole','requireGrowthFeature','call_permission_request','24*60*60*1000','callPlaced:false']],
 ['permission reply webhook lifecycle', 'app/api/growth/whatsapp/webhook/route.ts', ['call_permission_reply','permission_status:accepted?\'granted\'','growth_whatsapp_call_permissions']],
 ['Growth Intelligence permission action', 'components/growth-intelligence.tsx', ['Request WhatsApp call permission','No call was placed']],
 ['readiness separates permission from media', 'app/api/growth/readiness/route.ts', ['whatsapp_call_permissions','WhatsApp Business Calling media','WebRTC/SIP']],
];
let failed=0;
for(const [name,file,needles] of checks){const src=fs.existsSync(file)?fs.readFileSync(file,'utf8'):'';const missing=needles.filter(n=>!src.includes(n));if(missing.length){failed++;console.error(`FAIL ${name}: ${missing.join(', ')}`);}else console.log(`PASS ${name}`);}
console.log(`${checks.length-failed}/${checks.length} WhatsApp calling permission checks passed.`);process.exitCode=failed?1:0;
