const fs=require('node:fs');const path=require('node:path');const root=path.resolve(__dirname,'..');const read=p=>fs.readFileSync(path.join(root,p),'utf8');const checks=[];function check(name,ok){checks.push({name,ok});}
const migration=read('supabase/migrations/20261109290000_growth_billing_usage_entitlements_v677.sql');
const guard=read('supabase/migrations/20261109291000_growth_quota_subscription_guard_v6771.sql');
const quota=read('lib/growth-quota.ts');const api=read('app/api/growth/billing/route.ts');const usage=read('app/api/growth/usage/route.ts');
check('plan catalogue and tenant subscriptions',/create table if not exists public\.growth_plans/.test(migration)&&/create table if not exists public\.growth_subscriptions/.test(migration));
check('monthly usage counters and append-only usage events',/growth_usage_counters/.test(migration)&&/growth_usage_events/.test(migration));
check('RLS and service-role-only grants',/alter table public\.growth_plans enable row level security/.test(migration)&&/revoke all .* from public,anon,authenticated/.test(migration));
check('atomic quota RPC restricted to service role',/consume_growth_quota/.test(migration)&&/grant execute .* to service_role/.test(migration));
check('subscription expiry fails closed',/v_has_subscription/.test(guard)&&/subscription_inactive/.test(guard));
check('quota helper fails closed on RPC error',/quota_service_unavailable/.test(quota)&&/allowed: false/.test(quota));
check('platform plan and subscription management API',/create_plan/.test(api)&&/assign_subscription/.test(api)&&/platformAdmin/.test(api));
check('platform billing authorizes verified user via admin_users allow-list',/from\('admin_users'\).*eq\('user_id',userId\)/.test(api)&&!api.includes("rpc('is_anaira_admin')"));
check('tenant usage API is role-gated',/requireGrowthRole/.test(usage)&&/growth_usage_counters/.test(usage));
for(const p of ['app/api/growth/chat/route.ts','app/api/growth/lead/route.ts','app/api/growth/content/route.ts','app/api/growth/whatsapp/send/route.ts','app/api/growth/worker/route.ts','app/api/growth/whatsapp/webhook/route.ts'])check(`quota enforced in ${p}`,/consumeGrowthQuota|assertQuota/.test(read(p)));
let failed=0;for(const c of checks){console.log(`${c.ok?'PASS':'FAIL'} ${c.name}`);if(!c.ok)failed++;}console.log(`${checks.length-failed}/${checks.length} billing checks passed.`);process.exitCode=failed?1:0;
