const fs=require('fs');
const pkg=require('../package.json');
const nav=fs.readFileSync('components/growth-primary-nav.tsx','utf8');
const css=fs.readFileSync('app/globals.css','utf8');
const layout=fs.readFileSync('app/admin/ai-growth/layout.tsx','utf8');
const checks=[
 ['release version is v6.124.0',['6.124.0','6.124.1','6.124.2','6.124.3','6.124.4','6.124.5','6.124.6','6.124.7'].includes(pkg.version),'6.124.1','6.124.2','6.124.3','6.124.4','6.124.5','6.124.6'],
 ['design verifier registered in full suite',pkg.scripts['verify:all'].includes('verify:growth-workspace-design-v61240')],
 ['desktop navigation is grouped by business workflow',['COMMAND','INTELLIGENCE','SALES & CUSTOMER','MARKETING & CHANNELS','AUTOMATION','ANALYTICS','WORKSPACE'].every(x=>nav.includes(`label:'${x}'`))],
 ['all primary workspace routes retained',['/admin/ai-growth','/admin/ai-growth/overview','/admin/ai-growth/intelligence','/admin/ai-growth/crm','/admin/ai-growth/marketing','/admin/ai-growth/social','/admin/ai-growth/campaigns','/admin/ai-growth/integrations','/admin/ai-growth/analytics','/admin/ai-growth/automation/schedules'].every(x=>nav.includes(x))],
 ['sidebar includes workspace selector and search',nav.includes('growth-nav-workspace-switcher') && nav.includes('Search navigation')],
 ['sidebar uses accessible nav landmarks',nav.includes('aria-label="Workspace modules"')&&nav.includes('aria-current')],
 ['sidebar supports mobile all-modules drawer',nav.includes('growth-mobile-more-group')&&nav.includes('growth-mobile-scrim')],
 ['topbar provides current route breadcrumb',nav.includes('growth-workspace-topbar')&&nav.includes('growth-topbar-breadcrumb')],
 ['desktop sidebar width and fixed layout styles',css.includes('--growth-sidebar-width:272px')&&css.includes('.growth-primary-nav{width:272px')],
 ['responsive mobile bottom navigation retained',css.includes('@media(max-width:900px)')&&css.includes('.growth-mobile-nav')],
 ['shared page design system styles page headers, cards, tables and forms',['.growth-app-content .growth-head','.growth-app-content :is(.growth-panel','.growth-app-content table','.growth-app-content :is(input,select,textarea)'].every(x=>css.includes(x))],
 ['reduced-motion preference respected',css.includes('prefers-reduced-motion:reduce')],
 ['Growth layout mounts navigation for all child pages',layout.includes('<GrowthPrimaryNav/>')&&layout.includes('{children}')],
];
let failed=0;for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)failed++;}
console.log(`RESULT ${checks.length-failed}/${checks.length} PASS`);if(failed)process.exit(1);
