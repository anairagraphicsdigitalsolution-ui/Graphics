const fs=require('fs');const p='app/api/growth/readiness/route.ts',s=fs.readFileSync(p,'utf8');const checks=[
 ['connected social publishing accounts',s.includes("id:'social_publishing'")],
 ['inbound email routing',s.includes("id:'inbound_email'")],
 ['WhatsApp native calling correctly distinguished from outbound voice',s.includes("id:'whatsapp_calling'")&&s.includes("id:'outbound_voice'")],
 ['prospect discovery provider readiness',s.includes("id:'prospect_discovery'")&&s.includes("GOOGLE_CSE_API_KEY")],
 ['campaign optimization requires ads_read',s.includes("id:'campaign_optimization'")&&s.includes('hasAdsReadScope')],
 ['owner approval retained for spend-changing actions',s.includes('remain approval-gated')],
 ['queued and failed job monitoring',s.includes('queuedOrProcessingJobs')&&s.includes('failedJobs')],
 ['workflow dead-letter monitoring',s.includes('openWorkflowDeadLetters')],
 ['honest incomplete certification state',s.includes("certification:'not_certified'")&&s.includes("completion:'incomplete'")],
 ['data query failures surfaced',s.includes('data_check_required')],
 ['blocker identifiers returned',s.includes('blockingChecks')],
 ['meeting metrics use a defined tenant-scoped result collection',s.includes('meetingRows=meetings||[]')&&s.includes('meetingRows.filter')],
 ['proposal metrics use a defined tenant-scoped result collection',s.includes('proposalRows=proposals||[]')&&s.includes('proposalRows.filter')],
 ['retention query failures affect operational data health',s.includes('proposalsError,retentionError].filter(Boolean)')]
];let failed=0;for(const [n,ok]of checks){console.log(`${ok?'PASS':'FAIL'} ${n}`);if(!ok)failed++;}if(failed)process.exit(1);console.log(`${checks.length}/${checks.length} readiness checks passed.`);
