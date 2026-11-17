const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'app/admin/ai-growth/google-ads/page.tsx'), 'utf8');
const briefing = fs.readFileSync(path.join(root, 'app/api/growth/briefing/route.ts'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const reconciliation = fs.readFileSync(path.join(root, 'app/api/growth/analytics/reconciliation/route.ts'), 'utf8');
let pass=0,fail=0;
function check(label,ok){if(ok){pass++;console.log(`PASS ${label}`)}else{fail++;console.log(`FAIL ${label}`)}}
check('Google Ads campaign has an explicit non-empty fallback type', page.includes("const c: NonNullable<Campaign['campaign']> = row.campaign ?? {id:'',name:'',status:'UNKNOWN',advertisingChannelType:'UNKNOWN'}"));
check('Google Ads campaign id and name are accessed on typed object', page.includes('key={c.id||i}') && page.includes('{c.name||c.id}'));
check('Briefing distinguishes exhausted OpenAI credits', briefing.includes('OpenAI API credits are exhausted. Add credits in the OpenAI Platform billing settings'));
check('Briefing preserves rule-based fallback on provider 429', briefing.includes('Rule-based briefing metrics are shown in the meantime.'));
check('Function returns fallback response rather than failing request', briefing.includes('return apiJson({ briefing, metrics, aiMode, aiNotice });'));
check('Reconciliation date validator is declared at module scope', /^const validDate = \(s: string\)/m.test(reconciliation));
check('GET and POST both use the shared date validator', (reconciliation.match(/validDate\(/g) || []).length >= 3);
check('Release version bumped', ['6.124.4','6.124.5','6.124.6','6.124.7'].includes(pkg.version));
console.log(`RESULT ${pass} PASS ${fail} FAIL`);
process.exit(fail?1:0);
