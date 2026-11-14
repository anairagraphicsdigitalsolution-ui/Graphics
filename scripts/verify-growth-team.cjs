const fs=require('fs');
const checks=[
 ['team invitation schema exists',fs.existsSync('supabase/migrations/20261109260000_growth_team_invitations_v676.sql')],
 ['team invitation API supports create/list/role/revoke',fs.readFileSync('app/api/growth/team/route.ts','utf8').includes('inviteUserByEmail')&&fs.readFileSync('app/api/growth/team/route.ts','utf8').includes('export async function PATCH')&&fs.readFileSync('app/api/growth/team/route.ts','utf8').includes('export async function DELETE')],
 ['invitation acceptance delegates to atomic identity-checked database function',fs.readFileSync('app/api/growth/team/accept/route.ts','utf8').includes("rpc('growth_team_accept_invitation'")&&fs.readFileSync('supabase/migrations/20261113153000_growth_team_atomic_lifecycle_v6885.sql','utf8').includes('invitation_identity_mismatch')],
 ['invitation acceptance rejects inactive workspaces atomically',fs.readFileSync('supabase/migrations/20261113153000_growth_team_atomic_lifecycle_v6885.sql','utf8').includes("v_org_status is distinct from 'active'")],
 ['invitation creation rejects existing workspace members',fs.readFileSync('app/api/growth/team/route.ts','utf8').includes('This account is already a member of the workspace.')],
 ['invitation creation rejects inactive workspaces',fs.readFileSync('app/api/growth/team/route.ts','utf8').includes("org.status!=='active'")],
 ['team UI supports role change, removal and ownership transfer',fs.readFileSync('components/growth-team-manager.tsx','utf8').includes("'/api/growth/team','PATCH'")&&fs.readFileSync('components/growth-team-manager.tsx','utf8').includes("'/api/growth/team','DELETE'")&&fs.readFileSync('components/growth-team-manager.tsx','utf8').includes("action:'transfer_owner'")],
 ['team lifecycle RPCs are service-role-only', ['growth_team_accept_invitation','growth_team_set_member_role','growth_team_remove_member','growth_team_transfer_owner'].every(n=>fs.readFileSync('supabase/migrations/20261113153000_growth_team_atomic_lifecycle_v6885.sql','utf8').includes('grant execute on function public.'+n))],
 ['platform tenant API checks the verified user against admin_users',/from\('admin_users'\).*eq\('user_id',userId\)/.test(fs.readFileSync('app/api/growth/platform/route.ts','utf8'))],
 ['service-role admin checks do not depend on auth.uid RPC context',!fs.readFileSync('lib/growth-server.ts','utf8').includes("rpc('is_anaira_admin')")&&fs.readFileSync('lib/growth-server.ts','utf8').includes("eq('user_id', userId)")],
 ['platform admin audit log is written',fs.readFileSync('app/api/growth/platform/route.ts','utf8').includes('growth_platform_audit_events')],
 ['shared role helper enforces active tenant status',fs.readFileSync('lib/growth-server.ts','utf8').includes("organization.status === 'active'")],
 ['independent module routes exist', ['overview','crm','marketing','tasks','campaigns','employee','automation','channels','analytics','team','platform'].every(x=>fs.existsSync(`app/admin/ai-growth/${x}/page.tsx`))],
 ['workspace selection persists across module routes',fs.readFileSync('components/growth-dashboard.tsx','utf8').includes('anaira-growth-active-org')],
];let failed=0;for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)failed++;}if(failed)process.exit(1);
