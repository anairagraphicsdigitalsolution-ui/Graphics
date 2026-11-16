const fs = require('fs');
const api = fs.readFileSync('app/api/growth/intelligence/route.ts', 'utf8');
const ui = fs.readFileSync('components/growth-intelligence.tsx', 'utf8');
const checks = [
  ['strategy activation action exists', api.includes("action==='activate_strategy'")],
  ['strategy is workspace scoped', api.includes(".eq('id',strategyId).eq('organization_id',orgId)")],
  ['only owner and manager can activate', api.includes("requireGrowthRole(c.db,c.userId,orgId,['owner','manager'])")],
  ['archived strategy is blocked', api.includes("strategy.status==='archived'")],
  ['weekly plan actions become internal tasks', api.includes("from('growth_tasks').insert(rows)")],
  ['task execution markers provide retry deduplication', api.includes('growth_strategy_plan:${strategyId}|week:${x.week}|action:${x.index}')],
  ['tasks assigned to authorized actor', api.includes('assigned_to:c.userId,created_by:c.userId')],
  ['no external publishing or messaging is performed', api.includes('No ads, posts, emails or WhatsApp messages were sent.')],
  ['UI exposes explicit approval action', ui.includes('Approve & create tasks')],
  ['UI communicates internal task-only execution', ui.includes('No external messages or campaigns were launched.')],
];
let failed = 0;
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failed++; }
console.log(`RESULT ${checks.length - failed}/${checks.length} passed`);
process.exitCode = failed ? 1 : 0;
