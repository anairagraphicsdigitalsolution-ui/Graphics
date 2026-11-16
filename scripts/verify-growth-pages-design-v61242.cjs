const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const routes = path.join(root, 'app', 'admin', 'ai-growth');
const css = fs.readFileSync(path.join(root, 'app', 'globals.css'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
let pass = 0, fail = 0;
function check(label, ok) { if (ok) { pass++; process.stdout.write(`PASS ${label}\n`); } else { fail++; process.stdout.write(`FAIL ${label}\n`); } }
const pages = [];
function walk(dir) { for (const item of fs.readdirSync(dir, {withFileTypes:true})) { const full=path.join(dir,item.name); if(item.isDirectory()) walk(full); else if(item.name==='page.tsx') pages.push(full); } }
walk(routes);
check('all AI Growth route pages discovered', pages.length >= 25);
check('workspace shell has responsive desktop sidebar width', css.includes('--growth-sidebar-width:272px') && css.includes('padding-left:var(--growth-sidebar-width)'));
check('global page design tokens defined', ['--anaira-forest','--anaira-gold','--anaira-cream','--anaira-paper','--anaira-line'].every(x=>css.includes(x)));
check('consistent root page headings styled', css.includes('.growth-app-content :is(.growth-admin,.growth-integrations,.growth-report-page,.growth-page) h1'));
check('page sections receive shared panel treatment', css.includes('>section{min-width:0;margin:0 0 17px;padding:clamp'));
check('tables have horizontal overflow wrapper treatment', css.includes('overflow-x:auto;border:1px solid #ebe5d9'));
check('form controls receive shared styling', css.includes('textarea{min-height:94px;line-height:1.55}'));
check('primary, secondary and danger button variants styled', css.includes('.btn-secondary{background:#fffdf8') && css.includes('.btn-danger{background:#fff5f2'));
check('keyboard focus-visible treatment present', css.includes(':focus-visible{outline:3px solid #d8b56f66'));
check('tablet breakpoint included', css.includes('@media(max-width:760px)'));
check('small mobile breakpoint included', css.includes('@media(max-width:480px)'));
check('all routes have page component source', pages.every(f=>fs.statSync(f).size>0));
check('package version supports current release', ['6.124.2','6.124.3','6.124.4','6.124.5','6.124.6'].includes(pkg.version));
check('design verifier registered in full suite', pkg.scripts['verify:all'].includes('verify:growth-pages-design-v61242'));
console.log(`RESULT ${pass} PASS ${fail} FAIL · ${pages.length} routes`);
process.exit(fail?1:0);
