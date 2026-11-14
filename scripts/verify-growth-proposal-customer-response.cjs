const fs = require('node:fs');
const send = fs.readFileSync('app/api/growth/crm/proposals/send/route.ts', 'utf8');
const route = fs.readFileSync('app/api/growth/proposals/respond/route.ts', 'utf8');
const page = fs.readFileSync('components/growth-proposal-response.tsx', 'utf8');
const migration = fs.readFileSync('supabase/migrations/20261113173000_growth_proposal_customer_response_links_v6897.sql', 'utf8');
const guard = fs.readFileSync('supabase/migrations/20261113174000_growth_proposal_queue_null_guard_v6897b.sql', 'utf8');
const worker = fs.readFileSync('app/api/growth/worker/route.ts', 'utf8');
const tests = [
 ['proposal sender creates a cryptographically random response token', send.includes('randomBytes(32)') && send.includes("createHash('sha256')")],
 ['proposal email includes customer response URL', send.includes("new URL('/proposal-response'") && send.includes('responseUrl.toString()') && send.includes('Review and respond securely to this proposal')],
 ['response token expiry follows proposal validity or a 30-day default', send.includes('proposal.valid_until') && send.includes('30 * 24 * 60 * 60 * 1000')],
 ['queue RPC stores only token hash and is tenant/consent protected', send.includes('growth_queue_proposal_email_with_response') && send.includes('p_response_token_hash: tokenHash') && migration.includes('contact_opted_out_at') && guard.includes('p_response_token_hash is null') && guard.includes('p_response_token_expires_at is null')],
 ['public proposal API hashes token and returns limited proposal fields only', route.includes("createHash('sha256')") && route.includes("select('reference_no,title,summary,line_items,currency,total_amount,valid_until,status,response_token_expires_at')")],
 ['public accept/reject endpoint uses atomic database RPC', route.includes("rpc('growth_respond_to_proposal'")],
 ['response token is one-time, expires and row-locks proposal', migration.includes('for update') && migration.includes('response_token_hash=null') && migration.includes('response_token_expires_at <= v_now') && migration.includes('p_token_hash is null')],
 ['customer acceptance marks CRM lead won and rejection marks lost', migration.includes("then 'won' else 'lost' end")],
 ['customer decision is recorded in CRM activity timeline', migration.includes('growth_lead_activities') && migration.includes('secure_customer_response_link')],
 ['public page has explicit accept and decline actions', page.includes('Accept proposal') && page.includes('Decline proposal')],
 ['proposal delivery remains provider-acceptance gated', worker.includes("delivery_status:'sent'") && worker.includes('provider_message_id:jobResult?.id')],
 ['response routes are public token-based and do not expose customer email', !route.includes('email') && route.includes('validToken(token)')],
];
let failed = 0;
for (const [name, ok] of tests) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failed++; }
console.log(`${tests.length - failed}/${tests.length} customer proposal response checks passed.`);
if (failed) process.exit(1);
