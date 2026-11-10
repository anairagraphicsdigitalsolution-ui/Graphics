const fs=require('fs');
const nav=fs.readFileSync('components/growth-primary-nav.tsx','utf8');
const admin=fs.readFileSync('app/admin/page.tsx','utf8');
const billing=fs.readFileSync('app/api/growth/billing/route.ts','utf8');
const workspace=fs.readFileSync('components/growth-workspace-billing.tsx','utf8');
const software=fs.readFileSync('app/software/page.tsx','utf8');
const studio=fs.readFileSync('app/admin/page.tsx','utf8');
const checks=[
 ['navigation resolves platform-admin and workspace-member roles',nav.includes("from '@/lib/supabase'")&&nav.includes("admin_users")&&nav.includes("growth_members")],
 ['platform-only links are separated from workspace navigation',nav.includes('platformItems')&&nav.includes('...(isPlatformAdmin?platformItems:[])')],
 ['workspace Plan & Usage is shown only to workspace members',nav.includes("isWorkspaceMember?workspaceItems:[]")&&nav.includes("['billing','Plan & Usage'")],
 ['platform billing API requires platform allow-list',billing.includes("if(platformView){if(!await platformAdmin(c.db,c.userId))")],
 ['workspace billing API requires owner or manager role',billing.includes("requireGrowthRole(c.db,c.userId,orgId,['owner','manager'])")],
 ['workspace billing UI is tenant scoped',workspace.includes("filter(x=>['owner','manager'].includes(x.role))")&&workspace.includes('organizationId=${encodeURIComponent(id)}')],
 ['website CMS requires platform admin allow-list',admin.includes("from('admin_users')")&&admin.includes('Super Admin access required')],
 ['software page passes saved hero colours and overlay',software.includes('titleColor={settings.software_hero_title_color}')&&software.includes('overlayColor={settings.software_hero_overlay_color}')],
 ['studio patch merges defaults and previously saved data',studio.includes("{...(studioDefaults[page.key]||{}),...(v[key]||{}),...patch}")],
];
let failed=0;for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)failed++;}if(failed)process.exit(1);
