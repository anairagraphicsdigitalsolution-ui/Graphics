const fs=require('fs');const path=require('path');let pass=0,fail=0;function check(n,v){if(v){pass++;console.log(`PASS ${n}`)}else{fail++;console.error(`FAIL ${n}`)}}
const root=process.cwd();const worker=fs.readFileSync(path.join(root,'app/api/growth/worker/route.ts'),'utf8');const verify=fs.readFileSync(path.join(root,'app/api/growth/prospect-verification/route.ts'),'utf8');const ads=fs.readFileSync(path.join(root,'app/api/growth/ads-autopilot/route.ts'),'utf8');const schedules=fs.readFileSync(path.join(root,'app/api/growth/autonomous-schedules/route.ts'),'utf8');const scheduleUi=fs.readFileSync(path.join(root,'components/growth-autonomous-schedules.tsx'),'utf8');
check('Meta scheduled analysis retains ads_read requirement',worker.includes("includes('ads_read')"));
check('autonomous pausing is explicit opt-in',worker.includes('config.autoPauseNoConversions===true'));
check('auto-pause requires ads_management scope',worker.includes("includes('ads_management')"));
check('auto-pause requires positive spend threshold',worker.includes('minSpend>0'));
check('auto-pause requires spend and impression thresholds',worker.includes('cur.spend>=minSpend&&cur.impressions>=minImpressions&&cur.conversions===0'));
check('auto-pause only sets PAUSED state',worker.includes("new URLSearchParams({status:'PAUSED',access_token:String(credentials.access_token)})"));
check('worker never auto-increases ad budget',worker.includes("budgetIncreases:'never automatic'"));
check('worker never auto-resumes ads',worker.includes("resume:'never automatic'"));
check('email mailbox provider is optional and server-side',verify.includes('ZEROBOUNCE_API_KEY')&&verify.includes('api.zerobounce.net'));
check('phone line intelligence provider is optional and server-side',verify.includes('TWILIO_ACCOUNT_SID')&&verify.includes('lookups.twilio.com/v2/PhoneNumbers'));
check('verification records provider and result evidence',verify.includes('mailbox')&&verify.includes('lookup')&&verify.includes('verification_evidence'));
check('verification never implies consent',verify.includes('does not prove')&&verify.includes('contact consent'));
check('phone lookup requires explicit E.164 country code',verify.includes('requires_e164')&&verify.includes("phone.startsWith('+')"));
check('auto-pause schedule config validates hard thresholds',schedules.includes('autoPauseMinSpend')&&schedules.includes('autoPauseMinImpressions'));
check('auto-pause requires ads_management permission at schedule creation',schedules.includes("config.autoPauseNoConversions===true&&!account.scopes.includes('ads_management')"));
check('schedule UI exposes opt-in pause thresholds and describes restrictions',scheduleUi.includes('Enable guarded auto-pause')&&scheduleUi.includes('never raises budgets'));

check('Meta ad creation remains paused until explicit activation',ads.includes("status:'PAUSED'")&&ads.includes('activationRequired:true'));
console.log(`\n${pass} PASS / ${fail} FAIL`);process.exit(fail?1:0);
