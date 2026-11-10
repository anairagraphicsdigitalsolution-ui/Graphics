const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const sql = fs.readFileSync(path.join(root, 'supabase/migrations/20261109160834_growth_security_and_fk_index_hardening_v6757.sql'), 'utf8');
const expected = [
  'growth_ad_activation_audit_campaign_draft_idx','growth_ad_drafts_adset_draft_idx',
  'growth_ad_drafts_creative_draft_idx','growth_adset_drafts_campaign_draft_idx',
  'growth_conversations_assigned_to_idx','growth_leads_assigned_to_idx',
  'growth_oauth_states_organization_idx','growth_oauth_states_user_idx',
  'growth_tasks_assigned_to_idx','growth_tasks_created_by_idx',
  'growth_webhook_events_organization_idx','growth_workflow_runs_lead_idx',
  'growth_workflow_runs_rule_idx'
];
let failed = 0;
for (const name of expected) {
  const ok = sql.includes(`create index if not exists ${name}`);
  console.log(`${ok ? 'PASS' : 'FAIL'} FK index migration includes ${name}`);
  if (!ok) failed++;
}
const checks = [
  ['anonymous role cannot execute Anaira admin helper', sql.includes('revoke all on function public.is_anaira_admin() from public, anon')],
  ['authenticated role retains RLS helper execution', sql.includes('grant execute on function public.is_anaira_admin() to authenticated, service_role')],
  ['event trigger helper is not exposed to app roles', sql.includes('revoke all on function public.rls_auto_enable() from public, anon, authenticated')]
];
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed++; }
process.exitCode = failed ? 1 : 0;
