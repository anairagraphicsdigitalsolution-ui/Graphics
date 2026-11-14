const fs = require('fs');
const route = fs.readFileSync('app/api/growth/retention/route.ts', 'utf8');
const ui = fs.readFileSync('components/growth-crm-retention.tsx', 'utf8');
const crm = fs.readFileSync('components/growth-crm.tsx', 'utf8');
const tasks = fs.readFileSync('app/api/growth/task/route.ts', 'utf8');
const checks = [
  ['retention route requires authenticated workspace context', route.includes('growthContext(req)')],
  ['retention data is workspace and lead scoped', route.includes(".eq('organization_id', organizationId)") && route.includes(".eq('lead_id', leadId)")],
  ['retention planner is only available for Won customers', route.includes("lead.status !== 'won'")],
  ['retention task kinds cover relationship, renewal, feedback and review', ['retention','renewal','feedback','review'].every(x => route.includes(`'${x}'`))],
  ['retention task creation requires manager/editor permission', route.includes("['owner', 'manager', 'editor']")],
  ['retention assignee must belong to the same workspace', route.includes(".eq('organization_id', organizationId).eq('user_id', requestedAssignee)")],
  ['retention task creation writes to CRM timeline', route.includes("activity_type: 'note'") && route.includes('retention_task_id')],
  ['retention status updates are workspace scoped and type limited', route.includes(".eq('id', taskId).eq('organization_id', organizationId).in('task_type'")],
  ['retention API does not call WhatsApp, email or voice providers', !/fetch\(['"`]https:\/\/.*(graph\.facebook|api\.resend|twilio)/i.test(route)],
  ['retention UI explicitly displays contact policy and no-send behavior', ui.includes('Internal tasks only') && ui.includes('No active contact consent')],
  ['retention UI supports reminders, tasks and completion', ui.includes('Create retention reminder') && ui.includes("updateTask(task.id, 'done')")],
  ['CRM renders retention planner for Won customers only', crm.includes("active.status==='won'&&<GrowthCRMRetention")],
  ['existing general CRM tasks remain compatible', tasks.includes("'review'") && tasks.includes("'follow_up'")],
];
let failed = 0;
for (const [name, pass] of checks) { console.log(`${pass ? 'PASS' : 'FAIL'} ${name}`); if (!pass) failed++; }
console.log(`${checks.length - failed}/${checks.length} customer retention checks passed`);
process.exit(failed ? 1 : 0);
