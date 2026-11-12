const fs=require('fs'),path=require('path');
const read=p=>fs.readFileSync(path.join(process.cwd(),p),'utf8');
const checks=[
 ['SEO scan route exists',fs.existsSync('app/api/growth/website-intelligence/route.ts')],
 ['Owner/manager permission enforced',read('app/api/growth/website-intelligence/route.ts').includes("['owner','manager']")],
 ['Verified ownership required',read('app/api/growth/website-intelligence/route.ts').includes("site.verification_status!=='verified'")],
 ['Private IP ranges blocked',read('app/api/growth/website-intelligence/route.ts').includes('privateIp')],
 ['HTML metadata extraction',read('app/api/growth/website-intelligence/route.ts').includes("tags(html,'title')")],
 ['SEO checks persisted',read('app/api/growth/website-intelligence/route.ts').includes("from('growth_website_audits').insert")],
 ['Audit history API',read('app/api/growth/website-intelligence/route.ts').includes("from('growth_website_audits')")],
 ['Premium dashboard page',fs.existsSync('app/admin/ai-growth/website-intelligence/page.tsx')],
 ['Navigation link',read('components/growth-primary-nav.tsx').includes('/admin/ai-growth/website-intelligence')],
 ['Database migration exists',fs.existsSync('supabase/migrations/20261112200000_growth_website_intelligence_v1.sql')]
];
let failed=0;for(const [name,ok] of checks){console.log((ok?'PASS':'FAIL')+' '+name);if(!ok)failed++;}console.log(`${checks.length-failed}/${checks.length} passed`);process.exitCode=failed?1:0;
