const fs=require('fs');
const checks=[
 ['team invitation schema exists',fs.existsSync('supabase/migrations/20261109260000_growth_team_invitations_v676.sql')],
 ['team invitation API supports create/list/role/revoke',fs.readFileSync('app/api/growth/team/route.ts','utf8').includes('inviteUserByEmail')&&fs.readFileSync('app/api/growth/team/route.ts','utf8').includes('export async function PATCH')&&fs.readFileSync('app/api/growth/team/route.ts','utf8').includes('export async function DELETE')],
 ['invitation acceptance checks exact user and email',fs.readFileSync('app/api/growth/team/accept/route.ts','utf8').includes('invite.invited_user_id!==c.userId')&&fs.readFileSync('app/api/growth/team/accept/route.ts','utf8').includes('invited_email.toLowerCase()')],
 ['team UI supports role change and removal',fs.readFileSync('components/growth-team-manager.tsx','utf8').includes("'/api/growth/team','PATCH'")&&fs.readFileSync('components/growth-team-manager.tsx','utf8').includes("'/api/growth/team','DELETE'")],
 ['platform tenant API checks the verified user against admin_users',/from\('admin_users'\).*eq\('user_id',userId\)/.test(fs.readFileSync('app/api/growth/platform/route.ts','utf8'))],
 ['service-role admin checks do not depend on auth.uid RPC context',!fs.readFileSync('lib/growth-server.ts','utf8').includes("rpc('is_anaira_admin')")&&fs.readFileSync('lib/growth-server.ts','utf8').includes("eq('user_id', userId)")],
 ['platform admin audit log is written',fs.readFileSync('app/api/growth/platform/route.ts','utf8').includes('growth_platform_audit_events')],
 ['shared role helper enforces active tenant status',fs.readFileSync('lib/growth-server.ts','utf8').includes("organization.status === 'active'")],
 ['independent module routes exist', ['overview','crm','marketing','tasks','campaigns','employee','automation','channels','analytics','team','platform'].every(x=>fs.existsSync(`app/admin/ai-growth/${x}/page.tsx`))],
 ['workspace selection persists across module routes',fs.readFileSync('components/growth-dashboard.tsx','utf8').includes('anaira-growth-active-org')],
];let failed=0;for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)failed++;}if(failed)process.exit(1);
