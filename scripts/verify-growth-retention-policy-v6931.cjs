const fs = require('fs');
const source = fs.readFileSync('app/api/growth/retention/route.ts', 'utf8');
let passed = 0;
function check(label, condition) {
  if (!condition) { console.error(`FAIL ${label}`); process.exitCode = 1; }
  else { console.log(`PASS ${label}`); passed++; }
}
check('retention query loads email bounce and complaint suppression fields', /email_bounced_at,email_complained_at/.test(source));
check('email eligibility requires explicit email channel consent and clean deliverability', source.includes('channel_consents?.email?.granted === true') && source.includes('!lead.email_bounced_at && !lead.email_complained_at'));
check('WhatsApp eligibility requires explicit channel consent', source.includes('channel_consents?.whatsapp?.granted === true'));
check('SMS eligibility requires channel-specific consent evidence', source.includes('channel_consents?.sms?.granted === true'));
check('Voice eligibility requires channel-specific consent evidence', source.includes('channel_consents?.voice?.granted === true'));
check('WhatsApp block reason explains missing channel-specific consent', source.includes('Explicit WhatsApp channel consent is not recorded'));
check('eligibility is explicitly advisory and sending re-check is required', source.includes('Eligibility is advisory only') && source.includes('re-check consent, suppression, quiet hours and provider policy'));
check('retention POST remains internal-task-only', /Internal retention task created\. No customer communication was sent\./.test(source));
check('workspace-scoped customer lookup is preserved', /eq\('id', leadId\)\.eq\('organization_id', organizationId\)/.test(source));
check('CRM role and feature gating is preserved', /requireGrowthRole[\s\S]*requireGrowthFeature/.test(source));
console.log(`Retention policy verification: ${passed}/10 PASS`);
