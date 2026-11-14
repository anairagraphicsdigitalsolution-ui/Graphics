const fs=require('fs');
const nav=fs.readFileSync('components/growth-primary-nav.tsx','utf8');
const css=fs.readFileSync('app/growth-premium.css','utf8');
const dash=fs.readFileSync('components/growth-dashboard.tsx','utf8');
const login=fs.readFileSync('app/growth-login/page.tsx','utf8');
const sql=fs.readFileSync('supabase/migrations/20261109000100_anaira_ai_growth_multitenant.sql','utf8');
const checks=[
 ['desktop sidebar exists',nav.includes('growth-nav-links')&&css.includes('.growth-primary-nav{position:fixed')],
 ['mobile bottom navigation exists',nav.includes('growth-mobile-nav')&&css.includes('.growth-mobile-nav{position:fixed')],
 ['mobile More drawer exposes every module',nav.includes('growth-mobile-more')&&nav.includes('items.map')],
 ['workspace roles include editor, viewer and client',nav.includes("'editor','viewer','client'")],
 ['dedicated client sign-in uses Supabase password auth',login.includes('signInWithPassword')],
 ['password reset uses Supabase auth',login.includes('resetPasswordForEmail')],
 ['client dashboard directs unauthenticated users to Growth login',dash.includes('href="/growth-login"')],
 ['only platform admins see create-workspace control',dash.includes("activeTab==='overview'&&isPlatformAdmin")],
 ['multi-tenant organizations and memberships are defined',sql.includes('growth_organizations')&&sql.includes('growth_members')],
 ['tenant RLS policies use membership helper',sql.includes('private.is_growth_member(organization_id)')]
];
for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)process.exitCode=1;}
console.log(`${checks.filter(x=>x[1]).length}/${checks.length} Growth shell checks passed`);
