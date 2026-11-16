const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20261115140000_growth_channel_specific_consent_v6939.sql'), 'utf8');
const api = fs.readFileSync(path.join(root, 'app/api/growth/lead-consent/route.ts'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'app/api/growth/worker/route.ts'), 'utf8');
const unsubscribe = fs.readFileSync(path.join(root, 'app/api/growth/email/unsubscribe/route.ts'), 'utf8');
const retention = fs.readFileSync(path.join(root, 'app/api/growth/retention/route.ts'), 'utf8');
const crm = fs.readFileSync(path.join(root, 'components/growth-crm.tsx'), 'utf8');
const directWhatsApp = fs.readFileSync(path.join(root, 'app/api/growth/whatsapp/send/route.ts'), 'utf8');
const directTemplate = fs.readFileSync(path.join(root, 'app/api/growth/whatsapp/templates/send/route.ts'), 'utf8');
const voice = fs.readFileSync(path.join(root, 'app/api/growth/voice-calls/route.ts'), 'utf8');
const inbox = fs.readFileSync(path.join(root, 'app/api/growth/inbox/reply/route.ts'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const checks = [
 ['channel consent JSONB column is created with an object constraint', /add column if not exists channel_consents jsonb/i.test(migration) && /jsonb_typeof\(channel_consents\) = 'object'/i.test(migration)],
 ['supported channels are allow-listed in the database function', /p_channel not in \('email','whatsapp','sms','voice'\)/.test(migration)],
 ['grant requires consent source and method evidence', /consent_evidence_required/.test(migration)],
 ['database function verifies owner or manager for grants', /coalesce\(v_role,''\) not in \('owner','manager'\)/.test(migration)],
 ['database function is service-role-only', /revoke all on function[\s\S]*from public, anon, authenticated/i.test(migration) && /grant execute on function[\s\S]*to service_role/i.test(migration)],
 ['channel consent endpoint validates the selected channel and evidence', /includes\(channel\)/.test(api) && /consentConfirmed!==true/.test(api)],
 ['global opt-out clears every channel consent', /channel_consents:\{email:[\s\S]*whatsapp:[\s\S]*sms:[\s\S]*voice:/.test(api)],
 ['WhatsApp free-form and template dispatch require WhatsApp-specific consent', (worker.match(/channel_consents\?\.whatsapp\?\.granted!==true/g)||[]).length >= 2],
 ['email dispatch requires email-specific consent', /channel_consents\?\.email\?\.granted!==true/.test(worker)],
 ['email one-click unsubscribe revokes email channel only through the RPC', /growth_set_lead_channel_consent/.test(unsubscribe) && /p_channel:\s*'email'/.test(unsubscribe) && !/contact_opted_out_at:\s*now/.test(unsubscribe)],
 ['retention eligibility reads channel-specific consent', /channel_consents\?\.email\?\.granted/.test(retention) && /channel_consents\?\.whatsapp\?\.granted/.test(retention)],
 ['manual WhatsApp and approved-template endpoints require WhatsApp consent', directWhatsApp.includes('channel_consents?.whatsapp?.granted!==true') && directTemplate.includes('channel_consents?.whatsapp?.granted!==true')],
 ['Twilio voice call initiation requires voice-specific consent', voice.includes('channel_consents?.voice?.granted!==true')],
 ['human inbox email and WhatsApp replies require channel-specific consent', inbox.includes('channel_consents?.email?.granted!==true') && inbox.includes('channel_consents?.whatsapp?.granted===true')],
 ['CRM exposes evidence-source controls to record and revoke channel consent', /Consent evidence source/.test(crm) && /updateChannelConsent/.test(crm)],
 ['release version and verifier are registered', /^6\.(?:93\.9|(?:95|96|97|98|99|100|101|102|103|104|105|106|107|108|109|110|111|112|113|114|115|116|117|118|119|120|121|122|123|124)\.\d+)$/.test(pkg.version) && pkg.scripts['verify:all'].includes('verify:growth-channel-consent-v6939')]
];
let failed=0;
for (const [label, ok] of checks) { console.log(`${ok?'PASS':'FAIL'} ${label}`); if(!ok) failed++; }
console.log(`Channel consent verification: ${checks.length-failed}/${checks.length} PASS`);
process.exitCode=failed?1:0;
