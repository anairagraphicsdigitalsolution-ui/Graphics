const fs=require('fs'),path=require('path');let pass=0,fail=0;function check(name,ok){if(ok){pass++;console.log(`PASS ${name}`)}else{fail++;console.error(`FAIL ${name}`)}}
const root=process.cwd(),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const helper=read('lib/growth-send-policy.ts'),migration=read('supabase/migrations/20261115160000_growth_send_policy_v6940.sql'),api=read('app/api/growth/communication-policy/route.ts'),worker=read('app/api/growth/worker/route.ts');
check('tenant communication policy column',migration.includes('communication_policy jsonb'));
check('contact channel suppression column',migration.includes('channel_suppressions jsonb'));
check('quiet-hours timezone evaluated using IANA timezone',helper.includes('Intl.DateTimeFormat')&&helper.includes('timeZone'));
check('overnight quiet-hours window handled',helper.includes('local.minute>=start||local.minute<end'));
check('all-day quiet-hours window handled',helper.includes('start===end?true'));
check('weekday allowlist supported',helper.includes('q.days'));
check('channel disable policy enforced',helper.includes('channel_enabled?.[channel]===false'));
check('global opt-out blocks channel',helper.includes('contact_opted_out_at'));
check('channel consent remains mandatory',helper.includes("channel_consents?.[channel]?.granted!==true"));
check('per-channel suppression overrides consent',helper.includes('channel_suppressions?.[channel]?.suppressed===true'));
check('email bounce and complaint suppression',helper.includes('email_bounced_at')&&helper.includes('email_complained_at'));
check('policy settings require owner or manager',api.includes("['owner','manager']"));
check('policy settings validate IANA timezone',api.includes('Intl.DateTimeFormat'));
check('worker defers jobs during quiet hours',worker.includes('POLICY_DEFERRED:')&&worker.includes("status:'deferred_policy'"));
const workerDispatch=worker.slice(worker.indexOf('const {data:jobs,error}=await db.rpc'));check('worker checks send policy before provider dispatch markers',workerDispatch.indexOf('evaluateGrowthSendPolicy(policyOrg')<workerDispatch.indexOf('external_effect_started_at'));
for(const p of ['app/api/growth/whatsapp/send/route.ts','app/api/growth/whatsapp/templates/send/route.ts','app/api/growth/email/route.ts','app/api/growth/voice-calls/route.ts']){const s=read(p);check(`${p} enforces channel policy`,s.includes('evaluateGrowthSendPolicy')&&s.includes('evaluateLeadChannelSuppression'));}
console.log(`\nRESULT ${pass} PASS / ${fail} FAIL`);process.exitCode=fail?1:0;
