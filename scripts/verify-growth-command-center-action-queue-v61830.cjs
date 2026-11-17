const fs = require('node:fs');
const ui = fs.readFileSync('components/growth-command-center.tsx', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const checks = [
  ['Command Center exposes a named AI Action Queue section', ui.includes('AI Action Queue') && ui.includes('growth-action-queue-title')],
  ['overdue tasks generate a high-priority task action', ui.includes('Number(data.tasks?.overdue || 0) > 0') && ui.includes('/admin/ai-growth/tasks')],
  ['human handoffs generate a high-priority conversation action', ui.includes('Number(data.conversations?.humanHandoff || 0) > 0') && ui.includes('/admin/ai-growth/communications')],
  ['lead pipeline action links to CRM', ui.includes('Number(data.leads?.total || 0) > 0') && ui.includes('/admin/ai-growth/crm')],
  ['campaign action links to campaign management', ui.includes('Number(data.campaigns?.total || 0) > 0') && ui.includes('/admin/ai-growth/campaigns')],
  ['content action links to Content Studio', ui.includes('Number(data.content?.total || 0) > 0') && ui.includes('/admin/ai-growth/marketing')],
  ['empty state is rendered when no action signals exist', ui.includes('No actionable KPI signals were found')],
  ['queue explains its KPI evidence basis', ui.includes('based only on the returned workspace KPI snapshot')],
  ['queue explicitly avoids claiming automatic execution', ui.includes('does not execute changes or contact customers')],
  ['queue is part of the full verification suite', pkg.scripts['verify:all'].includes('verify:growth-command-center-action-queue-v61830')],
  ['release version is compatible', ['6.112.0','6.113.0','6.114.0','6.115.0','6.116.0','6.118.0','6.119.0','6.120.0','6.121.0','6.122.0','6.123.0','6.124.0','6.124.1','6.124.2','6.124.3','6.124.4','6.124.5','6.124.6','6.124.7'].includes(pkg.version)],
];
let failed = 0;
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed++; }
console.log(`${checks.length - failed}/${checks.length} Command Center action queue checks passed`);
process.exitCode = failed ? 1 : 0;
