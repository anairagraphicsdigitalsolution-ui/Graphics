const fs = require('fs');
const dashboard = fs.readFileSync('components/growth-dashboard.tsx', 'utf8');
const control = fs.readFileSync('components/growth-control-center.tsx', 'utf8');
const primary = fs.readFileSync('components/growth-primary-nav.tsx', 'utf8');
const checks = [
  ['dashboard has dedicated module navigation', dashboard.includes('<GrowthPrimaryNav/>') && primary.includes('growth-module-nav')],
  ['CRM and Leads have a dedicated tab', primary.includes('CRM & Leads') && dashboard.includes("activeTab==='leads'")],
  ['Content Studio has a dedicated tab', primary.includes('Content Studio') && dashboard.includes("activeTab==='content'")],
  ['Tasks have a dedicated tab', primary.includes('Tasks') && dashboard.includes("activeTab==='tasks'")],
  ['Campaigns have a dedicated tab', primary.includes('Campaigns & Ads') && dashboard.includes("activeTab==='campaigns'")],
  ['AI Control Center is separated from dashboard modules', primary.includes('AI Employee') && dashboard.includes("activeTab==='control'")],
  ['Control Center has its own sub-navigation', control.includes('growth-subnav')],
  ['AI Employee route opens the unified inbox panel by default', fs.readFileSync('app/admin/ai-growth/employee/page.tsx','utf8').includes('initialPanel="channels"')],
  ['AI & Workflows panel is isolated', control.includes("panel==='assistant'")],
  ['Analytics panel is isolated', control.includes("panel==='analytics'")],
  ['Channels and Inbox panel is isolated', control.includes("panel==='channels'")],
  ['Ads Manager panel is isolated', control.includes("panel==='ads'")],
  ['Main portfolio admin remains a separate route', dashboard.includes('href="/admin"')],
];
let failed = 0;
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failed++; }
if (failed) process.exit(1);
