const fs=require('fs');
const css=fs.readFileSync('app/globals.css','utf8');
const premium=fs.readFileSync('app/growth-premium.css','utf8');
const layout=fs.readFileSync('app/admin/ai-growth/layout.tsx','utf8');
const checks=[
 ['Every Growth route is wrapped by shared application shell',layout.includes('growth-app-shell')&&layout.includes('growth-app-content')],
 ['Desktop shell reserves exactly the fixed sidebar width',/\.growth-app-shell\{[^}]*--growth-sidebar-width:244px[^}]*padding-left:var\(--growth-sidebar-width\)/s.test(premium)],
 ['Desktop content does not add a second sidebar offset',/@media\s*\(min-width:\s*901px\)\{[^}]*\.growth-admin,\.growth-integrations\{padding-left:clamp\(12px,1\.4vw,22px\)!important/s.test(css)],
 ['Desktop sidebar remains visible above 900px',/@media \(min-width:901px\)\{[\s\S]*?\.growth-primary-nav\{display:flex!important\}/.test(css)],
 ['Mobile shell removes reserved desktop sidebar space',/@media\(max-width:900px\)\{\.growth-app-shell\{padding-left:0/s.test(premium)],
 ['Navigation switches to mobile at the same 900px breakpoint',/@media\(max-width:900px\)\{[\s\S]*?\.growth-primary-nav\{display:none!important\}/.test(premium)],
 ['No conflicting 1200px sidebar-hide breakpoint remains',!/@media\(max-width:1200px\)[\s\S]{0,1200}\.growth-primary-nav\{display:none!important\}/.test(css)],
 ['Content descendants are constrained to prevent horizontal spill',premium.includes('.growth-app-content>*{min-width:0;max-width:100%}')],
 ['Wide tables are contained in horizontal scroll wrappers',premium.includes('overflow-x:auto;max-width:100%;scrollbar-width:thin')],
 ['Images, video and canvas stay within content width',premium.includes('.growth-app-content img,.growth-app-content video,.growth-app-content canvas{max-width:100%;height:auto}')]
];
for(const [name,ok] of checks) console.log(`${ok?'PASS':'FAIL'} ${name}`);
console.log(`${checks.filter(x=>x[1]).length}/${checks.length} layout regression checks passed`);
if(checks.some(x=>!x[1]))process.exitCode=1;
