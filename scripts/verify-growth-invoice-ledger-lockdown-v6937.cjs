const fs=require('fs');
const m='supabase/migrations/20261115120000_growth_invoice_ledger_service_role_lockdown_v6937.sql';
const s=fs.readFileSync(m,'utf8');
const a=fs.readFileSync('scripts/audit-growth-migrations-v6936.cjs','utf8');
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const checks=[
 ['manual payment ledger has RLS enabled',/alter table public\.growth_manual_payments enable row level security/i.test(s)],
 ['invoice ledger has RLS enabled',/alter table public\.growth_invoices enable row level security/i.test(s)],
 ['public, anon and authenticated privileges are revoked',/revoke all on table[\s\S]*from public, anon, authenticated/i.test(s)],
 ['service role receives explicit access',/grant all on table[\s\S]*to service_role/i.test(s)],
 ['billing PII access is documented as server-only',s.includes('platform-authorized API')],
 ['migration is non-destructive',!s.includes('drop table')&&!s.includes('truncate')],
 ['static audit classifies service-role-only tables',a.includes('explicitlyServiceRoleOnlyTables')],
 ['static audit separates policy review from service-role-only tables',a.includes('tablesNeedingPolicyOrPrivilegeReview')],
 ['version is bumped',/^6\.(?:93\.[7-9]|(?:95|96|97|98|99|100|101|102|103|104|105|106|107|108|109|110|111|112|113|114|115|116|117|118|119|120|121|122|123|124)\.\d+)$/.test(pkg.version)],
 ['verifier is included in verify:all',pkg.scripts['verify:all'].includes('verify:growth-invoice-ledger-lockdown-v6937')]
];
let fail=0;for(const [n,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${n}`);if(!ok)fail++;}
if(fail)process.exit(1);console.log(`${checks.length}/${checks.length} invoice ledger hardening checks passed.`);
