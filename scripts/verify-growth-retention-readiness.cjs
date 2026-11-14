const fs = require('fs');
const readiness = fs.readFileSync('app/api/growth/readiness/route.ts', 'utf8');
const migration = fs.readFileSync('supabase/migrations/20261113174852_growth_customer_retention_task_index_v6898.sql', 'utf8');
const checks = [
  ['readiness endpoint checks retention task query', readiness.includes("in('task_type',['retention','renewal','feedback','review'])")],
  ['readiness exposes customer retention operational state', readiness.includes("id:'customer_retention'")],
  ['readiness counts open, overdue and completed retention tasks', ['retentionTasksOpen','retentionTasksOverdue','retentionTasksCompleted'].every(x => readiness.includes(x))],
  ['retention query errors contribute to readiness data check', readiness.includes('retentionError')],
  ['retention partial index is workspace/task/status/due scoped', migration.includes('organization_id, task_type, status, due_at') && migration.includes("'review'")],
];
let failed = 0;
for (const [name, pass] of checks) { console.log(`${pass ? 'PASS' : 'FAIL'} ${name}`); if (!pass) failed++; }
console.log(`${checks.length - failed}/${checks.length} retention readiness checks passed`);
process.exit(failed ? 1 : 0);
