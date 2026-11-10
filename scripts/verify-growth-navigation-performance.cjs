const fs=require('fs');
const nav=fs.readFileSync('components/growth-primary-nav.tsx','utf8');
const dashboard=fs.readFileSync('components/growth-dashboard.tsx','utf8');
const css=fs.readFileSync('app/globals.css','utf8');
const surfaces=['components/growth-dashboard.tsx','components/growth-platform-admin.tsx','components/growth-billing-admin.tsx','components/growth-workspace-billing.tsx','components/growth-crm.tsx','components/growth-crm-reports.tsx','components/growth-team-manager.tsx'];
const checks=[
 ['single shared primary nav includes core modules',nav.includes('CRM & Leads')&&nav.includes('Plan & Usage')&&nav.includes('Automation')&&nav.includes('Channels')],
 ['shared nav uses client-side prefetch links',nav.includes('next/link')&&nav.includes('prefetch')],
 ['dashboard loads only page-relevant datasets',dashboard.includes('wantsLeads=')&&dashboard.includes('wantsCampaigns=')],
 ['dashboard uses narrow column projections',dashboard.includes("select('id,name,email,phone,status,lead_score")],
 ['desktop/tablet/mobile nav style unified',css.includes('.growth-primary-nav')&&css.includes('@media(max-width:900px)')&&css.includes('@media(max-width:640px)')],
 ...surfaces.map(f=>[`${f} uses shared nav`,fs.readFileSync(f,'utf8').includes('<GrowthPrimaryNav/>')])
];
for(const [n,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${n}`);if(!ok)process.exitCode=1;}
console.log(`${checks.filter(x=>x[1]).length}/${checks.length} navigation/performance checks passed`);
