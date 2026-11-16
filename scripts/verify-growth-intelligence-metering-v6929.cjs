const fs = require('fs');
const route = fs.readFileSync('app/api/growth/intelligence/route.ts', 'utf8');
const checks = [
  ['AI Intelligence imports atomic workspace quota service', /consumeGrowthQuota,quotaErrorMessage/.test(route)],
  ['AI Intelligence imports token cost estimator', /estimateOpenAICost/.test(route)],
  ['AI calls consume tenant ai_messages quota before provider request', /consumeGrowthQuota\(db,orgId,'ai_messages',1,undefined,\{operation:'growth_intelligence_ai',model\}\)/.test(route)],
  ['Quota denial blocks provider call with quota-aware HTTP status', /if\(!quota\.allowed\)throw new GrowthIntelligenceError\(quotaErrorMessage\(quota\),quota\.reason==='quota_exceeded'\?402:503\)/.test(route)],
  ['Provider request has a bounded timeout', /signal:AbortSignal\.timeout\(30000\)/.test(route)],
  ['Provider token usage is written to tenant usage ledger', /growth_usage_logs'\)\.insert\(\{organization_id:orgId,provider:'openai',model,operation:'growth_intelligence_ai',input_units:usage\.prompt_tokens\|\|0,output_units:usage\.completion_tokens\|\|0/.test(route)],
  ['Estimated cost is recorded', /estimated_cost:estimateOpenAICost\(model,usage\.prompt_tokens\|\|0,usage\.completion_tokens\|\|0\)/.test(route)],
  ['Quota errors return their specific HTTP status', /e instanceof GrowthIntelligenceError\?e\.status:500/.test(route)],
  ['Usage log failure is visible in server logs', /\[growth-intelligence\] Usage log insert failed/.test(route)],
  ['Strategy and follow-up share the metered AI helper', (route.match(/aiJson\(c\.db,orgId,/g)||[]).length >= 2],
  ['External campaign launch remains absent from this helper', !/campaigns\.insert|publish_content|send_whatsapp/.test(route)],
];
let failed = 0;
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failed++; }
console.log(`RESULT ${checks.length - failed}/${checks.length} passed`);
process.exitCode = failed ? 1 : 0;
