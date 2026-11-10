const fs=require('fs');
const route=fs.readFileSync('app/api/growth/lead/route.ts','utf8');
const widget=fs.readFileSync('components/ai-sales-chat.tsx','utf8');
const checks=[
 ['lead capture no longer hardcodes Anaira tenant slug',!route.includes("eq('slug','anaira-graphics-digital-solution')")],
 ['conversation ID resolves authoritative organization',route.includes("select('id,organization_id').eq('id',conversationId)")],
 ['conversation and supplied slug mismatch is rejected',route.includes('Conversation and workspace do not match.')],
 ['first-contact form requires a valid public tenant slug',route.includes('A valid workspace slug is required.')],
 ['inactive tenants cannot receive public leads',route.includes("eq('status','active')")],
 ['lead workflow starts in the resolved tenant',route.includes('runLeadCreatedRules(db,org.id')],
 ['chat widget accepts a configurable organization slug',widget.includes("organizationSlug='anaira-graphics-digital-solution'")],
 ['chat widget passes tenant slug to chat API',widget.includes('slug:organizationSlug')],
 ['chat widget passes tenant slug to lead capture',widget.includes('slug:organizationSlug,conversationId')],
];
let failed=0;for(const [label,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${label}`);if(!ok)failed++;}
if(failed)process.exit(1);
