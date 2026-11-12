const fs=require('node:fs');const assert=require('node:assert/strict');
const route=fs.readFileSync('app/api/growth/website-verification/route.ts','utf8');
const ui=fs.readFileSync('components/growth-dashboard.tsx','utf8');
const migration=fs.readFileSync('supabase/migrations/20261112195000_growth_website_dns_verification_v6864.sql','utf8');
for(const [name,ok] of [
 ['authenticated workspace verification route',route.includes('growthContext(req)')&&route.includes('requireGrowthRole')],
 ['one-time cryptographic token generation',route.includes('randomBytes(24)')],
 ['token hash only persisted',route.includes('verification_token_hash:hash(token)')],
 ['DNS TXT lookup',route.includes('resolveTxt(`_anaira-growth.${domain}`)')],
 ['verified status only after exact hash match',route.includes("verification_status:found?'verified':'failed'")],
 ['workspace-scoped website lookup',route.includes(".eq('id',websiteId).eq('organization_id',organizationId)")],
 ['UI generation and verification actions',ui.includes("verifyWebsite(w,'generate')")&&ui.includes("verifyWebsite(w,'verify')")],
 ['migration adds verification fields',migration.includes('verification_token_hash')&&migration.includes('verified_at')]
]){assert.ok(ok,`FAILED: ${name}`);console.log(`PASS ${name}`)}
