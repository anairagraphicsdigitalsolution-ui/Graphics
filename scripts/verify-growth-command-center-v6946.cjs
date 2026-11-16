const fs = require('node:fs');
const dashboard = fs.readFileSync('components/growth-dashboard.tsx', 'utf8');
const commandCenter = fs.readFileSync('components/growth-command-center.tsx', 'utf8');
const analytics = fs.readFileSync('app/api/growth/analytics/route.ts', 'utf8');
const briefing = fs.readFileSync('components/growth-daily-briefing.tsx', 'utf8');
const checks = [
  ['overview mounts the workspace Command Center', dashboard.includes('<GrowthCommandCenter organizationId={active.id}/>')],
  ['Command Center is tenant-bound by active organization ID', commandCenter.includes('organizationId={organizationId}') && commandCenter.includes('encodeURIComponent(organizationId)')],
  ['analytics request uses authenticated bearer session', commandCenter.includes('Authorization: `Bearer ${session.access_token}`')],
  ['Command Center refresh is user-operable and loading-aware', commandCenter.includes('onClick={() => void refresh()}') && commandCenter.includes('disabled={loading}')],
  ['KPI display includes leads, qualified, won, overdue, content and campaigns', ['data.leads?.total','data.leads?.qualified','data.leads?.won','data.tasks?.overdue','data.content?.total','data.campaigns?.total'].every(x => commandCenter.includes(x))],
  ['data quality and truncation warnings are visible', commandCenter.includes('dataQuality?.complete') && commandCenter.includes('truncatedSources')],
  ['CPL, CAC and ROAS are not fabricated', commandCenter.includes('remain unavailable until spend and revenue are reconciled')],
  ['attribution revenue is shown grouped by currency', commandCenter.includes('revenueByCurrency') && commandCenter.includes('Object.entries')],
  ['AI briefing and actionable priorities are mounted in Command Center', commandCenter.includes('<GrowthDailyBriefing organizationId={organizationId} />') && briefing.includes('Priority actions')],
  ['analytics endpoint enforces authenticated workspace role', analytics.includes('growthContext(req)') && analytics.includes('requireGrowthRole')],
  ['analytics endpoint scopes source queries to the active tenant', analytics.includes(".eq('organization_id', organizationId)")],
  ['analytics endpoint reports truncation rather than silently hiding the safety cap', analytics.includes('truncatedSources') && analytics.includes('dataQuality')],
];
let failed = 0;
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed++; }
console.log(`${checks.length - failed}/${checks.length} Command Center checks passed`);
process.exitCode = failed ? 1 : 0;
