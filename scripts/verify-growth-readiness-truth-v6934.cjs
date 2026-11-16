const fs=require('fs');const p='app/api/growth/readiness/route.ts',s=fs.readFileSync(p,'utf8');const checks=[
 ['outbound WhatsApp signaling distinguished from production certification',s.includes('Outbound browser WebRTC signaling and permission-gated session initiation are present in source')],
 ['inbound WhatsApp calling remains explicitly outstanding',s.includes('Inbound answering')],
 ['production TURN/media reliability remains outstanding',s.includes('production TURN/media reliability')],
 ['Meta live call certification remains outstanding',s.includes('live Meta call certification')],
 ['Twilio voice is not mislabeled as native WhatsApp Calling',s.includes('not native WhatsApp Calling')],
 ['configuration readiness is not represented as live verification',s.includes("verificationStatus:'not_live_verified'")],
 ['verification note requires a live consented E2E test',s.includes('live, consented end-to-end test')],
 ['provider tests explicitly not run in readiness response',s.includes("liveProviderTests:'not_run'")],
 ['browser E2E explicitly not run in readiness response',s.includes("browserEndToEnd:'not_run'")],
 ['tenant isolation explicitly not run in readiness response',s.includes("tenantIsolation:'not_run'")],
 ['production build not silently certified',s.includes("productionBuild:'not_verified'")],
 ['certification remains not certified and incomplete',s.includes("certification:'not_certified'")&&s.includes("completion:'incomplete'")]
];let failed=0;for(const [n,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${n}`);if(!ok)failed++;}if(failed)process.exit(1);console.log(`${checks.length}/${checks.length} readiness truth checks passed.`);
