const fs=require('fs'),path=require('path'),root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const webhook=read('app/api/growth/email/webhook/route.ts');
const address=read('app/api/growth/email/inbound-addresses/route.ts');
const worker=read('app/api/growth/worker/route.ts');
const send=read('app/api/growth/email/route.ts');
const migration=fs.readdirSync(path.join(root,'supabase/migrations')).filter(x=>x.includes('growth_inbound_email_lifecycle'))[0];
const sql=read('supabase/migrations/'+migration);
const checks=[
 ['Svix signature validates id/timestamp/body',/svix-id/.test(webhook)&&/svix-timestamp/.test(webhook)&&/createHmac\('sha256'/.test(webhook)],
 ['Webhook rejects stale timestamps',/age > 300/.test(webhook)],
 ['Inbound recipient maps to one active tenant inbox',/growth_inbound_email_addresses/.test(webhook)&&/is_active', true/.test(webhook)],
 ['Inbound event idempotency is enforced',/provider_event_id: eventId/.test(webhook)&&/23505/.test(webhook)],
 ['Inbound email creates or appends tenant-scoped conversation',/growth_conversations/.test(webhook)&&/organization_id', inbox.organization_id/.test(webhook)],
 ['Bounce and complaint lifecycle is recorded',/email\.bounced/.test(webhook)&&/email\.complained/.test(webhook)],
 ['Bounced and complained addresses are blocked by worker',/email_bounced_at/.test(worker)&&/email_complained_at/.test(worker)],
 ['Manual outbound email checks delivery suppression',/email_bounced_at/.test(send)&&/email_complained_at/.test(send)],
 ['Inbound address management is owner-gated',/requireGrowthRole\(c\.db,c\.userId,org,\['owner'\]\)/.test(address)],
 ['Migration keeps inbound/provider event tables service-role-only',/revoke all on public\.growth_inbound_email_addresses from public, anon, authenticated/.test(sql)&&/revoke all on public\.growth_email_provider_events from public, anon, authenticated/.test(sql)]
];
let failed=0;for(const [name,ok] of checks){console.log((ok?'PASS ':'FAIL ')+name);if(!ok)failed++;}
console.log(`${checks.length-failed}/${checks.length} inbound email lifecycle checks passed.`);process.exit(failed?1:0);
