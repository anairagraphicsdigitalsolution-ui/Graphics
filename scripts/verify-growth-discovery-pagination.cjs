const fs=require('fs');
const s=fs.readFileSync('app/api/growth/prospect-discovery/route.ts','utf8');
const checks=[
 ['discovery result limit is bounded to 1–50',s.includes('requested<1||requested>50')],
 ['Google CSE pagination uses start offsets',s.includes("url.searchParams.set('start',String(start))")&&s.includes('start+=10')],
 ['each CSE page requests at most ten results',s.includes("url.searchParams.set('num',String(Math.min(10,requested-start+1)))")],
 ['discovery run is persisted before provider requests',s.indexOf("from('growth_prospect_discovery_runs').insert")<s.indexOf("fetch(url,{cache:'no-store'})")],
 ['provider failure marks the run failed',s.includes("status:'failed'")&&s.includes('error_message:clean(payload.error?.message')],
 ['same domain is deduplicated within a run',s.includes('seenDomains.has(domain)')],
 ['existing tenant prospect is checked by normalized domain',s.includes("eq('website_domain',domain)")],
 ['new prospects remain without assumed contact consent',s.includes('consent_to_contact:false')],
 ['discovery returns requested and saved counters',s.includes('requested,maxResults:requested,discovered:items.length,saved,duplicates,skipped')],
];
let failed=0;for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)failed++;}if(failed)process.exit(1);
console.log(`${checks.length-failed}/${checks.length} discovery pagination checks passed.`);
