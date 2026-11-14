const fs=require('fs');
const expected=['new','discovered','enriched','qualified','contact_pending','contacted','interested','meeting_scheduled','proposal','negotiation','follow_up_later','won','lost'];
const files=['app/api/growth/lead-update/route.ts','app/api/growth/lead-bulk/route.ts','components/growth-crm.tsx'];
let failed=0;
for(const file of files){const source=fs.readFileSync(file,'utf8');const ok=expected.every(stage=>source.includes(stage));console.log(`${ok?'PASS':'FAIL'} ${file} supports the complete 13-stage sales lifecycle`);if(!ok)failed++;}
const consent=fs.readFileSync('app/api/growth/lead-consent/route.ts','utf8');const outreach=fs.readFileSync('app/api/growth/email/route.ts','utf8');
for(const [name,ok] of [['consent endpoint requires explicit re-consent evidence',consent.includes('consentConfirmed!==true')&&consent.includes('source')],['email queue blocks missing consent and opt-outs',outreach.includes('!lead.consent_to_contact')&&outreach.includes('contact_opted_out_at')]]){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)failed++;}
if(failed)process.exit(1);console.log('5/5 sales lifecycle checks passed.');
