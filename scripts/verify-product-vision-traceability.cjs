const fs=require('fs');
const blueprint=fs.readFileSync('ANAIRA-AI-GROWTH-ENGINE-MASTER-BLUEPRINT-v1.md','utf8');
const trace=fs.readFileSync('PRODUCT-REQUIREMENTS-TRACEABILITY-v6.90.3.md','utf8');
const moduleRows=Array.from({length:15},(_,i)=>new RegExp(`\\|\\s*0?${i+1}\\s*\\|`).test(trace));
const checks=[
 ['dual workspace business model is locked',blueprint.includes('Anaira internal workspace plus customer SaaS workspaces')],
 ['mixed autonomy approval model is locked',blueprint.includes('mixed autonomy')],
 ['all fifteen modules are traceable',moduleRows.every(Boolean)],
 ['outbound native WhatsApp calling implementation and remaining inbound/media gaps are traceable',trace.includes('browser WebRTC SDP offer/answer signaling')&&trace.includes('Inbound call answering')],
 ['Twilio voice and native WhatsApp Calling are distinguished',trace.includes('Twilio voice remains a separate provider path')],
 ['provider certification gaps are explicit',trace.includes('Real provider credentials/OAuth grants/webhooks')||trace.includes('real provider credentials/OAuth grants/webhooks')],
 ['dedicated Growth Engine Supabase target is required',trace.includes('Do not apply these migrations to a database merely because it is a connected Anaira project')],
];
let failed=0;for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)failed++;}
if(failed)process.exit(1);console.log(`${checks.length}/${checks.length} product-vision traceability checks passed.`);
