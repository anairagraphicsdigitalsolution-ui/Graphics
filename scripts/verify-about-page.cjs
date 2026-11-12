const fs = require('fs');
const page = fs.readFileSync('app/about/page.tsx', 'utf8');
const css = fs.readFileSync('app/globals.css', 'utf8');
const checks = [
  ['About page keeps saved CMS content and defaults', page.includes('getPortfolioContent') && page.includes('aboutDefaults')],
  ['Hero CTA links to Contact page', page.includes('href="/contact"')],
  ['At-a-glance proof strip is present', page.includes('about-proof-strip') && page.includes('Creative · Digital · Technology')],
  ['Story, mission, values and journey sections remain present', ['about-premium-story','about-mission','about-values-premium','about-journey'].every(x => page.includes(x))],
  ['Capabilities links remain connected', page.includes('about-cap-links') && page.includes('href="/software"')],
  ['Desktop section rhythm is tightened', css.includes('.about-premium-story{padding-top:72px;padding-bottom:76px}') && css.includes('.about-values-premium,.about-journey{padding-top:72px;padding-bottom:76px}')],
  ['Mission and CTA spacing is tightened', css.includes('.about-mission{padding-top:62px;padding-bottom:62px}') && css.includes('.about-final-cta{padding:58px 0}')],
  ['Mobile spacing and proof strip are responsive', css.includes('@media(max-width:640px)') && css.includes('.about-proof-grid{grid-template-columns:1fr;gap:0;padding-top:10px;padding-bottom:10px}')],
];
let failed=0;
for (const [name, ok] of checks) { console.log(`${ok?'PASS':'FAIL'} ${name}`); if (!ok) failed++; }
console.log(`About page verification: ${checks.length-failed}/${checks.length} passed`);
if (failed) process.exit(1);
