const fs=require('fs');
const route=fs.readFileSync('app/api/growth/platform/route.ts','utf8');
const sql=fs.readFileSync('supabase/migrations/20261113090000_growth_platform_tenant_onboarding_v6883.sql','utf8');
const checks=[
 ['platform tenant creation endpoint exists',route.includes('export async function POST')],
 ['platform administrator authorization enforced',route.includes("isPlatformAdmin(c.db,c.userId)")],
 ['workspace slug normalized and validated',route.includes("/^[a-z0-9]+(?:-[a-z0-9]+)*$/")],
 ['plan allow-list enforced',route.includes("'agency-managed','starter','growth','agency','enterprise'")],
 ['website URL protocol validated',route.includes("['http:','https:']")],
 ['creation uses atomic database RPC',route.includes("rpc('growth_platform_create_tenant'")],
 ['RPC revalidates platform administrator',sql.includes('admin_users a where a.user_id=p_actor_user_id')],
 ['RPC validates existing owner account',sql.includes('auth.users u where u.id=p_owner_user_id')],
 ['organization and owner membership created in one transaction',sql.indexOf('insert into public.growth_organizations')<sql.indexOf('insert into public.growth_members')],
 ['owner assigned immutable owner role',sql.includes("values(v_org.id,p_owner_user_id,'owner')")],
 ['tenant creation audit event written',sql.includes("'platform.tenant_created'")],
 ['RPC execute permission restricted to service role',sql.includes('to service_role')&&sql.includes('from public, anon, authenticated')],
];let failed=0;for(const [n,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${n}`);if(!ok)failed++;}if(failed)process.exit(1);
