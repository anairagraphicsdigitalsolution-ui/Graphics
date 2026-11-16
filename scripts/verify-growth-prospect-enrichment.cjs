const fs=require('fs');
const source=fs.readFileSync('lib/growth-prospect-enrichment.ts','utf8');
const verification=fs.readFileSync('app/api/growth/prospect-verification/route.ts','utf8');
const checks=[
 ['rejects non-HTTPS prospect URLs',source.includes("origin.protocol!=='https:'")],
 ['rejects URL credentials',source.includes('origin.username||origin.password')],
 ['rejects IP-literal hosts',source.includes('isIP(host)')],
 ['rejects localhost and local domains',source.includes("host==='localhost'")&&source.includes("host.endsWith('.local')")],
 ['checks all DNS answers for public addresses',source.includes("lookup(host,{all:true})")&&source.includes('addresses.some(a=>!isPublicIp(a.address))')],
 ['rechecks DNS for each page',source.includes('pageAddresses.some(a=>!isPublicIp(a.address))')],
 ['does not follow redirects',source.includes("redirect:'manual'")],
 ['rejects cross-host page targets',source.includes('targetUrl.hostname.toLowerCase()!==host')],
 ['requires HTML content type',source.includes("type.toLowerCase().includes('text/html')")],
 ['enforces streaming response byte limit',source.includes('reader.read()')&&source.includes('total>maxBytes')],
 ['cancels oversized response streams',source.includes('await reader.cancel()')],
 ['caps HTML body at 750 KB',source.includes('const MAX_HTML_BYTES=750_000')],
 ['uses request abort timeout',source.includes('controller.abort()')],
 ['verification checks run concurrently',verification.includes('Promise.all([')],
 ['verification route has a deployment duration budget',verification.includes('maxDuration = 45')],
 ['MX and mailbox checks are sequential within one bounded branch',verification.includes('const mx = await checkMx(email)')&&verification.includes('const mailbox = await verifyMailbox(email')],
];
let failed=0;for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)failed++;}
if(failed)process.exit(1);console.log(`${checks.length}/${checks.length} prospect enrichment security checks passed.`);
