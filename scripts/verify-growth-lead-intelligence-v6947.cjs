const fs = require('fs');
const discovery = fs.readFileSync('app/api/growth/prospect-discovery/route.ts', 'utf8');
const verification = fs.readFileSync('app/api/growth/prospect-verification/route.ts', 'utf8');
const qualification = fs.readFileSync('app/api/growth/prospect-qualification/route.ts', 'utf8');
const ui = fs.readFileSync('components/growth-intelligence.tsx', 'utf8');
const worker = fs.readFileSync('app/api/growth/worker/route.ts', 'utf8');
const checks = [
  ['discovery remains tenant-scoped', discovery.includes("eq('organization_id',orgId)")],
  ['discovery deduplicates within workspace by canonical domain', discovery.includes("eq('website_domain',domain)") && discovery.includes('website_domain:domain')],
  ['discovery never assumes outreach consent', discovery.includes('consent_to_contact:false')],
  ['email and phone verification run in parallel with website check', verification.includes('Promise.all([')],
  ['verification route has bounded deployment duration', verification.includes('maxDuration = 45')],
  ['verification clearly disclaims ownership and consent proof', verification.includes('does not prove the person owns the number or consents to contact')],
  ['AI qualification is tenant-scoped', qualification.includes("eq('id', prospectId).eq('organization_id', orgId)")],
  ['AI qualification has a provider timeout', qualification.includes('AbortSignal.timeout(20000)')],
  ['intent requires an explicit direct enquiry', qualification.includes('clean(body.directEnquiry, 2000)')],
  ['intent evidence is source-allow-listed', qualification.includes("clean(x.source, 80) === 'user_provided_enquiry'")],
  ['server forces intent to zero without direct enquiry evidence', qualification.includes('hasDirectIntentEvidence ? clamp(result.intent_score) : 0')],
  ['scheduled AI qualification forces public-prospect intent to zero', worker.includes('intent=0')],
  ['UI explains the distinction between fit and buying intent', ui.includes('Public website/contact details never count as buying intent')],
  ['UI accepts optional direct enquiry evidence', ui.includes('directEnquiry') && ui.includes('Direct customer enquiry')],
];
let failed = 0;
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failed++; }
console.log(`${checks.length - failed}/${checks.length} Lead Intelligence v6.94.7 checks passed.`);
process.exit(failed ? 1 : 0);
