const fs=require('fs');
const p='scripts/preflight-growth-production-v6935.cjs';
const s=fs.readFileSync(p,'utf8');
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const checks=[
 ['preflight is read-only and does not apply migrations',!s.includes('supabase db push')&&!s.includes('supabase migration up')],
 ['preflight counts and sorts SQL migrations',s.includes("filter(x => x.endsWith('.sql')).sort()")],
 ['preflight checks lockfile reproducibility',s.includes("lockfilePresent: exists('package-lock.json')")],
 ['preflight checks Next.js dependency and installation',s.includes('nextDependencyDeclared')&&s.includes('nextInstalled')],
 ['preflight checks Supabase URL and public key',s.includes("'NEXT_PUBLIC_SUPABASE_URL'")&&s.includes("'NEXT_PUBLIC_SUPABASE_ANON_KEY'")],
 ['preflight checks service role and cron secret',s.includes("'SUPABASE_SERVICE_ROLE_KEY'")&&s.includes("'CRON_SECRET'")],
 ['preflight never prints environment secret values',s.includes('envNamesFound')&&!s.includes('process.env[')],
 ['preflight marks live database state as unknown unless connected',s.includes("liveDatabaseMigrationStatus: 'unknown_not_connected'")],
 ['preflight does not claim provider certification',s.includes("liveProviderCertification: 'not_run'")],
 ['preflight exits nonzero when release blockers exist',s.includes('process.exitCode = blockers.length ? 2 : 0')],
 ['production preflight command is registered',pkg.scripts['preflight:growth-production']==='node scripts/preflight-growth-production-v6935.cjs'],
 ['preflight verifier is part of verify:all',pkg.scripts['verify:all'].includes('verify:growth-production-preflight-v6935')],
];
let failed=0;for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)failed++;}
if(failed)process.exit(1);console.log(`${checks.length}/${checks.length} production preflight assertions passed.`);
