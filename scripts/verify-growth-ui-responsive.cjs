const fs=require('fs');
const css=fs.readFileSync('app/globals.css','utf8');
const report=fs.readFileSync('components/growth-crm-reports.tsx','utf8');
const inbox=fs.readFileSync('components/growth-inbox.tsx','utf8');
const checks=[
 ['Growth admin uses full viewport width',/\.growth-admin\{[^}]*width:100%[^}]*max-width:none/s.test(css)],
 ['Tablet breakpoint included',/@media\(max-width:900px\)/.test(css)],
 ['Mobile breakpoint included',/@media\(max-width:640px\)/.test(css)],
 ['Mobile module navigation can scroll horizontally without page overflow',/\.growth-module-nav\{[^}]*overflow-x:auto/s.test(css)],
 ['Growth tables have horizontal overflow containment',/\.growth-admin \.table-wrap[^}]*overflow-x:auto/.test(css)],
 ['CRM reports no longer use max-width centered container',report.includes('growth-report-page growth-sales-report')&&!report.includes('max-w-7xl')],
 ['Inbox conversation list no longer has fixed 520px nested scroll',inbox.includes('growth-inbox-list')&&!inbox.includes('maxHeight:520')],
 ['Reduced-motion preference supported',/prefers-reduced-motion:reduce/.test(css)]
];
for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)process.exitCode=1;}
console.log(`${checks.filter(x=>x[1]).length}/${checks.length} responsive UI checks passed`);
